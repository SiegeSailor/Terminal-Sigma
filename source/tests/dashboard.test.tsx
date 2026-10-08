import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "ava";
import React from "react";
import { render } from "ink-testing-library";
import App from "../app.js";
import { loadConfig } from "../config.js";
import { messagesOf } from "../i18n.js";
import { loadProgress, type Progress, progressSchema } from "../progress.js";
import type { Updater } from "../update.js";

const options = { name: "Nova", focus: 25, break: 5 };
const empty = progressSchema.parse({ language: "en" });
const down = "\u001B[B";
const up = "\u001B[A";
const backspace = "\u007F";
const escape = "\u001B";

// Every test gets its own file, never the real ~/.terminal-sigma.
const temporaryFile = () =>
	path.join(
		mkdtempSync(path.join(tmpdir(), "terminal-sigma-")),
		"progress.json",
	);

const settle = async () =>
	new Promise((resolve) => {
		setTimeout(resolve, 150);
	});

const type = async (
	stdin: { write: (data: string) => void },
	keys: string[],
) => {
	for (const key of keys) {
		// eslint-disable-next-line no-await-in-loop
		await settle();
		stdin.write(key);
	}

	await settle();
};

// Stands in for NPM: v1.1.0 is out, and installing it always works.
const fakeUpdater = () => {
	const calls: string[] = [];
	const updater: Updater = {
		source: "npm",
		current: "1.0.0",
		newest: async () => "1.1.0",
		async install(version) {
			calls.push(`install ${version}`);
		},
		restart() {
			calls.push("restart");
		},
	};

	return { calls, updater };
};

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

// Waits for async work, like an install, to reach the screen.
const shows = async (lastFrame: () => string | undefined, text: string) => {
	for (let attempt = 0; attempt < 20; attempt++) {
		if ((lastFrame() ?? "").includes(text)) {
			return true;
		}

		// eslint-disable-next-line no-await-in-loop
		await settle();
	}

	return false;
};

const actionsIn = (file: string) =>
	loadProgress(file).events.map((event) => event.action);

test("renders the dashboard with the menu in order", async (t) => {
	const { file, lastFrame, unmount } = start();
	await settle();
	const frame = lastFrame() ?? "";
	const order = [
		"1. Log",
		"2. Tomato Timer",
		"3. History",
		"4. Everyday Quotes",
		"5. Profile",
		"6. Theme",
		"7. Language",
		"8. Environment",
		"9. Software Update",
	].map((label) => frame.indexOf(label));

	t.true(order.every((index, position) => index > (order[position - 1] ?? -1)));
	t.true(frame.includes("❯ 1. Log"), "the cursor starts on Log");
	t.true(frame.includes("0 logged today"));
	t.true(frame.includes("Recent"));
	t.deepEqual(actionsIn(file), ["appOpened"]);

	unmount();
});

test("asks for a language on the first run and saves it", async (t) => {
	const { file, stdin, lastFrame, unmount } = start(progressSchema.parse({}));

	t.true((lastFrame() ?? "").includes("언어 선택"));
	await type(stdin, [down, "\r"]);

	t.is(loadProgress(file).language, "zh-TW");
	t.true((lastFrame() ?? "").includes("番茄鐘"));
	t.true(actionsIn(file).includes("languageChanged"));

	unmount();
});

test("switches to Korean from the menu", async (t) => {
	const { file, stdin, lastFrame, unmount } = start();

	await type(stdin, ["7", "\r", down, down, "\r"]);

	t.is(loadProgress(file).language, "ko");
	t.true((lastFrame() ?? "").includes("토마토 타이머"));

	unmount();
});

test("logs a line, saying what it cannot read", async (t) => {
	const { file, stdin, lastFrame, unmount } = start();

	await type(stdin, ["1", "\r", "w lots"]);
	t.true((lastFrame() ?? "").includes("A number is missing or unreadable."));

	await type(stdin, ["\r"]);
	t.deepEqual(loadProgress(file).water, []);

	await type(stdin, [backspace.repeat(6), "2 eggs, toast"]);
	t.true((lastFrame() ?? "").includes("2 × Egg · 144 kcal · 12 g protein"));

	await type(stdin, ["\r"]);
	t.like(loadProgress(file).meals, [
		{ food: "Egg", servings: 2, calories: 144 },
		{ food: "Whole wheat toast", calories: 160 },
	]);
	t.true((lastFrame() ?? "").includes("Logged 2 Egg, Whole wheat toast"));

	unmount();
});

