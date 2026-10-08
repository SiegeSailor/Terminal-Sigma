import test from "ava";
import {
	activeDaysOf,
	correlationsOf,
	habitStrengthsOf,
	liftsOf,
	sparklineOf,
	streakOf,
	weekOf,
	weightTrendOf,
} from "../insights.js";
import { progressSchema } from "../progress.js";

// 15:00 local time on 7 October 2026, so day boundaries hold in any time zone.
const now = new Date(2026, 9, 7, 15).getTime();
const daysAgo = (days: number, hour = 9) => {
	const date = new Date(now);
	date.setDate(date.getDate() - days);
	date.setHours(hour, 0, 0, 0);
	return date.toISOString();
};

const notesOn = (...days: number[]) =>
	progressSchema.parse({
		notes: days.map((days) => ({ at: daysAgo(days), text: "x" })),
	});

test("counts a streak of days with any log, spending banked grace days", (t) => {
	t.is(streakOf(notesOn(), now), 0);
	t.is(streakOf(notesOn(0, 1, 2), now), 3);
	t.is(streakOf(notesOn(1, 2), now), 2, "today is not over yet");
	t.is(streakOf(notesOn(0, 2, 3), now), 1, "a miss before 7 days breaks it");
	t.is(
		streakOf(notesOn(0, 2, 3, 4, 5, 6, 7, 8), now),
		8,
		"7 days in a row bank a grace day, which covers 1 miss",
	);
	t.is(
		streakOf(notesOn(0, 3, 4, 5, 6, 7, 8, 9), now),
		1,
		"2 misses need 2 grace days",
	);
	t.is(
		streakOf(
			progressSchema.parse({
				events: [{ at: daysAgo(0), action: "appOpened" }],
			}),
			now,
		),
		0,
		"opening the app is not a log",
	);
	t.deepEqual(
		[...activeDaysOf(notesOn(0, 0, 1))],
		[new Date(daysAgo(0)).toDateString(), new Date(daysAgo(1)).toDateString()],
	);
});

test("never loops on an entry dated in the future", (t) => {
	const future = new Date(now + 3 * 86_400_000).toISOString();

	t.is(
		streakOf(progressSchema.parse({ notes: [{ at: future, text: "x" }] }), now),
		0,
	);
});

test("smooths the weight into a trend, carrying it over missing days", (t) => {
	const progress = progressSchema.parse({
		body: [
			{ at: daysAgo(6), weight: 80 },
			{ at: daysAgo(0), weight: 79 },
			{ at: daysAgo(3), waist: 82 },
		],
	});

	t.deepEqual(weightTrendOf(progress, now, 7), [80, 80, 80, 80, 80, 80, 79.9]);
	t.deepEqual(weightTrendOf(progress, now, 2), [80, 79.9]);
	t.deepEqual(weightTrendOf(progressSchema.parse({}), now, 7), []);
});

test("scores a habit's strength the way Loop does, skips leaving it alone", (t) => {
	const days = (count: number, from = 0) =>
		Array.from({ length: count }, (_, index) => ({
			at: daysAgo(from + index),
			name: "read",
		}));

	t.deepEqual(
		habitStrengthsOf(progressSchema.parse({ habits: days(30) }), now),
		[{ name: "read", strength: 80 }],
	);

	const skipped = habitStrengthsOf(
		progressSchema.parse({
			habits: [...days(29, 1), { at: daysAgo(0), name: "Read", skipped: true }],
		}),
		now,
	);
	const missed = habitStrengthsOf(
		progressSchema.parse({ habits: days(29, 1) }),
		now,
	);
	t.deepEqual(skipped, [{ name: "Read", strength: 79 }], "the latest spelling");
	t.deepEqual(missed, [{ name: "read", strength: 75 }]);
});

test("finds what goes with a better mood, only with enough days of each", (t) => {
	const moods = [0, 1, 2, 3, 4, 5].map((days) => ({
		at: daysAgo(days, 21),
		score: days < 3 ? 5 : 3,
	}));
	const run = (days: number) => ({
		at: daysAgo(days, 7),
		activity: "running",
		minutes: 30,
		intensity: "moderate" as const,
	});

	t.deepEqual(
		correlationsOf(
			progressSchema.parse({ moods, workouts: [run(0), run(1), run(2)] }),
			now,
		),
		[
			{
				factor: { kind: "workout", name: "running" },
				difference: 2,
				withDays: 3,
				withoutDays: 3,
			},
		],
	);
	t.deepEqual(
		correlationsOf(
			progressSchema.parse({ moods, workouts: [run(0), run(1)] }),
			now,
		),
		[],
		"2 days are not enough",
	);
});

test("estimates each lift's best this week against before", (t) => {
	const bench = (days: number, weight: number) => ({
		at: daysAgo(days),
		activity: "strength",
		minutes: 20,
		sets: [{ exercise: "bench", weight, reps: 5 }],
	});

	t.deepEqual(
		liftsOf(
			progressSchema.parse({ workouts: [bench(9, 60), bench(2, 62.5)] }),
			now,
		),
		[{ exercise: "bench", best: 72.9, before: 70 }],
	);
	t.deepEqual(
		liftsOf(progressSchema.parse({ workouts: [bench(9, 60)] }), now),
		[],
	);
});

test("draws a sparkline against the target, and sums up the week", (t) => {
	t.is(sparklineOf([0, 50, 100], 100), " ▄█");
	t.is(sparklineOf([1, 2], 0), "▄█");
	t.is(sparklineOf([0, 0]), "  ");

	const week = weekOf(notesOn(0, 1), now);
	t.is(week.days.length, 7);
	t.is(
		new Date(week.days[6]?.time ?? 0).toDateString(),
		new Date(now).toDateString(),
	);
	t.is(week.streak, 2);
	t.is(week.targets.water, 2600);
});
