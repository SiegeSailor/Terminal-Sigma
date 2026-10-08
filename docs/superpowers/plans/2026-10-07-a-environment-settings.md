# Environment Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users see and change every environment variable Terminal Sigma reads from a new **Environment** menu item, saved to a private `config.json`, with the shell's own variables always winning.

**Architecture:** A registry in `source/config.ts` lists every variable with its group, whether it is a secret, whether it needs a restart, and a parser. On start, `applyConfig` copies saved values into `process.env` only where the shell left them unset, so every existing `process.env` read keeps working unchanged. The view edits the registry's variables, writes `config.json` (mode 600, validate → temp → rename, like `progress.json`), and updates the live environment object. `App` receives that environment as a prop so tests never touch the real one.

**Tech Stack:** TypeScript 6, Ink 7, `@inkjs/ui` 2 (`TextInput`, `PasswordInput`), zod 4, AVA 7, ink-testing-library 4.

**Spec:** [`2026-10-07-roadmap.md`](./2026-10-07-roadmap.md), section "Plan A".

## Global Constraints

- Every user-facing string goes into all 3 languages in `source/i18n.ts`; the `Messages` type rejects a missing key
- Every user action appends an event through `withEvent`, with its text under `events` in all 3 languages
- An event names a variable, never its value: secrets must never reach `progress.json`, the logs, or the footer
- `config.json` is validated before it is written, written to `config.json.tmp` with mode `0o600`, then renamed; an unreadable one is refused, never overwritten
- A variable set by the shell always wins over a saved one
- Tests pass `App` a temporary `file`, a temporary `configFile`, and their own `env` object; they never read or write the real `~/.terminal-sigma` or `process.env`
- xo runs the React compiler rules: `react-hooks/purity` rejects `Date.now()` during render, and `react-hooks/immutability` rejects assigning to a prop, such as `env`, inside a component
- `npm test` (Prettier, xo, AVA) passes after every task; commit messages follow Conventional Commits and the `conventional-commit` skill

## Review Focus

- A saved `TERMINAL_SIGMA_HOME` that points at a missing folder: `progress.json` is created there on the first save, and `config.json` stays in the default folder so the setting is never lost
- A shell variable with an invalid value such as `TERMINAL_SIGMA_FOCUS=abc`: the CLI prints the zod error and exits 2 instead of starting with `NaN` minutes
- Pasting a 100-character API key into the secret field: the value is masked on screen and saved whole
- Clearing a variable the shell also sets: the shell value stays in effect and keeps showing as "shell"
- A hand-edited `config.json` with unknown variable names: it still loads, and the unknown names are ignored rather than applied

---

### Task 1: The Variable Registry and `config.json`

**Files:**

- Create: `source/config.ts`
- Test: `source/tests/config.test.ts`

**Interfaces:**

- Consumes: `parseWholeNumber(text, minimum, maximum)` and `progressFile()` from `source/progress.ts`
- Produces:
  - `variableGroups: readonly ["data", "timer", "display", "quotes"]`, `type VariableGroup`
  - `type Variable = { name: string; group: VariableGroup; isSecret: boolean; needsRestart: boolean; parse: (text: string) => string | undefined }`
  - `variables` (readonly tuple), `type VariableName`, `variableOf(name: string)` returning the registry entry (its `name` typed as `VariableName`) or `undefined`
  - `type Environment = Record<string, string | undefined>`
  - `configSchema`, `type Config = { env: Record<string, string> }`
  - `configFile(): string`, `loadConfig(file: string): Config`, `saveConfig(file: string, config: Config): void`
  - `applyConfig(config: Config, env?: Environment): void`
  - `type Source = "shell" | "saved" | "default"`, `sourceOf(name: VariableName, config: Config, env: Environment): Source`
  - `maskSecret(value: string): string`, `isReducedMotion(env?: Environment): boolean`, `timerOptionsOf(env?: Environment): { focus?: number; break?: number }`
  - `withVariable(config: Config, name: VariableName, value: string | undefined): Config`
  - `writeVariable(env: Environment, name: VariableName, value: string | undefined): void` — sets or deletes 1 live variable; components call it because xo's `react-hooks/immutability` rejects assigning to a prop inside a component

- [ ] **Step 1: Write the failing tests**

