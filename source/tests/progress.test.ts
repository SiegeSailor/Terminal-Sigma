import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "ava";
import {
	experienceOf,
	levelOf,
	loadProgress,
	parseEntry,
	type Progress,
	saveProgress,
	todayOf,
} from "../progress.js";

const temporaryFile = () =>
	path.join(
		mkdtempSync(path.join(tmpdir(), "terminal-sigma-")),
		"progress.json",
	);

const sample: Progress = {
	focus: [{ at: "2026-10-03T09:00:00.000Z", minutes: 25 }],
	meals: [
		{ at: "2026-10-03T08:00:00.000Z", food: "Oatmeal", calories: 350 },
		{ at: "2026-10-01T08:00:00.000Z", food: "Toast" },
	],
	workouts: [{ at: "2026-10-03T07:00:00.000Z", activity: "Run", minutes: 80 }],
};

test("parses an entry with and without an amount", (t) => {
	t.deepEqual(parseEntry("Oatmeal 350"), { label: "Oatmeal", amount: 350 });
	t.deepEqual(parseEntry("  Chicken salad  "), { label: "Chicken salad" });
	t.deepEqual(parseEntry("5k run"), { label: "5k run" });
	t.is(parseEntry("   "), undefined);
});

test("derives experience and level from entries", (t) => {
	t.is(experienceOf(sample), 25 + 2 * 5 + 80);
	t.is(levelOf(0), 1);
	t.is(levelOf(99), 1);
	t.is(levelOf(experienceOf(sample)), 2);
});

test("counts only today's entries", (t) => {
	const today = todayOf(sample, Date.parse("2026-10-03T12:00:00.000Z"));

	t.deepEqual(today, {
		focusSessions: 1,
		meals: 1,
		calories: 350,
		workoutMinutes: 80,
	});
});

test("starts empty and round-trips through the file", (t) => {
	const file = temporaryFile();

	t.deepEqual(loadProgress(file), { focus: [], meals: [], workouts: [] });
	saveProgress(file, sample);
	t.deepEqual(loadProgress(file), sample);
});

test("refuses an unreadable file without touching it", (t) => {
	const file = temporaryFile();
	writeFileSync(file, "{ not json");

	t.throws(() => loadProgress(file), { message: /unreadable/v });
	t.is(readFileSync(file, "utf8"), "{ not json");
});

test("never saves what it could not load", (t) => {
	const file = temporaryFile();
	saveProgress(file, sample);

	t.throws(() => {
		saveProgress(file, {
			...sample,
			workouts: [
				{ at: "2026-10-03T07:00:00.000Z", activity: "Run", minutes: 0 },
			],
		});
	});
	t.deepEqual(loadProgress(file), sample);
});
