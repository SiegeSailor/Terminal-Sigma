import test from "ava";
import { type Language, messagesOf } from "../i18n.js";
import {
	type Logged,
	logsOf,
	type Progress,
	progressSchema,
} from "../progress.js";
import {
	applyDrafts,
	completionOf,
	describeDraft,
	type Draft,
	draftOf,
	isEditable,
	lineOf,
	type ParseError,
	parseQuickLog,
	restoreLog,
	summaryOf,
	suggestionsOf,
	withEstimate,
	undoAdded,
} from "../quick-log.js";

// Noon on 3 October 2026, local time, so the cases hold in any time zone.
const local = (hour: number, minute = 0, day = 3) =>
	new Date(2026, 9, day, hour, minute).toISOString();
const now = Date.parse(local(12));
const empty = progressSchema.parse({ language: "en" });

const parse = (
	line: string,
	{
		progress = empty,
		language = "en",
		at = now,
	}: { progress?: Progress; language?: Language; at?: number } = {},
): Draft[] | ParseError => {
	const result = parseQuickLog(line, { progress, now: at, language });
	return result.ok ? result.drafts : result.error;
};

type Case = readonly [line: string, expected: Draft[] | ParseError];

const check = (
	t: {
		deepEqual: (actual: unknown, expected: unknown, message: string) => void;
	},
	cases: readonly Case[],
	options?: Parameters<typeof parse>[1],
) => {
	for (const [line, expected] of cases) {
		t.deepEqual(parse(line, options), expected, line);
	}
};

const meal = (fields: Partial<Extract<Draft, { kind: "meal" }>>) => ({
	kind: "meal" as const,
	at: local(12),
	servings: 1,
	isKnown: true,
	food: "",
	...fields,
});
test("parses meals: quantities, known foods, and typed amounts", (t) => {
	check(t, [
		[
			"2 eggs, toast, coffee",
			[
				meal({
					food: "Egg",
					servings: 2,
					calories: 144,
					protein: 12,
					carbs: 0,
					fat: 10,
				}),
				meal({
					food: "Whole wheat toast",
					calories: 160,
					protein: 8,
					carbs: 27,
					fat: 2,
				}),
				meal({
					food: "Black coffee",
					calories: 5,
					protein: 0,
					carbs: 0,
					fat: 0,
				}),
			],
		],
		["450kcal 30p", [meal({ food: "Quick add", calories: 450, protein: 30 })]],
		[
			"ramen 500kcal 20c 10f",
			[meal({ food: "ramen", calories: 500, carbs: 20, fat: 10 })],
		],
		["mystery stew", [meal({ food: "mystery stew", isKnown: false })]],
		[
			"1/2 avocado",
			[
				meal({
					food: "Avocado",
					servings: 0.5,
					calories: 80,
					protein: 1,
					carbs: 4.5,
					fat: 7.5,
				}),
			],
		],
		[
			"½ avocado",
			[
				meal({
					food: "Avocado",
					servings: 0.5,
					calories: 80,
					protein: 1,
					carbs: 4.5,
					fat: 7.5,
				}),
			],
		],
		[
			"ramen x2 + 2 cookies",
			[
				meal({
					food: "Ramen",
					servings: 2,
					calories: 1000,
					protein: 40,
					carbs: 110,
					fat: 36,
				}),
				meal({
					food: "Cookie",
					servings: 2,
					calories: 300,
					protein: 4,
					carbs: 40,
					fat: 16,
				}),
			],
		],
		["0 eggs", "badNumber"],
		["1/0 eggs", "badNumber"],
		["@-1000d 450kcal", "badTime"],
		["constructor 450kcal", [meal({ food: "constructor", calories: 450 })]],
		[
			"200g chicken breast",
			[meal({ food: "200g chicken breast", isKnown: false })],
		],
		["2% milk", [meal({ food: "2% milk", isKnown: false })]],
		[
			"2 large eggs",
			[meal({ food: "large eggs", servings: 2, isKnown: false })],
		],
		["   ", "empty"],
	]);
});

