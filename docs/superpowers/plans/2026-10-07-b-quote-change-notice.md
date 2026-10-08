# Quote Change Notice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every new everyday quote announce itself. For 8 seconds the header shows a `✦ New` badge and the quote in the accent tone, and the quote types itself in over 0.8 seconds; a random draw never repeats the quote already on screen.

**Architecture:** 2 pure functions in `source/quotes.ts` decide what the header shows: `quoteNoticeOf` turns the time of the change into a badge flag and a typed fraction, and `typedOf` cuts the text at whole graphemes. A new `Header` component, extracted from `app.tsx`, notices when the quote's identity changes, and uses Ink 7's `useAnimation` to redraw at 20 fps only while the notice shows; the animation's own `time` is the notice's clock, because xo enforces `react-hooks/purity`, which rejects `Date.now()` during render. `TERMINAL_SIGMA_MOTION=reduced` skips the typing but keeps the badge.

**Tech Stack:** TypeScript 6, Ink 7 (`useAnimation` with `isActive`), `Intl.Segmenter`, AVA 7, ink-testing-library 4.

**Spec:** [`2026-10-07-roadmap.md`](./2026-10-07-roadmap.md), section "Plan B". Depends on [Plan A](./2026-10-07-a-environment-settings.md) for `isReducedMotion` and the `env` prop.

## Global Constraints

- Every user-facing string goes into all 3 languages in `source/i18n.ts`
- Read colors from `usePalette()`; never write a hex color in a component
- Let Ink measure text: CJK and Hangul take 2 cells, so never pad or cut with `String.length`; cut with `Intl.Segmenter`
- Switching the language must not count as a new quote: the notice follows the quote's identity (its English text), not its translation
- `npm test` passes after every task

## Review Focus

- A language switch while a quote shows: no `✦ New` badge appears, because the quote did not change
- A quote that contains an emoji or a combining mark: typing never shows half a grapheme
- Auto-refresh every 15 seconds: each refresh shows the badge, and the 20 fps redraw stops 8 seconds later
- A pool of 1 quote (filters match only 1): drawing returns that quote again, and no badge shows because nothing changed
- `TERMINAL_SIGMA_MOTION=reduced`: the full quote shows at once with the badge

---

### Task 1: The Notice and the Typing as Pure Functions

**Files:**

- Modify: `source/quotes.ts:437-451` (`pickBundled`), `:486-506` (`fetchQuote`), and append the new functions
- Test: `source/tests/data.test.ts`

**Interfaces:**

- Produces:
  - `quoteNoticeMilliseconds = 8000`, `quoteTypingMilliseconds = 800`
  - `type QuoteNotice = Readonly<{ isNew: boolean; shown: number }>` where `shown` runs from 0 to 1
  - `quoteNoticeOf(changedAt: number | undefined, now: number, isReduced: boolean): QuoteNotice`
  - `typedOf(text: string, shown: number): string`
  - `pickBundled(settings, now, random?, current?: Quote): Quote` and `fetchQuote(settings, apiKey?, current?: Quote): Promise<Quote>`

- [ ] **Step 1: Write the failing tests**

Append to `source/tests/data.test.ts`, importing `quoteNoticeOf` and `typedOf` from `../quotes.js`:

```ts
test("marks a changed quote new for 8 seconds, typing it in first", (t) => {
	t.deepEqual(quoteNoticeOf(undefined, 5000, false), {
		isNew: false,
		shown: 1,
	});
	t.deepEqual(quoteNoticeOf(1000, 1000, false), { isNew: true, shown: 0 });
	t.deepEqual(quoteNoticeOf(1000, 1400, false), { isNew: true, shown: 0.5 });
	t.deepEqual(quoteNoticeOf(1000, 3000, false), { isNew: true, shown: 1 });
	t.deepEqual(quoteNoticeOf(1000, 9000, false), { isNew: false, shown: 1 });
	t.deepEqual(quoteNoticeOf(1000, 1000, true), { isNew: true, shown: 1 });
});

test("types in whole characters, never half of one", (t) => {
	t.is(typedOf("abcd", 0.5), "ab");
	t.is(typedOf("健全的精神", 0.4), "健全");
	t.is(typedOf("👍🏽ok", 0.34), "👍🏽");
	t.is(typedOf("abc", 0), "");
	t.is(typedOf("abc", 1), "abc");
});

test("never draws the quote already on screen", (t) => {
	const current = pickBundled(defaultQuoteSettings, 0, 0);

	for (const random of [0, 0.25, 0.5, 0.75, 0.999]) {
		t.not(
			pickBundled(defaultQuoteSettings, 0, random, current).quote,
			current.quote,
		);
	}

	const one = { ...defaultQuoteSettings, author: "Juvenal" };
	const only = pickBundled(one, 0, 0);
	t.is(pickBundled(one, 0, 0.5, only).quote, only.quote, "a pool of 1 repeats");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run build`
