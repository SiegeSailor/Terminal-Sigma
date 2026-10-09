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
	facialHairs,
	genders,
	hairColors,
	hairStyles,
	healthGoals,
	intensities,
	type Intensity,
	languages,
	skinTones,
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
const rating = zod.number().int().min(1).max(5);

// Fields added after 1.0.0 stay optional, so older files keep loading.
const focusSchema = zod.object({
	at: timestamp,
	minutes: zod.number().positive(),
});
// Amounts are totals for the entry, already multiplied by its servings.
const mealSchema = zod.object({
	at: timestamp,
	food: zod.string().min(1),
	calories: zod.number().nonnegative().optional(),
	protein: zod.number().nonnegative().optional(),
	carbs: zod.number().nonnegative().optional(),
	fat: zod.number().nonnegative().optional(),
	servings: zod.number().positive().optional(),
});
const setSchema = zod.object({
	exercise: zod.string().min(1),
	reps: zod.number().int().min(1),
	weight: zod.number().nonnegative().optional(),
});
const workoutSchema = zod.object({
	at: timestamp,
	activity: zod.string().min(1),
	minutes: zod.number().positive(),
	intensity: zod.enum(intensities).optional(),
	calories: zod.number().nonnegative().optional(),
	distance: zod.number().positive().optional(),
	sets: zod.array(setSchema).optional(),
});
const waterSchema = zod.object({
	at: timestamp,
	milliliters: zod.number().min(1).max(5000),
});
// Stamped with the wake time, so a night counts toward the day it ends.
const sleepSchema = zod.object({
	at: timestamp,
	minutes: zod.number().int().min(1).max(1440),
	quality: rating.optional(),
});
const bodySchema = zod
	.object({
		at: timestamp,
		weight: zod.number().min(30).max(300).optional(),
		waist: zod.number().min(40).max(250).optional(),
		bodyFat: zod.number().min(3).max(60).optional(),
	})
	.refine(
		(body) =>
			body.weight !== undefined ||
			body.waist !== undefined ||
			body.bodyFat !== undefined,
		"A body entry needs a weight, a waist, or a body fat.",
	);
