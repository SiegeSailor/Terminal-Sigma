import type { Option } from "./components/choice.js";
import type { Combination, Field } from "./components/entry-form.js";
import type { Section } from "./components/today-panel.js";
import { foodSuggestions } from "./foods.js";
import { adviceOf, targetsOf } from "./health.js";
import {
	formatNumber,
	genders,
	healthGoals,
	intensities,
	type Language,
	languages,
	type Messages,
	messagesOf,
	type Mood,
	workoutActivities,
	workStyles,
} from "./i18n.js";
import {
	dailyGoals,
	type Event,
	experienceOf,
	experiencePerLevel,
	type Meal,
	type Profile,
	type Progress,
	todayOf,
	type Workout,
} from "./progress.js";
import {
	type QuoteCategory,
	quoteCategories,
	quoteIntervals,
	quoteModes,
	type QuoteSettings,
} from "./quotes.js";
import { type Palette, type ThemeName, themeNames } from "./theme.js";

export const characterWidth = 36;
export const menuListWidth = 24;

// Header and footer take 5 rows. The character's panel is 21 rows tall,
// Today 19 with its spacing or 16 compact, the menu 9, and Recent 7.
const chromeRows = 5;
const characterRows = 21;
const todayRows = 19;
const compactTodayRows = 16;
const menuRows = 9;
const recentRows = 7;
// The description beside the menu list needs at least this many columns.
const descriptionColumns = 36;

export type Layout = Readonly<{
	panelWidth: number;
	todayWidth: number;
	isMenuSplit: boolean;
	showCharacter: boolean;
	showRecent: boolean;
	showToday: boolean;
	isTodayCompact: boolean;
	todayBeside: boolean;
	stacked: boolean;
}>;

// The menu always shows, because it takes the input; the rest appears as
// space allows.
export function layoutOf(columns: number, rows: number): Layout {
	const isSplitAt = (panelWidth: number) =>
		panelWidth >= menuListWidth + descriptionColumns;

	if (columns >= 120) {
		const todayWidth = Math.min(
			Math.max(Math.floor((columns - characterWidth) * 0.4), 40),
			56,
		);
		const panelWidth = columns - characterWidth - todayWidth;
		return {
			panelWidth,
			todayWidth,
			isMenuSplit: isSplitAt(panelWidth),
			showCharacter: true,
			showRecent: rows >= chromeRows + menuRows + recentRows,
			showToday: true,
			isTodayCompact: rows < chromeRows + todayRows,
			todayBeside: true,
			stacked: false,
		};
	}

	if (columns >= 80) {
		const panelWidth = columns - characterWidth;
		const isMenuSplit = isSplitAt(panelWidth);
		const menuHeight = isMenuSplit ? menuRows : menuRows * 2;
		return {
			panelWidth,
			todayWidth: columns,
			isMenuSplit,
			showCharacter: true,
			showRecent: rows >= chromeRows + menuHeight + recentRows,
			showToday: rows >= chromeRows + characterRows + compactTodayRows,
			isTodayCompact: rows < chromeRows + characterRows + todayRows,
			todayBeside: false,
			stacked: false,
		};
	}

	const isMenuSplit = isSplitAt(columns);
	const menuHeight = isMenuSplit ? menuRows : menuRows * 2;
	const aboveToday = chromeRows + menuHeight + recentRows + characterRows;
	return {
		panelWidth: columns,
		todayWidth: columns,
		isMenuSplit,
		showCharacter: rows >= aboveToday,
		showRecent: rows >= chromeRows + menuHeight + recentRows,
		showToday: rows >= aboveToday + compactTodayRows,
		isTodayCompact: rows < aboveToday + todayRows,
		todayBeside: false,
		stacked: true,
	};
}

const percentOf = (value: number, goal: number) => (value / goal) * 100;

