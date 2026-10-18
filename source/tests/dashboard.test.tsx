import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "ava";
import React from "react";
import { render } from "ink-testing-library";
import App from "../app.js";
import type { Asker, AskReply, AskRequest } from "../asker.js";
import { loadCoach, saveCoach } from "../coach.js";
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

// A local calendar day back, which a DST change cannot turn into today.
const daysAgo = (days: number) => {
	const date = new Date();
	date.setDate(date.getDate() - days);
	return date.toISOString();
};

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
	asker?: Asker,
) => {
	const configFile = path.join(path.dirname(file), "config.json");

	return {
		file,
		configFile,
		env,
		...render(
			<App
				asker={asker}
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
		"3. Coach",
		"4. History",
		"5. Everyday Quotes",
		"6. Profile",
		"7. Theme",
		"8. Language",
		"9. Environment",
		"0. Software Update",
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

	await type(stdin, ["8", "\r", down, down, "\r"]);

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
	const yesterday = daysAgo(1);
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
		"6",
		"\r",
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

test("keeps unknown profile fields when saving the profile", async (t) => {
	const { file, stdin, unmount } = start(
		progressSchema.parse({
			language: "en",
			profile: {
				name: "Ken",
				age: 30,
				height: 175,
				weight: 70,
				gender: "male",
				workStyle: "desk",
				goal: "maintain",
				skinTone: 2,
				newerField: "kept",
			},
		}),
	);

	await type(stdin, [
		"6",
		"\r",
		"\r",
		...Array.from({ length: 8 }, () => "\r"),
	]);
	t.true(actionsIn(file).includes("profileSaved"));
	t.like(loadProgress(file).profile, {
		name: "Ken",
		skinTone: 2,
		newerField: "kept",
	});

	unmount();
});

test("previews a theme while browsing and saves the chosen one", async (t) => {
	const { file, stdin, lastFrame, unmount } = start();
	const before = lastFrame() ?? "";

	await type(stdin, ["7", "\r", down]);
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
	await type(stdin, ["5", "\r", down, "\r", down, "\r", down, "\r"]);
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

	await type(stdin, ["4", "\r"]);
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

	await type(stdin, ["0"]);
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

	await type(stdin, ["9", "\r"]);
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
		"9",
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
	await type(stdin, ["5", "\r", "\r"]);
	t.true(await shows(lastFrame, "✦ New"));

	unmount();
});

test("a language switch is not a new quote", async (t) => {
	const { stdin, lastFrame, unmount } = start();
	await settle();

	// Language, then 繁體中文.
	await type(stdin, ["8", "\r", down, "\r"]);
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

	await type(stdin, ["5", "\r", "\r"]);
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
	const at = daysAgo(3);
	const { file, stdin, lastFrame, unmount } = start({
		...empty,
		meals: [
			{ at, food: "Egg", servings: 2, calories: 144 },
			{ at, food: "Toast", calories: 160 },
		],
	});

	// History, the Diet filter, then the second item of that line.
	await type(stdin, ["4", "\r", right, right, down, "e"]);
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
	const at = daysAgo(3);
	const { file, stdin, lastFrame, unmount } = start({
		...empty,
		meals: [{ at, food: "Toast", calories: 160 }],
	});
	const before = loadProgress(file);

	await type(stdin, ["4", "\r", right, right, "e"]);
	await type(stdin, [backspace.repeat(15), "goal water 2.5l", "\r"]);
	t.deepEqual(loadProgress(file).meals, [{ at, food: "Toast", calories: 160 }]);
	t.deepEqual(loadProgress(file).goals, before.goals);
	t.true((lastFrame() ?? "").includes("An edit keeps its kind"), "says why");

	unmount();
});

test("cannot edit a workout of several exercises", async (t) => {
	const at = daysAgo(3);
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

	await type(stdin, ["4", "\r", right, right, right, "e"]);
	// The footer clips the message, so match its start.
	t.true((lastFrame() ?? "").includes("This entry can't be written"));

	unmount();
});

test("deletes a log, puts it back, and logs it again now", async (t) => {
	const at = daysAgo(1);
	const { file, stdin, lastFrame, unmount } = start({
		...empty,
		water: [{ at, milliliters: 500 }],
	});

	// History, then the Water filter: All, Focus, Diet, Workout, Water.
	await type(stdin, ["4", "\r", right, right, right, right, "d"]);
	t.deepEqual(loadProgress(file).water, []);
	t.true(actionsIn(file).includes("logDeleted"));

	await type(stdin, ["u"]);
	t.deepEqual(loadProgress(file).water, [{ at, milliliters: 500 }]);

	await type(stdin, ["r"]);
	t.is(loadProgress(file).water.length, 2);
	t.true((lastFrame() ?? "").includes("Logged Water"));
	t.false((lastFrame() ?? "").includes("u to undo"));

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
	await type(stdin, ["4", "\r", left]);
	const frame = lastFrame() ?? "";
	t.true(frame.includes("‹ Week ›"));
	t.false(frame.includes("XP"), "the log summary is for the list");
	t.true(frame.includes("avg 857 of 2,600 ml"));
	t.true(frame.includes("Streak: 3 days"));
	t.true(frame.includes("read 15%"));

	unmount();
});

test("chooses an appearance, previewing it before saving", async (t) => {
	const profile = {
		name: "Nova",
		age: 30,
		height: 170,
		weight: 65,
		gender: "other",
		workStyle: "desk",
		goal: "maintain",
	} as const;
	const { file, stdin, lastFrame, unmount } = start({ ...empty, profile });

	// Profile, then Appearance.
	await type(stdin, ["6", "\r", down, "\r"]);
	t.true((lastFrame() ?? "").includes("Skin tone"));

	// Tan, then the defaults for style, color, and facial hair, then glasses.
	await type(stdin, [down, "\r", "\r", "\r", "\r", up, "\r"]);
	t.like(loadProgress(file).profile, {
		skinTone: 4,
		hairStyle: "bob",
		glasses: true,
	});
	t.true(actionsIn(file).includes("appearanceSaved"));
	t.true((lastFrame() ?? "").includes("Appearance saved"));

	unmount();
});

test("asks for the body first when there is no profile", async (t) => {
	const { file, stdin, lastFrame, unmount } = start();

	await type(stdin, ["6", "\r", down, "\r"]);
	const frame = lastFrame() ?? "";
	t.true(frame.includes("then choose your appearance"));
	t.false(frame.includes("Skin tone"), "no appearance form to fill in");
	t.false(actionsIn(file).includes("appearanceSaved"));
	t.is(loadProgress(file).profile, undefined);

	unmount();
});

test("shows the streak beside the character's name", async (t) => {
	const { lastFrame, unmount } = start({
		...empty,
		notes: [
			{ at: daysAgo(1), text: "yesterday" },
			{ at: new Date().toISOString(), text: "today" },
		],
	});

	await settle();
	t.true((lastFrame() ?? "").includes("2-day streak"));

	unmount();
});

test("says what a log earned on the character's label", async (t) => {
	const { stdin, lastFrame, unmount } = start();

	// Log, then 1 glass of water. Recent shows "+1 XP" too, so look for the
	// label itself.
	await type(stdin, ["1", "\r", "w", "\r"]);
	t.true(await shows(lastFrame, "Drinking water… +1 XP"));

	unmount();
});

const asking = (reply: (request: AskRequest) => AskReply) => {
	const requests: AskRequest[] = [];
	const asker: Asker = async (request) => {
		requests.push(request);
		return reply(request);
	};

	return { asker, requests };
};

const keys = {
	// eslint-disable-next-line @typescript-eslint/naming-convention
	OPENAI_API_KEY: "sk-test-openai-1234",
	// eslint-disable-next-line @typescript-eslint/naming-convention
	ANTHROPIC_API_KEY: "sk-ant-test-5678",
};

test("explains how to set up the Coach without accounts", async (t) => {
	const { stdin, lastFrame, unmount } = start();
	t.teardown(unmount);

	await type(stdin, ["3", "\r"]);
	t.true((lastFrame() ?? "").includes("Add an account under Accounts"));
});

test("adds an account, masking its key and keeping it out of progress.json", async (t) => {
	const { file, configFile, stdin, lastFrame, unmount } = start();
	t.teardown(unmount);

	// Coach, Accounts, Add, then OpenAI, its name, the key, its model, no URL.
	await type(stdin, [
		"3",
		"\r",
		"\r",
		"\r",
		"\r",
		"\r",
		"sk-test-123456789",
		"\r",
		"\r",
		"\r",
	]);
	t.like(loadConfig(configFile).accounts[0], {
		provider: "openai",
		apiKey: "sk-test-123456789",
		model: "gpt-5.5",
	});
	t.true((lastFrame() ?? "").includes("••••6789"));
	t.false((lastFrame() ?? "").includes("sk-test"));
	t.false(readFileSync(file, "utf8").includes("sk-test"));
	t.true(actionsIn(file).includes("accountAdded"));
});

test("reviews the week and says when it fell back", async (t) => {
	const { asker, requests } = asking((request) => {
		const [first, second] = request.accounts;
		return first && second
			? {
					ok: true,
					result: "Great week!",
					account: second,
					attempts: [
						{
							account: first,
							failure: { kind: "rateLimited", message: "429" },
						},
						{ account: second },
					],
				}
			: { ok: false, attempts: [] };
	});
	const { file, stdin, lastFrame, unmount } = start(
		empty,
		temporaryFile(),
		fakeUpdater(),
		keys,
		asker,
	);
	t.teardown(unmount);

	// Coach, then Review my week.
	await type(stdin, ["3", "\r", down, down, "\r"]);
	t.true(await shows(lastFrame, "Great week!"));
	t.true(
		(lastFrame() ?? "").includes(
			"OPENAI_API_KEY could not answer, so ANTHROPIC_API_KEY did.",
		),
	);
	t.is(requests[0]?.kind, "week");
	t.true(requests[0]?.instructions.includes("Daily targets") ?? false);
	t.deepEqual(
		loadCoach(
			path.join(path.dirname(file), "coach.json"),
		).sessions[0]?.turns.map((turn) => [turn.role, turn.via]),
		[
			["user", undefined],
			["assistant", "ANTHROPIC_API_KEY"],
		],
	);
	t.true(actionsIn(file).includes("coachAsked"));
	t.false(
		readFileSync(file, "utf8").includes("Great week"),
		"answers stay out of progress.json",
	);
});

test("saves a planned week", async (t) => {
	const plan = {
		title: "Base building",
		days: [
			{ weekday: 1, activity: "running", minutes: 30, intensity: "light" },
		],
	};
	const { asker } = asking((request) =>
		request.accounts[0]
			? {
					ok: true,
					result: plan,
					account: request.accounts[0],
					attempts: [{ account: request.accounts[0] }],
				}
			: { ok: false, attempts: [] },
	);
	const { file, stdin, lastFrame, unmount } = start(
		empty,
		temporaryFile(),
		fakeUpdater(),
		keys,
		asker,
	);
	t.teardown(unmount);

	// Coach, then Plan my workouts, then Save this plan just below it.
	await type(stdin, ["3", "\r", down, down, down, "\r"]);
	t.true(await shows(lastFrame, "Mon · Running · 30 min · Light"));

	await type(stdin, [down, "\r"]);
	t.like(loadProgress(file).plans[0], { title: "Base building" });
	t.true(actionsIn(file).includes("planSaved"));
});

test("says it could not read a plan that does not fit, and saves nothing", async (t) => {
	const { asker } = asking((request) =>
		request.accounts[0]
			? {
					ok: true,
					result: { title: "x", days: [{ weekday: 9 }] },
					account: request.accounts[0],
					attempts: [{ account: request.accounts[0] }],
				}
			: { ok: false, attempts: [] },
	);
	const { file, stdin, lastFrame, unmount } = start(
		empty,
		temporaryFile(),
		fakeUpdater(),
		keys,
		asker,
	);
	t.teardown(unmount);

	await type(stdin, ["3", "\r", down, down, down, "\r"]);
	t.true(await shows(lastFrame, "not a plan Terminal Sigma could read"));
	t.false((lastFrame() ?? "").includes("Save this plan"));
	t.deepEqual(
		loadCoach(path.join(path.dirname(file), "coach.json")).sessions,
		[],
	);
});

test("treats an answer that cleans to nothing as no answer, and saves nothing", async (t) => {
	const { asker } = asking((request) =>
		request.accounts[0]
			? {
					ok: true,
					result: "\u001B]8;;https://x.example\u0007\u001B]8;;\u0007\r\n",
					account: request.accounts[0],
					attempts: [{ account: request.accounts[0] }],
				}
			: { ok: false, attempts: [] },
	);
	const { file, stdin, lastFrame, unmount } = start(
		empty,
		temporaryFile(),
		fakeUpdater(),
		keys,
		asker,
	);
	t.teardown(unmount);

	await type(stdin, ["3", "\r", down, down, "\r"]);
	t.true(await shows(lastFrame, "No account could answer"));
	t.deepEqual(
		loadCoach(path.join(path.dirname(file), "coach.json")).sessions,
		[],
	);
});

test("cancels a request with Esc, and a late answer never shows", async (t) => {
	const asker: Asker = async (request) =>
		new Promise((resolve) => {
			request.signal?.addEventListener("abort", () => {
				const [account] = request.accounts;
				resolve(
					account
						? {
								ok: true,
								result: "Late answer",
								account,
								attempts: [{ account }],
							}
						: { ok: false, attempts: [] },
				);
			});
		});
	const { file, stdin, lastFrame, unmount } = start(
		empty,
		temporaryFile(),
		fakeUpdater(),
		keys,
		asker,
	);
	t.teardown(unmount);

	await type(stdin, ["3", "\r", down, "\r"]);
	t.true((lastFrame() ?? "").includes("Asking OPENAI_API_KEY"));

	await type(stdin, [escape]);
	t.true((lastFrame() ?? "").includes("Cancelled"));
	t.false((lastFrame() ?? "").includes("Asking"));
	t.false((lastFrame() ?? "").includes("Late answer"));
	t.deepEqual(
		loadCoach(path.join(path.dirname(file), "coach.json")).sessions,
		[],
	);
});

test("scrolls a long answer row by row in Read", async (t) => {
	const file = temporaryFile();
	const at = new Date().toISOString();
	saveCoach(path.join(path.dirname(file), "coach.json"), {
		sessions: [
			{
				id: "s1",
				startedAt: at,
				turns: [
					{
						role: "assistant",
						content: Array.from(
							{ length: 30 },
							(_, index) => `row ${index + 1}`,
						).join("\n"),
						at,
					},
				],
			},
		],
	});
	const { stdin, lastFrame, unmount } = start(empty, file, fakeUpdater(), keys);
	t.teardown(unmount);

	// Coach, then Read the conversation, after Ask, Today, Week, and Plan.
	await type(stdin, ["3", "\r", down, down, down, down, "\r"]);
	t.regex(lastFrame() ?? "", /row 1\b/v, "Read opens on the latest turn");
	t.false((lastFrame() ?? "").includes("row 30"));

	const rowsShown = () =>
		Array.from((lastFrame() ?? "").matchAll(/row \d+/gv), ([row]) => row);

	await type(
		stdin,
		Array.from({ length: 20 }, () => down),
	);
	const bottom = rowsShown();
	t.true(bottom.includes("row 30"), "the last row comes into view");
	t.false(bottom.includes("row 1"));

	// Scrolling stops at the last row, so more ↓ do nothing and 1 ↑ moves at once.
	await type(stdin, [down, down, down]);
	t.deepEqual(rowsShown(), bottom);
	await type(stdin, [up]);
	t.notDeepEqual(rowsShown(), bottom);
});

test("estimates an unknown food with the Coach, and logs it on Enter", async (t) => {
	const { asker, requests } = asking((request) =>
		request.accounts[0]
			? {
					ok: true,
					result: { calories: 450, protein: 20, carbs: 50, fat: 15 },
					account: request.accounts[0],
					attempts: [{ account: request.accounts[0] }],
				}
			: { ok: false, attempts: [] },
	);
	const { file, stdin, lastFrame, unmount } = start(
		empty,
		temporaryFile(),
		fakeUpdater(),
		keys,
		asker,
	);

	await type(stdin, ["1", "\r", "mystery stew"]);
	t.true((lastFrame() ?? "").includes("Tab estimates it with the Coach"));

	await type(stdin, ["\t"]);
	t.true(await shows(lastFrame, "mystery stew 450kcal 20p 50c 15f"));
	t.is(requests[0]?.kind, "estimate");
	t.deepEqual(loadProgress(file).meals, [], "nothing logged on a guess");

	await type(stdin, ["\r"]);
	t.like(loadProgress(file).meals[0], {
		food: "mystery stew",
		calories: 450,
		protein: 20,
	});

	unmount();
});

// A reply the test releases by hand, to hold an estimate in flight.
const held = () => {
	const requests: AskRequest[] = [];
	const releases: Array<() => void> = [];
	const asker: Asker = async (request) => {
		requests.push(request);
		await new Promise<void>((resolve) => {
			releases.push(resolve);
		});
		return request.accounts[0]
			? {
					ok: true,
					result: { calories: 450, protein: 20, carbs: 50, fat: 15 },
					account: request.accounts[0],
					attempts: [{ account: request.accounts[0] }],
				}
			: { ok: false, attempts: [] };
	};

	return { asker, requests, releases };
};

test("drops an estimate that arrives after the line changed", async (t) => {
	const { asker, releases } = held();
	const { stdin, lastFrame, unmount } = start(
		empty,
		temporaryFile(),
		fakeUpdater(),
		keys,
		asker,
	);
	t.teardown(unmount);

	await type(stdin, ["1", "\r", "mystery stew", "\t", "s"]);
	releases[0]?.();
	await settle();
	const frame = lastFrame() ?? "";

	t.true(frame.includes("mystery stews"));
	t.false(frame.includes("450kcal"));
});

test("a second Tab aborts the first estimate, and Esc aborts the second", async (t) => {
	const { asker, requests } = held();
	const { stdin, unmount } = start(
		empty,
		temporaryFile(),
		fakeUpdater(),
		keys,
		asker,
	);
	t.teardown(unmount);

	await type(stdin, ["1", "\r", "mystery stew", "\t", "\t"]);
	t.is(requests.length, 2);
	t.true(requests[0]?.signal?.aborted);
	t.false(requests[1]?.signal?.aborted);

	await type(stdin, [escape]);
	t.true(requests[1]?.signal?.aborted);
});

test("aborts a request in flight when the dashboard closes", async (t) => {
	const { asker, requests, releases } = held();
	const { file, stdin, unmount } = start(
		empty,
		temporaryFile(),
		fakeUpdater(),
		keys,
		asker,
	);

	await type(stdin, ["3", "\r", down, "\r"]);
	t.is(requests.length, 1);
	unmount();
	t.true(requests[0]?.signal?.aborted);
	releases[0]?.();
	await settle();
	t.deepEqual(
		loadCoach(path.join(path.dirname(file), "coach.json")).sessions,
		[],
	);
});

test("Tab on an unknown food without an account asks nothing and logs no event", async (t) => {
	const { asker, requests } = asking(() => ({ ok: false, attempts: [] }));
	const { file, stdin, unmount } = start(
		empty,
		temporaryFile(),
		fakeUpdater(),
		{},
		asker,
	);
	t.teardown(unmount);

	await type(stdin, ["1", "\r", "mystery stew", "\t"]);
	t.is(requests.length, 0);
	t.false(actionsIn(file).includes("coachAsked"));
});
