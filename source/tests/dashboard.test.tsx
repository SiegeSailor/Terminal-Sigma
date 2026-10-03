import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import test from "ava";
import React from "react";
import { render } from "ink-testing-library";
import Index from "../commands/index.js";
import { loadProgress } from "../progress.js";

const options = { name: "Nova", focus: 25, break: 5 };
const settle = async () =>
	new Promise((resolve) => {
		setTimeout(resolve, 200);
	});

// Each test gets its own data folder, never the real ~/.terminal-sigma.
test.beforeEach(() => {
	process.env.TERMINAL_SIGMA_HOME = mkdtempSync(
		path.join(tmpdir(), "terminal-sigma-"),
	);
	delete process.env.API_NINJAS_KEY;
});

test.serial("renders the dashboard shell", (t) => {
	const { lastFrame, unmount } = render(<Index options={options} />);
	const frame = lastFrame() ?? "";

	t.true(frame.includes("TERMINAL SIGMA"));
	t.true(frame.includes("STATUS BOARD"));
	t.true(frame.includes("NAVIGATION MENU"));
	t.true(frame.includes("Nova"));
	t.true(frame.includes("LV 1"));

	unmount();
});

test.serial("logs a meal from the menu into progress.json", async (t) => {
	const { stdin, lastFrame, unmount } = render(<Index options={options} />);

	for (const keys of ["2", "\r", "Oatmeal 350", "\r"]) {
		// eslint-disable-next-line no-await-in-loop
		await settle();
		stdin.write(keys);
	}

	await settle();
	const saved = loadProgress(
		path.join(process.env.TERMINAL_SIGMA_HOME ?? "", "progress.json"),
	);

	t.like(saved.meals[0], { food: "Oatmeal", calories: 350 });
	t.true((lastFrame() ?? "").includes("Logged Oatmeal"));

	unmount();
});
