import { type Targets, targetsOf } from "./health.js";
import {
	byTime,
	logsOf,
	profileNow,
	type Progress,
	type Today,
	todayOf,
} from "./progress.js";
import { keyOf } from "./quick-log.js";

const dayOf = (time: number) => new Date(time).toDateString();

// The same time of day, `days` later or earlier, across clock changes.
const shifted = (time: number, days: number) => {
	const date = new Date(time);
	date.setDate(date.getDate() + days);
	return date.getTime();
};

// Local days with at least 1 log; actions are not logs.
export const activeDaysOf = (progress: Progress): ReadonlySet<string> =>
	new Set(
		logsOf(progress)
			.filter((log) => log.kind !== "event")
			.map((log) => dayOf(Date.parse(log.at))),
	);

// Every 7 days in a row bank 1 grace day, up to 2, which a missed day spends
// instead of breaking the streak, like Duolingo's streak freeze.
const graceEvery = 7;
const graceMost = 2;

// Days in a row with any log, ending today; today counts as kept until it
// is over, so the streak shows before the first log of the day.
export function streakOf(progress: Progress, now: number): number {
	const days = activeDaysOf(progress);
	const oldest = logsOf(progress).findLast((log) => log.kind !== "event")?.at;

	if (!oldest) {
		return 0;
	}

	const today = dayOf(now);
	const day = new Date(oldest);
	day.setHours(12, 0, 0, 0);
	let streak = 0;
	let grace = 0;

	// A hand-edited entry dated in the future must not loop forever.
	while (day.toDateString() !== today && day.getTime() < now) {
		if (days.has(day.toDateString())) {
			streak += 1;

			if (streak % graceEvery === 0) {
				grace = Math.min(grace + 1, graceMost);
			}
		} else if (grace > 0 && streak > 0) {
			grace -= 1;
		} else {
			streak = 0;
			grace = 0;
		}

		day.setDate(day.getDate() + 1);
	}

	return days.has(today) ? streak + 1 : streak;
}

// The Hacker's Diet trend: each day moves 10% of the way to that day's
// weight, carrying the last weight over days without a weigh-in.
export function weightTrendOf(
	progress: Progress,
	now: number,
	days: number,
): number[] {
	const weighIns = progress.body
		.filter((body) => body.weight !== undefined)
		.toSorted(byTime);
	const [first] = weighIns;
	const start = first?.weight;

	if (first === undefined || start === undefined) {
		return [];
	}

	// The last weigh-in of each day counts.
	const weightOn = new Map(
		weighIns.map((body) => [dayOf(Date.parse(body.at)), body.weight ?? 0]),
	);
	const today = dayOf(now);
	const day = new Date(first.at);
	day.setHours(12, 0, 0, 0);
	let weight = start;
	let trend = start;
	const trends: number[] = [];

	for (;;) {
		weight = weightOn.get(day.toDateString()) ?? weight;
		trend += 0.1 * (weight - trend);
		trends.push(Math.round(trend * 10) / 10);

		if (day.toDateString() === today || day.getTime() > now) {
			break;
		}

		day.setDate(day.getDate() + 1);
	}

	return trends.slice(-days);
}

// Loop Habit Tracker's multiplier for a daily habit: 0.5^(√1 / 13).
const habitMultiplier = 0.5 ** (1 / 13);

// Each habit's strength over the last 90 days, strongest first, named by
// its latest spelling.
export function habitStrengthsOf(
	progress: Progress,
	now: number,
): Array<Readonly<{ name: string; strength: number }>> {
	const names = new Map(
		progress.habits
			.toSorted(byTime)
			.map((habit) => [keyOf(habit.name), habit.name]),
	);

	// Bucket once: which habit-days have an entry, and which have a done one.
	const entered = new Set<string>();
	const done = new Set<string>();

	for (const habit of progress.habits) {
		const bucket = `${keyOf(habit.name)}|${dayOf(Date.parse(habit.at))}`;
		entered.add(bucket);

		if (!habit.skipped) {
			done.add(bucket);
		}
	}

	const days = Array.from({ length: 90 }, (_, index) =>
		dayOf(shifted(now, index - 89)),
	);

	return [...names]
		.map(([key, name]) => {
			let score = 0;

			for (const day of days) {
				const isDone = done.has(`${key}|${day}`);

				// A skipped day leaves the score as it was.
				if (isDone || !entered.has(`${key}|${day}`)) {
					score = score * habitMultiplier + (isDone ? 1 - habitMultiplier : 0);
				}
			}

			return { name, strength: Math.round(score * 100) };
		})
		.toSorted((left, right) => right.strength - left.strength);
}

export type Factor = Readonly<{
	kind: "tag" | "workout" | "habit";
	name: string;
}>;

export type Correlation = Readonly<{
	factor: Factor;
	difference: number;
	withDays: number;
	withoutDays: number;
}>;

const average = (values: readonly number[]) =>
	values.reduce((total, value) => total + value, 0) / values.length;

