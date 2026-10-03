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

const timestamp = zod.iso.datetime({ offset: true });

const progressSchema = zod.object({
	focus: zod
		.array(zod.object({ at: timestamp, minutes: zod.number().positive() }))
		.default([]),
	meals: zod
		.array(
			zod.object({
				at: timestamp,
				food: zod.string().min(1),
				calories: zod.number().nonnegative().optional(),
			}),
		)
		.default([]),
	workouts: zod
		.array(
			zod.object({
				at: timestamp,
				activity: zod.string().min(1),
				minutes: zod.number().positive(),
			}),
		)
		.default([]),
});

export type Progress = zod.infer<typeof progressSchema>;

export const experiencePerLevel = 100;
export const experiencePerMeal = 5;
export const dailyGoals = { focusSessions: 4, meals: 3, workoutMinutes: 30 };

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

// Experience is derived from the entries, so hand-editing the file never desyncs it.
export function experienceOf(progress: Progress) {
	const sum = (values: number[]) =>
		values.reduce((total, value) => total + value, 0);

	return (
		sum(progress.focus.map((entry) => entry.minutes)) +
		progress.meals.length * experiencePerMeal +
		sum(progress.workouts.map((entry) => entry.minutes))
	);
}

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
		workoutMinutes: progress.workouts
			.filter((workout) => isToday(workout))
			.reduce((total, workout) => total + workout.minutes, 0),
	};
}

// "Oatmeal 350" -> { label: "Oatmeal", amount: 350 }; "Salad" -> { label: "Salad" }
export function parseEntry(text: string) {
	const match = /^(?<label>.+?)(?:\s+(?<amount>\d+))?$/v.exec(text.trim());

	if (!match?.groups?.label) {
		return undefined;
	}

	const { label, amount } = match.groups;

	return amount === undefined
		? { label }
		: { label, amount: Number.parseInt(amount, 10) };
}
