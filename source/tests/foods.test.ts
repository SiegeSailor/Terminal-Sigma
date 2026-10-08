import test from "ava";
import { commonFoods, foodsOf, matchFood } from "../foods.js";

// Alcohol brings 7 kcal per gram, which the 4-4-9 rule leaves out.
const alcoholic = new Set(["Beer", "Red wine", "Soju"]);

test("gives every food 3 names, a serving in 3 languages, and its macros", (t) => {
	t.is(commonFoods.length, 112);

	for (const food of commonFoods) {
		t.true(
			[...Object.values(food.names), ...Object.values(food.serving)].every(
				Boolean,
			),
			`${food.names.en} has every name and serving`,
		);
		t.true(
			[food.calories, food.protein, food.carbs, food.fat].every(
				(value) => Number.isFinite(value) && value >= 0,
			),
			`${food.names.en} has its kcal and macros`,
		);
	}
});

test("keeps every food's kcal within 20% of its protein, carbs, and fat", (t) => {
	for (const food of commonFoods.filter(
		({ names }) => !alcoholic.has(names.en),
	)) {
		const fromMacros = 4 * food.protein + 4 * food.carbs + 9 * food.fat;
		// 5 kcal of slack for drinks with almost none, like black coffee.
		t.true(
			Math.abs(food.calories - fromMacros) <= Math.max(food.calories * 0.2, 5),
			`${food.names.en}: ${food.calories} kcal against ${fromMacros}`,
		);
	}
});

test("never gives 2 foods the same name in any language", (t) => {
	const names = commonFoods.flatMap((food) =>
		Object.values(food.names).map((name) => name.toLowerCase()),
	);

	t.deepEqual(
		names.filter((name, index) => names.indexOf(name) !== index),
		[],
	);
});

test("reads a table line by line", (t) => {
	t.deepEqual(foodsOf("Egg|雞蛋|계란|72|6|0|5|1 egg|1 顆|1개\n"), [
		{
			names: { en: "Egg", "zh-TW": "雞蛋", ko: "계란" },
			calories: 72,
			protein: 6,
			carbs: 0,
			fat: 5,
			serving: { en: "1 egg", "zh-TW": "1 顆", ko: "1개" },
		},
	]);
});

test("matches the food a name means, yours first", (t) => {
	const at = "2026-10-03T08:00:00.000Z";
	const pho = {
		at,
		food: "Chicken pho",
		calories: 900,
		protein: 60,
		servings: 2,
	};

	t.like(matchFood("eggs", "en", []), {
		label: "Egg",
		calories: 72,
		serving: "1 large egg",
		isYours: false,
	});
	t.like(matchFood("雞蛋", "ko", []), { label: "계란" });
	t.like(matchFood("rice", "en", []), { label: "White rice" });
	t.like(matchFood("蛋", "zh-TW", []), { label: "雞蛋" });
	t.like(matchFood("볶음밥", "en", []), { label: "Fried rice" });
	t.like(matchFood("toast", "en", []), { label: "Whole wheat toast" });
	t.like(matchFood("chicken pho", "en", [pho]), {
		label: "Chicken pho",
		calories: 450,
		protein: 30,
		isYours: true,
	});
	t.like(matchFood("chicken breast", "en", [pho]), { isYours: false });
	t.like(matchFood("chicken", "en", [pho]), { label: "Chicken pho" });
	t.is(matchFood("zzz", "en", []), undefined);
	t.is(matchFood("  ", "en", []), undefined);
});
