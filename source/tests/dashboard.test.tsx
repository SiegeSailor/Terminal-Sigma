import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "ava";
import React from "react";
import { render } from "ink-testing-library";
import App from "../app.js";
import { loadProgress, type Progress } from "../progress.js";

const options = { name: "Nova", focus: 25, break: 5 };
const empty: Progress = { language: "en", focus: [], meals: [], workouts: [] };
const down = "\u001B[B";
const backspace = "\u007F";

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

const start = (initialProgress: Progress = empty, file = temporaryFile()) => ({
	file,
	...render(
		<App file={file} initialProgress={initialProgress} options={options} />,
	),
});

test("renders the dashboard shell", (t) => {
	const { lastFrame, unmount } = start();
	const frame = lastFrame() ?? "";

	for (const text of [
		"Terminal Sigma",
		"Nova",
		"Lv 1",
		"Tomato Timer",
		"Health",
		"Recent",
	]) {
		t.true(frame.includes(text), `shows ${text}`);
	}

	unmount();
});

test("asks for a language on the first run and saves it", async (t) => {
	const { file, stdin, lastFrame, unmount } = start({
		focus: [],
		meals: [],
		workouts: [],
	});

	t.true((lastFrame() ?? "").includes("언어 선택"));
	await type(stdin, [down, "\r"]);

	t.is(loadProgress(file).language, "zh-TW");
	t.true((lastFrame() ?? "").includes("番茄鐘"));

	unmount();
});

test("switches to Korean from the menu", async (t) => {
	const { file, stdin, lastFrame, unmount } = start();

	await type(stdin, ["7", "\r", down, down, "\r"]);

	t.is(loadProgress(file).language, "ko");
	t.true((lastFrame() ?? "").includes("토마토 타이머"));

	unmount();
});

test("logs a meal from Health, rejecting a bad number", async (t) => {
	const { file, stdin, lastFrame, unmount } = start();

	await type(stdin, ["2", "\r", down, "\r", "Oatmeal", "\r", "lots", "\r"]);
	t.true((lastFrame() ?? "").includes("Enter a whole number from 0 to 5000."));

	await type(stdin, [backspace.repeat(4), "350", "\r", "12", "\r"]);
	t.like(loadProgress(file).meals[0], {
		food: "Oatmeal",
		calories: 350,
		protein: 12,
	});
	t.true((lastFrame() ?? "").includes("Logged Oatmeal"));

	unmount();
});

test("logs a workout and scales its experience", async (t) => {
	const { file, stdin, lastFrame, unmount } = start();

	await type(stdin, [
		"2",
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
		down,
		"\r",
		"\r",
		down,
		down,
		"\r",
	]);

	t.deepEqual(loadProgress(file).profile, {
		name: "Nova",
		age: 30,
		height: 175,
		weight: 70,
		gender: "male",
		workStyle: "desk",
		goal: "buildMuscle",
	});
	t.true((lastFrame() ?? "").includes("140 g protein"));

	unmount();
});

test("changes the theme", async (t) => {
	const { file, stdin, lastFrame, unmount } = start();

	await type(stdin, ["6", "\r", down, "\r"]);

	t.is(loadProgress(file).theme, "moss");
	t.true((lastFrame() ?? "").includes("Theme set to Moss."));

	unmount();
});

test("previews a theme while browsing without saving it", async (t) => {
	const { file, stdin, lastFrame, unmount } = start();
	const before = lastFrame() ?? "";

	await type(stdin, ["6", "\r", down]);
	t.not(lastFrame(), before);
	t.is(loadProgress(file).theme, undefined);

	await type(stdin, ["\u001B"]);
	t.is(loadProgress(file).theme, undefined);
	t.true((lastFrame() ?? "").includes("Tomato Timer"));

	unmount();
});

test("stops a running tomato without credit", async (t) => {
	const { file, stdin, lastFrame, unmount } = start();

	await type(stdin, ["\r"]);
	t.true((lastFrame() ?? "").includes("Focus started."));

	await type(stdin, ["\r", down, "\r"]);
	t.true((lastFrame() ?? "").includes("Tomato stopped."));
	t.is(loadProgress(file).focus.length, 0);

	unmount();
});

test("shows recent logs on the menu and every log in the logs view", async (t) => {
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
		workouts: [
			{
				at: "2026-10-02T07:00:00.000Z",
				activity: "strength",
				minutes: 20,
				intensity: "light",
			},
		],
	});

	t.true((lastFrame() ?? "").includes("Oatmeal · 350 kcal"));

	await type(stdin, ["3", "\r"]);
	const frame = lastFrame() ?? "";
	t.true(frame.includes("Strength · 20 min · Light"));
	t.true(frame.includes("2 logs · 25 XP"));

	unmount();
});