test("completes a food name and logs the pick", async (t) => {
	const { file, stdin, lastFrame, unmount } = start();

	await type(stdin, ["1", "\r", "2 chick"]);
	t.true((lastFrame() ?? "").includes("Chicken breast"));

	await type(stdin, [down, "\r"]);
	t.like(loadProgress(file).meals[0], {
		food: "Chicken breast",
		servings: 2,
		calories: 496,
		protein: 92,
	});

	unmount();
});

test("logs a workout and scales its experience", async (t) => {
	const { file, stdin, lastFrame, unmount } = start();

	await type(stdin, ["1", "\r", "wo run 30m hard", "\r"]);
	t.like(loadProgress(file).workouts[0], {
		activity: "running",
		minutes: 30,
		intensity: "vigorous",
	});
	t.true((lastFrame() ?? "").includes("+60 XP"));

	unmount();
});

test("repeats the last line with a dot", async (t) => {
	const { file, stdin, unmount } = start({
		...empty,
		workouts: [
			{
				at: "2026-10-02T07:00:00.000Z",
				activity: "cycling",
				minutes: 45,
				intensity: "moderate",
			},
		],
	});

	await type(stdin, ["1", "\r", ".", "\r"]);
	t.like(loadProgress(file).workouts[1], {
		activity: "cycling",
		minutes: 45,
		intensity: "moderate",
	});

	unmount();
});

test("logs a suggestion for this hour with Enter", async (t) => {
	const yesterday = new Date(Date.now() - 86_400_000).toISOString();
	const { file, stdin, lastFrame, unmount } = start({
		...empty,
		meals: [{ at: yesterday, food: "Oatmeal", calories: 300, protein: 10 }],
	});

	await type(stdin, ["1", "\r"]);
	t.true((lastFrame() ?? "").includes("usual around now"));

	await type(stdin, [down, "\r"]);
	t.like(loadProgress(file).meals[1], { food: "Oatmeal", calories: 300 });

	unmount();
});

test("undoes only the line u, and only while the Log view is open", async (t) => {
	const { file, stdin, lastFrame, unmount } = start();

	await type(stdin, ["1", "\r", "udon", "\r"]);
	t.is(loadProgress(file).meals[0]?.food, "Udon", "udon is a food");

	await type(stdin, ["u", "\r"]);
	t.deepEqual(loadProgress(file).meals, []);
	t.true(actionsIn(file).includes("logDeleted"));

	await type(stdin, ["u", "\r"]);
	t.true((lastFrame() ?? "").includes("Nothing to undo."));

	// A full-width u from an input method undoes too, never logging a food.
	await type(stdin, ["w 500", "\r", "ｕ", "\r"]);
	t.deepEqual(loadProgress(file).water, []);
	t.deepEqual(loadProgress(file).meals, []);

	// Leaving the view forgets what it could undo.
	await type(stdin, ["w 500", "\r", escape, "\r", "u", "\r"]);
	t.true((lastFrame() ?? "").includes("Nothing to undo."));
	t.is(loadProgress(file).water.length, 1);

	unmount();
});

test("keeps a pasted line whole until Enter", async (t) => {
	const { file, stdin, lastFrame, unmount } = start();

	await type(stdin, ["1", "\r", "\u001B[200~2 eggs\ntoast\n\u001B[201~"]);
	t.true((lastFrame() ?? "").includes("2 × Egg"));
	t.true((lastFrame() ?? "").includes("Whole wheat toast · 160 kcal"));
	t.deepEqual(loadProgress(file).meals, []);

	await type(stdin, ["\r"]);
	t.is(loadProgress(file).meals.length, 2);

	unmount();
});

test("sets a goal and logs the change", async (t) => {
	const { file, stdin, unmount } = start();

	await type(stdin, ["1", "\r", "goal water 2.5l", "\r"]);
	t.deepEqual(loadProgress(file).goals, { water: 2500 });
	t.like(loadProgress(file).events.at(-1), {
		action: "goalChanged",
		detail: "water:2500",
	});

	unmount();
});

