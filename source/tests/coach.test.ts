import { mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "ava";
import {
	contextOf,
	estimateSchema,
	instructionsOf,
	loadCoach,
	planReplySchema,
	plainTextOf,
	planTextOf,
	promptOf,
	recentTurnsOf,
	saveCoach,
	withTurns,
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
		planReplySchema.safeParse({
			title: "Base building",
			days: [
				{ weekday: 1, activity: "running", minutes: 30, intensity: "light" },
			],
		}).success,
	);
	t.false(
		planReplySchema.safeParse({
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

const day = {
	weekday: 1,
	activity: "running",
	minutes: 30,
	intensity: "light",
};

test("caps a plan at 7 days, 1 per weekday", (t) => {
	const days = (weekdays: number[]) =>
		weekdays.map((weekday) => ({ ...day, weekday }));

	t.true(
		planReplySchema.safeParse({
			title: "Week",
			days: days([0, 1, 2, 3, 4, 5, 6]),
		}).success,
	);
	t.false(
		planReplySchema.safeParse({
			title: "Month",
			days: days([0, 1, 2, 3, 4, 5, 6, 0]),
		}).success,
	);
	t.false(
		planReplySchema.safeParse({ title: "Twice", days: days([1, 1]) }).success,
	);
});

test("bounds long names and long meal lists, and leaves out the profile name", (t) => {
	const big = progressSchema.parse({
		...progress,
		meals: [
			{ at: ago(5), food: "x".repeat(200) },
			...Array.from({ length: 30 }, (_, index) => ({
				at: ago(4),
				food: `meal ${index}`,
			})),
		],
		sleep: [{ at: ago(1), minutes: 420, quality: 3 }],
		moods: [{ at: ago(1), score: 4 }],
	});
	const context = contextOf(big, now);

	t.false(context.includes("x".repeat(61)));
	t.true(context.includes(`${"x".repeat(59)}…`));
	t.true(context.includes("+11 more"));
	t.false(context.includes("meal 29"));
	t.false(context.includes("Ken"));
	t.regex(context, /Today so far:.*7 h sleep.*mood 4\/5/v);
});

test("rejects estimates above their maxima", (t) => {
	const ok = { calories: 500, protein: 10, carbs: 50, fat: 10 };

	t.true(estimateSchema.safeParse(ok).success);
	for (const bad of [
		{ calories: 5001 },
		{ protein: 501 },
		{ carbs: 1001 },
		{ fat: 501 },
	]) {
		t.false(estimateSchema.safeParse({ ...ok, ...bad }).success);
	}
});

test("words the prompts in the user's language", (t) => {
	t.true(promptOf("today", messagesOf("zh-TW")).includes("今天"));
	t.true(
		promptOf("estimate", messagesOf("ko"), "김치찌개").includes("김치찌개"),
	);
});

test("writes coach.json for its owner only and keeps newer fields", (t) => {
	const file = path.join(
		mkdtempSync(path.join(tmpdir(), "terminal-sigma-")),
		"coach.json",
	);
	const coach = {
		sessions: [
			{
				id: "s1",
				startedAt: ago(2),
				future: 1,
				turns: [{ role: "user" as const, content: "hi", at: ago(1), extra: 2 }],
			},
		],
	};

	saveCoach(file, coach);
	t.is(statSync(file).mode.toString(8).slice(-3), "600");
	t.deepEqual(loadCoach(file), coach);
});

test("adds turns to their session, or starts it", (t) => {
	const turn = { role: "user" as const, content: "hi", at: ago(1) };
	const session = { id: "s1", startedAt: ago(2), turns: [] };

	t.deepEqual(withTurns({ sessions: [] }, session, [turn]), {
		sessions: [{ ...session, turns: [turn] }],
	});
	t.deepEqual(
		withTurns({ sessions: [{ ...session, turns: [turn] }] }, session, [turn])
			.sessions[0]?.turns,
		[turn, turn],
	);
});

test("writes a plan as 1 line per day, in the user's language", (t) => {
	const text = planTextOf(
		{
			title: "Base building",
			days: [
				{ weekday: 1, activity: "running", minutes: 30, intensity: "light" },
				{
					weekday: 3,
					activity: "strength",
					minutes: 45,
					intensity: "vigorous",
					note: "Legs",
				},
			],
		},
		"en",
		messagesOf("en"),
	);

	t.is(
		text,
		"Base building\nMon · Running · 30 min · Light\nWed · Strength · 45 min · Vigorous · Legs",
	);
});

test("reduces model text to words and newlines", (t) => {
	t.is(
		plainTextOf(
			"see \u001B]8;;https://evil.example\u0007here\u001B]8;;\u0007 now",
		),
		"see here now",
		"an OSC 8 link keeps its label, not its URL",
	);
	t.is(plainTextOf("a\u001B]0;title\u001B\\b"), "ab", "ST ends an OSC too");
	t.is(plainTextOf("a\r\nb\tc\u0007\bd\re"), "a\nb  cde");
	t.is(plainTextOf("\u001B[31mred\u001B[0m"), "red");
	t.is(plainTextOf(" \u0007\r\n "), "", "nothing left is empty");
	t.true(
		instructionsOf("en", "x").includes("Write plain text without Markdown."),
	);
});