```ts
// source/tests/config.test.ts
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import test from "ava";
import {
	applyConfig,
	type Config,
	isReducedMotion,
	loadConfig,
	maskSecret,
	saveConfig,
	sourceOf,
	timerOptionsOf,
	variableOf,
	variables,
	withVariable,
	writeVariable,
} from "../config.js";

const temporaryFile = () =>
	path.join(mkdtempSync(path.join(tmpdir(), "terminal-sigma-")), "config.json");

const saved: Config = {
	env: { API_NINJAS_KEY: "ninja-key-123456", TERMINAL_SIGMA_FOCUS: "50" },
};

test("starts empty and round-trips, readable only by the owner", (t) => {
	const file = temporaryFile();

	t.deepEqual(loadConfig(file), { env: {} });
	saveConfig(file, saved);
	t.deepEqual(loadConfig(file), saved);

	if (process.platform !== "win32") {
		t.is(statSync(file).mode & 0o777, 0o600);
	}
});

test("refuses an unreadable config without touching it", (t) => {
	const file = temporaryFile();
	writeFileSync(file, "{ nope");

	t.throws(() => loadConfig(file), { message: /unreadable/v });
	t.is(readFileSync(file, "utf8"), "{ nope");
});

test("fills in only what the shell left unset, and only known names", (t) => {
	const env: Record<string, string | undefined> = {
		TERMINAL_SIGMA_FOCUS: "30",
	};
	applyConfig({ env: { ...saved.env, UNKNOWN_NAME: "x" } }, env);

	t.is(env.TERMINAL_SIGMA_FOCUS, "30", "the shell wins");
	t.is(env.API_NINJAS_KEY, "ninja-key-123456");
	t.is(env.UNKNOWN_NAME, undefined);
	t.is(sourceOf("TERMINAL_SIGMA_FOCUS", saved, env), "shell");
	t.is(sourceOf("API_NINJAS_KEY", saved, env), "saved");
	t.is(sourceOf("TERMINAL_SIGMA_BREAK", saved, env), "default");
});

test("parses each variable, rejecting what it cannot use", (t) => {
	const parse = (name: string, text: string) => variableOf(name)?.parse(text);

	t.is(parse("TERMINAL_SIGMA_FOCUS", " 45 "), "45");
	t.is(parse("TERMINAL_SIGMA_FOCUS", "0"), undefined);
	t.is(parse("TERMINAL_SIGMA_FOCUS", "abc"), undefined);
	t.is(parse("TERMINAL_SIGMA_MOTION", "reduced"), "reduced");
	t.is(parse("TERMINAL_SIGMA_MOTION", "slow"), undefined);
	t.is(parse("TERMINAL_SIGMA_HOME", "relative/folder"), undefined);
	t.is(parse("TERMINAL_SIGMA_HOME", "/tmp/sigma"), "/tmp/sigma");
	t.is(parse("API_NINJAS_KEY", "   "), undefined);
	t.true(
		variables.every(
			(variable) => variable.name === variable.name.toUpperCase(),
		),
	);
});

test("masks secrets and reads the timer and motion", (t) => {
	t.is(maskSecret("sk-1234567890abcd"), "••••abcd");
	t.is(maskSecret("short"), "••••");
	t.deepEqual(timerOptionsOf({ TERMINAL_SIGMA_FOCUS: "50" }), { focus: 50 });
	t.deepEqual(timerOptionsOf({}), {});
	t.true(isReducedMotion({ TERMINAL_SIGMA_MOTION: "reduced" }));
	t.false(isReducedMotion({}));
});

test("sets and clears 1 variable without touching the rest", (t) => {
	t.deepEqual(withVariable(saved, "TERMINAL_SIGMA_FOCUS", undefined).env, {
		API_NINJAS_KEY: "ninja-key-123456",
	});
	t.deepEqual(withVariable({ env: {} }, "TERMINAL_SIGMA_BREAK", "10").env, {
		TERMINAL_SIGMA_BREAK: "10",
	});

	const env: Record<string, string | undefined> = { API_NINJAS_KEY: "old" };
	writeVariable(env, "TERMINAL_SIGMA_FOCUS", "40");
	writeVariable(env, "API_NINJAS_KEY", undefined);
	t.deepEqual(env, { TERMINAL_SIGMA_FOCUS: "40" });
	t.false("API_NINJAS_KEY" in env, "deleted, not set to undefined");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run build`
Expected: FAIL — `tsc` reports `Cannot find module '../config.js'`.

- [ ] **Step 3: Write the implementation**

