import {
	formatNumber,
	type Gender,
	type HealthGoal,
	type Language,
	type Messages,
	type WorkStyle,
} from "./i18n.js";
import type { Profile, todayOf } from "./progress.js";

export type Targets = Readonly<{
	calories: number;
	protein: number;
	workoutMinutes: number;
}>;

type Today = ReturnType<typeof todayOf>;

// Without a profile: the common 2,000 kcal reference, 50 g protein, and 30 active minutes.
const defaultTargets: Targets = {
	calories: 2000,
	protein: 50,
	workoutMinutes: 30,
};

// Physical activity levels, from sedentary to very active.
const activityFactor: Record<WorkStyle, number> = {
	desk: 1.2,
	standing: 1.375,
	active: 1.55,
	athlete: 1.725,
};

// Mifflin-St Jeor's constant, averaged when gender is not given.
const genderConstant: Record<Gender, number> = {
	male: 5,
	female: -161,
	other: -78,
};

const calorieShift: Record<HealthGoal, number> = {
	loseFat: -500,
	maintain: 0,
	buildMuscle: 300,
	endurance: 200,
};

// Grams of protein per kilogram of body weight, within the 0.8 to 2.2 g that
// sports nutrition guidance covers.
const proteinPerKilogram: Record<HealthGoal, number> = {
	loseFat: 1.8,
	maintain: 1,
	buildMuscle: 2,
	endurance: 1.4,
};

const proteinForWork: Record<WorkStyle, number> = {
	desk: 0,
	standing: 0.1,
	active: 0.2,
	athlete: 0.3,
};

const workoutMinutes: Record<HealthGoal, number> = {
	loseFat: 45,
	maintain: 30,
	buildMuscle: 45,
	endurance: 60,
};

export function targetsOf(profile: Profile | undefined): Targets {
	if (!profile) {
		return defaultTargets;
	}

	const { weight, height, age, gender, workStyle, goal } = profile;
	const restingCalories =
		10 * weight + 6.25 * height - 5 * age + genderConstant[gender];
	const calories =
		restingCalories * activityFactor[workStyle] + calorieShift[goal];
	const proteinRate = Math.min(
		proteinPerKilogram[goal] + proteinForWork[workStyle],
		2.2,
	);

	return {
		calories: Math.round(Math.max(calories, 1200) / 10) * 10,
		protein: Math.round(weight * proteinRate),
		workoutMinutes: workoutMinutes[goal],
	};
}

export type Advice = Readonly<{ text: string; isDone: boolean }>;

// What is left of today, most pressing first.
export function adviceOf(
	profile: Profile | undefined,
	today: Today,
	language: Language,
	messages: Messages,
): Advice[] {
	const targets = targetsOf(profile);
	const goal = profile?.goal ?? "maintain";
	const protein = targets.protein - today.protein;
	const minutes = targets.workoutMinutes - today.workoutMinutes;
	const calories = targets.calories - today.calories;
	const { health } = messages;

	return [
		minutes > 0
			? {
					text: health.workoutLeft(minutes, health.suggestion[goal]),
					isDone: false,
				}
			: { text: health.workoutDone, isDone: true },
		protein > 0
			? { text: health.proteinLeft(protein), isDone: false }
			: { text: health.proteinDone, isDone: true },
		calories >= 0
			? {
					text: health.caloriesLeft(formatNumber(language, calories)),
					isDone: false,
				}
			: {
					text: health.caloriesOver(formatNumber(language, -calories)),
					isDone: false,
				},
	];
}