Expected: FAIL — `quoteNoticeOf` and `typedOf` are not exported from `../quotes.js`.

- [ ] **Step 3: Write the implementation**

Replace `pickBundled` in `source/quotes.ts`:

```ts
export function pickBundled(
	settings: QuoteSettings,
	now: number,
	random = Math.random(),
	current?: Quote,
): Quote {
	const pool = bundledPool(settings);

	if (settings.mode === "daily") {
		return (
			pool[dayOf(now) % pool.length] ??
			bundledQuotes[0] ?? { quote: "", author: "" }
		);
	}

	// A random draw never repeats the quote on screen, unless it is the only one.
	const fresh =
		current && pool.length > 1
			? pool.filter((quote) => quote.quote !== current.quote)
			: pool;

	return (
		fresh[Math.floor(random * fresh.length)] ??
		bundledQuotes[0] ?? { quote: "", author: "" }
	);
}
```

Give `fetchQuote` a third parameter `current?: Quote` and pass it to both `pickBundled(settings, Date.now(), Math.random(), current)` fallbacks. Append:

```ts
// How long a new quote stays marked, and how long it takes to type itself in.
export const quoteNoticeMilliseconds = 8000;
export const quoteTypingMilliseconds = 800;

export type QuoteNotice = Readonly<{ isNew: boolean; shown: number }>;

export function quoteNoticeOf(
	changedAt: number | undefined,
	now: number,
	isReduced: boolean,
): QuoteNotice {
	if (changedAt === undefined || now - changedAt >= quoteNoticeMilliseconds) {
		return { isNew: false, shown: 1 };
	}

	return {
		isNew: true,
		shown: isReduced
			? 1
			: Math.min(Math.max((now - changedAt) / quoteTypingMilliseconds, 0), 1),
	};
}

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

// The first part of the text in whole characters, so CJK and emoji never split.
export function typedOf(text: string, shown: number) {
	const characters = Array.from(
		graphemes.segment(text),
		({ segment }) => segment,
	);
	return characters.slice(0, Math.round(characters.length * shown)).join("");
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run build && npx ava build/tests/data.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add source/quotes.ts source/tests/data.test.ts
git commit -m "feat: never draw the quote already on screen"
```

---

### Task 2: The Header Badge and Typing Effect

**Files:**

- Create: `source/components/header.tsx`
- Modify: `source/app.tsx:1027-1043` (the header box), `:384-391` and `:574-577` (pass the current quote)
- Modify: `source/i18n.ts` (`quotes.fresh` in all 3 languages)
- Test: `source/tests/dashboard.test.tsx`

**Interfaces:**

- Consumes: `quoteNoticeOf`, `typedOf` from Task 1; `isReducedMotion(env)` from Plan A's `source/config.ts`
- Produces: `Header` with props `{ clock: string; quoteKey: string; line: string; freshLabel: string; isReduced: boolean }`; `messages.quotes.fresh`

- [ ] **Step 1: Write the failing test**

Append to `source/tests/dashboard.test.tsx`:

```tsx
test("marks a newly drawn quote and types it in", async (t) => {
	const { stdin, lastFrame, unmount } = start();
	await settle();
	t.false((lastFrame() ?? "").includes("✦ New"), "the first quote is not news");

	// Everyday Quotes, then Draw a new quote.
	await type(stdin, ["4", "\r", "\r"]);
	t.true(await shows(lastFrame, "✦ New"));

	await type(stdin, [escape, "7", "\r", down, "\r"]);
	t.false(
		(lastFrame() ?? "").includes("✦"),
		"a language switch is not a new quote",
	);

	unmount();
});

test("shows the whole new quote at once with reduced motion", async (t) => {
	const { stdin, lastFrame, unmount } = start(
		empty,
		temporaryFile(),
		fakeUpdater(),
		{
			TERMINAL_SIGMA_MOTION: "reduced",
		},
	);

	await type(stdin, ["4", "\r", "\r"]);
	const header = (lastFrame() ?? "").split("\n").slice(0, 4).join("\n");
	t.true(header.includes("✦ New"));
	t.true(header.includes("” — "), "the quote is complete straight away");

	unmount();
});
```

The language test relies on Plan A's menu, where `7` is Language and `down` moves from English to 繁體中文; the badge label in Traditional Chinese is `新`, which also must not appear, so the check is on `✦`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run build && npx ava build/tests/dashboard.test.js --match "*quote*"`
Expected: FAIL — no `✦ New` in the frame.

- [ ] **Step 3: Add the label in all 3 languages**

In `source/i18n.ts`, add to `quotes`: `fresh: "New",` in `en`, `fresh: "新",` in `traditionalChinese`, and `fresh: "새 명언",` in `korean`.

- [ ] **Step 4: Write the header**