export function sectionsOf(
	language: Language,
	palette: Palette,
	progress: Progress,
	now: number,
): Section[] {
	const messages = messagesOf(language);
	const today = todayOf(progress, now);
	const targets = targetsOf(progress.profile);
	const experience = experienceOf(progress);
	const level = Math.floor(experience / experiencePerLevel) + 1;
	const levelExperience = experience % experiencePerLevel;
	const advice = adviceOf(progress.profile, today, language, messages);
	const format = (value: number) => formatNumber(language, value);

	return [
		{
			metrics: [
				{
					label: messages.today.character,
					detail: messages.today.characterDetail(
						level + 1,
						experiencePerLevel - levelExperience,
					),
					value: percentOf(levelExperience, experiencePerLevel),
					color: palette.metrics.character,
				},
				{
					label: messages.today.focus,
					detail: messages.today.focusDetail(
						today.focusSessions,
						dailyGoals.focusSessions,
					),
					value: percentOf(today.focusSessions, dailyGoals.focusSessions),
					color: palette.metrics.focus,
				},
			],
		},
		{
			title: progress.profile
				? messages.health.title(messages.goal[progress.profile.goal])
				: messages.today.health,
			metrics: [
				{
					label: messages.today.protein,
					detail: messages.today.proteinDetail(
						format(today.protein),
						format(targets.protein),
					),
					value: percentOf(today.protein, targets.protein),
					color: palette.metrics.protein,
				},
				{
					label: messages.today.calories,
					detail: messages.today.caloriesDetail(
						format(today.calories),
						format(targets.calories),
						today.meals,
					),
					value: percentOf(today.calories, targets.calories),
					color: palette.metrics.calories,
				},
				{
					label: messages.today.workout,
					detail: messages.today.workoutDetail(
						today.workoutMinutes,
						targets.workoutMinutes,
					),
					value: percentOf(today.workoutMinutes, targets.workoutMinutes),
					color: palette.metrics.workout,
				},
			],
			advice: progress.profile
				? (advice.find((item) => !item.isDone) ?? advice[0])
				: { text: messages.health.noProfile, isDone: false },
		},
	];
}

// Today's logs set the character's mood: dozing until something is logged,
// happy once the targets are met.
export function moodOf(progress: Progress, now: number): Mood {
	const today = todayOf(progress, now);
	const targets = targetsOf(progress.profile);
	const isMet =
		(today.protein >= targets.protein &&
			today.workoutMinutes >= targets.workoutMinutes) ||
		today.focusSessions >= dailyGoals.focusSessions;

	if (
		today.meals === 0 &&
		today.workoutMinutes === 0 &&
		today.focusSessions === 0
	) {
		return "sleepy";
	}

	return isMet ? "happy" : "content";
}

export const menuOrder = [
	"quotes",
	"timer",
	"health",
	"logs",
	"profile",
	"theme",
	"language",
] as const;
export type MenuKey = (typeof menuOrder)[number];

export type MenuEntry = Readonly<{
	key: MenuKey;
	label: string;
	status: string;
	description: string;
}>;

export function menuEntriesOf(
	messages: Messages,
	state: Readonly<{
		timerSignal: string;
		progress: Progress;
		quotes: QuoteSettings;
		now: number;
		logs: number;
		theme: ThemeName;
		focus: number;
		rest: number;
	}>,
): MenuEntry[] {
	const { profile } = state.progress;
	const proteinLeft =
		targetsOf(profile).protein - todayOf(state.progress, state.now).protein;
	let healthStatus = messages.signal.setUp;

	if (profile) {
		healthStatus =
			proteinLeft > 0
				? messages.signal.proteinLeft(proteinLeft)
				: messages.signal.onTrack;
	}

	const statuses: Record<MenuKey, string> = {
		quotes: state.quotes.autoRefresh
			? messages.signal.quotesAuto(
					messages.quotes.intervals(state.quotes.interval),
				)
			: messages.signal.quotesManual,
		timer: state.timerSignal,
		health: healthStatus,
		logs: messages.signal.entries(state.logs),
		profile: profile?.name ?? messages.signal.setUp,
		theme: messages.themes.names[state.theme],
		language: messages.languageName,
	};
	const descriptions: Record<MenuKey, string> = {
		quotes: messages.describe.quotes,
		timer: messages.describe.timer(state.focus, state.rest),
		health: messages.describe.health,
		logs: messages.describe.logs,
		profile: messages.describe.profile,
		theme: messages.describe.theme,
		language: messages.describe.language,
	};

	return menuOrder.map((key) => ({
		key,
		label: messages.menu[key],
		status: statuses[key],
		description: descriptions[key],
	}));
}

