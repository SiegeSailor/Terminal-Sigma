import type { Option } from "./components/choice.js";
import type { Field } from "./components/entry-form.js";
import type { Section } from "./components/today-panel.js";
import { exerciseName, setGroupsOf } from "./exercises.js";
import { adviceOf, targetsOf } from "./health.js";
import {
	durationOf,
	formatNumber,
	genders,
	healthGoals,
	type Language,
	languages,
	type Messages,
	messagesOf,
	type Mood,
	type WorkoutActivity,
	workoutActivities,
	workStyles,
} from "./i18n.js";
import {
	type Event,
	experiencePerLevel,
	goalKeys,
	type Goals,
	type Log,
	type Logged,
	type LogKind,
	logKinds,
	type Profile,
	type Progress,
	profileNow,
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
import type { Activity } from "./pixel-art.js";
import { type Palette, type ThemeName, themeNames } from "./theme.js";
import { isNewer, type Updater } from "./update.js";

export const characterWidth = 36;
export const menuListWidth = 26;

// Header and footer take 5 rows. The character's panel is 25 rows tall,
// Today 23 with its spacing or 20 compact, the menu 15 with its 4 headings
// and 9 items, and Recent 7.
const chromeRows = 5;
const characterRows = 25;
const todayRows = 23;
const compactTodayRows = 20;
const menuRows = 15;
const compactMenuRows = 11;
const recentRows = 7;
// The description beside the menu list needs at least this many columns.
const descriptionColumns = 36;

export type Layout = Readonly<{
	panelWidth: number;
	todayWidth: number;
	isMenuSplit: boolean;
	isMenuGrouped: boolean;
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
	// Short terminals drop the group headings to keep Recent in view.
	const isMenuGrouped = rows >= chromeRows + menuRows + recentRows;
	const listRows = isMenuGrouped ? menuRows : compactMenuRows;

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
			isMenuGrouped,
			showCharacter: true,
			showRecent: rows >= chromeRows + listRows + recentRows,
			showToday: true,
			isTodayCompact: rows < chromeRows + todayRows,
			todayBeside: true,
			stacked: false,
		};
	}

	if (columns >= 80) {
		const panelWidth = columns - characterWidth;
		const isMenuSplit = isSplitAt(panelWidth);
		const menuHeight = isMenuSplit ? listRows : listRows * 2;
		return {
			panelWidth,
			todayWidth: columns,
			isMenuSplit,
			isMenuGrouped,
			showCharacter: true,
			showRecent: rows >= chromeRows + menuHeight + recentRows,
			showToday: rows >= chromeRows + characterRows + compactTodayRows,
			isTodayCompact: rows < chromeRows + characterRows + todayRows,
			todayBeside: false,
			stacked: false,
		};
	}

	const isMenuSplit = isSplitAt(columns);
	const menuHeight = isMenuSplit ? listRows : listRows * 2;
	const aboveToday = chromeRows + menuHeight + recentRows + characterRows;
	return {
		panelWidth: columns,
		todayWidth: columns,
		isMenuSplit,
		isMenuGrouped,
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
	experience: number,
): Section[] {
	const messages = messagesOf(language);
	const today = todayOf(progress, now);
	const profile = profileNow(progress);
	const targets = targetsOf(profile, progress.goals);
	const level = Math.floor(experience / experiencePerLevel) + 1;
	const levelExperience = experience % experiencePerLevel;
	const advice = adviceOf(profile, today, language, messages, progress.goals);
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
						targets.focusSessions,
					),
					value: percentOf(today.focusSessions, targets.focusSessions),
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
				{
					label: messages.today.water,
					detail: messages.today.waterDetail(
						format(today.water),
						format(targets.water),
					),
					value: percentOf(today.water, targets.water),
					color: palette.metrics.water,
				},
				{
					label: messages.today.sleep,
					detail: messages.today.sleepDetail(
						durationOf(today.sleepMinutes, messages),
						durationOf(targets.sleep, messages),
					),
					value: percentOf(today.sleepMinutes, targets.sleep),
					color: palette.metrics.sleep,
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
	const targets = targetsOf(profileNow(progress), progress.goals);
	const isMet =
		(today.protein >= targets.protein &&
			today.workoutMinutes >= targets.workoutMinutes) ||
		today.focusSessions >= targets.focusSessions;

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
	"log",
	"timer",
	"logs",
	"quotes",
	"profile",
	"theme",
	"language",
	"environment",
	"update",
] as const;
export type MenuKey = (typeof menuOrder)[number];

