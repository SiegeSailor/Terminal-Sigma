import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "ava";
import {
	experienceOf,
	levelOf,
	loadProgress,
	logsOf,
	parseWholeNumber,
	type Progress,
	saveProgress,
	todayOf,
	workoutExperience,
} from "../progress.js";

const temporaryFile = () =>
	path.join(
		mkdtempSync(path.join(tmpdir(), "terminal-sigma-")),
		"progress.json",
	);

const sample: Progress = {
	language: "en",
	focus: [{ at: "2026-10-03T09:00:00.000Z", minutes: 25 }],
	meals: [
		{
			at: "2026-10-03T08:00:00.000Z",
			food: "Oatmeal",
			calories: 350,
			protein: 12,
		},
		{ at: "2026-10-01T08:00:00.000Z", food: "Toast" },
	],
	workouts: [
		{
			at: "2026-10-03T07:00:00.000Z",
			activity: "running",
			minutes: 40,
			intensity: "vigorous",
		},
	],
};

test("accepts only whole numbers within range", (t) => {
	t.is(parseWholeNumber(" 350 ", 0, 5000), 350);
	t.is(parseWholeNumber("0", 0, 10), 0);
	t.is(parseWholeNumber("0", 1, 10), undefined);
	t.is(parseWholeNumber("12.5", 0, 100), undefined);
	t.is(parseWholeNumber("-3", 0, 100), undefined);
	t.is(parseWholeNumber("abc", 0, 100), undefined);
	t.is(parseWholeNumber("", 0, 100), undefined);
});

test("scales workout experience by intensity", (t) => {
	const at = "2026-10-03T07:00:00.000Z";
	const yoga = (intensity: "light" | "moderate" | "vigorous") =>
		workoutExperience({ at, activity: "yoga", minutes: 30, intensity });

	t.is(yoga("light"), 30);
	t.is(yoga("moderate"), 45);
	t.is(yoga("vigorous"), 60);
	t.is(workoutExperience({ at, activity: "Run", minutes: 30 }), 30);
});

test("derives experience and level from entries", (t) => {
	t.is(experienceOf(sample), 25 + 2 * 5 + 80);
	t.is(levelOf(0), 1);
	t.is(levelOf(99), 1);
	t.is(levelOf(experienceOf(sample)), 2);
});

test("lists every log newest first", (t) => {
	t.deepEqual(
		logsOf(sample).map((log) => [log.kind, log.experience]),
		[
			["focus", 25],
			["meal", 5],
			["workout", 80],
			["meal", 5],
		],
	);
});

test("counts only today's entries", (t) => {
	t.deepEqual(todayOf(sample, Date.parse("2026-10-03T12:00:00.000Z")), {
		focusSessions: 1,
		meals: 1,
		calories: 350,
		protein: 12,
		workoutMinutes: 40,
	});
});

test("starts empty and round-trips through the file", (t) => {
	const file = temporaryFile();

	t.deepEqual(loadProgress(file), { focus: [], meals: [], workouts: [] });
	saveProgress(file, sample);
	t.deepEqual(loadProgress(file), sample);
});

test("still loads a file written by 1.0.0", (t) => {
	const file = temporaryFile();
	writeFileSync(
		file,
		JSON.stringify({
			focus: [],
			meals: [
				{ at: "2026-10-03T08:00:00.000Z", food: "Oatmeal", calories: 350 },
			],
			workouts: [
				{ at: "2026-10-03T07:00:00.000Z", activity: "Run", minutes: 30 },
			],
		}),
	);

	const progress = loadProgress(file);
	t.is(progress.language, undefined);
	t.is(experienceOf(progress), 35);
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