// How much higher or lower the mood runs on days with a tag, a workout, or a
// habit than on days without it, over the last 30 days. Like Bearable, a
// factor needs 3 days with it and 3 without, and a difference of 0.5.
export function correlationsOf(progress: Progress, now: number): Correlation[] {
	const window = new Set(
		Array.from({ length: 30 }, (_, back) => dayOf(shifted(now, -back))),
	);
	const moodOn = new Map<string, number>();

	for (const day of window) {
		const scores = progress.moods
			.filter((mood) => dayOf(Date.parse(mood.at)) === day)
			.map((mood) => mood.score);

		if (scores.length > 0) {
			moodOn.set(day, average(scores));
		}
	}

	const daysWith = new Map<string, { factor: Factor; days: Set<string> }>();
	const add = (factor: Factor, at: string) => {
		const day = dayOf(Date.parse(at));
		const key = `${factor.kind}:${factor.name}`;

		if (moodOn.has(day)) {
			const known = daysWith.get(key) ?? { factor, days: new Set<string>() };
			known.days.add(day);
			daysWith.set(key, known);
		}
	};

	for (const mood of progress.moods) {
		for (const tag of mood.tags ?? []) {
			add({ kind: "tag", name: tag }, mood.at);
		}
	}

	for (const workout of progress.workouts) {
		add({ kind: "workout", name: workout.activity }, workout.at);
	}

	const spellings = new Map(
		progress.habits
			.toSorted(byTime)
			.map((habit) => [keyOf(habit.name), habit.name]),
	);

	for (const habit of progress.habits.filter((habit) => !habit.skipped)) {
		add(
			{ kind: "habit", name: spellings.get(keyOf(habit.name)) ?? habit.name },
			habit.at,
		);
	}

	return [...daysWith.values()]
		.flatMap(({ factor, days }) => {
			const scores = [...moodOn];
			const withScores = scores.filter(([day]) => days.has(day));
			const withoutScores = scores.filter(([day]) => !days.has(day));

			if (withScores.length < 3 || withoutScores.length < 3) {
				return [];
			}

			const difference =
				Math.round(
					(average(withScores.map(([, score]) => score)) -
						average(withoutScores.map(([, score]) => score))) *
						10,
				) / 10;

			return Math.abs(difference) >= 0.5
				? [
						{
							factor,
							difference,
							withDays: withScores.length,
							withoutDays: withoutScores.length,
						},
					]
				: [];
		})
		.toSorted(
			(left, right) => Math.abs(right.difference) - Math.abs(left.difference),
		);
}

// Each exercise's best estimated 1-rep max this week, by Epley, against its
// best before this week; only exercises done this week.
export function liftsOf(
	progress: Progress,
	now: number,
): Array<Readonly<{ exercise: string; best: number; before?: number }>> {
	const weekStart = shifted(now, -7);
	const best = new Map<string, { week: number; before: number }>();

	for (const workout of progress.workouts) {
		const isThisWeek = Date.parse(workout.at) > weekStart;

		for (const set of workout.sets ?? []) {
			const estimate = (set.weight ?? 0) * (1 + set.reps / 30);
			const known = best.get(set.exercise) ?? { week: 0, before: 0 };
			best.set(
				set.exercise,
				isThisWeek
					? { ...known, week: Math.max(known.week, estimate) }
					: { ...known, before: Math.max(known.before, estimate) },
			);
		}
	}

	const tenths = (value: number) => Math.round(value * 10) / 10;

	return [...best]
		.filter(([, { week }]) => week > 0)
		.map(([exercise, { week, before }]) => ({
			exercise,
			best: tenths(week),
			...(before > 0 ? { before: tenths(before) } : {}),
		}));
}

export type Week = Readonly<{
	// The last 7 days, oldest first, today last.
	days: ReadonlyArray<Readonly<{ time: number; today: Today }>>;
	targets: Targets;
	streak: number;
	trend: readonly number[];
	habits: ReturnType<typeof habitStrengthsOf>;
	correlations: readonly Correlation[];
	lifts: ReturnType<typeof liftsOf>;
}>;

export function weekOf(progress: Progress, now: number): Week {
	return {
		days: Array.from({ length: 7 }, (_, index) => {
			const time = shifted(now, index - 6);
			return { time, today: todayOf(progress, time) };
		}),
		targets: targetsOf(profileNow(progress), progress.goals),
		streak: streakOf(progress, now),
		trend: weightTrendOf(progress, now, 7),
		habits: habitStrengthsOf(progress, now),
		correlations: correlationsOf(progress, now),
		lifts: liftsOf(progress, now),
	};
}

const bars = " ▁▂▃▄▅▆▇█";

// 1 character a day, the full block at the target or the highest day,
// whichever is more; a day with nothing is blank.
export function sparklineOf(values: readonly number[], target = 0): string {
	const top = Math.max(target, ...values);

	return values
		.map((value) =>
			top <= 0 || value <= 0
				? " "
				: (bars[Math.max(1, Math.round((value / top) * 8))] ?? "█"),
		)
		.join("");
}