```ts
// source/config.ts
import {
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import process from "node:process";
import zod from "zod";
import { parseWholeNumber, progressFile } from "./progress.js";

export const variableGroups = ["data", "timer", "display", "quotes"] as const;
export type VariableGroup = (typeof variableGroups)[number];

export type Variable = Readonly<{
	name: string;
	group: VariableGroup;
	isSecret: boolean;
	// Read once on start, so a change shows only after a restart.
	needsRestart: boolean;
	// The value to store, or undefined when the text is not allowed.
	parse: (text: string) => string | undefined;
}>;

export type Environment = Record<string, string | undefined>;

const textFrom = (text: string) => text.trim() || undefined;

const minutesFrom = (text: string) => {
	const value = parseWholeNumber(text, 1, 180);
	return value === undefined ? undefined : String(value);
};

const folderFrom = (text: string) => {
	const folder = text.trim().replace(/^~(?=$|[\\/])/v, homedir());
	return folder && path.isAbsolute(folder) ? folder : undefined;
};

export const variables = [
	{
		name: "TERMINAL_SIGMA_HOME",
		group: "data",
		isSecret: false,
		needsRestart: true,
		parse: folderFrom,
	},
	{
		name: "TERMINAL_SIGMA_FOCUS",
		group: "timer",
		isSecret: false,
		needsRestart: true,
		parse: minutesFrom,
	},
	{
		name: "TERMINAL_SIGMA_BREAK",
		group: "timer",
		isSecret: false,
		needsRestart: true,
		parse: minutesFrom,
	},
	{
		name: "TERMINAL_SIGMA_MOTION",
		group: "display",
		isSecret: false,
		needsRestart: false,
		parse: (text: string) =>
			["full", "reduced"].find((value) => value === text.trim()),
	},
	{
		name: "API_NINJAS_KEY",
		group: "quotes",
		isSecret: true,
		needsRestart: false,
		parse: textFrom,
	},
] as const satisfies readonly Variable[];

export type VariableName = (typeof variables)[number]["name"];

export const variableOf = (name: string) =>
	variables.find((variable) => variable.name === name);

export const configSchema = zod.object({
	env: zod.record(zod.string(), zod.string()).default({}),
});

export type Config = zod.infer<typeof configSchema>;

// Beside progress.json, located before a saved TERMINAL_SIGMA_HOME applies,
// so moving the data folder never moves the setting that moved it.
export const configFile = () =>
	path.join(path.dirname(progressFile()), "config.json");

export function loadConfig(file: string): Config {
	if (!existsSync(file)) {
		return configSchema.parse({});
	}

	try {
		return configSchema.parse(JSON.parse(readFileSync(file, "utf8")));
	} catch (error) {
		throw new Error(
			`${file} is unreadable, so Terminal-Sigma will not touch it. Fix or move it, then restart.\n${String(error)}`,
			{ cause: error },
		);
	}
}

export function saveConfig(file: string, config: Config) {
	mkdirSync(path.dirname(file), { recursive: true });
	const valid = configSchema.parse(config);
	const temporary = `${file}.tmp`;
	// Keys live here, so only the owner may read it.
	writeFileSync(temporary, `${JSON.stringify(valid, null, "\t")}\n`, {
		mode: 0o600,
	});
	chmodSync(temporary, 0o600);
	renameSync(temporary, file);
}

// A saved value fills in only what the shell left unset, so the shell wins.
export function applyConfig(config: Config, env: Environment = process.env) {
	for (const { name } of variables) {
		const saved = config.env[name];

		if (saved !== undefined && !env[name]) {
			env[name] = saved;
		}
	}
}

export type Source = "shell" | "saved" | "default";

export function sourceOf(
	name: VariableName,
	config: Config,
	env: Environment,
): Source {
	const value = env[name];

	if (!value) {
		return "default";
	}

	return value === config.env[name] ? "saved" : "shell";
}

export function withVariable(
	config: Config,
	name: VariableName,
	value: string | undefined,
): Config {
	const rest = Object.fromEntries(
		Object.entries(config.env).filter(([key]) => key !== name),
	);
	return {
		...config,
		env: value === undefined ? rest : { ...rest, [name]: value },
	};
}

// Sets or deletes 1 live variable. It lives outside every component, because
// xo's react-hooks/immutability rejects assigning to a prop inside one.
export function writeVariable(
	env: Environment,
	name: VariableName,
	value: string | undefined,
) {
	if (value === undefined) {
		Reflect.deleteProperty(env, name);
	} else {
		env[name] = value;
	}
}

export const maskSecret = (value: string) =>
	value.length >= 12 ? `••••${value.slice(-4)}` : "••••";

export const isReducedMotion = (env: Environment = process.env) =>
	env.TERMINAL_SIGMA_MOTION === "reduced";

// The timer's minutes from the environment; the CLI's flags override them.
export const timerOptionsOf = (env: Environment = process.env) => ({
	...(env.TERMINAL_SIGMA_FOCUS
		? { focus: Number(env.TERMINAL_SIGMA_FOCUS) }
		: {}),
	...(env.TERMINAL_SIGMA_BREAK
		? { break: Number(env.TERMINAL_SIGMA_BREAK) }
		: {}),
});
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run build && npx ava build/tests/config.test.js`
Expected: PASS, 6 tests.

- [ ] **Step 5: Run the whole gate and commit**

Run: `npm test`
Expected: Prettier, xo, and all AVA tests pass. Fix any Prettier formatting with `npx prettier --write source/config.ts source/tests/config.test.ts`.

```bash
git add source/config.ts source/tests/config.test.ts
git commit -m "feat: save environment variables to a private config file"
```

---

### Task 2: Load the Config on Start, in the CLI and the Desktop App

**Files:**

- Modify: `source/command-line-interface.tsx:33-49`
- Modify: `source/app.tsx:95-100` (props), `:382-411` (quote refresh), `:574-577` (`drawQuote`)
- Modify: `source/quotes.ts:409` (`hasQuoteApi`)
- Modify: `desktop/main.tsx:42-104`
- Test: `source/tests/dashboard.test.tsx:67-81` (the `start` helper)

**Interfaces:**

- Consumes: everything Task 1 produces
- Produces: `App` props `configFile: string`, `initialConfig: Config`, `env?: Environment` (defaults to `process.env`); `hasQuoteApi(env?: Environment): boolean`

- [ ] **Step 1: Update the test helper so every test owns its config and environment**

In `source/tests/dashboard.test.tsx`, add `import { loadConfig } from "../config.js";` and replace the `start` helper:

```tsx
const start = (
	initialProgress: Progress = empty,
	file = temporaryFile(),
	{ updater } = fakeUpdater(),
	env: Record<string, string | undefined> = {},
) => {
	const configFile = path.join(path.dirname(file), "config.json");

	return {
		file,
		configFile,
		env,
		...render(
			<App
				configFile={configFile}
				env={env}
				file={file}
				initialConfig={loadConfig(configFile)}
				initialProgress={initialProgress}
				options={options}
				updater={updater}
			/>,
		),
	};
};
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run build`
Expected: FAIL — `tsc` reports that `configFile`, `env`, and `initialConfig` do not exist on `AppProps`.

