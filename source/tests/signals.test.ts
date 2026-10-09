import test from "ava";
import { progressSchema } from "../progress.js";
import {
	daylightOf,
	quietSignals,
	signalClockOf,
	seasonOf,
	signalsOf,
	stageSignalsOf,
	strengthLoadOf,
} from "../signals.js";

// 15:00 local time on a Wednesday in October.
const now = new Date(2026, 9, 7, 15, 0).getTime();
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
const hours = 60;
const days = 24 * hours;

// Every array filled in, as loadProgress would, so later fields never break it.
const empty = progressSchema.parse({ language: "en" });

test("says nothing about a journey with nothing logged", (t) => {
	t.deepEqual(signalsOf(empty, now), {
		...quietSignals,
		daylight: "day",
		season: "autumn",
	});
});

test("reads the clock and the calendar in local time", (t) => {
	t.is(daylightOf(new Date(2026, 9, 7, 23, 30).getTime()), "night");
	t.is(daylightOf(new Date(2026, 9, 7, 4, 59).getTime()), "night");
	t.is(daylightOf(new Date(2026, 9, 7, 6, 0).getTime()), "dawn");
	t.is(daylightOf(new Date(2026, 9, 7, 12, 0).getTime()), "day");
	t.is(daylightOf(new Date(2026, 9, 7, 19, 0).getTime()), "dusk");
	t.is(seasonOf(new Date(2027, 0, 15).getTime()), "winter");
	t.is(seasonOf(new Date(2027, 3, 15).getTime()), "spring");
	t.is(seasonOf(new Date(2027, 6, 15).getTime()), "summer");
});

test("is tired after a short night, fine after a full one", (t) => {
	t.is(
		signalsOf({ ...empty, sleep: [{ at: ago(8 * hours), minutes: 300 }] }, now)
			.rest,
		"tired",
	);
	t.is(
		signalsOf({ ...empty, sleep: [{ at: ago(8 * hours), minutes: 480 }] }, now)
			.rest,
		"fine",
	);
	t.is(
		signalsOf({ ...empty, sleep: [{ at: ago(2 * days), minutes: 300 }] }, now)
			.rest,
		"fine",
		"an old short night no longer counts",
	);
});

test("gets thirsty behind on water, only for someone who logs water", (t) => {
	t.false(signalsOf(empty, now).isThirsty, "never logged water");
	t.true(
		signalsOf(
			{ ...empty, water: [{ at: ago(26 * hours), milliliters: 250 }] },
			now,
		).isThirsty,
	);
	t.false(
		signalsOf({ ...empty, water: [{ at: ago(10), milliliters: 1500 }] }, now)
			.isThirsty,
	);
});

test("gets hungry 5 hours after a meal, and full right after a big one", (t) => {
	const meal = (minutesAgo: number, calories: number) => ({
		at: ago(minutesAgo),
		food: "Bibimbap",
		calories,
	});

	t.false(signalsOf(empty, now).isHungry, "never logged food");
	t.true(signalsOf({ ...empty, meals: [meal(6 * hours, 500)] }, now).isHungry);
	t.false(signalsOf({ ...empty, meals: [meal(hours, 500)] }, now).isHungry);
	t.true(signalsOf({ ...empty, meals: [meal(30, 1000)] }, now).isFull);
	t.false(signalsOf({ ...empty, meals: [meal(90, 1000)] }, now).isFull);
});

test("sweats after a workout and flushes after a hard one", (t) => {
	const workout = (minutesAgo: number, intensity: "moderate" | "vigorous") => ({
		at: ago(minutesAgo),
		activity: "running",
		minutes: 30,
		intensity,
	});

	t.is(
		signalsOf({ ...empty, workouts: [workout(10, "vigorous")] }, now).exertion,
		"flushed",
	);
	t.is(
		signalsOf({ ...empty, workouts: [workout(10, "moderate")] }, now).exertion,
		"sweaty",
	);
	t.is(
		signalsOf({ ...empty, workouts: [workout(25, "moderate")] }, now).exertion,
		"none",
	);
});

test("wears today's latest mood, reading by time, not by order", (t) => {
	t.is(
		signalsOf({ ...empty, moods: [{ at: ago(hours), score: 2 }] }, now).face,
		"sad",
	);
	t.is(
		signalsOf({ ...empty, moods: [{ at: ago(hours), score: 5 }] }, now).face,
		"bright",
	);
	t.is(
		signalsOf(
			{
				...empty,
				// The second was backdated, so it is older though it comes later.
				moods: [
					{ at: ago(30), score: 5 },
					{ at: ago(3 * hours), score: 1 },
				],
			},
			now,
		).face,
		"bright",
	);
});

test("wakes with bed head after a week away", (t) => {
	const old = { at: ago(8 * days), text: "back soon" };

	t.true(signalsOf({ ...empty, notes: [old] }, now).isBedHead);
	t.false(
		signalsOf({ ...empty, notes: [old, { at: ago(5), text: "back" }] }, now)
			.isBedHead,
	);
});

test("fills the room with what was earned", (t) => {
	const strength = Array.from({ length: 10 }, (_, index) => ({
		at: ago((index + 1) * days),
		activity: "strength",
		minutes: 30,
		intensity: "moderate" as const,
	}));
	const focus = Array.from({ length: 60 }, (_, index) => ({
		at: ago(index * hours),
		minutes: 25,
	}));
	const { room } = signalsOf({ ...empty, workouts: strength, focus }, now);

	t.true(room.dumbbells);
	t.true(room.books, "25 hours of focus");
	t.is(
		signalsOf({ ...empty, water: [{ at: ago(10), milliliters: 250 }] }, now)
			.room.plant,
		"growing",
	);
	t.is(
		signalsOf(
			{ ...empty, water: [{ at: ago(3 * days), milliliters: 250 }] },
			now,
		).room.plant,
		"wilting",
	);
});

test("weighs only the last 28 days of strength work", (t) => {
	const strength = (daysAgo: number) => ({
		at: ago(daysAgo * days),
		activity: "strength",
		minutes: 60,
		intensity: "moderate" as const,
	});

	t.is(
		strengthLoadOf(
			{ ...empty, workouts: [strength(1), strength(20), strength(40)] },
			now,
		),
		180,
	);
});

test("drops falling particles under reduced motion", (t) => {
	const signals = signalsOf(empty, now);

	t.is(stageSignalsOf(signals, true).season, undefined);
	t.is(stageSignalsOf(signals, true).daylight, "day");
	t.is(stageSignalsOf(signals, false), signals);
});

test("clears hunger at once when a meal is logged mid-minute", (t) => {
	const saved = new Date(2026, 9, 7, 15, 0, 30).getTime();
	const meals = [
		{
			at: new Date(saved - 6 * hours * 60_000).toISOString(),
			calories: 500,
			food: "lunch",
		},
		{ at: new Date(saved).toISOString(), calories: 300, food: "snack" },
	];
	const minuteStart = new Date(2026, 9, 7, 15, 0).getTime();

	t.true(signalsOf({ ...empty, meals }, minuteStart).isHungry, "floored");
	t.false(
		signalsOf({ ...empty, meals }, signalClockOf(saved + 1000)).isHungry,
		"clocked at the minute's end",
	);
});
