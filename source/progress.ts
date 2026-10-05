import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import process from "node:process";
import zod from "zod";
import {
	genders,
	healthGoals,
	intensities,
	type Intensity,
	languages,
	workStyles,
} from "./i18n.js";
import {
	defaultQuoteSettings,
	quoteCategories,
	quoteIntervals,
	quoteModes,
} from "./quotes.js";
import { themeNames } from "./theme.js";

const timestamp = zod.iso.datetime({ offset: true });

// Fields added after 1.0.0 stay optional, so older files keep loading.
const focusSchema = zod.object({
	at: timestamp,
	minutes: zod.number().positive(),
});
const mealSchema = zod.object({
	at: timestamp,
	food: zod.string().min(1),
	calories: zod.number().nonnegative().optional(),
	protein: zod.number().nonnegative().optional(),
});
const workoutSchema = zod.object({
	at: timestamp,
	activity: zod.string().min(1),
	minutes: zod.number().positive(),
	intensity: zod.enum(intensities).optional(),
});

// Every action that changes something is logged too, not only the entries.
export const eventActions = [
	"appOpened",
	"timerStarted",
	"timerPaused",
	"timerResumed",
	"timerStopped",
	"breakOver",
	"levelUp",
	"languageChanged",
	"themeChanged",
	"profileSaved",
	"quoteDrawn",
	"quoteSettingsChanged",
] as const;
export type EventAction = (typeof eventActions)[number];

const eventSchema = zod.object({
	at: timestamp,
	action: zod.enum(eventActions),
	detail: zod.string().optional(),
});

const quotesSchema = zod.object({
	autoRefresh: zod.boolean().default(defaultQuoteSettings.autoRefresh),
	interval: zod.literal(quoteIntervals).default(defaultQuoteSettings.interval),
	mode: zod.enum(quoteModes).default(defaultQuoteSettings.mode),
	categories: zod.array(zod.enum(quoteCategories)).default([]),
	excluded: zod.array(zod.enum(quoteCategories)).default([]),
	author: zod.string().default(""),
	work: zod.string().default(""),
});

const profileSchema = zod.object({
	name: zod.string().min(1),
	age: zod.number().int().min(10).max(100),
	height: zod.number().min(100).max(250),
	weight: zod.number().min(30).max(300),
	gender: zod.enum(genders),
	workStyle: zod.enum(workStyles),
	goal: zod.enum(healthGoals),
});

const progressSchema = zod.object({
	language: zod.enum(languages).optional(),
	theme: zod.enum(themeNames).optional(),
	profile: profileSchema.optional(),
	quotes: quotesSchema.optional(),
	focus: zod.array(focusSchema).default([]),
	meals: zod.array(mealSchema).default([]),
	workouts: zod.array(workoutSchema).default([]),
	events: zod.array(eventSchema).default([]),
});

export type Progress = zod.infer<typeof progressSchema>;
export type Profile = zod.infer<typeof profileSchema>;
export type Focus = zod.infer<typeof focusSchema>;
export type Meal = zod.infer<typeof mealSchema>;
export type Workout = zod.infer<typeof workoutSchema>;
export type Event = zod.infer<typeof eventSchema>;

export const experiencePerLevel = 100;
export const experiencePerMeal = 5;
export const dailyGoals = { focusSessions: 4 };

// Entries from before intensity existed earned 1 XP per minute, and still do.
const intensityFactor: Record<Intensity, number> = {
	light: 1,
	moderate: 1.5,
	vigorous: 2,
};

export const workoutExperience = (workout: Workout) =>
	Math.round(
		workout.minutes *
			(workout.intensity ? intensityFactor[workout.intensity] : 1),
	);

export const progressFile = () =>
	path.join(
		process.env.TERMINAL_SIGMA_HOME ?? path.join(homedir(), ".terminal-sigma"),
		"progress.json",
	);

export function loadProgress(file: string): Progress {
	if (!existsSync(file)) {
		return progressSchema.parse({});
	}

	try {
		return progressSchema.parse(JSON.parse(readFileSync(file, "utf8")));
	} catch (error) {
		throw new Error(
			`${file} is unreadable, so Terminal-Sigma will not touch it. Fix or move it, then restart.\n${String(error)}`,
			{ cause: error },
		);
	}
}

export function saveProgress(file: string, progress: Progress) {
	mkdirSync(path.dirname(file), { recursive: true });
	// Validate, write, then rename: never save what loadProgress would reject, and
	// a crash mid-write never truncates the journey.
	const valid = progressSchema.parse(progress);
	const temporary = `${file}.tmp`;
	writeFileSync(temporary, `${JSON.stringify(valid, null, "\t")}\n`);
	renameSync(temporary, file);
}

export type Log =
	| { kind: "focus"; at: string; experience: number; entry: Focus }
	| { kind: "meal"; at: string; experience: number; entry: Meal }
	| { kind: "workout"; at: string; experience: number; entry: Workout }
	| { kind: "event"; at: string; experience: number; entry: Event };

// Every entry, newest first, with the experience it earned.
export const logsOf = (progress: Progress): Log[] =>
	[
		...progress.focus.map(
			(entry): Log => ({
				kind: "focus",
				at: entry.at,
				experience: entry.minutes,
				entry,
			}),
		),
		...progress.meals.map(
			(entry): Log => ({
				kind: "meal",
				at: entry.at,
				experience: experiencePerMeal,
				entry,
			}),
		),
		...progress.workouts.map(
			(entry): Log => ({
				kind: "workout",
				at: entry.at,
				experience: workoutExperience(entry),
				entry,
			}),
		),
		...progress.events.map(
			(entry): Log => ({ kind: "event", at: entry.at, experience: 0, entry }),
		),
	].toSorted((left, right) => Date.parse(right.at) - Date.parse(left.at));

// Experience is derived from the entries, so hand-editing the file never desyncs it.
export const experienceOf = (progress: Progress) =>
	logsOf(progress).reduce((total, log) => total + log.experience, 0);

export const levelOf = (experience: number) =>
	Math.floor(experience / experiencePerLevel) + 1;

export function todayOf(progress: Progress, now: number) {
	const today = new Date(now).toDateString();
	const isToday = ({ at }: { at: string }) =>
		new Date(at).toDateString() === today;
	const meals = progress.meals.filter((meal) => isToday(meal));

	return {
		focusSessions: progress.focus.filter((focus) => isToday(focus)).length,
		meals: meals.length,
		calories: meals.reduce((total, meal) => total + (meal.calories ?? 0), 0),
		protein: meals.reduce((total, meal) => total + (meal.protein ?? 0), 0),
		workoutMinutes: progress.workouts
			.filter((workout) => isToday(workout))
			.reduce((total, workout) => total + workout.minutes, 0),
	};
}

export function parseWholeNumber(
	text: string,
	minimum: number,
	maximum: number,
) {
	const trimmed = text.trim();
	const value = Number(trimmed);

	return /^\d+$/v.test(trimmed) && value >= minimum && value <= maximum
		? value
		: undefined;
}
