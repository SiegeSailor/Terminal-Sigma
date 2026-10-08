import {
	durationOf,
	formatNumber,
	type Gender,
	type HealthGoal,
	type Language,
	type Messages,
	type WorkStyle,
} from "./i18n.js";
import type { Goals, Profile, Today } from "./progress.js";

export type Targets = Readonly<{
	calories: number;
	protein: number;
	workoutMinutes: number;
	// Milliliters, minutes, and a count.
	water: number;
	sleep: number;
	steps: number;
	focusSessions: number;
}>;

// Without a profile: the common 2,000 kcal reference, 50 g protein, and 30
// active minutes; the rest follow from the profile when there is one.
const defaultTargets: Targets = {
	calories: 2000,
	protein: 50,
	workoutMinutes: 30,
	water: 2600,
	sleep: 420,
	steps: 8000,
	focusSessions: 4,
};

// What to drink a day: the beverage share of the National Academies' adequate
// intake of 3.7 L for men and 2.7 L for women, about 80% of all water, since
// food brings the rest. "other" takes the middle.
const waterTarget: Record<Gender, number> = {
	male: 3000,
	female: 2200,
	other: 2600,
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

// The targets for the body, work style, and goal, with the user's own goals
// for water, sleep, steps, and focus winning over the defaults.
export function targetsOf(
	profile: Profile | undefined,
	goals: Goals = {},
): Targets {
	return { ...bodyTargetsOf(profile), ...goals };
}

function bodyTargetsOf(profile: Profile | undefined): Targets {
	if (!profile) {
		return defaultTargets;
	}

	const { weight, height, age, gender, workStyle, goal, bodyFat } = profile;
	// Katch-McArdle from lean mass when body fat is known, else Mifflin-St Jeor.
	const restingCalories =
		bodyFat === undefined
			? 10 * weight + 6.25 * height - 5 * age + genderConstant[gender]
			: 370 + 21.6 * weight * (1 - bodyFat / 100);
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
		water: waterTarget[gender],
		// 7 hours or more, as the AASM recommends for adults.
		sleep: 420,
		// Mortality stops falling at about 8,000 steps under 60, 7,000 from 60.
		steps: age < 60 ? 8000 : 7000,
		focusSessions: 4,
	};
}

export type Advice = Readonly<{ text: string; isDone: boolean }>;

// What is left of today, most pressing first.
export function adviceOf(
	profile: Profile | undefined,
	today: Today,
	language: Language,
	messages: Messages,
	goals?: Goals,
): Advice[] {
	const targets = targetsOf(profile, goals);
	const goal = profile?.goal ?? "maintain";
	const protein = targets.protein - today.protein;
	const minutes = targets.workoutMinutes - today.workoutMinutes;
	const calories = targets.calories - today.calories;
	const water = targets.water - today.water;
	const { health } = messages;
	let sleep: Advice = { text: health.sleepUnknown, isDone: false };

	if (today.sleepMinutes >= targets.sleep) {
		sleep = { text: health.sleepDone, isDone: true };
	} else if (today.sleepMinutes > 0) {
		sleep = {
			text: health.sleepShort(
				durationOf(today.sleepMinutes, messages),
				durationOf(targets.sleep, messages),
			),
			isDone: false,
		};
	}

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
		water > 0
			? {
					text: health.waterLeft(
						formatNumber(language, water),
						Math.ceil(water / 250),
					),
					isDone: false,
				}
			: { text: health.waterDone, isDone: true },
		sleep,
	];
}