test("parses meals in Chinese and Korean, even in full width", (t) => {
	check(
		t,
		[
			[
				"２個雞蛋，吐司",
				[
					meal({
						food: "雞蛋",
						servings: 2,
						calories: 144,
						protein: 12,
						carbs: 0,
						fat: 10,
					}),
					meal({
						food: "白吐司",
						calories: 150,
						protein: 5,
						carbs: 28,
						fat: 2,
					}),
				],
			],
			[
				"牛肉麵、珍珠奶茶",
				[
					meal({
						food: "牛肉麵",
						calories: 600,
						protein: 32,
						carbs: 44,
						fat: 26,
					}),
					meal({
						food: "珍珠奶茶",
						calories: 450,
						protein: 4,
						carbs: 79,
						fat: 9,
					}),
				],
			],
		],
		{ language: "zh-TW" },
	);
	check(
		t,
		[
			[
				"계란 2개 + 김치",
				[
					meal({
						food: "계란",
						servings: 2,
						calories: 144,
						protein: 12,
						carbs: 0,
						fat: 10,
					}),
					meal({ food: "김치", calories: 20, protein: 1, carbs: 3, fat: 1 }),
				],
			],
			[
				"떡볶이 1인분",
				[
					meal({
						food: "떡볶이",
						calories: 450,
						protein: 8,
						carbs: 67,
						fat: 14,
					}),
				],
			],
			["450kcal", [meal({ food: "빠른 기록", calories: 450 })]],
			["2 장어", [meal({ food: "장어", servings: 2, isKnown: false })]],
		],
		{ language: "ko" },
	);
});

test("puts an entry at the time it names, in local time", (t) => {
	const quick = (at: string) => [
		meal({ at, food: "Quick add", calories: 450 }),
	];

	check(t, [
		["@y 21:00 450kcal", quick(local(21, 0, 2))],
		["@y21:00 450kcal", quick(local(21, 0, 2))],
		["@-2d 7:30 450kcal", quick(local(7, 30, 1))],
		["@7:30 450kcal", quick(local(7, 30))],
		["@y 450kcal", quick(local(12, 0, 2))],
		["@23:00 450kcal", quick(local(23, 0, 2))],
		["@25:00 450kcal", "badTime"],
		["@yesterday 450kcal", "badTime"],
		["@ 450kcal", "badTime"],
		["@y", "empty"],
	]);
});

test("puts a time typed after midnight on yesterday", (t) => {
	t.deepEqual(parse("@23:00 450kcal", { at: Date.parse(local(0, 20, 4)) }), [
		meal({ at: local(23, 0, 3), food: "Quick add", calories: 450 }),
	]);
});

test("reads typed units and English counters the way people type them", (t) => {
	const cup = parse("1 c rice");
	t.true(Array.isArray(cup) && cup[0]?.kind === "meal" && !("carbs" in cup[0]));
	t.like(parse("ramen 20c"), [{ kind: "meal", carbs: 20 }]);
	t.like(parse("2 slices pizza"), [
		{ kind: "meal", servings: 2, food: "Pepperoni pizza" },
	]);
	t.like(parse("goal sleep 8"), [{ kind: "goal", goal: "sleep", value: 480 }]);
});

test("reads 水餃 as a food, not as water", (t) => {
	const result = parse("水餃");

	t.true(Array.isArray(result) && result[0]?.kind === "meal");
});

