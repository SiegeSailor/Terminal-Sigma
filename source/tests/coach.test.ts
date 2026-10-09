import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "ava";
import {
	contextOf,
	estimateSchema,
	instructionsOf,
	loadCoach,
	planSchema,
	promptOf,
	recentTurnsOf,
	saveCoach,
} from "../coach.js";
import { messagesOf } from "../i18n.js";
import { progressSchema } from "../progress.js";

const now = new Date(2026, 9, 7, 15, 0).getTime();
const ago = (hours: number) => new Date(now - hours * 3_600_000).toISOString();

const progress = progressSchema.parse({
	language: "en",
	profile: {
		name: "Ken",
		age: 30,
		height: 175,
		weight: 72,
		gender: "male",
		workStyle: "desk",
		goal: "buildMuscle",
	},
	focus: [],
	meals: [{ at: ago(4), food: "Oatmeal", calories: 300, protein: 10 }],
	workouts: [
		{ at: ago(26), activity: "running", minutes: 30, intensity: "moderate" },
	],
	water: [{ at: ago(2), milliliters: 500 }],
	sleep: [{ at: ago(8), minutes: 400, quality: 3 }],
	body: [{ at: ago(30), weight: 71.5 }],
	moods: [],
	habits: [],
	steps: [],
	notes: [{ at: ago(1), text: "My password is hunter2" }],
});

test("sums up the profile, targets, the last 7 days, and today", (t) => {
	const context = contextOf(progress, now);

	t.true(
		context.includes("30-year-old male, 175 cm, 71.5 kg"),
		"the latest weight",
	);
	t.true(context.includes("goal: build muscle"));
	t.true(context.includes("Daily targets:"));
	t.true(context.includes("2026-10-06"), "yesterday's line");
	t.true(context.includes("running 30 min"));
	t.true(context.includes("Oatmeal"), "today's meals by name");
	t.false(context.includes("hunter2"), "notes stay private");
});

test("asks for the answer in the user's language, without medical claims", (t) => {
	t.true(instructionsOf("zh-TW", "x").includes("Traditional Chinese"));
	t.true(instructionsOf("ko", "x").includes("Korean"));
	t.true(instructionsOf("en", "x").includes("not medical advice"));
	t.true(
		promptOf("estimate", messagesOf("en"), "beef noodle soup").includes(
			"beef noodle soup",
		),
	);
});

test("accepts only plans and estimates that make sense", (t) => {
	t.true(
		planSchema.safeParse({
			title: "Base building",
			days: [
				{ weekday: 1, activity: "running", minutes: 30, intensity: "light" },
			],
		}).success,
	);
	t.false(
		planSchema.safeParse({
			title: "Too much",
			days: [
				{ weekday: 9, activity: "running", minutes: 30, intensity: "light" },
			],
		}).success,
	);
	t.false(
		estimateSchema.safeParse({ calories: -5, protein: 1, carbs: 1, fat: 1 })
			.success,
	);
});

test("keeps the conversation in coach.json and sends only the last 20 turns", (t) => {
	const file = path.join(
		mkdtempSync(path.join(tmpdir(), "terminal-sigma-")),
		"coach.json",
	);
	const turns = Array.from({ length: 30 }, (_, index) => ({
		role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
		content: `turn ${index}`,
		at: ago(1),
	}));
	const session = { id: "s1", startedAt: ago(2), turns };
	const coach = { sessions: [session] };

	t.deepEqual(loadCoach(file), { sessions: [] });
	saveCoach(file, coach);
	t.deepEqual(loadCoach(file), coach);
	t.is(recentTurnsOf(session).length, 20);
	t.is(recentTurnsOf(session)[0]?.content, "turn 10");

	writeFileSync(file, "{ nope");
	t.throws(() => loadCoach(file), { message: /unreadable/v });
});