const categoriesLabel = (
	messages: Messages,
	categories: readonly QuoteCategory[],
	empty: string,
) =>
	categories.length === 0
		? empty
		: categories
				.map((category) => messages.quotes.categoryNames[category])
				.join(", ");

// The quote settings as options; values name the setting to change.
export function quoteOptionsOf(
	messages: Messages,
	settings: QuoteSettings,
): Option[] {
	const { quotes } = messages;

	return [
		{ label: quotes.draw, value: "draw" },
		{ label: quotes.autoRefresh(settings.autoRefresh), value: "autoRefresh" },
		{
			label: quotes.interval(quotes.intervals(settings.interval)),
			value: "interval",
		},
		{ label: quotes.mode(quotes.modes[settings.mode]), value: "mode" },
		{
			label: quotes.categories(
				categoriesLabel(messages, settings.categories, quotes.all),
			),
			value: "categories",
		},
		{
			label: quotes.excluded(
				categoriesLabel(messages, settings.excluded, quotes.none),
			),
			value: "excluded",
		},
		{ label: quotes.author(settings.author || quotes.any), value: "author" },
		{ label: quotes.work(settings.work || quotes.any), value: "work" },
		{ label: quotes.back, value: "back" },
	];
}

export const intervalOptionsOf = (messages: Messages): Option[] =>
	quoteIntervals.map((interval) => ({
		label: messages.quotes.intervals(interval),
		value: String(interval),
	}));

export const categoryOptionsOf = (messages: Messages): Option[] =>
	quoteCategories.map((category) => ({
		label: messages.quotes.categoryNames[category],
		value: category,
	}));

// A quote setting change is logged as "setting:value", so it can be shown in
// whatever language is on later.
export function describeQuoteChange(messages: Messages, detail: string) {
	const [setting = "", value = ""] = detail.split(/:(.*)/sv);
	const { quotes } = messages;
	const list = value
		.split(",")
		.filter((category): category is QuoteCategory =>
			(quoteCategories as readonly string[]).includes(category),
		);

	switch (setting) {
		case "autoRefresh": {
			return quotes.autoRefresh(value === "on");
		}

		case "interval": {
			const interval = quoteIntervals.find(
				(option) => String(option) === value,
			);
			return quotes.interval(interval ? quotes.intervals(interval) : value);
		}

		case "mode": {
			const mode = quoteModes.find((option) => option === value);
			return quotes.mode(mode ? quotes.modes[mode] : value);
		}

		case "categories": {
			return quotes.categories(categoriesLabel(messages, list, quotes.all));
		}

		case "excluded": {
			return quotes.excluded(categoriesLabel(messages, list, quotes.none));
		}

		case "author": {
			return quotes.author(value || quotes.any);
		}

		default: {
			return quotes.work(value || quotes.any);
		}
	}
}

export function describeEvent(messages: Messages, event: Event) {
	const detail = event.detail ?? "";
	const { events } = messages;

	if (event.action === "languageChanged") {
		const language = languages.find((option) => option === detail);
		return events.languageChanged(
			language ? messagesOf(language).languageName : detail,
		);
	}

	if (event.action === "themeChanged") {
		const theme = themeNames.find((option) => option === detail);
		return events.themeChanged(theme ? messages.themes.names[theme] : detail);
	}

	if (event.action === "quoteSettingsChanged") {
		return events.quoteSettingsChanged(describeQuoteChange(messages, detail));
	}

	return events[event.action](detail);
}