test("parses water, body, sleep, mood, habits, steps, notes, and goals", (t) => {
	const at = local(12);

	check(t, [
		["w", [{ kind: "water", at, milliliters: 250 }]],
		["w 500", [{ kind: "water", at, milliliters: 500 }]],
		["W 500ml", [{ kind: "water", at, milliliters: 500 }]],
		["w 0.5l", [{ kind: "water", at, milliliters: 500 }]],
		["w 2 glasses", [{ kind: "water", at, milliliters: 500 }]],
		["w 2杯", [{ kind: "water", at, milliliters: 500 }]],
		["ｗ　５００", [{ kind: "water", at, milliliters: 500 }]],
		["water", [{ kind: "water", at, milliliters: 250 }]],
		["water 500", [{ kind: "water", at, milliliters: 500 }]],
		["水 500", [{ kind: "water", at, milliliters: 500 }]],
		["물", [{ kind: "water", at, milliliters: 250 }]],
		["w lots", "badNumber"],
		["w 6000", "outOfRange"],
		["wt 72.4", [{ kind: "body", at, weight: 72.4 }]],
		["waist 82", [{ kind: "body", at, waist: 82 }]],
		["bf 18", [{ kind: "body", at, bodyFat: 18 }]],
		["wt 72.4kg bf 18%", [{ kind: "body", at, weight: 72.4, bodyFat: 18 }]],
		["wt 500", "outOfRange"],
		["wt 72 bf", "badNumber"],
		[
			"sl 23:30-7:10 q4",
			[{ kind: "sleep", at: local(7, 10), minutes: 460, quality: 4 }],
		],
		["sl 7.5h q3", [{ kind: "sleep", at, minutes: 450, quality: 3 }]],
		["sl 7h30m", [{ kind: "sleep", at, minutes: 450 }]],
		["sl 7시간", [{ kind: "sleep", at, minutes: 420 }]],
		["sl 8", [{ kind: "sleep", at, minutes: 480 }]],
		["sl 450", [{ kind: "sleep", at, minutes: 450 }]],
		["h read 1/0", "badNumber"],
		["h read 0/0", "badNumber"],
		["sl 7.5h q9", "badSleep"],
		["sl 25:00-7:00", "badSleep"],
		["sl", "badSleep"],
		[
			"m 4 e3 s2 #work #friends",
			[
				{
					kind: "mood",
					at,
					score: 4,
					energy: 3,
					stress: 2,
					tags: ["work", "friends"],
				},
			],
		],
		["m 2", [{ kind: "mood", at, score: 2 }]],
		["m 6", "badMood"],
		["m 4 great", "badMood"],
		["h read", [{ kind: "habit", at, name: "read" }]],
		["h read 30", [{ kind: "habit", at, name: "read", amount: 30 }]],
		["h read s", [{ kind: "habit", at, name: "read", skipped: true }]],
		["h no sugar", [{ kind: "habit", at, name: "no sugar" }]],
		["h", "empty"],
		["st 8400", [{ kind: "steps", at, count: 8400 }]],
		["st 8,400", [{ kind: "steps", at, count: 8400 }]],
		["st 0", "outOfRange"],
		["st many", "badNumber"],
		[
			"n grateful for the sun",
			[{ kind: "note", at, text: "grateful for the sun" }],
		],
		["n", "empty"],
		[`n ${"a".repeat(2001)}`, "tooLong"],
		["goal water 2.5l", [{ kind: "goal", at, goal: "water", value: 2500 }]],
		["goal sleep 8h", [{ kind: "goal", at, goal: "sleep", value: 480 }]],
		["goal steps 9000", [{ kind: "goal", at, goal: "steps", value: 9000 }]],
		["goal focus 6", [{ kind: "goal", at, goal: "focusSessions", value: 6 }]],
		["goal water 20l", "outOfRange"],
		["goal mood 5", "badGoal"],
		["goal steps lots", "badNumber"],
	]);
});

test("puts a sleep logged after midnight on the morning it ended", (t) => {
	t.deepEqual(parse("sl 23:30-7:10", { at: Date.parse(local(0, 20, 4)) }), [
		{ kind: "sleep", at: local(7, 10, 3), minutes: 460 },
	]);
});

test("reuses the spelling of a habit logged before", (t) => {
	const progress = progressSchema.parse({
		habits: [{ at: local(8, 0, 2), name: "Read" }],
	});

	t.deepEqual(parse("h read", { progress }), [
		{ kind: "habit", at: local(12), name: "Read" },
	]);
});

test("matches a habit spelled in full width", (t) => {
	const progress = progressSchema.parse({
		habits: [{ at: local(8, 0, 2), name: "Read" }],
	});

	t.deepEqual(parse("h ｒｅａｄ", { progress }), [
		{ kind: "habit", at: local(12), name: "Read" },
	]);
});