test("never undoes past a goal line", async (t) => {
	const { file, stdin, lastFrame, unmount } = start();

	await type(stdin, ["1", "\r", "w 500", "\r", "goal water 3l", "\r"]);
	await type(stdin, ["u", "\r"]);
	t.true((lastFrame() ?? "").includes("Nothing to undo."));
	t.is(loadProgress(file).goals?.water, 3000);
	t.is(loadProgress(file).water.length, 1, "the line before stays");

	unmount();
});

test("saves a profile and turns it into targets", async (t) => {
	const { file, stdin, lastFrame, unmount } = start();

	await type(stdin, [
		"5",
		"\r",
		"\r",
		"30",
		"\r",
		"175",
		"\r",
		"70",
		"\r",
		"15",
		"\r",
		down,
		"\r",
		"\r",
		down,
		down,
		"\r",
	]);

	t.like(loadProgress(file).profile, {
		name: "Nova",
		height: 175,
		bodyFat: 15,
		gender: "male",
		goal: "buildMuscle",
	});
	t.true(actionsIn(file).includes("profileSaved"));

	await type(stdin, ["1"]);
	t.true((lastFrame() ?? "").includes("Daily targets:"));
	t.true((lastFrame() ?? "").includes("140 g"));

	unmount();
});

test("previews a theme while browsing and saves the chosen one", async (t) => {
	const { file, stdin, lastFrame, unmount } = start();
	const before = lastFrame() ?? "";

	await type(stdin, ["6", "\r", down]);
	t.not(lastFrame(), before);
	t.is(loadProgress(file).theme, undefined);

	await type(stdin, [escape]);
	t.is(loadProgress(file).theme, undefined);

	await type(stdin, ["\r", down, "\r"]);
	t.is(loadProgress(file).theme, "moss");
	t.true(actionsIn(file).includes("themeChanged"));

	unmount();
});

test("starts and stops a tomato, logging both", async (t) => {
	const { file, stdin, lastFrame, unmount } = start();

	await type(stdin, ["2", "\r", "\r"]);
	t.true((lastFrame() ?? "").includes("Focus started."));

	await type(stdin, ["\r", down, "\r"]);
	t.true((lastFrame() ?? "").includes("Tomato stopped."));
	t.is(loadProgress(file).focus.length, 0);
	t.deepEqual(actionsIn(file).slice(1), ["timerStarted", "timerStopped"]);

	unmount();
});

test("configures everyday quotes", async (t) => {
	const { file, stdin, unmount } = start();

	// Auto-refresh off, then the interval to 1 hour.
	await type(stdin, ["4", "\r", down, "\r", down, "\r", down, "\r"]);
	t.like(loadProgress(file).quotes, { autoRefresh: false, interval: 3600 });

	// The cursor comes back on Interval; 2 down is Categories. Tick Art, then
	// jump up to Done.
	await type(stdin, [down, down, "\r", "\r", up, "\r"]);
	t.deepEqual(loadProgress(file).quotes?.categories, ["art"]);
	t.is(
		actionsIn(file).filter((action) => action === "quoteSettingsChanged")
			.length,
		3,
	);

	unmount();
});

test("shows recent logs and every action in the logs view", async (t) => {
	const { stdin, lastFrame, unmount } = start({
		...empty,
		meals: [
			{
				at: "2026-10-03T08:00:00.000Z",
				food: "Oatmeal",
				calories: 350,
				protein: 12,
			},
		],
	});

	await settle();
	t.true((lastFrame() ?? "").includes("Oatmeal · 350 kcal"));

	await type(stdin, ["3", "\r"]);
	t.true((lastFrame() ?? "").includes("Opened Terminal Sigma"));

	unmount();
});