// The headings the menu is grouped under; they only label, never open.
export const menuGroups = {
	log: "today",
	timer: "today",
	logs: "journal",
	quotes: "settings",
	profile: "settings",
	theme: "settings",
	language: "settings",
	environment: "settings",
	update: "system",
} as const satisfies Record<MenuKey, string>;

export type MenuEntry = Readonly<{
	key: MenuKey;
	group: string;
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
		logs: readonly Log[];
		theme: ThemeName;
		focus: number;
		rest: number;
		version: string;
		newest?: string;
		savedVariables: number;
	}>,
): MenuEntry[] {
	const { profile } = state.progress;
	const day = new Date(state.now).toDateString();
	const loggedToday = state.logs.filter(
		(log) =>
			log.kind !== "event" &&
			log.kind !== "focus" &&
			new Date(log.at).toDateString() === day,
	).length;

	const statuses: Record<MenuKey, string> = {
		quotes: state.quotes.autoRefresh
			? messages.signal.quotesAuto(
					messages.quotes.intervals(state.quotes.interval),
				)
			: messages.signal.quotesManual,
		log: messages.signal.loggedToday(loggedToday),
		timer: state.timerSignal,
		logs: messages.signal.entries(state.logs.length),
		profile: profile?.name ?? messages.signal.setUp,
		theme: messages.themes.names[state.theme],
		language: messages.languageName,
		environment: messages.signal.saved(state.savedVariables),
		update:
			state.newest && isNewer(state.newest, state.version)
				? messages.signal.updateAvailable(state.newest)
				: messages.signal.version(state.version),
	};
	const descriptions: Record<MenuKey, string> = {
		quotes: messages.describe.quotes,
		timer: messages.describe.timer(state.focus, state.rest),
		log: messages.describe.log,
		logs: messages.describe.logs,
		profile: messages.describe.profile,
		theme: messages.describe.theme,
		language: messages.describe.language,
		environment: messages.describe.environment,
		update: messages.describe.update,
	};

	return menuOrder.map((key) => ({
		key,
		group: messages.groups[menuGroups[key]],
		label: messages.menu[key],
		status: statuses[key],
		description: descriptions[key],
	}));
}

// Where an update stands: checking, ready, installing, or done.
export type Release = Readonly<{
	phase:
		| "checking"
		| "ready"
		| "checkFailed"
		| "installing"
		| "installed"
		| "installFailed";
	newest?: string;
	error?: string;
}>;

// The status line and the options of the Software Update view.
export function updateViewOf(
	messages: Messages,
	release: Release,
	updater: Pick<Updater, "current">,
): Readonly<{ status: string; options: Option[] }> {
	const { update } = messages;
	const newest = release.newest ?? updater.current;
	const back: Option = { label: update.back, value: "back" };
	const check: Option = { label: update.check, value: "check" };
	const install: Option = { label: update.install(newest), value: "install" };

	switch (release.phase) {
		case "checking": {
			return { status: update.checking, options: [back] };
		}

		case "checkFailed": {
			return {
				status: update.checkFailed(release.error ?? ""),
				options: [check, back],
			};
		}

		case "installing": {
			return { status: update.installing(newest), options: [] };
		}

		case "installed": {
			return {
				status: update.installed(newest),
				options: [{ label: update.restart, value: "restart" }, back],
			};
		}

		case "installFailed": {
			return {
				status: update.installFailed(release.error ?? ""),
				options: [install, back],
			};
		}

		case "ready": {
			return isNewer(newest, updater.current)
				? { status: update.newest(newest), options: [install, back] }
				: { status: update.upToDate(newest), options: [check, back] };
		}
	}
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

// What the character does when a kind is logged.
const activityByKind: Record<LogKind, Activity> = {
	focus: "focus",
	meal: "eat",
	workout: "run",
	water: "eat",
	sleep: "break",
	body: "stretch",
	mood: "break",
	habit: "focus",
	steps: "run",
	note: "focus",
	event: "idle",
};

export const activityOfKind = (kind: LogKind): Activity => activityByKind[kind];

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

	if (event.action === "goalChanged") {
		const [goal = "", value = ""] = detail.split(":");
		const key = goalKeys.find((option) => option === goal);
		return events.goalChanged(
			key ? goalText(key, Number(value), messages) : detail,
		);
	}

	if (event.action === "logDeleted" || event.action === "logEdited") {
		const kind = logKinds.find((option) => option === detail);
		return events[event.action](kind ? messages.logs.kinds[kind] : detail);
	}

	return events[event.action](detail);
}

