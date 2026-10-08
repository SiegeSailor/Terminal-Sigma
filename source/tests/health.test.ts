import test from "ava";
import { adviceOf, targetsOf } from "../health.js";
import { messagesOf } from "../i18n.js";
import { type Profile, progressSchema, todayOf } from "../progress.js";

const desk: Profile = {
	name: "Ken",
	age: 30,
	height: 175,
	weight: 70,
	gender: "male",
	workStyle: "desk",
	goal: "maintain",
};

const today = {
	...todayOf(progressSchema.parse({}), 0),
	meals: 1,
	calories: 600,
	protein: 30,
	workoutMinutes: 10,
};

test("falls back to general targets without a profile", (t) => {
	t.deepEqual(targetsOf(undefined), {
		calories: 2000,
		protein: 50,
		workoutMinutes: 30,
		water: 2600,
		sleep: 420,
		steps: 8000,
		focusSessions: 4,
	});
});

test("works targets out of body, work style, and goal", (t) => {
	// Resting 1,648.75 kcal x 1.2 for desk work.
	t.deepEqual(targetsOf(desk), {
		calories: 1980,
		protein: 70,
		workoutMinutes: 30,
		water: 3000,
		sleep: 420,
		steps: 8000,
		focusSessions: 4,
	});

	// Resting 1,330.25 kcal x 1.55, minus 500, at 2.0 g protein per kg.
	t.deepEqual(
		targetsOf({
			...desk,
			age: 28,
			height: 165,
			weight: 60,
			gender: "female",
			workStyle: "active",
			goal: "loseFat",
		}),
		{
			calories: 1560,
			protein: 120,
			workoutMinutes: 45,
			water: 2200,
			sleep: 420,
			steps: 8000,
			focusSessions: 4,
		},
	);

	// With body fat, Katch-McArdle: 370 + 21.6 x 59.5 kg of lean mass, x 1.2.
	t.is(targetsOf({ ...desk, bodyFat: 15 }).calories, 1990);

	// Protein stops at 2.2 g per kg, however hard the training.
	t.is(
		targetsOf({ ...desk, workStyle: "athlete", goal: "buildMuscle" }).protein,
		154,
	);
});

test("lowers the steps from 60 and lets goals win", (t) => {
	t.is(targetsOf({ ...desk, age: 65 }).steps, 7000);
	t.like(targetsOf(desk, { water: 2500, sleep: 480, focusSessions: 6 }), {
		water: 2500,
		sleep: 480,
		steps: 8000,
		focusSessions: 6,
		calories: 1980,
	});
	t.is(targetsOf(undefined, { steps: 10_000 }).steps, 10_000);
});

test("advises what is left of today, and when a target is met", (t) => {
	const messages = messagesOf("en");
	const advice = adviceOf(
		{ ...desk, goal: "buildMuscle" },
		today,
		"en",
		messages,
	);

	t.deepEqual(
		advice.map((item) => item.text),
		[
			"35 more minutes of exercise today: a strength session.",
			"110 g of protein to go today, e.g. a chicken breast has about 30 g.",
			"1,680 kcal left in today's budget.",
			"3,000 ml of water to go today, about 12 glasses.",
			"Log last night's sleep, e.g. sl 23:30-7:10.",
		],
	);

	const done = adviceOf(
		desk,
		{
			...today,
			protein: 80,
			workoutMinutes: 30,
			calories: 2500,
			water: 2500,
			sleepMinutes: 420,
		},
		"en",
		messages,
		{ water: 2500 },
	);
	t.deepEqual(
		done.map((item) => item.isDone),
		[true, true, false, true, true],
	);
	t.is(
		adviceOf(desk, { ...today, sleepMinutes: 370 }, "en", messages)[4]?.text,
		"You slept 6h 10m; aim for 7h tonight.",
	);
	t.is(
		done[2]?.text,
		"520 kcal over today's budget; keep the next meal light.",
	);
});