test("updates to the newest version and restarts into it", async (t) => {
	const fake = fakeUpdater();
	const { file, stdin, lastFrame, unmount } = start(
		empty,
		temporaryFile(),
		fake,
	);
	t.teardown(unmount);

	await type(stdin, ["9"]);
	t.true(await shows(lastFrame, "v1.1.0 available"));

	await type(stdin, ["\r"]);
	t.true(await shows(lastFrame, "Newest version: v1.1.0"));
	t.true((lastFrame() ?? "").includes("Current version: v1.0.0"));

	await type(stdin, ["\r"]);
	t.true(await shows(lastFrame, "Installed v1.1.0"));
	t.true(actionsIn(file).includes("updateInstalled"));

	await type(stdin, ["\r"]);
	t.deepEqual(fake.calls, ["install 1.1.0", "restart"]);
});

test("saves an environment variable, leaving the shell's alone", async (t) => {
	const { file, configFile, env, stdin, lastFrame, unmount } = start(
		empty,
		temporaryFile(),
		fakeUpdater(),
		// eslint-disable-next-line @typescript-eslint/naming-convention
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
	t.deepEqual(loadConfig(configFile).env, {
		// eslint-disable-next-line @typescript-eslint/naming-convention
		TERMINAL_SIGMA_FOCUS: "50",
	});
	t.is(env.TERMINAL_SIGMA_FOCUS, "50");
	t.is(env.TERMINAL_SIGMA_BREAK, "10");
	t.true((lastFrame() ?? "").includes("Restart Terminal Sigma"));
	t.deepEqual(actionsIn(file).slice(1), ["variableSaved"]);
	t.false(readFileSync(file, "utf8").includes('50"'), "no value in the logs");

	unmount();
});

test("masks a saved secret and clears it with an empty value", async (t) => {
	const { configFile, env, file, stdin, lastFrame, unmount } = start();

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
	t.false(readFileSync(file, "utf8").includes("ninja-key"));

	await type(stdin, ["\r", "\r"]);
	t.deepEqual(loadConfig(configFile).env, {});
	t.is(env.API_NINJAS_KEY, undefined);

	unmount();
});

test("marks a newly drawn quote", async (t) => {
	const { stdin, lastFrame, unmount } = start();
	await settle();
	t.false((lastFrame() ?? "").includes("✦ New"), "the first quote is not news");

	// Everyday Quotes, then Draw a new quote.
	await type(stdin, ["4", "\r", "\r"]);
	t.true(await shows(lastFrame, "✦ New"));

	unmount();
});

test("a language switch is not a new quote", async (t) => {
	const { stdin, lastFrame, unmount } = start();
	await settle();

	// Language, then 繁體中文.
	await type(stdin, ["7", "\r", down, "\r"]);
	t.false((lastFrame() ?? "").includes("✦"));
	t.true((lastFrame() ?? "").includes(messagesOf("zh-TW").menu.timer));

	unmount();
});

test("shows the whole new quote at once with reduced motion", async (t) => {
	const { stdin, lastFrame, unmount } = start(
		empty,
		temporaryFile(),
		fakeUpdater(),
		// eslint-disable-next-line @typescript-eslint/naming-convention
		{ TERMINAL_SIGMA_MOTION: "reduced" },
	);

	await type(stdin, ["4", "\r", "\r"]);
	const quoteLine = () => (lastFrame() ?? "").split("\n")[2];
	await shows(lastFrame, "✦ New");
	const before = quoteLine();
	t.true(before?.includes("✦ New"));

	for (let index = 0; index < 7; index++) {
		// eslint-disable-next-line no-await-in-loop
		await settle();
	}

	t.is(quoteLine(), before, "the quote does not type in");

	unmount();
});

test("keeps the menu preview's lines apart when it overflows", async (t) => {
	const { stdin, lastFrame, unmount } = start(
		progressSchema.parse({
			language: "en",
			profile: {
				name: "Ken",
				age: 30,
				height: 175,
				weight: 80,
				gender: "male",
				workStyle: "desk",
				goal: "loseFat",
			},
		}),
	);

	await type(stdin, ["1"]);
	await settle();

	t.true(
		(lastFrame() ?? "").includes("usually log now."),
		"the description text is visible and not overlapped",
	);

	unmount();
});

const right = "\u001B[C";

test("edits an older log in place, keeping its day and its neighbor", async (t) => {
	const at = new Date(Date.now() - 3 * 86_400_000).toISOString();
	const { file, stdin, lastFrame, unmount } = start({
		...empty,
		meals: [
			{ at, food: "Egg", servings: 2, calories: 144 },
			{ at, food: "Toast", calories: 160 },
		],
	});

	// History, the Diet filter, then the second item of that line.
	await type(stdin, ["3", "\r", right, right, down, "e"]);
	t.true((lastFrame() ?? "").includes("Toast 160kcal"));

	await type(stdin, [backspace.repeat(13), "Bagel 280kcal", "\r"]);
	t.deepEqual(loadProgress(file).meals, [
		{ at, food: "Egg", servings: 2, calories: 144 },
		{ at, food: "Bagel", calories: 280 },
	]);
	t.like(loadProgress(file).events.at(-1), {
		action: "logEdited",
		detail: "meal",
	});
	t.true((lastFrame() ?? "").includes("History"), "back in History");

	unmount();
});

test("keeps an edited log's kind", async (t) => {
	const at = new Date(Date.now() - 3 * 86_400_000).toISOString();
	const { file, stdin, lastFrame, unmount } = start({
		...empty,
		meals: [{ at, food: "Toast", calories: 160 }],
	});
	const before = loadProgress(file);

	await type(stdin, ["3", "\r", right, right, "e"]);
	await type(stdin, [backspace.repeat(15), "goal water 2.5l", "\r"]);
	t.deepEqual(loadProgress(file).meals, [{ at, food: "Toast", calories: 160 }]);
	t.deepEqual(loadProgress(file).goals, before.goals);
	t.true((lastFrame() ?? "").includes("An edit keeps its kind"), "says why");

	unmount();
});

test("cannot edit a workout of several exercises", async (t) => {
	const at = new Date(Date.now() - 3 * 86_400_000).toISOString();
	const { stdin, lastFrame, unmount } = start({
		...empty,
		workouts: [
			{
				at,
				activity: "strength",
				minutes: 30,
				intensity: "moderate",
				sets: [
					{ exercise: "bench", weight: 60, reps: 5 },
					{ exercise: "squat", weight: 80, reps: 5 },
				],
			},
		],
	});

	await type(stdin, ["3", "\r", right, right, right, "e"]);
	// The footer clips the message, so match its start.
	t.true((lastFrame() ?? "").includes("This entry can't be written"));

	unmount();
});

test("deletes a log, puts it back, and logs it again now", async (t) => {
	const at = new Date(Date.now() - 86_400_000).toISOString();
	const { file, stdin, lastFrame, unmount } = start({
		...empty,
		water: [{ at, milliliters: 500 }],
	});

	// History, then the Water filter: All, Focus, Diet, Workout, Water.
	await type(stdin, ["3", "\r", right, right, right, right, "d"]);
	t.deepEqual(loadProgress(file).water, []);
	t.true(actionsIn(file).includes("logDeleted"));

	await type(stdin, ["u"]);
	t.deepEqual(loadProgress(file).water, [{ at, milliliters: 500 }]);

	await type(stdin, ["r"]);
	t.is(loadProgress(file).water.length, 2);
	t.true((lastFrame() ?? "").includes("Logged Water"));

	// The Actions filter is the last of 12, 7 after Water.
	await type(stdin, [...Array.from({ length: 7 }, () => right), "e"]);
	t.true((lastFrame() ?? "").includes("cannot change"));

	unmount();
});

const left = "\u001B[D";

test("shows the week's trends, streak, and habits", async (t) => {
	const at = (back: number) => {
		const date = new Date();
		date.setDate(date.getDate() - back);
		return date.toISOString();
	};

	const { stdin, lastFrame, unmount } = start({
		...empty,
		water: [0, 1, 2].map((back) => ({ at: at(back), milliliters: 2000 })),
		habits: [0, 1, 2].map((back) => ({ at: at(back), name: "read" })),
	});

	// History, then left from All to Week, the last filter.
	await type(stdin, ["3", "\r", left]);
	const frame = lastFrame() ?? "";
	t.true(frame.includes("‹ Week ›"));
	t.false(frame.includes("XP"), "the log summary is for the list");
	t.true(frame.includes("avg 857 of 2,600 ml"));
	t.true(frame.includes("Streak: 3 days"));
	t.true(frame.includes("read 15%"));

	unmount();
});
