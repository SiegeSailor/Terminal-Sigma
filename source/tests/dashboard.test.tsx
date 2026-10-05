import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "ava";
import React from "react";
import { render } from "ink-testing-library";
import App from "../app.js";
import { loadProgress, type Progress } from "../progress.js";
import type { Updater } from "../update.js";

const options = { name: "Nova", focus: 25, break: 5 };
const empty: Progress = {
	language: "en",
	focus: [],
	meals: [],
	workouts: [],
	events: [],
};
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
) => ({
	file,
	...render(
		<App
			file={file}
			initialProgress={initialProgress}
			options={options}
			updater={updater}
		/>,
	),
});

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
		"1. Everyday Quotes",
		"2. Tomato Timer",
		"3. Health",
		"4. Logs",
		"5. Profile",
		"6. Theme",
		"7. Language",
		"8. Software Update",
	].map((label) => frame.indexOf(label));

	t.true(order.every((index, position) => index > (order[position - 1] ?? -1)));
	t.true(frame.includes("Enter to open"));
	t.true(frame.includes("Recent"));
	t.deepEqual(actionsIn(file), ["appOpened"]);

	unmount();
});

test("asks for a language on the first run and saves it", async (t) => {
	const { file, stdin, lastFrame, unmount } = start({
		focus: [],
		meals: [],
		workouts: [],
		events: [],
	});

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

test("logs a typed meal, rejecting a bad number", async (t) => {
	const { file, stdin, lastFrame, unmount } = start();

	await type(stdin, ["3", "\r", down, "\r", "Oatmeal", "\r", "lots", "\r"]);
	t.true((lastFrame() ?? "").includes("Enter a whole number"));

	await type(stdin, [backspace.repeat(4), "350", "\r", "12", "\r"]);
	t.like(loadProgress(file).meals[0], {
		food: "Oatmeal",
		calories: 350,
		protein: 12,
	});
	t.true((lastFrame() ?? "").includes("Logged Oatmeal"));

	unmount();
});

test("autocompletes a common food and its nutrition", async (t) => {
	const { file, stdin, lastFrame, unmount } = start();

	await type(stdin, ["3", "\r", down, "\r", "chick"]);
	t.true((lastFrame() ?? "").includes("Chicken breast"));

	await type(stdin, [down, "\r", "\r", "\r"]);
	t.like(loadProgress(file).meals[0], {
		food: "Chicken breast",
		calories: 248,
		protein: 46,
	});

	unmount();
});

test("logs a workout and scales its experience", async (t) => {
	const { file, stdin, lastFrame, unmount } = start();

	await type(stdin, [
		"3",
		"\r",
		down,
		down,
		"\r",
		"\r",
		"30",
		"\r",
		down,
		down,
		"\r",
	]);
	t.like(loadProgress(file).workouts[0], {
		activity: "running",
		minutes: 30,
		intensity: "vigorous",
	});
	t.true((lastFrame() ?? "").includes("+60 XP"));

	unmount();
});

test("repeats a past workout in 1 step", async (t) => {
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

	await type(stdin, ["3", "\r", down, down, "\r", "\r"]);
	t.like(loadProgress(file).workouts[1], {
		activity: "cycling",
		minutes: 45,
		intensity: "moderate",
	});

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

	await type(stdin, ["3"]);
	t.true((lastFrame() ?? "").includes("140 g protein left"));

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
	await type(stdin, ["1", "\r", down, "\r", down, "\r", down, "\r"]);
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

	await type(stdin, ["8"]);
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