- [ ] **Step 3: Accept the props in `App` and route the quote key through them**

In `source/app.tsx`, import `type Config, type Environment` from `./config.js`, then extend the props:

```tsx
type AppProps = Readonly<{
	options: AppOptions;
	file: string;
	configFile: string;
	initialConfig: Config;
	// The live environment; tests pass their own so they never touch the real one.
	env?: Environment;
	initialProgress: Progress;
	updater: Updater;
}>;
```

In this task destructure only `env = process.env` in `App` (add `import process from "node:process";`). `configFile` and `initialConfig` stay in the props type but are destructured in Task 3, where they are first used, so `noUnusedLocals` and xo never see an unused binding.

In the quote refresh effect and `drawQuote`, pass the key explicitly:

```tsx
const next = await fetchQuote(quoteSettings, env.API_NINJAS_KEY);
// …
if (hasQuoteApi(env)) {
	void refresh();
}
```

```tsx
const drawQuote = (settings: QuoteSettings, base: Progress) => {
	void fetchQuote(settings, env.API_NINJAS_KEY).then(setQuote);
	return withEvent(base, "quoteDrawn");
};
```

Add `env` to the refresh effect's dependency array: `}, [quoteSettings, env]);`.

In `source/quotes.ts`:

```ts
export const hasQuoteApi = (
	env: Record<string, string | undefined> = process.env,
) => Boolean(env.API_NINJAS_KEY);
```

- [ ] **Step 4: Load and apply the config before anything reads the environment**

Replace lines 33-49 of `source/command-line-interface.tsx`:

```tsx
// Load before entering the alternate screen, which would swallow the error.
// The config applies first: it may move the data folder and set the timer.
const settingsFile = configFile();
let initialConfig;
let initialProgress;

try {
	initialConfig = loadConfig(settingsFile);
	applyConfig(initialConfig);
	initialProgress = loadProgress(progressFile());
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}

// Flags win over the environment, which wins over the defaults.
const flags = Object.fromEntries(
	Object.entries(cli.flags).filter(([, value]) => value !== undefined),
);
const options = optionsSchema.safeParse({ ...timerOptionsOf(), ...flags });

if (!options.success) {
	console.error(zod.prettifyError(options.error));
	process.exit(2);
}

const file = progressFile();
```

Import `applyConfig, configFile, loadConfig, timerOptionsOf` from `./config.js`, and pass `configFile={settingsFile}` and `initialConfig={initialConfig}` to `App`. Keep `file={file}`.

In `desktop/main.tsx`, inside `start()`, replace the load block and the `App` props:

```tsx
const settingsFile = configFile();
let initialConfig: Config;
let initialProgress: Progress;

try {
	initialConfig = loadConfig(settingsFile);
	applyConfig(initialConfig);
	initialProgress = loadProgress(progressFile());
} catch (error) {
	dialog.showErrorBox(
		"Terminal Sigma",
		error instanceof Error ? error.message : String(error),
	);
	app.exit(1);
	return;
}

const file = progressFile();
const options =
	optionsSchema.safeParse(timerOptionsOf()).data ?? optionsSchema.parse({});
```

```tsx
<App
	configFile={settingsFile}
	file={file}
	initialConfig={initialConfig}
	initialProgress={initialProgress}
	options={options}
	updater={desktopUpdater()}
/>
```

Import `applyConfig, type Config, configFile, loadConfig, timerOptionsOf` from `../source/config.js`.

- [ ] **Step 5: Run the gate and the desktop type-check**

Run: `npm test && npm ci --prefix desktop && npm run bundle --prefix desktop`
Expected: every test passes, and the desktop bundle type-checks and builds.

- [ ] **Step 6: Commit**

```bash
git add source/app.tsx source/command-line-interface.tsx source/quotes.ts source/tests/dashboard.test.tsx desktop/main.tsx
git commit -m "feat: apply saved environment variables on start"
```

---

### Task 3: The Environment View and Menu Item

**Files:**

- Create: `source/components/environment-view.tsx`
- Modify: `source/components/choice.tsx:58-59,93-95` (the `0` key)
- Modify: `source/content.ts:43-51` (layout rows), `:235-259` (menu), `:269-333` (statuses)
- Modify: `source/progress.ts:49-63` (event actions)
- Modify: `source/i18n.ts` (all 3 languages)
- Modify: `source/app.tsx` (view, editor state, handlers, Esc, hint)
- Test: `source/tests/dashboard.test.tsx`, `source/tests/content.test.ts`

**Interfaces:**

- Consumes: Task 1 and Task 2
- Produces: menu key `"environment"`; event actions `"variableSaved"` and `"variableCleared"` with the variable name as `detail`; `messages.environment` with `groups`, `names`, `describe`, `sources`, `unset`, `placeholder(current)`, `invalid`, `shellWins`, `saved`, `savedRestart`, `cleared`; `messages.hints.environment` and `messages.hints.edit`; `messages.signal.saved(count)`

The menu after this task, with `0` jumping to the 10th item:

| Key | Group    | Item            |
| --- | -------- | --------------- |
| `1` | Actions  | Tomato Timer    |
| `2` | Health   | Log a Meal      |
| `3` | Health   | Log a Workout   |
| `4` | Settings | Everyday Quotes |
| `5` | Settings | Profile         |
| `6` | Settings | Theme           |
| `7` | Settings | Language        |
| `8` | Settings | Environment     |
| `9` | System   | Logs            |
| `0` | System   | Software Update |

- [ ] **Step 1: Write the failing tests**

In `source/tests/dashboard.test.tsx`, update the menu order test's expected labels to end with `"7. Language"`, `"8. Environment"`, `"9. Logs"`, `"0. Software Update"`; change `type(stdin, ["8", "\r"])` in the logs test to `"9"`; change `type(stdin, ["9"])` in the update test to `"0"`. Then add:

```tsx
test("saves an environment variable, leaving the shell's alone", async (t) => {
	const { file, configFile, env, stdin, lastFrame, unmount } = start(
		empty,
		temporaryFile(),
		fakeUpdater(),
		{ TERMINAL_SIGMA_BREAK: "10" },
	);

	await type(stdin, ["8", "\r"]);
	t.true((lastFrame() ?? "").includes("Focus minutes"));
	t.true(
		(lastFrame() ?? "").includes("shell"),
		"the break comes from the shell",
	);

	// The data folder is first; Focus minutes is next.
	await type(stdin, [down, "\r", "abc", "\r"]);
	t.true((lastFrame() ?? "").includes("not allowed"));

	await type(stdin, [backspace.repeat(3), "50", "\r"]);
	t.deepEqual(loadConfig(configFile).env, { TERMINAL_SIGMA_FOCUS: "50" });
	t.is(env.TERMINAL_SIGMA_FOCUS, "50");
	t.is(env.TERMINAL_SIGMA_BREAK, "10");
	t.true((lastFrame() ?? "").includes("Restart Terminal Sigma"));
	t.deepEqual(actionsIn(file).slice(1), ["variableSaved"]);
	t.false(readFileSync(file, "utf8").includes('50"'), "no value in the logs");

	unmount();
});

test("masks a saved secret and clears it with an empty value", async (t) => {
	const { configFile, env, stdin, lastFrame, unmount } = start();

	// Data, Focus, Break, Motion, then API Ninjas key.
	await type(stdin, [
		"8",
		"\r",
		down,
		down,
		down,
		down,
		"\r",
		"ninja-key-123456",
		"\r",
	]);
	t.is(loadConfig(configFile).env.API_NINJAS_KEY, "ninja-key-123456");
	t.true((lastFrame() ?? "").includes("••••3456"));
	t.false((lastFrame() ?? "").includes("ninja-key"));

	await type(stdin, ["\r", "\r"]);
	t.deepEqual(loadConfig(configFile).env, {});
	t.is(env.API_NINJAS_KEY, undefined);

	unmount();
});
```