test("parses workouts in every language, with their calories", (t) => {
	const at = local(12);
	const profile = {
		name: "Ken",
		age: 30,
		height: 175,
		weight: 70,
		gender: "male",
		workStyle: "desk",
		goal: "maintain",
	} as const;
	const bench = (weight: number, reps: number) => ({
		exercise: "bench",
		reps,
		weight,
	});
	const run = { kind: "workout", at, activity: "running" } as const;

	check(t, [
		["wo run 30m hard", [{ ...run, minutes: 30, intensity: "vigorous" }]],
		[
			"wo jog 5k 30 easy",
			[{ ...run, minutes: 30, intensity: "light", distance: 5 }],
		],
		[
			"wo bench 60x5x3",
			[
				{
					kind: "workout",
					at,
					activity: "strength",
					minutes: 9,
					intensity: "moderate",
					sets: [bench(60, 5), bench(60, 5), bench(60, 5)],
				},
			],
		],
		[
			"wo farmer carry 40x20x2 10m",
			[
				{
					kind: "workout",
					at,
					activity: "strength",
					minutes: 10,
					intensity: "moderate",
					sets: [
						{ exercise: "farmer carry", reps: 20, weight: 40 },
						{ exercise: "farmer carry", reps: 20, weight: 40 },
					],
				},
			],
		],
		[
			"wo frisbee 45m",
			[
				{
					kind: "workout",
					at,
					activity: "frisbee",
					minutes: 45,
					intensity: "moderate",
				},
			],
		],
		["wo run", "noMinutes"],
		["wo run fast", "badNumber"],
		["wo bench", "noPreviousSets"],
		["wo bench 60x0", "outOfRange"],
		["wo run 900m", "outOfRange"],
		["wo", "empty"],
	]);
	check(
		t,
		[["wo 跑步 30m 高強度", [{ ...run, minutes: 30, intensity: "vigorous" }]]],
		{
			language: "zh-TW",
		},
	);
	check(
		t,
		[
			[
				"wo 달리기 30분 격렬하게",
				[{ ...run, minutes: 30, intensity: "vigorous" }],
			],
		],
		{ language: "ko" },
	);
	check(
		t,
		[
			[
				"wo run 30m hard",
				// 11.8 METs × 70 kg × 0.5 h.
				[{ ...run, minutes: 30, intensity: "vigorous", calories: 413 }],
			],
		],
		{ progress: progressSchema.parse({ profile }) },
	);
});

test("repeats the sets of the last session of an exercise", (t) => {
	const progress = progressSchema.parse({
		workouts: [
			{
				at: local(18, 0, 1),
				activity: "strength",
				minutes: 30,
				sets: [
					{ exercise: "bench", reps: 5, weight: 60 },
					{ exercise: "squat", reps: 5, weight: 80 },
					{ exercise: "bench", reps: 3, weight: 65 },
				],
			},
		],
	});

	t.deepEqual(parse("wo bench 20m", { progress }), [
		{
			kind: "workout",
			at: local(12),
			activity: "strength",
			minutes: 20,
			intensity: "moderate",
			sets: [
				{ exercise: "bench", reps: 5, weight: 60 },
				{ exercise: "bench", reps: 3, weight: 65 },
			],
		},
	]);
});

test("refuses workout values the schema would reject", (t) => {
	check(t, [
		["wo run 1/0", "badNumber"],
		["wo bench 60x0", "outOfRange"],
		["wo run 99999", "outOfRange"],
		["wo bench 1e9x5", "badNumber"],
		["wo bench 99999999999999999999999999x5", "outOfRange"],
		["wo bench 60x5x999999", "outOfRange"],
		["wo run 30m 0k", "outOfRange"],
		["wo 60x5", "empty"],
	]);
});

test("repeats the newest session by time, not by position", (t) => {
	const session = (at: string, reps: number) => ({
		at,
		activity: "strength",
		minutes: 30,
		sets: [{ exercise: "bench", reps, weight: 60 }],
	});
	const progress = progressSchema.parse({
		workouts: [session(local(18, 0, 2), 8), session(local(9, 0, 1), 3)],
	});
	const drafts = parse("wo bench 20m", { progress });
	const draft = Array.isArray(drafts) ? drafts[0] : undefined;

	t.deepEqual(draft?.kind === "workout" ? draft.sets : undefined, [
		{ exercise: "bench", reps: 8, weight: 60 },
	]);
});

test("keeps sets typed after an activity word", (t) => {
	t.deepEqual(parse("wo lift 60x5"), [
		{
			kind: "workout",
			at: local(12),
			activity: "strength",
			minutes: 3,
			intensity: "moderate",
			sets: [{ exercise: "lift", reps: 5, weight: 60 }],
		},
	]);
});

