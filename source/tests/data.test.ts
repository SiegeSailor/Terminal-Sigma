import test from "ava";
import {
	describeEvent,
	describeQuoteChange,
	petStateOf,
	workoutCombinationsOf,
} from "../content.js";
import { commonFoodCount, foodSuggestions } from "../foods.js";
import { messagesOf } from "../i18n.js";
import type { Progress } from "../progress.js";
import {
	bundledPool,
	bundledQuotes,
	defaultQuoteSettings,
	pickBundled,
	quoteCategories,
	quoteRequestOf,
} from "../quotes.js";

const english = messagesOf("en");
const at = new Date().toISOString();
const empty: Progress = {
	language: "en",
	focus: [],
	meals: [],
	workouts: [],
	events: [],
};

test("suggests foods from the user's meals first, then common ones", (t) => {
	t.true(commonFoodCount >= 100);

	const meals = [{ at, food: "Chicken pho", calories: 450, protein: 30 }];
	const suggestions = foodSuggestions("chick", "en", meals);

	t.like(suggestions[0], { label: "Chicken pho", isYours: true });
	t.like(suggestions[1], {
		label: "Chicken breast",
		calories: 248,
		protein: 46,
	});
	t.like(foodSuggestions("雞胸", "ko", []), [{ label: "닭가슴살" }]);
	t.deepEqual(foodSuggestions("", "en", []), []);
});

test("offers past workouts as 1-step combinations", (t) => {
	const combinations = workoutCombinationsOf(english, [
		{ at, activity: "running", minutes: 30, intensity: "moderate" },
		{ at, activity: "yoga", minutes: 20, intensity: "light" },
		{ at, activity: "running", minutes: 30, intensity: "moderate" },
		{ at, activity: "Run", minutes: 10 },
	]);

	t.deepEqual(
		combinations.map((combination) => combination.label),
		["Running · 30 min · Moderate", "Yoga · 20 min · Light"],
	);
	t.deepEqual(combinations[1]?.values, {
		activity: "yoga",
		minutes: "20",
		intensity: "light",
	});
});

test("filters bundled quotes like the API would", (t) => {
	const covered = new Set(bundledQuotes.flatMap((quote) => quote.categories));
	t.deepEqual(
		quoteCategories.filter((category) => !covered.has(category)),
		[],
	);

	const humor = bundledPool({ ...defaultQuoteSettings, categories: ["humor"] });
	t.true(humor.every((quote) => quote.categories?.includes("humor")));

	const noWisdom = bundledPool({
		...defaultQuoteSettings,
		excluded: ["wisdom"],
	});
	t.true(noWisdom.every((quote) => !quote.categories?.includes("wisdom")));

	const seneca = bundledPool({ ...defaultQuoteSettings, author: "塞內卡" });
	t.true(
		seneca.length > 0 && seneca.every((quote) => quote.author === "Seneca"),
	);

	const daily = { ...defaultQuoteSettings, mode: "daily" as const };
	t.is(pickBundled(daily, 0, 0.1), pickBundled(daily, 1000, 0.9));
});

test("builds the API request from the quote settings", (t) => {
	t.is(
		quoteRequestOf(defaultQuoteSettings),
		"https://api.api-ninjas.com/v2/randomquotes",
	);
	t.is(
		quoteRequestOf({
			...defaultQuoteSettings,
			categories: ["wisdom", "life"],
			excluded: ["death"],
			author: "Seneca",
		}),
		"https://api.api-ninjas.com/v2/randomquotes?categories=wisdom%2Clife&exclude_categories=death&author=Seneca",
	);
	t.is(
		quoteRequestOf({ ...defaultQuoteSettings, mode: "daily", author: "x" }),
		"https://api.api-ninjas.com/v2/quoteoftheday",
	);
});

test("describes every logged action in the language on now", (t) => {
	t.is(
		describeEvent(english, { at, action: "languageChanged", detail: "ko" }),
		"Switched the language to 한국어",
	);
	t.is(
		describeEvent(messagesOf("zh-TW"), {
			at,
			action: "themeChanged",
			detail: "moss",
		}),
		"主題改為苔蘚",
	);
	t.is(describeQuoteChange(english, "interval:300"), "Interval: 5 minutes");
	t.is(
		describeQuoteChange(english, "categories:wisdom,life"),
		"Categories: Wisdom, Life",
	);
	t.is(describeQuoteChange(english, "author:"), "Author: Any");
});

test("puts the pet to sleep until something is logged today", (t) => {
	t.like(petStateOf(empty, Date.now()), {
		mood: "sleepy",
		badges: { meal: false, workout: false, focus: false },
	});
	t.like(
		petStateOf(
			{
				...empty,
				meals: [{ at, food: "Oatmeal", calories: 300, protein: 10 }],
			},
			Date.now(),
		),
		{ mood: "content", badges: { meal: true } },
	);
	t.like(
		petStateOf(
			{
				...empty,
				meals: [{ at, food: "Steak", calories: 800, protein: 60 }],
				workouts: [
					{ at, activity: "running", minutes: 40, intensity: "moderate" },
				],
			},
			Date.now(),
		),
		{ mood: "happy" },
	);
});
