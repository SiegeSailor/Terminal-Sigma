import type { Field } from "./components/entry-form.js";
import type { MenuItem } from "./components/menu-grid.js";
import type { Metric } from "./components/today-panel.js";
import {
	formatNumber,
	intensities,
	type Language,
	type Messages,
	workoutActivities,
} from "./i18n.js";
import {
	dailyGoals,
	experienceOf,
	experiencePerLevel,
	type Progress,
	todayOf,
} from "./progress.js";
import { quoteRefreshMinutes } from "./quotes.js";
import { colors } from "./theme.js";

export const characterWidth = 30;

// Header and footer take 5 rows; the character and Today panels 15 each.
const chromeRows = 5;
const panelRows = 15;

export type Layout = Readonly<{
	panelWidth: number;
	todayWidth: number;
	menuColumns: number;
	showCharacter: boolean;
	showToday: boolean;
	todayBeside: boolean;
	stacked: boolean;
}>;

// The panel that takes input always shows; the rest appears as space allows.
export function layoutOf(columns: number, rows: number): Layout {
	const menuColumnsOf = (panelWidth: number) => {
		const inner = panelWidth - 4;

		if (inner >= 90) {
			return 3;
		}

		return inner >= 52 ? 2 : 1;
	};

	if (columns >= 120) {
		const panelWidth = Math.floor((columns - characterWidth) / 2);
		return {
			panelWidth,
			todayWidth: columns - characterWidth - panelWidth,
			menuColumns: menuColumnsOf(panelWidth),
			showCharacter: true,
			showToday: true,
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
			showToday: rows >= chromeRows + panelRows * 2,
			todayBeside: false,
			stacked: false,
		};
	}

	return {
		panelWidth: columns,
		todayWidth: columns,
		menuColumns: menuColumnsOf(columns),
		showCharacter: rows >= chromeRows + panelRows * 2,
		showToday: rows >= chromeRows + panelRows * 3,
		todayBeside: false,
		stacked: true,
	};
}

const percentOf = (value: number, goal: number) => (value / goal) * 100;

export function metricsOf(
	messages: Messages,
	language: Language,
	progress: Progress,
	now: number,
): Metric[] {
	const today = todayOf(progress, now);
	const experience = experienceOf(progress);
	const level = Math.floor(experience / experiencePerLevel) + 1;
	const levelExperience = experience % experiencePerLevel;

	return [
		{
			label: messages.today.character,
			detail: messages.today.characterDetail(
				level + 1,
				experiencePerLevel - levelExperience,
			),
			value: percentOf(levelExperience, experiencePerLevel),
			color: colors.accent,
		},
		{
			label: messages.today.focus,
			detail: messages.today.focusDetail(
				today.focusSessions,
				dailyGoals.focusSessions,
			),
			value: percentOf(today.focusSessions, dailyGoals.focusSessions),
			color: colors.focus,
		},
		{
			label: messages.today.diet,
			detail: messages.today.dietDetail(
				today.meals,
				dailyGoals.meals,
				formatNumber(language, today.calories),
				formatNumber(language, today.protein),
			),
			value: percentOf(today.meals, dailyGoals.meals),
			color: colors.diet,
		},
		{
			label: messages.today.workout,
			detail: messages.today.workoutDetail(
				today.workoutMinutes,
				dailyGoals.workoutMinutes,
			),
			value: percentOf(today.workoutMinutes, dailyGoals.workoutMinutes),
			color: colors.workout,
		},
	];
}

export const menuOrder = [
	"timer",
	"diet",
	"workout",
	"logs",
	"quotes",
	"language",
] as const;

export function menuItemsOf(
	messages: Messages,
	language: Language,
	state: Readonly<{
		timerSignal: string;
		meals: number;
		workoutMinutes: number;
		logs: number;
		focus: number;
		rest: number;
	}>,
): MenuItem[] {
	return [
		{
			label: messages.menu.timer,
			signal: state.timerSignal,
			description: messages.describe.timer(state.focus, state.rest),
		},
		{
			label: messages.menu.diet,
			signal: messages.signal.meals(state.meals),
			description: messages.describe.diet,
		},
		{
			label: messages.menu.workout,
			signal: messages.signal.minutes(state.workoutMinutes),
			description: messages.describe.workout,
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
			label: messages.menu.language,
			signal: language === "zh-TW" ? "繁中" : "EN",
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