Add `readFileSync` to the `node:fs` import. In `source/tests/content.test.ts`, the menu grows by 1 row, so change `t.like(layoutOf(100, 27), …)` to `t.like(layoutOf(100, 28), …)` and add `t.like(layoutOf(100, 27), { isMenuGrouped: false });`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run build && npx ava build/tests/dashboard.test.js build/tests/content.test.js`
Expected: FAIL — no "8. Environment" in the menu, and `layoutOf(100, 27)` is still grouped.

- [ ] **Step 3: Let `0` reach the 10th item**

In `source/components/choice.tsx`, replace the numbered-key branch and the label:

```tsx
} else if (isNumbered && /^[0-9]$/v.test(input)) {
	// 1 to 9 pick the first 9 items, and 0 the 10th, like a keyboard row.
	focus(Math.min(input === "0" ? 10 : Number(input), count) - 1);
```

```tsx
{
	isNumbered ? `${(optionIndex + 1) % 10}. ${option.label}` : option.label;
}
```

- [ ] **Step 4: Add the menu item, its rows, and its status**

In `source/content.ts`, grow the menu rows and document why:

```ts
// Header and footer take 5 rows. The character's panel is 25 rows tall,
// Today 19 with its spacing or 16 compact, the menu 16 with its 4 headings
// and 10 items, and Recent 7.
const chromeRows = 5;
const characterRows = 25;
const todayRows = 19;
const compactTodayRows = 16;
const menuRows = 16;
const compactMenuRows = 12;
const recentRows = 7;
```

```ts
export const menuOrder = [
	"timer",
	"diet",
	"workout",
	"quotes",
	"profile",
	"theme",
	"language",
	"environment",
	"logs",
	"update",
] as const;
```

Add `environment: "settings",` to `menuGroups`. Add `savedVariables: number;` to the `state` parameter of `menuEntriesOf`, then `environment: messages.signal.saved(state.savedVariables),` to `statuses` and `environment: messages.describe.environment,` to `descriptions`.

- [ ] **Step 5: Add the event actions**

In `source/progress.ts`, append `"variableSaved"` and `"variableCleared"` to `eventActions`.

- [ ] **Step 6: Add the strings in all 3 languages**

Import `type Source, type VariableGroup, type VariableName` from `./config.js` at the top of `source/i18n.ts` (type-only, so no import cycle at run time). Add to `en`:

```ts
// hints
environment: "↑↓ move · enter edit · esc back",
edit: "enter save · empty enter clears · esc keep",
// menu
environment: "Environment",
// describe
environment:
	"See and change what environment variables control: the data folder, the timer, motion, and API keys. Your shell's variables always win.",
// signal
saved: (count: number) => `${count} saved`,
// events
variableSaved: (name: string) => `Saved ${name}`,
variableCleared: (name: string) => `Cleared ${name}`,
// a new top-level section
environment: {
	groups: {
		data: "Data",
		timer: "Tomato Timer",
		display: "Display",
		quotes: "Everyday Quotes",
	} satisfies Record<VariableGroup, string>,
	names: {
		TERMINAL_SIGMA_HOME: "Data folder",
		TERMINAL_SIGMA_FOCUS: "Focus minutes",
		TERMINAL_SIGMA_BREAK: "Break minutes",
		TERMINAL_SIGMA_MOTION: "Motion",
		API_NINJAS_KEY: "API Ninjas key",
	} satisfies Record<VariableName, string>,
	describe: {
		TERMINAL_SIGMA_HOME:
			"The folder that holds progress.json, as an absolute path. Applies after a restart.",
		TERMINAL_SIGMA_FOCUS:
			"Minutes of each focus, from 1 to 180. Applies after a restart; --focus still wins.",
		TERMINAL_SIGMA_BREAK:
			"Minutes of each break, from 1 to 180. Applies after a restart; --break still wins.",
		TERMINAL_SIGMA_MOTION:
			"full, or reduced to show every change at once, without text effects.",
		API_NINJAS_KEY:
			"Your API Ninjas key, to fetch English quotes instead of the bundled ones.",
	} satisfies Record<VariableName, string>,
	sources: {
		shell: "shell",
		saved: "saved",
		default: "default",
	} satisfies Record<Source, string>,
	unset: "–",
	placeholder: (current: string) => `Now: ${current}`,
	invalid: "That value is not allowed; see the line above.",
	shellWins: "Your shell sets this variable, so it wins over a saved value.",
	saved: "Saved.",
	savedRestart: "Saved. Restart Terminal Sigma to apply it.",
	cleared: "Cleared.",
},
```

Add to `traditionalChinese`:

```ts
// hints
environment: "↑↓ 移動 · enter 編輯 · esc 返回",
edit: "enter 儲存 · 空白 enter 清除 · esc 保留",
// menu
environment: "環境變數",
// describe
environment:
	"查看並修改環境變數控制的設定：資料夾、番茄鐘、動態效果與 API 金鑰。終端機設定的變數永遠優先。",
// signal
saved: (count) => `已儲存 ${count} 項`,
// events
variableSaved: (name) => `儲存 ${name}`,
variableCleared: (name) => `清除 ${name}`,
environment: {
	groups: {
		data: "資料",
		timer: "番茄鐘",
		display: "顯示",
		quotes: "每日語錄",
	},
	names: {
		TERMINAL_SIGMA_HOME: "資料夾",
		TERMINAL_SIGMA_FOCUS: "專注分鐘數",
		TERMINAL_SIGMA_BREAK: "休息分鐘數",
		TERMINAL_SIGMA_MOTION: "動態效果",
		API_NINJAS_KEY: "API Ninjas 金鑰",
	},
	describe: {
		TERMINAL_SIGMA_HOME: "存放 progress.json 的資料夾，須為絕對路徑。重新啟動後生效。",
		TERMINAL_SIGMA_FOCUS: "每次專注的分鐘數，1 到 180。重新啟動後生效；--focus 仍優先。",
		TERMINAL_SIGMA_BREAK: "每次休息的分鐘數，1 到 180。重新啟動後生效；--break 仍優先。",
		TERMINAL_SIGMA_MOTION: "full，或 reduced 以立即顯示所有變化，不播放文字特效。",
		API_NINJAS_KEY: "你的 API Ninjas 金鑰，用來改抓英文語錄，而非內建語錄。",
	},
	sources: { shell: "終端機", saved: "已儲存", default: "預設" },
	unset: "–",
	placeholder: (current) => `目前：${current}`,
	invalid: "不接受這個值，請見上一行說明。",
	shellWins: "終端機已設定這個變數，因此優先於儲存的值。",
	saved: "已儲存。",
	savedRestart: "已儲存。重新啟動 Terminal Sigma 後生效。",
	cleared: "已清除。",
},
```

Add to `korean`:

```ts
// hints
environment: "↑↓ 이동 · enter 편집 · esc 뒤로",
edit: "enter 저장 · 빈 enter 지우기 · esc 유지",
// menu
environment: "환경 변수",
// describe
environment:
	"데이터 폴더, 타이머, 움직임, API 키처럼 환경 변수가 정하는 설정을 보고 바꿉니다. 셸에서 설정한 변수가 항상 우선합니다.",
// signal
saved: (count) => `${count}개 저장됨`,
// events
variableSaved: (name) => `${name} 저장`,
variableCleared: (name) => `${name} 지움`,
environment: {
	groups: {
		data: "데이터",
		timer: "토마토 타이머",
		display: "화면",
		quotes: "오늘의 명언",
	},
	names: {
		TERMINAL_SIGMA_HOME: "데이터 폴더",
		TERMINAL_SIGMA_FOCUS: "집중 시간(분)",
		TERMINAL_SIGMA_BREAK: "휴식 시간(분)",
		TERMINAL_SIGMA_MOTION: "움직임",
		API_NINJAS_KEY: "API Ninjas 키",
	},
	describe: {
		TERMINAL_SIGMA_HOME: "progress.json을 보관하는 폴더의 절대 경로입니다. 다시 시작하면 적용됩니다.",
		TERMINAL_SIGMA_FOCUS: "집중 1회의 시간(분), 1부터 180까지. 다시 시작하면 적용되며 --focus가 우선합니다.",
		TERMINAL_SIGMA_BREAK: "휴식 1회의 시간(분), 1부터 180까지. 다시 시작하면 적용되며 --break가 우선합니다.",
		TERMINAL_SIGMA_MOTION: "full, 또는 글자 효과 없이 모든 변화를 바로 보여 주는 reduced.",
		API_NINJAS_KEY: "번들 명언 대신 영어 명언을 가져올 API Ninjas 키입니다.",
	},
	sources: { shell: "셸", saved: "저장됨", default: "기본값" },
	unset: "–",
	placeholder: (current) => `현재: ${current}`,
	invalid: "허용되지 않는 값입니다. 위 설명을 확인하세요.",
	shellWins: "셸에서 이 변수를 설정했으므로 저장된 값보다 우선합니다.",
	saved: "저장했습니다.",
	savedRestart: "저장했습니다. 적용하려면 Terminal Sigma를 다시 시작하세요.",
	cleared: "지웠습니다.",
},
```

- [ ] **Step 7: Write the view**

```tsx
// source/components/environment-view.tsx
import React from "react";
import { PasswordInput, TextInput } from "@inkjs/ui";
import { Box, Text } from "ink";
import {
	type Config,
	type Environment,
	maskSecret,
	type Source,
	sourceOf,
	type VariableName,
	variableOf,
	variables,
} from "../config.js";
import type { Messages } from "../i18n.js";
import { usePalette } from "../theme.js";
import Choice from "./choice.js";

type EnvironmentViewProps = Readonly<{
	config: Config;
	env: Environment;
	messages: Messages;
	editing?: VariableName;
	// The row the cursor starts on: the variable edited last.
	initialValue?: VariableName;
	onEdit: (name: VariableName) => void;
	onChange: (name: VariableName, value: string | undefined) => void;
}>;

// Every variable with its value and where it comes from; Enter edits 1, and
// an empty value clears what was saved.
export default function EnvironmentView({
	config,
	env,
	messages,
	editing,
	initialValue,
	onEdit,
	onChange,
}: EnvironmentViewProps) {
	const palette = usePalette();
	const [error, setError] = React.useState<string>();
	const { environment } = messages;
	const sourceColor: Record<Source, string | undefined> = {
		shell: palette.soft,
		saved: palette.accent,
		default: undefined,
	};
	const shown = (name: VariableName) => {
		const value = env[name];

		if (!value) {
			return environment.unset;
		}

		return variableOf(name)?.isSecret ? maskSecret(value) : value;
	};

	if (editing) {
		const variable = variableOf(editing);
		const Input = variable?.isSecret ? PasswordInput : TextInput;
		const submit = (text: string) => {
			if (!text.trim()) {
				onChange(editing, undefined);
				return;
			}

			const value = variable?.parse(text);

			if (value === undefined) {
				setError(environment.invalid);
				return;
			}

			onChange(editing, value);
		};

		return (
			<Box flexDirection="column">
				<Text bold color={palette.accent}>
					{environment.names[editing]}
				</Text>
				<Text dimColor>{environment.describe[editing]}</Text>
				{sourceOf(editing, config, env) === "shell" ? (
					<Text color={palette.soft}>{environment.shellWins}</Text>
				) : null}
				<Box marginTop={1}>
					<Input
						placeholder={environment.placeholder(shown(editing))}
						onSubmit={submit}
					/>
				</Box>
				{error ? <Text color={palette.error}>{error}</Text> : null}
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			<Text bold color={palette.accent}>
				{messages.menu.environment}
			</Text>
			<Choice
				initialValue={initialValue}
				options={variables.map(({ name, group }) => {
					const source = sourceOf(name, config, env);

					return {
						group: environment.groups[group],
						label: environment.names[name],
						value: name,
						hint: (
							<Text wrap="truncate-end">
								<Text dimColor>{shown(name)}</Text>
								<Text color={sourceColor[source]}>
									{` ${environment.sources[source]}`}
								</Text>
							</Text>
						),
					};
				})}
				onSelect={(value) => {
					const variable = variableOf(value);

					if (variable) {
						onEdit(variable.name);
					}
				}}
			/>
		</Box>
	);
}
```

- [ ] **Step 8: Wire the view into `App`**

In `source/app.tsx`:

1. Import `EnvironmentView` and `saveConfig, sourceOf, type VariableName, variableOf, variables, withVariable, writeVariable` from `./config.js`.
2. Destructure `configFile` and `initialConfig` from the props, and add state beside `quoteEditor`: `const [config, setConfig] = React.useState(initialConfig);`, `const [variableEditor, setVariableEditor] = React.useState<VariableName>();`, and `const [lastVariable, setLastVariable] = React.useState<VariableName>();`, so the list's cursor comes back to the row just edited.
3. In `backToMenu`, add `setVariableEditor(undefined);`.
4. In the dashboard's `useInput`, add a branch before the generic Esc branch:

```tsx
} else if (view === "environment" && variableEditor && key.escape) {
	setVariableEditor(undefined);
```

5. Add the handler after `chooseTheme`:

```tsx
// Saves 1 variable to config.json and the live environment, unless the shell
// set it, and logs only its name: the value may be a secret.
const changeVariable = (name: VariableName, value: string | undefined) => {
	const next = withVariable(config, name, value);
	const isShells = sourceOf(name, config, env) === "shell";

	try {
		saveConfig(configFile, next);
	} catch (error) {
		say(messages.notSaved(String(error)), "error");
		return;
	}

	if (!isShells) {
		writeVariable(env, name, value);
	}

	setConfig(next);
	setVariableEditor(undefined);
	const { environment } = messages;
	let text = environment.cleared;

	if (value !== undefined) {
		text = variableOf(name)?.needsRestart
			? environment.savedRestart
			: environment.saved;
	}

	commit(
		withEvent(
			progress,
			value === undefined ? "variableCleared" : "variableSaved",
			name,
		),
		text,
		"success",
	);
};
```

6. Pass `savedVariables: variables.filter(({ name }) => config.env[name] !== undefined).length,` to `menuEntriesOf`.
7. Add the panel:

```tsx
environment: (
	<EnvironmentView
		key={variableEditor ?? "list"}
		config={config}
		editing={variableEditor}
		env={env}
		initialValue={lastVariable}
		messages={messages}
		onChange={changeVariable}
		onEdit={(name) => {
			setLastVariable(name);
			setVariableEditor(name);
		}}
	/>
),
```

8. Pick the hint: before `else if (isTyping)`, add

```tsx
} else if (view === "environment") {
	hint = variableEditor ? messages.hints.edit : messages.hints.environment;
```

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, including both new dashboard tests and the updated layout test.

- [ ] **Step 10: Commit**

```bash
git add source/components/environment-view.tsx source/components/choice.tsx source/content.ts source/progress.ts source/i18n.ts source/app.tsx source/tests/dashboard.test.tsx source/tests/content.test.ts
git commit -m "feat: manage environment variables from the menu"
```

---

### Task 4: Document the Config File, the Variables, and the New Rules

**Files:**

- Modify: `README.md` (Menu, Keys, Environment Variables, a new Config File section)
- Modify: `CLAUDE.md` (Repository Layout, Universal Rules)
- Modify: `.claude/rules/terminal-layout.md` (menu rows and headings threshold)

- [ ] **Step 1: Update `README.md`**

Replace the menu table with the 10 rows from Task 3 (keys `1`-`9` then `0`, adding `| `8` | Settings | Environment | Every environment variable with its value and source; Enter edits 1, an empty value clears it |`). In the Keys table, change `` `1` to `9` `` to `` `0` to `9` `` and "Jump to a menu item" to "Jump to a menu item; `0` is the 10th". Change "The headings give way to Recent on a terminal shorter than 27 rows." to 28 rows. Replace the Environment Variables section:

```markdown
### Environment Variables

Every variable is optional, and **Environment** in the menu shows and edits each one. A value saved there goes to `config.json` beside `progress.json`, readable only by you; a variable your shell sets always wins over a saved one:

| Variable                | Effect                                                                                                                                    |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `API_NINJAS_KEY`        | Fetch quotes from [API Ninjas](https://api-ninjas.com/api/quotes) instead of the bundled list, in English only, falling back on any error |
| `TERMINAL_SIGMA_BREAK`  | Minutes of each Tomato Timer break, from `1` to `180`; `--break` wins                                                                     |
| `TERMINAL_SIGMA_FOCUS`  | Minutes of each Tomato Timer focus, from `1` to `180`; `--focus` wins                                                                     |
| `TERMINAL_SIGMA_HOME`   | The folder that holds `progress.json`, instead of `~/.terminal-sigma`, e.g. a synced folder                                               |
| `TERMINAL_SIGMA_MOTION` | `full`, or `reduced` to show every change at once, without text effects                                                                   |

A saved `TERMINAL_SIGMA_HOME` moves `progress.json`, while `config.json` stays in `~/.terminal-sigma`, so your keys never travel with a synced folder.
```

- [ ] **Step 2: Update `CLAUDE.md`**

Add a row to the Repository Layout table: ``| [`source/config.ts`](./source/config.ts) | The environment variable registry, and `config.json`: loading, applying, and saving |``. Add a Universal Rule (keep the list alphabetical):

```markdown
- **Keep Secrets Out of `progress.json`**: API keys live only in `config.json`, written with mode 600; an event names a variable, never its value
- **Register Every Environment Variable**: A new variable joins `variables` in [`config.ts`](./source/config.ts) with its strings in all 3 languages, so **Environment** can edit it
```

- [ ] **Step 3: Update `.claude/rules/terminal-layout.md`**

Change "the 9 numbered items under 4 headings" to "the 10 numbered items under 4 headings, `0` jumping to the 10th", and "The Menu shows its group headings from 27 rows" to "from 28 rows".

- [ ] **Step 4: Check the documents and commit**

Run: `npx prettier --check README.md CLAUDE.md .claude/rules/terminal-layout.md`
Expected: all files pass.

```bash
git add README.md CLAUDE.md .claude/rules/terminal-layout.md
git commit -m "docs: describe the environment view and config.json"
```