const moodSchema = zod.object({
	at: timestamp,
	score: rating,
	energy: rating.optional(),
	stress: rating.optional(),
	tags: zod.array(zod.string().min(1)).optional(),
});
const habitSchema = zod.object({
	at: timestamp,
	name: zod.string().min(1),
	amount: zod.number().positive().optional(),
	skipped: zod.boolean().optional(),
});
// The day's count so far, as a watch shows it; the highest of a day counts.
const stepsSchema = zod.object({
	at: timestamp,
	count: zod.number().int().min(1).max(100_000),
});
const noteSchema = zod.object({
	at: timestamp,
	text: zod.string().min(1).max(2000),
});
const goalsSchema = zod.object({
	water: zod.number().int().min(250).max(10_000).optional(),
	sleep: zod.number().int().min(240).max(720).optional(),
	steps: zod.number().int().min(1000).max(50_000).optional(),
	focusSessions: zod.number().int().min(1).max(16).optional(),
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
	"updateInstalled",
	"variableSaved",
	"variableCleared",
	"goalChanged",
	"logDeleted",
	"logEdited",
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

const profileShape = {
	name: zod.string().min(1),
	age: zod.number().int().min(10).max(100),
	height: zod.number().min(100).max(250),
	weight: zod.number().min(30).max(300),
	bodyFat: zod.number().int().min(3).max(60).optional(),
	gender: zod.enum(genders),
	workStyle: zod.enum(workStyles),
	goal: zod.enum(healthGoals),
	// The character's appearance, added after 1.6.0, so all optional.
	skinTone: zod.literal(skinTones).optional(),
	hairStyle: zod.enum(hairStyles).optional(),
	hairColor: zod.enum(hairColors).optional(),
	glasses: zod.boolean().optional(),
	facialHair: zod.enum(facialHairs).optional(),
};
// Parsing keeps the fields a newer version wrote; the types stay strict.
const profileSchema = zod.looseObject(profileShape);
const strictProfileSchema = zod.object(profileShape);

const progressShape = {
	language: zod.enum(languages).optional(),
	theme: zod.enum(themeNames).optional(),
	profile: strictProfileSchema.optional(),
	quotes: quotesSchema.optional(),
	goals: goalsSchema.optional(),
	focus: zod.array(focusSchema).default([]),
	meals: zod.array(mealSchema).default([]),
	workouts: zod.array(workoutSchema).default([]),
	water: zod.array(waterSchema).default([]),
	sleep: zod.array(sleepSchema).default([]),
	body: zod.array(bodySchema).default([]),
	moods: zod.array(moodSchema).default([]),
	habits: zod.array(habitSchema).default([]),
	steps: zod.array(stepsSchema).default([]),
	notes: zod.array(noteSchema).default([]),
	events: zod.array(eventSchema).default([]),
};

export const progressSchema = zod.looseObject({
	...progressShape,
	profile: profileSchema.optional(),
});

export type Progress = zod.infer<
	ReturnType<typeof zod.object<typeof progressShape>>
>;
export const goalKeys = goalsSchema.keyof().options;
export type Profile = zod.infer<typeof strictProfileSchema>;
export type Goals = zod.infer<typeof goalsSchema>;
export type Focus = zod.infer<typeof focusSchema>;
export type Meal = zod.infer<typeof mealSchema>;
export type Workout = zod.infer<typeof workoutSchema>;
export type Water = zod.infer<typeof waterSchema>;
export type Sleep = zod.infer<typeof sleepSchema>;
export type Body = zod.infer<typeof bodySchema>;
export type MoodEntry = zod.infer<typeof moodSchema>;
export type Habit = zod.infer<typeof habitSchema>;
export type Steps = zod.infer<typeof stepsSchema>;
export type Note = zod.infer<typeof noteSchema>;
export type Event = zod.infer<typeof eventSchema>;

export const experiencePerLevel = 100;
export const experiencePerMeal = 5;

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

export const logKinds = [
	"focus",
	"meal",
	"workout",
	"water",
	"sleep",
	"body",
	"mood",
	"habit",
	"steps",
	"note",
	"event",
] as const;
export type LogKind = (typeof logKinds)[number];

// The array in progress.json that holds each kind.
export const fieldOf = {
	focus: "focus",
	meal: "meals",
	workout: "workouts",
	water: "water",
	sleep: "sleep",
	body: "body",
	mood: "moods",
	habit: "habits",
	steps: "steps",
	note: "notes",
	event: "events",
} as const satisfies Record<LogKind, keyof Progress>;

export type EntryOf = {
	[Kind in LogKind]: Progress[(typeof fieldOf)[Kind]][number];
};

// An entry with its kind and its position in its own array, which edit and
// delete use, since the items of 1 line share a timestamp.
export type Logged<Kind extends LogKind = LogKind> = {
	[Each in Kind]: Readonly<{
		kind: Each;
		at: string;
		index: number;
		entry: EntryOf[Each];
	}>;
}[Kind];

export type Log = Logged & Readonly<{ experience: number }>;

// Small kinds earn a little, capped per local day so logging cannot be farmed.
export const dailyCaps: Partial<Record<LogKind, number>> = {
	body: 5,
	habit: 25,
	mood: 6,
	note: 3,
	sleep: 10,
	steps: 20,
	water: 8,
};

function experienceEach(log: Logged): number {
	switch (log.kind) {
		case "focus": {
			return log.entry.minutes;
		}

		case "meal": {
			return experiencePerMeal;
		}

		case "workout": {
			return workoutExperience(log.entry);
		}

		case "habit": {
			return log.entry.skipped ? 0 : 5;
		}

		case "steps": {
			return Math.floor(log.entry.count / 1000);
		}

		case "body": {
			return 5;
		}

		case "sleep": {
			return 10;
		}

		case "mood":
		case "note": {
			return 3;
		}

		case "water": {
			return 1;
		}

		case "event": {
			return 0;
		}
	}
}

const listed = <Kind extends LogKind>(
	kind: Kind,
	entries: ReadonlyArray<EntryOf[Kind]>,
): Array<Logged<Kind>> =>
	entries.map((entry, index) => ({ kind, at: entry.at, index, entry }));

export const byTime = (left: { at: string }, right: { at: string }) =>
	Date.parse(left.at) - Date.parse(right.at);

// Every entry, newest first, with the experience it earned. Entries earn in
// the order they happened, so whatever passes a daily cap earns nothing.
export function logsOf(progress: Progress): Log[] {
	const spent = new Map<string, number>();
	const bestSteps = new Map<string, number>();
	const logs = [
		...listed("focus", progress.focus),
		...listed("meal", progress.meals),
		...listed("workout", progress.workouts),
		...listed("water", progress.water),
		...listed("sleep", progress.sleep),
		...listed("body", progress.body),
		...listed("mood", progress.moods),
		...listed("habit", progress.habits),
		...listed("steps", progress.steps),
		...listed("note", progress.notes),
		...listed("event", progress.events),
	]
		.toSorted(byTime)
		.map((log): Log => {
			const day = `${log.kind} ${new Date(log.at).toDateString()}`;
			let each = experienceEach(log);

			// A later count of the same day earns only the thousands it adds.
			if (log.kind === "steps") {
				const best = bestSteps.get(day) ?? 0;
				bestSteps.set(day, Math.max(best, log.entry.count));
				each = Math.max(each - Math.floor(best / 1000), 0);
			}

			const cap = dailyCaps[log.kind];

			if (cap === undefined) {
				return { ...log, experience: each };
			}

			const used = spent.get(day) ?? 0;
			const experience = Math.min(each, cap - used);
			spent.set(day, used + experience);
			return { ...log, experience };
		});

	return logs.toSorted((left, right) => byTime(right, left));
}

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
	const workouts = progress.workouts.filter((workout) => isToday(workout));
	const total = <Entry>(
		entries: readonly Entry[],
		amount: (entry: Entry) => number | undefined,
	) => entries.reduce((sum, entry) => sum + (amount(entry) ?? 0), 0);

	return {
		focusSessions: progress.focus.filter((focus) => isToday(focus)).length,
		meals: meals.length,
		calories: total(meals, (meal) => meal.calories),
		protein: total(meals, (meal) => meal.protein),
		workoutMinutes: total(workouts, (workout) => workout.minutes),
		water: total(
			progress.water.filter((water) => isToday(water)),
			(water) => water.milliliters,
		),
		// Last night: every sleep that ended today.
		sleepMinutes: total(
			progress.sleep.filter((sleep) => isToday(sleep)),
			(sleep) => sleep.minutes,
		),
		steps: Math.max(
			0,
			...progress.steps
				.filter((steps) => isToday(steps))
				.map((steps) => steps.count),
		),
		mood: progress.moods
			.filter((mood) => isToday(mood))
			.toSorted(byTime)
			.at(-1)?.score,
		habitsDone: new Set(
			progress.habits
				.filter((habit) => isToday(habit) && !habit.skipped)
				.map((habit) => habit.name.toLowerCase()),
		).size,
		caloriesBurned: total(workouts, (workout) => workout.calories),
	};
}

export type Today = ReturnType<typeof todayOf>;

// The profile with the latest weigh-in, when it is newer than the profile:
// weight and body fat change far more often than the rest of it.
export function profileNow(progress: Progress): Profile | undefined {
	const { profile } = progress;

	if (!profile) {
		return undefined;
	}

	const savedAt = Math.max(
		0,
		...progress.events
			.filter((event) => event.action === "profileSaved")
			.map((event) => Date.parse(event.at)),
	);
	const latest = (field: "weight" | "bodyFat") =>
		progress.body
			.filter(
				(body) => body[field] !== undefined && Date.parse(body.at) > savedAt,
			)
			.toSorted(byTime)
			.at(-1)?.[field];
	const weight = latest("weight") ?? profile.weight;
	const bodyFat = latest("bodyFat") ?? profile.bodyFat;

	return { ...profile, weight, ...(bodyFat === undefined ? {} : { bodyFat }) };
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
