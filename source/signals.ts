import { targetsOf } from "./health.js";
import {
	byTime,
	type Log,
	logsOf,
	profileNow,
	type Progress,
	todayOf,
	workoutExperience,
} from "./progress.js";

export type Daylight = "night" | "dawn" | "day" | "dusk";
export type Season = "spring" | "summer" | "autumn" | "winter";

export type Room = Readonly<{
	plant: "none" | "growing" | "wilting";
	dumbbells: boolean;
	books: boolean;
}>;

// What the logs say about right now, for the character and its stage.
export type Signals = Readonly<{
	rest: "tired" | "fine";
	isThirsty: boolean;
	isHungry: boolean;
	isFull: boolean;
	exertion: "none" | "sweaty" | "flushed";
	face: "sad" | "neutral" | "bright";
	isBedHead: boolean;
	daylight?: Daylight;
	season?: Season;
	room: Room;
}>;

export const quietSignals: Signals = {
	rest: "fine",
	isThirsty: false,
	isHungry: false,
	isFull: false,
	exertion: "none",
	face: "neutral",
	isBedHead: false,
	room: { plant: "none", dumbbells: false, books: false },
};

const minute = 60_000;

// The signals read minutes and hours, so the app asks once a minute; asking at
// the minute's end, never its start, keeps an entry saved a moment ago from
// lying in the future and going unseen.
export const signalClockOf = (now: number) =>
	(Math.floor(now / minute) + 1) * minute;
const hour = 60 * minute;
const day = 24 * hour;

type Timed = Readonly<{ at: string }>;

// Entries between `within` ago and now, newest first by their timestamps.
const recentOf = <Entry extends Timed>(
	entries: readonly Entry[],
	now: number,
	within: number,
) =>
	entries
		.filter((entry) => {
			const age = now - Date.parse(entry.at);
			return age >= 0 && age <= within;
		})
		.toSorted((left, right) => byTime(right, left));

const isSameDay = (at: string, now: number) =>
	new Date(at).toDateString() === new Date(now).toDateString();

export function daylightOf(now: number): Daylight {
	const hourOfDay = new Date(now).getHours();

	if (hourOfDay < 5 || hourOfDay >= 22) {
		return "night";
	}

	if (hourOfDay < 8) {
		return "dawn";
	}

	return hourOfDay < 18 ? "day" : "dusk";
}

// The seasons follow the northern hemisphere.
// ponytail: Taiwan, Korea, and most users are there; add a hemisphere
// variable if someone in the south asks.
const seasonsByMonth = [
	"winter",
	"winter",
	"spring",
	"spring",
	"spring",
	"summer",
	"summer",
	"summer",
	"autumn",
	"autumn",
	"autumn",
	"winter",
] as const;

export const seasonOf = (now: number): Season =>
	seasonsByMonth[new Date(now).getMonth()] ?? "winter";

// Intensity-weighted strength minutes of the last 28 days, which build muscle.
export const strengthLoadOf = (progress: Progress, now: number) =>
	recentOf(
		progress.workouts.filter((workout) => workout.activity === "strength"),
		now,
		28 * day,
	).reduce((total, workout) => total + workoutExperience(workout), 0);

// `logs` defaults to a fresh `logsOf`; a caller that ticks passes its memo.
export function signalsOf(
	progress: Progress,
	now: number,
	// Newest first, as `logsOf` returns it.
	logs: readonly Log[] = logsOf(progress),
): Signals {
	const today = todayOf(progress, now);
	const targets = targetsOf(profileNow(progress), progress.goals);
	const clock = new Date(now);
	const hourOfDay = clock.getHours() + clock.getMinutes() / 60;
	const [lastSleep] = recentOf(progress.sleep, now, 20 * hour);
	const [lastMeal] = recentOf(progress.meals, now, 3 * day);
	const [lastWorkout] = recentOf(progress.workouts, now, 30 * minute);
	const [lastWater] = recentOf(progress.water, now, Number.POSITIVE_INFINITY);
	const lastEntry = logs.find((log) => log.kind !== "event");

	// Behind on water: under 40% of the pace from 7:00 to 22:00, past 11:00,
	// for someone who logged water this week.
	const pace = Math.min(Math.max((hourOfDay - 7) / 15, 0), 1);
	const isThirsty =
		recentOf(progress.water, now, 7 * day).length > 0 &&
		hourOfDay >= 11 &&
		hourOfDay < 22 &&
		today.water < 0.4 * targets.water * pace;

	const isHungry =
		lastMeal !== undefined &&
		hourOfDay >= 9 &&
		hourOfDay < 22 &&
		now - Date.parse(lastMeal.at) >= 5 * hour;

	const lastHourCalories = recentOf(progress.meals, now, hour).reduce(
		(total, meal) => total + (meal.calories ?? 0),
		0,
	);

	let exertion: Signals["exertion"] = "none";

	if (lastWorkout?.intensity === "vigorous") {
		exertion = "flushed";
	} else if (lastWorkout && now - Date.parse(lastWorkout.at) <= 20 * minute) {
		exertion = "sweaty";
	}

	let face: Signals["face"] = "neutral";

	if (today.mood !== undefined && today.mood <= 2) {
		face = "sad";
	} else if (today.mood !== undefined && today.mood >= 4) {
		face = "bright";
	}

	let plant: Room["plant"] = "none";

	if (lastWater) {
		plant = now - Date.parse(lastWater.at) <= 2 * day ? "growing" : "wilting";
	}

	return {
		rest: lastSleep && lastSleep.minutes < 360 ? "tired" : "fine",
		isThirsty,
		isHungry,
		isFull: lastHourCalories >= 0.4 * targets.calories,
		exertion,
		face,
		isBedHead:
			lastEntry !== undefined &&
			!isSameDay(lastEntry.at, now) &&
			now - Date.parse(lastEntry.at) >= 7 * day,
		daylight: daylightOf(now),
		season: seasonOf(now),
		room: {
			plant,
			dumbbells:
				progress.workouts.filter((workout) => workout.activity === "strength")
					.length >= 10,
			books:
				progress.focus.reduce((total, focus) => total + focus.minutes, 0) >=
				25 * 60,
		},
	};
}

// Falling particles are motion; the sky and the room stay.
export const stageSignalsOf = (
	signals: Signals,
	isReduced: boolean,
): Signals => (isReduced ? { ...signals, season: undefined } : signals);