test("repeats the last line with a dot, and copies yesterday's meals", (t) => {
	const progress = progressSchema.parse({
		meals: [
			{ at: local(8, 0, 1), food: "Bagel", calories: 280 },
			{ at: local(8, 0, 2), food: "Egg", servings: 2, calories: 144 },
			{ at: local(8, 0, 2), food: "Toast", calories: 160 },
			{ at: local(13, 0, 2), food: "Ramen", calories: 500 },
		],
		events: [{ at: local(11), action: "appOpened" }],
	});
	const ramen = {
		kind: "meal",
		food: "Ramen",
		servings: 1,
		calories: 500,
		isKnown: true,
	};
	const egg = {
		kind: "meal",
		food: "Egg",
		servings: 2,
		calories: 144,
		isKnown: true,
	};
	const toast = {
		kind: "meal",
		food: "Toast",
		servings: 1,
		calories: 160,
		isKnown: true,
	};

	t.deepEqual(parse(".", { progress }), [{ ...ramen, at: local(12) }]);
	t.deepEqual(parse("copy y", { progress }), [
		{ ...egg, at: local(8) },
		{ ...toast, at: local(8) },
		{ ...ramen, at: local(13) },
	]);
	t.is(parse(".", { progress: empty }), "nothingToRepeat");
	t.is(parse("copy y", { progress: empty }), "nothingToCopy");
	t.is(parse("copy x", { progress }), "badTime");
});

test("applies drafts, undoes exactly them, and restores a deleted entry", (t) => {
	const before = progressSchema.parse({
		meals: [{ at: local(7), food: "Bagel", calories: 280 }],
		water: [{ at: local(9), milliliters: 250 }],
	});
	const result = parseQuickLog("2 eggs, mystery stew", {
		progress: before,
		now,
		language: "en",
	});
	const goal = parseQuickLog("goal water 2.5l", {
		progress: before,
		now,
		language: "en",
	});
	const drafts = [
		...(result.ok ? result.drafts : []),
		...(goal.ok ? goal.drafts : []),
	];
	const snapshot = structuredClone(before);
	const { next, added } = applyDrafts(before, drafts);

	t.deepEqual(added, [
		{ kind: "meal", index: 1 },
		{ kind: "meal", index: 2 },
	]);
	t.deepEqual(next.meals.slice(1), [
		{
			at: local(12),
			food: "Egg",
			servings: 2,
			calories: 144,
			protein: 12,
			carbs: 0,
			fat: 10,
		},
		{ at: local(12), food: "mystery stew" },
	]);
	t.deepEqual(next.goals, { water: 2500 });
	t.deepEqual(undoAdded(next, added).meals, before.meals);
	t.deepEqual(undoAdded(next, added).water, before.water);
	t.deepEqual(before, snapshot);

	const [toast] = logsOf(
		progressSchema.parse({ meals: [{ at: local(8), food: "Toast" }] }),
	);
	const deleted = { ...toast!, index: 0 };
	t.deepEqual(restoreLog(before, deleted).meals, [
		{ at: local(8), food: "Toast" },
		{ at: local(7), food: "Bagel", calories: 280 },
	]);
});

test("writes every kind back as a line that parses to the same entry", (t) => {
	const at = local(18, 30, 1);
	const progress = progressSchema.parse({
		meals: [
			{
				at,
				food: "Egg",
				servings: 2,
				calories: 144,
				protein: 12,
				carbs: 0,
				fat: 10,
			},
			{ at, food: "Quick add", calories: 450, protein: 30 },
			{ at, food: "7UP", calories: 140 },
			{ at, food: "n stuff", calories: 100 },
			{ at, food: "Vitamin x3", calories: 5 },
			{ at, food: "杯子", calories: 50 },
			{ at, food: "Milk", servings: 0.25, calories: 40 },
		],
		workouts: [
			{
				at,
				activity: "running",
				minutes: 30,
				intensity: "vigorous",
				distance: 5,
			},
			{
				at,
				activity: "strength",
				minutes: 12,
				intensity: "moderate",
				sets: [
					{ exercise: "bench", reps: 5, weight: 60 },
					{ exercise: "bench", reps: 5, weight: 60 },
					{ exercise: "bench", reps: 3, weight: 65 },
				],
			},
		],
		water: [{ at, milliliters: 500 }],
		sleep: [{ at, minutes: 460, quality: 4 }],
		body: [{ at, weight: 72.4, bodyFat: 18 }],
		moods: [{ at, score: 4, energy: 3, stress: 2, tags: ["work"] }],
		habits: [
			{ at, name: "no sugar", amount: 2 },
			{ at, name: "read", skipped: true },
		],
		steps: [{ at, count: 8400 }],
		notes: [{ at, text: "grateful for the sun" }],
	});

	for (const language of ["en", "zh-TW", "ko"] as const) {
		for (const log of logsOf(progress)) {
			const line = lineOf(log, language);
			t.deepEqual(
				parse(line, { progress, language, at: Date.parse(log.at) }),
				[draftOf(log)],
				`${language}: ${line}`,
			);
		}
	}

	t.is(
		lineOf(
			logsOf(progress).find((log) => log.kind === "workout" && log.entry.sets)!,
			"zh-TW",
		),
		"wo 臥推 60x5x2 65x3 12m 中度",
	);
});