```tsx
// source/components/header.tsx
import React from "react";
import { Box, Text, useAnimation } from "ink";
import { quoteNoticeMilliseconds, quoteNoticeOf, typedOf } from "../quotes.js";
import { usePalette } from "../theme.js";

type HeaderProps = Readonly<{
	clock: string;
	// What identifies the quote in any language, so a translation is not news.
	quoteKey: string;
	line: string;
	freshLabel: string;
	isReduced: boolean;
}>;

// The title, the clock, and the everyday quote, which marks itself new and
// types itself in whenever it changes.
export default function Header({
	clock,
	quoteKey,
	line,
	freshLabel,
	isReduced,
}: HeaderProps) {
	const palette = usePalette();
	const [isFresh, setIsFresh] = React.useState(false);
	const previous = React.useRef(quoteKey);
	// Redraws 20 times a second only while the notice shows. Its `time` is the
	// clock of the notice, since xo's react-hooks/purity forbids Date.now() here.
	const { time, reset } = useAnimation({ interval: 50, isActive: isFresh });

	React.useEffect(() => {
		if (previous.current !== quoteKey) {
			previous.current = quoteKey;
			reset();
			setIsFresh(true);
		}
	}, [quoteKey, reset]);

	React.useEffect(() => {
		if (isFresh && time >= quoteNoticeMilliseconds) {
			setIsFresh(false);
		}
	}, [isFresh, time]);

	const notice = quoteNoticeOf(isFresh ? 0 : undefined, time, isReduced);

	return (
		<Box
			borderColor={palette.accent}
			borderStyle="round"
			flexDirection="column"
			flexShrink={0}
			paddingX={1}
		>
			<Box justifyContent="space-between">
				<Text bold color={palette.accent}>
					✻ Terminal Sigma
				</Text>
				<Text dimColor>{clock}</Text>
			</Box>
			<Text wrap="truncate-end">
				{notice.isNew ? (
					<Text bold color={palette.accent}>{`✦ ${freshLabel} `}</Text>
				) : null}
				<Text
					italic
					color={notice.isNew ? palette.soft : undefined}
					dimColor={!notice.isNew}
				>
					{typedOf(line, notice.shown)}
				</Text>
			</Text>
		</Box>
	);
}
```

- [ ] **Step 5: Use it in `App`, and pass the current quote to every draw**

In `source/app.tsx`, import `Header` and `isReducedMotion` from `./config.js`. Replace the header `Box` (the one holding `✻ Terminal Sigma` and the quote) with:

```tsx
<Header
	clock={new Date(now).toTimeString().slice(0, 8)}
	freshLabel={messages.quotes.fresh}
	isReduced={isReducedMotion(env)}
	line={`“${shownQuote.quote}” — ${shownQuote.author}`}
	quoteKey={`${quote.quote}|${quote.author}`}
/>
```

Keep a ref to the quote on screen so timers and draws read the newest one:

```tsx
const quoteOnScreen = React.useRef(quote);

React.useEffect(() => {
	quoteOnScreen.current = quote;
}, [quote]);
```

Pass it as the last argument in the refresh effect (`fetchQuote(quoteSettings, env.API_NINJAS_KEY, quoteOnScreen.current)`), in `drawQuote` (`fetchQuote(settings, env.API_NINJAS_KEY, quoteOnScreen.current)`), and in `updateQuotes` (`pickBundled(settings, Date.now(), Math.random(), quoteOnScreen.current)`).

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm test`
Expected: PASS, including both new dashboard tests.

- [ ] **Step 7: Look at it, then commit**

Run `TERMINAL_SIGMA_HOME="$(mktemp -d)" npm start`, open Everyday Quotes, choose "Draw a new quote" 3 times, and confirm the badge appears each time, the text types in left to right, and both disappear after about 8 seconds. Repeat in Traditional Chinese.

```bash
git add source/components/header.tsx source/app.tsx source/i18n.ts source/tests/dashboard.test.tsx
git commit -m "feat: mark each new quote and type it in"
```

---

### Task 3: Document the Notice

**Files:**

- Modify: `README.md` (Everyday Quotes section)
- Modify: `.claude/rules/terminal-layout.md` (Header row of the regions table)

- [ ] **Step 1: Update the documents**

In `README.md`, add after the Everyday Quotes settings table:

```markdown
Every new quote marks itself with **✦ New** for 8 seconds and types itself in, whether you drew it or it refreshed on its own. A random draw never repeats the quote on screen. With `TERMINAL_SIGMA_MOTION=reduced`, it appears whole at once.
```

In `.claude/rules/terminal-layout.md`, change the Header row to: ``| Header | `✻ Terminal Sigma`, the clock, and the everyday quote on 1 truncated line, marked ✦ New for 8 seconds after it changes |``.

- [ ] **Step 2: Check and commit**

Run: `npx prettier --check README.md .claude/rules/terminal-layout.md`
Expected: both pass.

```bash
git add README.md .claude/rules/terminal-layout.md
git commit -m "docs: describe the new quote notice"
```
