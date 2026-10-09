import test from "ava";
import {
	activityOfKind,
	appearanceOf,
	describeEvent,
	describeLog,
	describeQuoteChange,
	moodOf,
	sectionsOf,
	updateViewOf,
} from "../content.js";
import { commonFoodCount, foodSuggestions } from "../foods.js";
import { type Language, messagesOf } from "../i18n.js";
import { easeOutCubic, tweenOf } from "../motion.js";
import {
	type EntryOf,
	type Logged,
	type LogKind,
	progressSchema,
	experienceOf,
} from "../progress.js";
import { themes } from "../theme.js";
import {
	bundledPool,
	bundledQuotes,
	defaultQuoteSettings,
	pickBundled,
	quoteCategories,
	quoteNoticeOf,
	quoteRequestOf,
	typedOf,
} from "../quotes.js";
import { isNewer } from "../update.js";

const english = messagesOf("en");
const at = new Date().toISOString();
const empty = progressSchema.parse({ language: "en" });

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

test("dozes until something is logged today, and beams once targets are met", (t) => {
	t.is(moodOf(empty, Date.now()), "sleepy");
	t.is(
		moodOf(
			{
				...empty,
				meals: [{ at, food: "Oatmeal", calories: 300, protein: 10 }],
			},
			Date.now(),
		),
		"content",
	);
	t.is(
		moodOf(
			{
				...empty,
				meals: [{ at, food: "Steak", calories: 800, protein: 60 }],
				workouts: [
					{ at, activity: "running", minutes: 40, intensity: "moderate" },
				],
			},
			Date.now(),
		),
		"happy",
	);
});

test("compares versions part by part", (t) => {
	t.true(isNewer("1.10.0", "1.9.2"));
	t.true(isNewer("2.0.0", "1.99.99"));
	t.false(isNewer("1.4.1", "1.4.1"));
	t.false(isNewer("1.4.0", "1.4.1"));
	t.false(isNewer("not a version", "1.0.0"));
});

test("offers an update only when a newer version is out", (t) => {
	const current = { current: "1.4.1" };
	const values = (phase: Parameters<typeof updateViewOf>[1]) =>
		updateViewOf(english, phase, current).options.map((option) => option.value);

	t.deepEqual(values({ phase: "ready", newest: "1.5.0" }), ["install", "back"]);
	t.deepEqual(values({ phase: "ready", newest: "1.4.1" }), ["check", "back"]);
	t.deepEqual(values({ phase: "checkFailed", error: "offline" }), [
		"check",
		"back",
	]);
	t.deepEqual(values({ phase: "installing", newest: "1.5.0" }), []);
	t.deepEqual(values({ phase: "installed", newest: "1.5.0" }), [
		"restart",
		"back",
	]);
	t.is(
		updateViewOf(english, { phase: "ready", newest: "1.4.1" }, current).status,
		"Newest version: v1.4.1, so you are up to date",
	);
});

test("marks a changed quote new for 8 seconds, typing it in first", (t) => {
	t.deepEqual(quoteNoticeOf(undefined, 5000, false), {
		isNew: false,
		shown: 1,
	});
	t.deepEqual(quoteNoticeOf(1000, 1000, false), { isNew: true, shown: 0 });
	t.deepEqual(quoteNoticeOf(1000, 1400, false), { isNew: true, shown: 0.5 });
	t.deepEqual(quoteNoticeOf(1000, 3000, false), { isNew: true, shown: 1 });
	t.deepEqual(quoteNoticeOf(1000, 9000, false), { isNew: false, shown: 1 });
	t.deepEqual(quoteNoticeOf(1000, 1000, true), { isNew: true, shown: 1 });
});

test("types in whole characters, never half of one", (t) => {
	t.is(typedOf("abcd", 0.5), "ab");
	t.is(typedOf("健全的精神", 0.4), "健全");
	t.is(typedOf("👍🏽ok", 0.34), "👍🏽");
	t.is(typedOf("abc", 0), "");
	t.is(typedOf("abc", 1), "abc");
});

test("never draws the quote already on screen", (t) => {
	const current = pickBundled(defaultQuoteSettings, 0, 0);

	for (const random of [0, 0.25, 0.5, 0.75, 0.999]) {
		t.not(
			pickBundled(defaultQuoteSettings, 0, random, current).quote,
			current.quote,
		);
	}

	const one = { ...defaultQuoteSettings, author: "Juvenal" };
	const only = pickBundled(one, 0, 0);
	t.is(pickBundled(one, 0, 0.5, only).quote, only.quote, "a pool of 1 repeats");
});