test("describes drafts for the preview and names them for the footer", (t) => {
	const english = messagesOf("en");
	const result = parseQuickLog("2 eggs, mystery stew", {
		progress: empty,
		now,
		language: "en",
	});
	const drafts = result.ok ? result.drafts : [];
	const [eggs, stew] = drafts;

	t.is(
		describeDraft(eggs!, english, "en"),
		"2 × Egg · 144 kcal · 12 g protein",
	);
	t.is(
		describeDraft(stew!, english, "en"),
		"mystery stew: not a food I know yet; add its kcal, e.g. mystery stew 500kcal",
	);
	t.is(
		describeDraft(
			{ kind: "goal", at: local(12), goal: "sleep", value: 480 },
			english,
			"en",
		),
		"Sleep goal: 8h",
	);
	t.is(summaryOf(drafts, english), "2 Egg, mystery stew");
	t.is(
		summaryOf(
			[{ kind: "water", at: local(12), milliliters: 250 }],
			messagesOf("ko"),
		),
		"물",
	);
});

test("suggests the usual foods of this hour, water, last week's workout, and habits", (t) => {
	const nine = Date.parse(local(9));
	const progress = progressSchema.parse({
		language: "en",
		meals: [
			{ at: local(8, 0, 1), food: "Oatmeal", calories: 300 },
			{ at: local(8, 15, 2), food: "Oatmeal", calories: 300 },
			{ at: local(8, 30, 2), food: "Banana", servings: 2, calories: 210 },
			{ at: local(19, 0, 2), food: "Ramen", calories: 500 },
			{ at: local(8, 10), food: "Egg", calories: 72 },
			{ at: local(9, 30, 1), food: "Egg", calories: 72 },
		],
		workouts: [
			{
				at: new Date(2026, 8, 26, 7).toISOString(),
				activity: "running",
				minutes: 30,
				intensity: "moderate",
			},
		],
		habits: [
			{ at: new Date(2026, 8, 30, 21).toISOString(), name: "read" },
			{ at: local(21, 0, 1), name: "read" },
			{ at: local(21, 0, 2), name: "read" },
			{ at: local(22, 0, 1), name: "stretch" },
			{ at: local(22, 0, 2), name: "stretch" },
		],
	});

	t.deepEqual(suggestionsOf(progress, nine), [
		{ line: "Oatmeal", label: "usual around now" },
		{ line: "2 Banana", label: "usual around now" },
		{ line: "w", label: "behind on water today" },
		{ line: "wo Running 30m Moderate", label: "same day last week" },
		{ line: "h read", label: "3 of the last 7 days" },
	]);
	t.is(suggestionsOf(progress, nine, 2).length, 2);
	t.false(
		suggestionsOf(
			{ ...progress, water: [{ at: local(8), milliliters: 1000 }] },
			nine,
		).some(({ line }) => line === "w"),
		"ahead of the water pace",
	);
	t.deepEqual(
		suggestionsOf(progressSchema.parse({}), Date.parse(local(6))),
		[],
	);
});

