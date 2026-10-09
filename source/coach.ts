import {
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import zod from "zod";
import type { Turn } from "./asker.js";
import { targetsOf } from "./health.js";
import { type Language, type Messages, messagesOf } from "./i18n.js";
import { streakOf } from "./insights.js";
import {
	planSchema as savedPlanSchema,
	profileNow,
	type Progress,
	todayOf,
} from "./progress.js";

export const coachKinds = [
	"chat",
	"today",
	"week",
	"plan",
	"estimate",
] as const;
export type CoachKind = (typeof coachKinds)[number];

const dateOf = (time: number) => {
	const date = new Date(time);
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

// What a model needs to know, in plain English and metric units. Notes stay
// out: they are the user's private writing.
export function contextOf(progress: Progress, now: number): string {
	const english = messagesOf("en");
	const profile = profileNow(progress);
	const targets = targetsOf(profile, progress.goals);
	const lines = [
		`Now: ${dateOf(now)} ${new Date(now).toTimeString().slice(0, 5)}, ${new Date(now).toLocaleDateString("en", { weekday: "long" })}.`,
		profile
			? `Profile: ${profile.age}-year-old ${profile.gender === "other" ? "person" : profile.gender}, ${profile.height} cm, ${profile.weight} kg${profile.bodyFat === undefined ? "" : `, ${profile.bodyFat}% body fat`}, ${english.workStyle[profile.workStyle].toLowerCase()}, goal: ${english.goal[profile.goal].toLowerCase()}.`
			: "Profile: not set up.",
		`Daily targets: ${targets.calories} kcal, ${targets.protein} g protein, ${targets.workoutMinutes} min exercise, ${targets.water} ml water, ${Math.round(targets.sleep / 6) / 10} h sleep, ${targets.steps} steps.`,
		`Logging streak: ${streakOf(progress, now)} days.`,
		"Last 7 days, oldest first:",
	];

	for (let back = 7; back >= 1; back--) {
		// Step by calendar day, never by 24 hours, so a DST night lists no day twice.
		const date = new Date(now);
		date.setDate(date.getDate() - back);
		const then = date.getTime();
		const totals = todayOf(progress, then);
		const workouts = progress.workouts
			.filter((workout) => dateOf(Date.parse(workout.at)) === dateOf(then))
			.map((workout) => `${workout.activity} ${workout.minutes} min`)
			.join(", ");
		lines.push(
			`- ${dateOf(then)}: ${totals.calories} kcal, ${totals.protein} g protein, ${totals.workoutMinutes} min exercise${workouts ? ` (${workouts})` : ""}, ${totals.water} ml water, ${Math.round(totals.sleepMinutes / 6) / 10} h sleep, ${totals.steps} steps${totals.mood === undefined ? "" : `, mood ${totals.mood}/5`}.`,
		);
	}

	const today = todayOf(progress, now);
	const isToday = (at: string) => dateOf(Date.parse(at)) === dateOf(now);
	const meals = progress.meals
		.filter((meal) => isToday(meal.at))
		.map(
			(meal) =>
				`${meal.food}${meal.calories === undefined ? "" : ` ${meal.calories} kcal`}`,
		)
		.join(", ");
	lines.push(
		`Today so far: ${today.calories} kcal, ${today.protein} g protein, ${today.workoutMinutes} min exercise, ${today.water} ml water, ${today.steps} steps. Meals: ${meals || "none yet"}.`,
	);

	return lines.join("\n");
}

const languageNames: Record<Language, string> = {
	en: "English",
	"zh-TW": "Traditional Chinese as used in Taiwan",
	ko: "Korean",
};

export function instructionsOf(language: Language, context: string): string {
	return [
		"You are the coach inside Terminal Sigma, a self-development dashboard. You see the user's own logs below.",
		"Be specific to their numbers, warm, and brief: at most 150 words unless they ask for more. Use metric units.",
		"Give general fitness and nutrition guidance only. This is not medical advice: for pain, illness, pregnancy, eating disorders, or medication, tell them to see a professional.",
		`Always answer in ${languageNames[language]}.`,
		"",
		"The user's data:",
		context,
	].join("\n");
}

export const promptOf = (
	kind: Exclude<CoachKind, "chat">,
	messages: Messages,
	text = "",
) =>
	kind === "estimate"
		? messages.coach.prompts.estimate(text)
		: messages.coach.prompts[kind];

// What the model replies with; saving it adds the time.
export const planSchema = savedPlanSchema.omit({ at: true });
export type Plan = zod.infer<typeof planSchema>;

export const estimateSchema = zod.object({
	calories: zod.number().int().min(0).max(5000),
	protein: zod.number().min(0).max(500),
	carbs: zod.number().min(0).max(1000),
	fat: zod.number().min(0).max(500),
	serving: zod.string().max(60).optional(),
});
export type Estimate = zod.infer<typeof estimateSchema>;

const timestamp = zod.iso.datetime({ offset: true });

export const coachSchema = zod.object({
	sessions: zod
		.array(
			zod.object({
				id: zod.string().min(1),
				startedAt: timestamp,
				turns: zod.array(
					zod.object({
						role: zod.enum(["user", "assistant"]),
						content: zod.string(),
						at: timestamp,
						via: zod.string().optional(),
					}),
				),
			}),
		)
		.default([]),
});
export type Coach = zod.infer<typeof coachSchema>;
export type Session = Coach["sessions"][number];

// Beside progress.json, wherever TERMINAL_SIGMA_HOME puts it.
export const coachPathOf = (progressFile: string) =>
	path.join(path.dirname(progressFile), "coach.json");

export function loadCoach(file: string): Coach {
	if (!existsSync(file)) {
		return coachSchema.parse({});
	}

	try {
		return coachSchema.parse(JSON.parse(readFileSync(file, "utf8")));
	} catch (error) {
		throw new Error(
			`${file} is unreadable, so Terminal-Sigma will not touch it. Fix or move it, then restart.\n${String(error)}`,
			{ cause: error },
		);
	}
}

// The conversation is about the user's health, so only the owner may read it.
export function saveCoach(file: string, coach: Coach) {
	mkdirSync(path.dirname(file), { recursive: true });
	const valid = coachSchema.parse(coach);
	const temporary = `${file}.tmp`;
	writeFileSync(temporary, `${JSON.stringify(valid, null, "\t")}\n`, {
		mode: 0o600,
	});
	chmodSync(temporary, 0o600);
	renameSync(temporary, file);
}

// Ponytail: the last 20 turns fit every provider's context window; summarize
// older turns if conversations ever need a longer memory.
export const recentTurnsOf = (session: Session, limit = 20): Turn[] =>
	session.turns.slice(-limit).map(({ role, content }) => ({ role, content }));
