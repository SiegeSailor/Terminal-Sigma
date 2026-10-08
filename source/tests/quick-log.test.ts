import test from "ava";
import type { Language } from "../i18n.js";
import { type Progress, progressSchema } from "../progress.js";
import { type Draft, type ParseError, parseQuickLog } from "../quick-log.js";

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