export const dietFieldsOf = (
	messages: Messages,
	language: Language,
	meals: readonly Meal[],
): Field[] => [
	{
		key: "food",
		label: messages.form.food,
		kind: "text",
		placeholder: messages.form.foodExample,
		suggest: (text) =>
			foodSuggestions(text, language, meals).map((suggestion) => {
				const calories = suggestion.calories ?? 0;
				const protein = suggestion.protein ?? 0;

				return {
					label: suggestion.label,
					detail: messages.form.nutrition(
						formatNumber(language, calories),
						formatNumber(language, protein),
					),
					tag: suggestion.isYours ? messages.form.yours : undefined,
					values: { calories: String(calories), protein: String(protein) },
				};
			}),
	},
	{
		key: "calories",
		label: messages.form.calories,
		kind: "number",
		minimum: 0,
		maximum: 5000,
	},
	{
		key: "protein",
		label: messages.form.protein,
		kind: "number",
		minimum: 0,
		maximum: 500,
	},
];

// The 3 newest distinct workouts, to log again in 1 step.
export function workoutCombinationsOf(
	messages: Messages,
	workouts: readonly Workout[],
): Combination[] {
	const seen = new Set<string>();
	const combinations: Combination[] = [];

	for (const workout of workouts.toReversed()) {
		const activity = workoutActivities.find(
			(option) => option === workout.activity,
		);
		const key = `${workout.activity}|${workout.minutes}|${workout.intensity}`;

		if (
			activity &&
			workout.intensity &&
			!seen.has(key) &&
			combinations.length < 3
		) {
			seen.add(key);
			combinations.push({
				label: messages.logs.workoutEntry(
					messages.workoutActivity[activity],
					workout.minutes,
					messages.intensity[workout.intensity],
				),
				values: {
					activity,
					minutes: String(workout.minutes),
					intensity: workout.intensity,
				},
			});
		}
	}

	return combinations;
}

export const workoutFieldsOf = (
	messages: Messages,
	workouts: readonly Workout[],
): Field[] => [
	{
		key: "activity",
		label: messages.form.activity,
		kind: "select",
		combinations: workoutCombinationsOf(messages, workouts),
		options: workoutActivities.map((option) => ({
			label: messages.workoutActivity[option],
			value: option,
		})),
	},
	{
		key: "minutes",
		label: messages.form.minutes,
		kind: "number",
		minimum: 1,
		maximum: 600,
	},
	{
		key: "intensity",
		label: messages.form.intensity,
		kind: "select",
		options: intensities.map((option) => ({
			label: messages.intensity[option],
			value: option,
		})),
	},
];

// Saved values come back as defaults, so editing the profile is a run of Enter.
export const profileFieldsOf = (
	messages: Messages,
	profile: Profile | undefined,
	name: string,
): Field[] => [
	{
		key: "name",
		label: messages.form.name,
		kind: "text",
		defaultValue: profile?.name ?? name,
	},
	{
		key: "age",
		label: messages.form.age,
		kind: "number",
		minimum: 10,
		maximum: 100,
		defaultValue: profile ? String(profile.age) : undefined,
	},
	{
		key: "height",
		label: messages.form.height,
		kind: "number",
		minimum: 100,
		maximum: 250,
		defaultValue: profile ? String(profile.height) : undefined,
	},
	{
		key: "weight",
		label: messages.form.weight,
		kind: "number",
		minimum: 30,
		maximum: 300,
		defaultValue: profile ? String(profile.weight) : undefined,
	},
	{
		key: "gender",
		label: messages.form.gender,
		kind: "select",
		options: genders.map((option) => ({
			label: messages.gender[option],
			value: option,
		})),
		defaultValue: profile?.gender,
	},
	{
		key: "workStyle",
		label: messages.form.workStyle,
		kind: "select",
		options: workStyles.map((option) => ({
			label: messages.workStyle[option],
			value: option,
		})),
		defaultValue: profile?.workStyle,
	},
	{
		key: "goal",
		label: messages.form.goal,
		kind: "select",
		options: healthGoals.map((option) => ({
			label: messages.goal[option],
			value: option,
		})),
		defaultValue: profile?.goal,
	},
];
