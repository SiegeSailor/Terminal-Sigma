import test from "ava";
import { adviceOf, targetsOf } from "../health.js";
import { messagesOf } from "../i18n.js";
import type { Profile } from "../progress.js";

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
	focusSessions: 0,
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
	});
});

test("works targets out of body, work style, and goal", (t) => {
	// Resting 1,648.75 kcal x 1.2 for desk work.
	t.deepEqual(targetsOf(desk), {
		calories: 1980,
		protein: 70,
		workoutMinutes: 30,
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
		{ calories: 1560, protein: 120, workoutMinutes: 45 },
	);

	// With body fat, Katch-McArdle: 370 + 21.6 x 59.5 kg of lean mass, x 1.2.
	t.is(targetsOf({ ...desk, bodyFat: 15 }).calories, 1990);

	// Protein stops at 2.2 g per kg, however hard the training.
	t.is(
		targetsOf({ ...desk, workStyle: "athlete", goal: "buildMuscle" }).protein,
		154,
	);
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
		],
	);

	const done = adviceOf(
		desk,
		{ ...today, protein: 80, workoutMinutes: 30, calories: 2500 },
		"en",
		messages,
	);
	t.deepEqual(
		done.map((item) => item.isDone),
		[true, true, false],
	);
	t.is(
		done[2]?.text,
		"520 kcal over today's budget; keep the next meal light.",
	);
});
