import type { Field } from "./components/entry-form.js";
import type { MenuItem } from "./components/menu-grid.js";
import type { Section } from "./components/today-panel.js";
import { adviceOf, targetsOf } from "./health.js";
import {
	formatNumber,
	genders,
	healthGoals,
	intensities,
	type Language,
	type Messages,
	messagesOf,
	workoutActivities,
	workStyles,
} from "./i18n.js";
import {
	dailyGoals,
	experienceOf,
	experiencePerLevel,
	type Profile,
	type Progress,
	todayOf,
} from "./progress.js";
import { quoteRefreshMinutes } from "./quotes.js";
import type { Palette, ThemeName } from "./theme.js";

export const characterWidth = 28;

// Header and footer take 5 rows. The character panel is 19 rows tall, Today
// 25 with its spacing or 16 compact, the menu about 11, and Recent 7.
const chromeRows = 5;
const characterRows = 19;
const todayRows = 25;
const compactTodayRows = 16;
const menuRows = 11;
const recentRows = 7;

export type Layout = Readonly<{
	panelWidth: number;
	todayWidth: number;
	menuColumns: number;
	showCharacter: boolean;
	showRecent: boolean;
	showToday: boolean;
	isTodayCompact: boolean;
	todayBeside: boolean;
	stacked: boolean;
}>;

// The panel that takes input always shows; the rest appears as space allows.
export function layoutOf(columns: number, rows: number): Layout {
	const menuColumnsOf = (panelWidth: number) => {
		const inner = panelWidth - 4;

		if (inner >= 96) {
			return 3;
		}

		return inner >= 60 ? 2 : 1;
	};

	const showRecent = rows >= chromeRows + menuRows + recentRows;

	if (columns >= 120) {
		const panelWidth = Math.floor((columns - characterWidth) / 2);
		return {
			panelWidth,
			todayWidth: columns - characterWidth - panelWidth,
			menuColumns: menuColumnsOf(panelWidth),
			showCharacter: true,
			showRecent,
			showToday: true,
			isTodayCompact: rows < chromeRows + todayRows,
			todayBeside: true,
			stacked: false,
		};
	}

	if (columns >= 76) {
		const panelWidth = columns - characterWidth;
		return {
			panelWidth,
			todayWidth: columns,
			menuColumns: menuColumnsOf(panelWidth),
			showCharacter: true,
			showRecent,
			showToday: rows >= chromeRows + characterRows + compactTodayRows,
			isTodayCompact: rows < chromeRows + characterRows + todayRows,
			todayBeside: false,
			stacked: false,
		};
	}

	const aboveToday = chromeRows + menuRows + recentRows + characterRows;
	return {
		panelWidth: columns,
		todayWidth: columns,
		menuColumns: menuColumnsOf(columns),
		showCharacter: rows >= aboveToday,
		showRecent,
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

export const menuOrder = [
	"timer",
	"health",
	"logs",
	"quotes",
	"profile",
	"theme",
	"language",
] as const;

const languageSignal: Record<Language, string> = {
	en: "EN",
	"zh-TW": "繁中",
	ko: "한국어",
};

export function menuItemsOf(
	messages: Messages,
	language: Language,
	state: Readonly<{
		timerSignal: string;
		progress: Progress;
		now: number;
		logs: number;
		theme: ThemeName;
		focus: number;
		rest: number;
	}>,
): MenuItem[] {
	const { profile } = state.progress;
	const proteinLeft =
		targetsOf(profile).protein - todayOf(state.progress, state.now).protein;
	let healthSignal = messages.signal.setUp;

	if (profile) {
		healthSignal =
			proteinLeft > 0
				? messages.signal.proteinLeft(proteinLeft)
				: messages.signal.onTrack;
	}

	return [
		{
			label: messages.menu.timer,
			signal: state.timerSignal,
			description: messages.describe.timer(state.focus, state.rest),
		},
		{
			label: messages.menu.health,
			signal: healthSignal,
			description: messages.describe.health,
		},
		{
			label: messages.menu.logs,
			signal: messages.signal.entries(state.logs),
			description: messages.describe.logs,
		},
		{
			label: messages.menu.quotes,
			signal: messages.signal.newQuote,
			description: messages.describe.quotes(quoteRefreshMinutes),
		},
		{
			label: messages.menu.profile,
			signal: profile?.name ?? messages.signal.setUp,
			description: messages.describe.profile,
		},
		{
			label: messages.menu.theme,
			signal: messages.themes.names[state.theme],
			description: messages.describe.theme,
		},
		{
			label: messages.menu.language,
			signal: languageSignal[language],
			description: messages.describe.language,
		},
	];
}

export const dietFieldsOf = (messages: Messages): Field[] => [
	{
		key: "food",
		label: messages.form.food,
		kind: "text",
		placeholder: messages.form.foodExample,
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

export const workoutFieldsOf = (messages: Messages): Field[] => [
	{
		key: "activity",
		label: messages.form.activity,
		kind: "select",
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