test("finds the food name being typed, to complete it", (t) => {
	t.deepEqual(completionOf("2 eggs, chi"), { head: "2 eggs, ", query: "chi" });
	t.deepEqual(completionOf("@y 21:00 2 chi"), {
		head: "@y 21:00 2 ",
		query: "chi",
	});
	t.deepEqual(completionOf("계란 2개 + 김"), {
		head: "계란 2개 + ",
		query: "김",
	});
	t.deepEqual(completionOf("2個雞"), { head: "2個", query: "雞" });
	t.deepEqual(completionOf("udon"), { head: "", query: "udon" });
	t.is(completionOf("w 500"), undefined);
	t.is(completionOf("wo bench"), undefined);
});

test("edits only an entry whose line parses back to itself", (t) => {
	const progress = progressSchema.parse({
		language: "en",
		meals: [
			{ at: local(8), food: "Toast", calories: 160 },
			{ at: local(9), food: "salt, pepper", calories: 5 },
		],
		workouts: [
			{
				at: local(10),
				activity: "strength",
				minutes: 30,
				sets: [
					{ exercise: "bench", weight: 60, reps: 5 },
					{ exercise: "squat", weight: 80, reps: 5 },
				],
			},
		],
		water: [{ at: local(11), milliliters: 500 }],
	});
	const editable = (match: (log: Logged) => boolean) =>
		isEditable(logsOf(progress).find((log) => match(log))!, progress, "en");

	t.true(editable((log) => log.at === local(8)));
	t.false(editable((log) => log.at === local(9)));
	t.false(editable((log) => log.at === local(10)));
	t.true(editable((log) => log.at === local(11)));
});

test("suggests the workout today's plan names, until one is logged", (t) => {
	const nine = Date.parse(local(9));
	const progress = progressSchema.parse({
		language: "en",
		plans: [
			{
				at: local(8, 0, 1),
				title: "Base building",
				days: [
					{
						weekday: new Date(nine).getDay(),
						activity: "running",
						minutes: 30,
						intensity: "light",
					},
				],
			},
		],
	});
	const planned = (value: typeof progress) =>
		suggestionsOf(value, nine).find(({ label }) => label === "on today's plan");

	t.deepEqual(planned(progress), {
		line: "wo Running 30m Light",
		label: "on today's plan",
	});
	t.is(
		planned(
			progressSchema.parse({
				...progress,
				workouts: [{ at: local(8), activity: "walking", minutes: 20 }],
			}),
		),
		undefined,
	);
});

const estimated = (line: string) => {
	const context = { progress: empty, now, language: "en" } as const;
	const result = parseQuickLog(line, context);
	const stew = result.ok
		? result.drafts.find((draft) => draft.kind === "meal" && !draft.isKnown)
		: undefined;

	return stew?.kind === "meal"
		? withEstimate(
				line,
				stew,
				{ calories: 300, protein: 10, carbs: 30, fat: 12 },
				context,
			)
		: undefined;
};

test("puts an estimate into the line as totals for every serving", (t) => {
	t.is(
		estimated("2 mystery stew, toast"),
		"2 mystery stew 600kcal 20p 60c 24f, toast",
	);
	t.is(estimated("zorb x2, zorb"), "2 zorb 600kcal 20p 60c 24f, zorb");
	t.is(estimated("2 mystery  stew"), "2 mystery stew 600kcal 20p 60c 24f");
});

test("writes an estimate the parser reads back, even after a Chinese name", (t) => {
	const line = estimated("媽媽的湯2碗");
	const result = line
		? parseQuickLog(line, { progress: empty, now, language: "en" })
		: undefined;

	t.like(result?.ok ? result.drafts[0] : undefined, {
		calories: 600,
		fat: 24,
	});
});

test("the planned workout suggestion parses back with its minutes and intensity", (t) => {
	const nine = Date.parse(local(9));
	const progress = progressSchema.parse({
		language: "en",
		plans: [
			{
				at: local(8, 0, 1),
				title: "Base building",
				days: [
					{
						weekday: new Date(nine).getDay(),
						activity: "running",
						minutes: 30,
						intensity: "light",
					},
				],
			},
		],
	});
	const line = suggestionsOf(progress, nine).find(
		({ label }) => label === "on today's plan",
	)?.line;
	const result = parseQuickLog(line ?? "", {
		progress,
		now: nine,
		language: "en",
	});

	t.like(result.ok ? result.drafts[0] : undefined, {
		kind: "workout",
		minutes: 30,
		intensity: "light",
	});
});