const isWorkoutActivity = (activity: string): activity is WorkoutActivity =>
	(workoutActivities as readonly string[]).includes(activity);

const joined = (...parts: Array<string | false>) =>
	parts.filter(Boolean).join(" · ");

function describeWorkout(
	workout: Workout,
	language: Language,
	messages: Messages,
) {
	const { activity, minutes, intensity, sets, distance, calories } = workout;
	const format = (value: number) => formatNumber(language, value);
	const groups = setGroupsOf(sets).map((group, index, all) => {
		const name =
			all[index - 1]?.exercise === group.exercise
				? ""
				: `${exerciseName(group.exercise, language)} `;
		const count = group.count > 1 ? `×${group.count}` : "";
		return `${name}${format(group.weight)}×${group.reps}${count}`;
	});

	return joined(
		messages.logs.workoutEntry(
			isWorkoutActivity(activity)
				? messages.workoutActivity[activity]
				: activity,
			minutes,
			intensity ? messages.intensity[intensity] : "-",
		),
		groups.join(", "),
		distance !== undefined && messages.logs.distance(format(distance)),
		calories !== undefined && messages.logs.burned(format(calories)),
	);
}

// 1 entry as a line of the logs, in the language on now.
export function describeLog(
	log: Logged,
	language: Language,
	messages: Messages,
): string {
	const { logs } = messages;
	const format = (value: number) => formatNumber(language, value);
	const optional = <Value>(
		value: Value | undefined,
		text: (value: Value) => string,
	) => value !== undefined && text(value);

	switch (log.kind) {
		case "focus": {
			return logs.focusEntry(log.entry.minutes);
		}

		case "meal": {
			const { food, servings, calories, protein } = log.entry;
			return logs.mealEntry(
				servings === undefined ? food : `${format(servings)} × ${food}`,
				calories === undefined ? "-" : format(calories),
				protein === undefined ? "-" : format(protein),
			);
		}

		case "workout": {
			return describeWorkout(log.entry, language, messages);
		}

		case "water": {
			return logs.waterEntry(format(log.entry.milliliters));
		}

		case "sleep": {
			return joined(
				logs.sleepEntry(durationOf(log.entry.minutes, messages)),
				optional(log.entry.quality, logs.quality),
			);
		}

		case "body": {
			return joined(
				optional(log.entry.weight, (weight) => logs.weight(format(weight))),
				optional(log.entry.waist, (waist) => logs.waist(format(waist))),
				optional(log.entry.bodyFat, (fat) => logs.bodyFat(format(fat))),
			);
		}

		case "mood": {
			const { score, energy, stress, tags = [] } = log.entry;
			return joined(
				logs.moodEntry(score),
				optional(energy, logs.energy),
				optional(stress, logs.stress),
				tags.map((tag) => `#${tag}`).join(" "),
			);
		}

		case "habit": {
			const { name, amount, skipped } = log.entry;
			return skipped
				? logs.skipped(name)
				: joined(name, optional(amount, format));
		}

		case "steps": {
			return logs.stepsEntry(format(log.entry.count));
		}

		case "note": {
			return log.entry.text;
		}

		case "event": {
			return describeEvent(messages, log.entry);
		}
	}
}

// "Water goal: 2500 ml": a goal and its value, in the language on now.
export function goalText(goal: keyof Goals, value: number, messages: Messages) {
	const { log } = messages;
	const shown: Record<keyof Goals, string> = {
		water: log.milliliters(value),
		sleep: durationOf(value, messages),
		steps: String(value),
		focusSessions: String(value),
	};

	return log.goalSet(log.goals[goal], shown[goal]);
}

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
		// A weigh-in may carry a decimal; the field takes whole kilograms.
		defaultValue: profile ? String(Math.round(profile.weight)) : undefined,
	},
	{
		key: "bodyFat",
		label: messages.form.bodyFat,
		kind: "number",
		minimum: 3,
		maximum: 60,
		optional: true,
		defaultValue:
			profile?.bodyFat === undefined
				? undefined
				: String(Math.round(profile.bodyFat)),
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
