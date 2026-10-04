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

test("renders the dashboard shell", (t) => {
	const { lastFrame, unmount } = render(
		<App file={temporaryFile()} initialProgress={empty} options={options} />,
	);
	const frame = lastFrame() ?? "";

	for (const text of [
		"Terminal Sigma",
		"Nova",
		"Lv 1",
		"Tomato Timer",
		"Logs",
	]) {
		t.true(frame.includes(text), `shows ${text}`);
	}

	unmount();
});

test("asks for a language on the first run and saves it", async (t) => {
	const file = temporaryFile();
	const { stdin, lastFrame, unmount } = render(
		<App
			file={file}
			initialProgress={{ focus: [], meals: [], workouts: [] }}
			options={options}
		/>,
	);

	t.true((lastFrame() ?? "").includes("選擇語言"));
	await type(stdin, [down, "\r"]);

	t.is(loadProgress(file).language, "zh-TW");
	t.true((lastFrame() ?? "").includes("番茄鐘"));

	unmount();
});

test("logs a meal step by step, rejecting a bad number", async (t) => {
	const file = temporaryFile();
	const { stdin, lastFrame, unmount } = render(
		<App file={file} initialProgress={empty} options={options} />,
	);

	await type(stdin, ["2", "\r", "Oatmeal", "\r", "lots", "\r"]);
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
	const file = temporaryFile();
	const { stdin, lastFrame, unmount } = render(
		<App file={file} initialProgress={empty} options={options} />,
	);

	await type(stdin, ["3", "\r", "\r", "30", "\r", down, down, "\r"]);
	t.like(loadProgress(file).workouts[0], {
		activity: "running",
		minutes: 30,
		intensity: "vigorous",
	});
	t.true((lastFrame() ?? "").includes("+60 XP"));

	unmount();
});

test("stops a running tomato without credit", async (t) => {
	const file = temporaryFile();
	const { stdin, lastFrame, unmount } = render(
		<App file={file} initialProgress={empty} options={options} />,
	);

	await type(stdin, ["\r"]);
	t.true((lastFrame() ?? "").includes("Focus started."));

	await type(stdin, ["\r", down, "\r"]);
	t.true((lastFrame() ?? "").includes("Tomato stopped."));
	t.is(loadProgress(file).focus.length, 0);

	unmount();
});

test("shows every log in the logs view", async (t) => {
	const { stdin, lastFrame, unmount } = render(
		<App
			file={temporaryFile()}
			initialProgress={{
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
			}}
			options={options}
		/>,
	);

	await type(stdin, ["4", "\r"]);
	const frame = lastFrame() ?? "";
	t.true(frame.includes("Oatmeal · 350 kcal · 12 g protein"));
	t.true(frame.includes("Strength · 20 min · Light"));
	t.true(frame.includes("2 logs · 25 XP"));

	unmount();
});
