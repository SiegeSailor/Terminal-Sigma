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
	profileNow,
	progressSchema,
	saveProgress,
	todayOf,
	workoutExperience,
} from "../progress.js";

const temporaryFile = () =>
	path.join(
		mkdtempSync(path.join(tmpdir(), "terminal-sigma-")),
		"progress.json",
	);

const sample = progressSchema.parse({
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
	events: [{ at: "2026-10-03T06:00:00.000Z", action: "appOpened" }],
});

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
			["event", 0],
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
		water: 0,
		sleepMinutes: 0,
		steps: 0,
		mood: undefined,
		habitsDone: 0,
		caloriesBurned: 0,
	});
});

test("starts empty and round-trips through the file", (t) => {
	const file = temporaryFile();

	t.deepEqual(loadProgress(file), {
		focus: [],
		meals: [],
		workouts: [],
		water: [],
		sleep: [],
		body: [],
		moods: [],
		habits: [],
		steps: [],
		notes: [],
		events: [],
	});
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
	t.deepEqual(progress.events, []);
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

// A local time on 3 October 2026, so day boundaries hold in any time zone.
const local = (hour: number, minute = 0, day = 3) =>
	new Date(2026, 9, day, hour, minute).toISOString();

test("still loads a file written by 1.6.0", (t) => {
	const file = temporaryFile();
	writeFileSync(
		file,
		JSON.stringify({
			language: "ko",
			theme: "moss",
			profile: {
				name: "Ken",
				age: 30,
				height: 175,
				weight: 70,
				bodyFat: 18,
				gender: "male",
				workStyle: "desk",
				goal: "buildMuscle",
			},
			focus: [{ at: "2026-10-03T09:00:00.000Z", minutes: 25 }],
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
					at: "2026-10-03T07:00:00.000Z",
					activity: "running",
					minutes: 30,
					intensity: "moderate",
				},
			],
			quotes: {
				autoRefresh: true,
				interval: 1500,
				mode: "random",
				categories: ["wisdom"],
				excluded: [],
				author: "",
				work: "",
			},
			events: [
				{
					at: "2026-10-03T09:30:00.000Z",
					action: "themeChanged",
					detail: "moss",
				},
			],
		}),
	);

	const progress = loadProgress(file);
	t.is(progress.profile?.bodyFat, 18);
	t.deepEqual(
		[progress.water, progress.sleep, progress.body, progress.notes],
		[[], [], [], []],
	);
	t.is(progress.goals, undefined);
	t.is(experienceOf(progress), 25 + 5 + 45);
});

test("rejects entries that make no sense", (t) => {
	const parse = (value: unknown) => progressSchema.safeParse(value).success;

	t.false(parse({ body: [{ at: local(8) }] }), "a body entry needs a value");
	t.false(parse({ moods: [{ at: local(8), score: 6 }] }));
	t.false(parse({ water: [{ at: local(8), milliliters: 0 }] }));
	t.false(parse({ goals: { sleep: 60 } }));
	t.true(
		parse({
			body: [{ at: local(8), waist: 82 }],
			moods: [{ at: local(8), score: 4, tags: ["work"] }],
			habits: [{ at: local(8), name: "read", skipped: true }],
			goals: { water: 2500 },
		}),
	);
});

test("numbers every entry within its own array", (t) => {
	const breakfast = progressSchema.parse({
		meals: [
			{ at: local(8), food: "Egg", servings: 2 },
			{ at: local(8), food: "Toast" },
		],
	});

	t.deepEqual(
		logsOf(breakfast).map((log) => [log.kind, log.index]),
		[
			["meal", 0],
			["meal", 1],
		],
	);
});

test("caps the small kinds per local day, in the order they happened", (t) => {
	const progress = progressSchema.parse({
		water: [
			...Array.from({ length: 10 }, (_, minute) => ({
				at: local(9, minute),
				milliliters: 250,
			})),
			{ at: local(9, 0, 4), milliliters: 250 },
		],
		steps: [
			{ at: local(12), count: 4000 },
			{ at: local(20), count: 8400 },
			{ at: local(21), count: 30_000 },
		],
		habits: [
			{ at: local(7), name: "read" },
			{ at: local(8), name: "stretch", skipped: true },
		],
		moods: [1, 2, 3].map((hour) => ({ at: local(hour), score: 4 })),
		notes: [
			{ at: local(1), text: "first" },
			{ at: local(2), text: "second" },
		],
		sleep: [{ at: local(7), minutes: 450, quality: 4 }],
		body: [{ at: local(6), weight: 72.4 }],
	});
	const earned = (kind: string) =>
		logsOf(progress)
			.filter((log) => log.kind === kind)
			.map((log) => log.experience)
			.toReversed();

	t.deepEqual(earned("water"), [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1]);
	t.deepEqual(earned("steps"), [4, 4, 12], "the highest count of a day counts");
	t.deepEqual(earned("habit"), [5, 0], "a skip earns nothing");
	t.deepEqual(earned("mood"), [3, 3, 0]);
	t.deepEqual(earned("note"), [3, 0]);
	t.is(experienceOf(progress), 9 + 20 + 5 + 6 + 3 + 10 + 5);
});

test("sums today's water, sleep, steps, mood, habits, and burned calories", (t) => {
	const progress = progressSchema.parse({
		water: [
			{ at: local(9), milliliters: 250 },
			{ at: local(13), milliliters: 500 },
		],
		sleep: [
			{ at: local(7), minutes: 420 },
			{ at: local(7, 0, 2), minutes: 300 },
		],
		steps: [
			{ at: local(12), count: 4000 },
			{ at: local(20), count: 8400 },
		],
		moods: [
			{ at: local(21), score: 2 },
			{ at: local(9), score: 4 },
		],
		habits: [
			{ at: local(7), name: "Read" },
			{ at: local(22), name: "read" },
			{ at: local(7), name: "stretch", skipped: true },
		],
		workouts: [
			{ at: local(18), activity: "running", minutes: 30, calories: 326 },
		],
	});

	t.like(todayOf(progress, Date.parse(local(23))), {
		water: 750,
		sleepMinutes: 420,
		steps: 8400,
		mood: 2,
		habitsDone: 1,
		caloriesBurned: 326,
	});
});

test("takes the latest weigh-in over the profile, unless the profile is newer", (t) => {
	const profile = {
		name: "Ken",
		age: 30,
		height: 175,
		weight: 70,
		gender: "male",
		workStyle: "desk",
		goal: "maintain",
	} as const;
	const progress = progressSchema.parse({
		profile,
		events: [{ at: local(8), action: "profileSaved" }],
		body: [
			{ at: local(7), weight: 75 },
			{ at: local(9), weight: 72.4 },
			{ at: local(10), waist: 82, bodyFat: 18.5 },
		],
	});

	t.like(profileNow(progress), { weight: 72.4, bodyFat: 18.5, height: 175 });
	t.like(
		profileNow({ ...progress, body: [{ at: local(7), weight: 75 }] }),
		{ weight: 70 },
		"a weigh-in before the profile was saved",
	);
	t.is(profileNow(progressSchema.parse({})), undefined);
});