test("describes every kind of entry in the language on now", (t) => {
	const describe = (log: Logged, language: Language = "en") =>
		describeLog(log, language, messagesOf(language));
	const entry = <Kind extends LogKind>(
		kind: Kind,
		fields: Omit<EntryOf[Kind], "at">,
	) => ({ kind, at, index: 0, entry: { ...fields, at } });
	const bench = (weight: number, reps: number) => ({
		exercise: "bench",
		weight,
		reps,
	});

	t.is(
		describe(
			entry("meal", { food: "Egg", servings: 2, calories: 144, protein: 12 }),
		),
		"2 × Egg · 144 kcal · 12 g protein",
	);
	t.is(
		describe(
			entry("workout", {
				activity: "strength",
				minutes: 9,
				intensity: "moderate",
				sets: [bench(60, 5), bench(60, 5), bench(65, 3)],
			}),
		),
		"Strength · 9 min · Moderate · Bench press 60×5×2, 65×3",
	);
	t.is(
		describe(
			entry("workout", {
				activity: "running",
				minutes: 30,
				intensity: "vigorous",
				distance: 5,
				calories: 413,
			}),
		),
		"Running · 30 min · Vigorous · 5 km · 413 kcal burned",
	);
	t.is(describe(entry("water", { milliliters: 1500 })), "1,500 ml of water");
	t.is(
		describe(entry("sleep", { minutes: 460, quality: 4 })),
		"Slept 7h 40m · quality 4/5",
	);
	t.is(
		describe(entry("body", { weight: 72.4, bodyFat: 18 })),
		"72.4 kg · body fat 18%",
	);
	t.is(
		describe(entry("mood", { score: 4, energy: 3, tags: ["work", "friends"] })),
		"Mood 4/5 · energy 3/5 · #work #friends",
	);
	t.is(describe(entry("habit", { name: "read", amount: 30 })), "read · 30");
	t.is(
		describe(entry("habit", { name: "read", skipped: true })),
		"Skipped read",
	);
	t.is(describe(entry("steps", { count: 8400 })), "8,400 steps");
	t.is(describe(entry("note", { text: "grateful" })), "grateful");
	t.is(describe(entry("sleep", { minutes: 480 }), "zh-TW"), "睡了 8 小時");
	t.is(describe(entry("water", { milliliters: 500 }), "ko"), "물 500ml");
});

test("shows water and last night's sleep against their targets in Today", (t) => {
	const progress = progressSchema.parse({
		language: "en",
		water: [{ at, milliliters: 750 }],
		sleep: [{ at, minutes: 400 }],
	});
	const [, health] = sectionsOf(
		"en",
		themes.ember,
		progress,
		Date.parse(at),
		experienceOf(progress),
	);

	t.like(
		health?.metrics.find((metric) => metric.label === "Water"),
		{ detail: "750 of 2,600 ml", color: themes.ember.metrics.water },
	);
	t.like(
		health?.metrics.find((metric) => metric.label === "Sleep"),
		{
			detail: "6h 40m of 7h",
		},
	);
});

test("reads an appearance from the form's values, ignoring what is missing", (t) => {
	t.deepEqual(appearanceOf({ skinTone: "4", glasses: "yes" }), {
		skinTone: 4,
		glasses: true,
	});
	t.deepEqual(appearanceOf({ hairStyle: "mohawk", skinTone: "9" }), {});
	t.deepEqual(appearanceOf({}), {});
});

test("plays an animation for every kind of log", (t) => {
	t.is(activityOfKind("water"), "drink");
	t.is(activityOfKind("body"), "weigh");
	t.is(activityOfKind("steps"), "weigh");

	for (const kind of ["mood", "habit", "note"] as const) {
		t.is(activityOfKind(kind), "write");
	}
});

test("eases out toward the target and lands on it", (t) => {
	t.is(easeOutCubic(0), 0);
	t.is(easeOutCubic(1), 1);
	t.is(easeOutCubic(2), 1);
	t.true(easeOutCubic(0.5) > 0.5, "fast first, then slow");
	t.is(tweenOf(10, 20, 0, 500), 10);
	t.is(tweenOf(10, 20, 500, 500), 20);
	t.is(tweenOf(10, 20, 100, 0), 20);
});
