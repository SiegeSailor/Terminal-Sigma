/* eslint-disable @typescript-eslint/naming-convention */
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import test from "ava";
import {
	applyConfig,
	configSchema,
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
		// eslint-disable-next-line ava/no-conditional-assertion, no-bitwise
		t.is(statSync(file).mode & 0o777, 0o600);
	}
});

test("refuses an unreadable config without touching it", (t) => {
	const file = temporaryFile();
	writeFileSync(file, "{ nope");

	t.throws(() => loadConfig(file), { message: /unreadable/v });
	t.is(readFileSync(file, "utf8"), "{ nope");
});

test("keeps keys and variables this build does not know", (t) => {
	const file = temporaryFile();
	saveConfig(
		file,
		configSchema.parse({
			env: { FUTURE_NAME: "x" },
			accounts: [{ id: "a1" }],
		}),
	);

	const next = withVariable(loadConfig(file), "TERMINAL_SIGMA_FOCUS", "50");
	saveConfig(file, next);
	const reread: Record<string, unknown> = loadConfig(file);

	t.deepEqual(reread.accounts, [{ id: "a1" }]);
	t.deepEqual(loadConfig(file).env, {
		FUTURE_NAME: "x",
		TERMINAL_SIGMA_FOCUS: "50",
	});
});

test("fills in only what the shell left unset, and only known names", (t) => {
	const env: Record<string, string | undefined> = {
		TERMINAL_SIGMA_FOCUS: "30",
	};
	applyConfig({ env: { ...saved.env, UNKNOWN_NAME: "x" } }, env);

	t.is(env.TERMINAL_SIGMA_FOCUS, "30", "the shell wins");
	t.is(env.API_NINJAS_KEY, "ninja-key-123456");
	t.is(env.UNKNOWN_NAME, undefined);

	const hand: Record<string, string | undefined> = {};
	applyConfig(
		{
			env: {
				TERMINAL_SIGMA_FOCUS: "abc",
				TERMINAL_SIGMA_HOME: "relative/folder",
			},
		},
		hand,
	);
	t.deepEqual(hand, {}, "a saved value that does not parse is skipped");
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
/* eslint-enable @typescript-eslint/naming-convention */
