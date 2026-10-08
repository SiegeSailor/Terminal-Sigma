import {
	caloriesOf,
	intensityOf,
	leadingActivity,
	leadingExercise,
} from "./exercises.js";
import { matchFood } from "./foods.js";
import {
	type Intensity,
	type Language,
	messagesOf,
	type WorkoutActivity,
	workoutActivities,
} from "./i18n.js";
import {
	type EntryOf,
	type Goals,
	type Progress,
	profileNow,
} from "./progress.js";

export type ParseContext = Readonly<{
	progress: Progress;
	now: number;
	language: Language;
}>;

type Flat<Kind extends keyof EntryOf> = Readonly<
	{ kind: Kind } & EntryOf[Kind]
>;

// Amounts are totals for all the servings, like the meal they become.
export type MealDraft = Readonly<{
	kind: "meal";
	at: string;
	food: string;
	servings: number;
	calories?: number;
	protein?: number;
	carbs?: number;
	fat?: number;
	// False for a food nobody knows and no kcal were typed for.
	isKnown: boolean;
}>;

export type GoalDraft = Readonly<{
	kind: "goal";
	at: string;
	goal: keyof Goals;
	value: number;
}>;

export type Draft =
	| MealDraft
	| Flat<"workout">
	| Flat<"water">
	| Flat<"sleep">
	| Flat<"body">
	| Flat<"mood">
	| Flat<"habit">
	| Flat<"steps">
	| Flat<"note">
	| GoalDraft;

// Codes, never text: the view says each one in the language on now.
export const parseErrors = [
	"empty",
	"badTime",
	"badNumber",
	"outOfRange",
	"badSleep",
	"badMood",
	"badGoal",
	"noMinutes",
	"noPreviousSets",
	"nothingToRepeat",
	"nothingToCopy",
	"tooLong",
] as const;
export type ParseError = (typeof parseErrors)[number];

export type ParseResult =
	| Readonly<{ ok: true; drafts: Draft[] }>
	| Readonly<{ ok: false; error: ParseError }>;

const failed = (error: ParseError): ParseResult => ({ ok: false, error });
const parsed = (...drafts: Draft[]): ParseResult => ({ ok: true, drafts });

// "72.4", "1/2", and "½", which NFKC turns into "1⁄2".
function amountOf(text: string): number | undefined {
	const fraction = /^(?<top>\d+)[\/⁄](?<bottom>\d+)$/v.exec(text);

	if (fraction?.groups) {
		const value = Number(fraction.groups.top) / Number(fraction.groups.bottom);
		return Number.isFinite(value) ? value : undefined;
	}

	return /^\d+(?:\.\d+)?$/v.test(text) ? Number(text) : undefined;
}

// "@y", "@-2d", "@7:30", "@y21:00", or "@y 21:00", in local time; a clock
// time later than now with no day means yesterday, like a sleep past midnight.
function timeOf(
	line: string,
	now: number,
): { at: number; rest: string } | undefined {
	if (!line.startsWith("@")) {
		return { at: now, rest: line };
	}

	const match =
		/^@(?<day>y|-\d{1,3}d)? ?(?:(?<hour>\d{1,2}):(?<minute>\d{2}))?(?: |$)/v.exec(
			line,
		);
	const { day, hour, minute } = match?.groups ?? {};

	if (
		!match ||
		(!day && hour === undefined) ||
		Number(hour ?? 0) > 23 ||
		Number(minute ?? 0) > 59
	) {
		return undefined;
	}

	const date = new Date(now);
	date.setDate(
		date.getDate() - (day === "y" ? 1 : Number(day?.slice(1, -1) ?? 0)),
	);

	if (hour !== undefined) {
		date.setHours(Number(hour), Number(minute), 0, 0);

		if (!day && date.getTime() > now) {
			date.setDate(date.getDate() - 1);
		}
	}

	return { at: date.getTime(), rest: line.slice(match[0].length).trim() };
}

// The text after the prefix, when it was logged, the context, and the prefix.
type Parser = (
	text: string,
	at: number,
	context: ParseContext,
	prefix: string,
) => ParseResult;

// 1 line of the Log view into drafts. ASCII prefixes choose the kind, so they
// still work through a Chinese or Korean input method; no prefix is a meal.
export function parseQuickLog(
	text: string,
	context: ParseContext,
): ParseResult {
	// Full-width letters, digits, spaces, and commas from an input method.
	const line = text.normalize("NFKC").replaceAll(/\s+/gv, " ").trim();

	if (!line) {
		return failed("empty");
	}

	const timed = timeOf(line, context.now);

	if (!timed) {
		return failed("badTime");
	}

	if (!timed.rest) {
		return failed("empty");
	}

	const [word = "", ...words] = timed.rest.split(" ");
	const parser = Object.hasOwn(parsers, word.toLowerCase())
		? parsers[word.toLowerCase()]
		: undefined;

	return parser
		? parser(words.join(" "), timed.at, context, word.toLowerCase())
		: mealsOf(timed.rest, timed.at, context);
}

const iso = (at: number) => new Date(at).toISOString();

// Words that may follow a quantity, as in "2個", "1 碗", "2개", or "1 공기".
const hangulCounter = String.raw`(?:공기|그릇|인분|조각|마리|[개잔장병캔])`;
const chineseCounter = String.raw`[個颗顆杯碗片份塊條根盤隻]`;
const counter = String.raw`공기|그릇|인분|조각|마리|[個颗顆杯碗片份塊條根盤隻개잔장병캔]`;
// A weight, volume, or percent after the number is not a count of servings.
const unit = String.raw`(?! ?(?:%|(?:kg|g|ml|l|oz|lbs|lb)(?![\p{L}\p{N}])))`;
const quantity = String.raw`\d+[\/⁄]\d+|\d+(?:\.\d+)?`;
const leadingQuantity = new RegExp(
	String.raw`^(?<amount>${quantity})(?!\d|\.\d)${unit} ?(?:${chineseCounter}|${hangulCounter}(?= |$)|[x×](?= ))? ?(?<food>.+)$`,
	"v",
);
const trailingQuantity = new RegExp(
	String.raw`^(?<food>.+?) ?(?:(?<amount>${quantity}) ?(?:${counter})|[x×](?<times>\d+))$`,
	"v",
);
const macroPattern =
	/(?<value>\d+(?:\.\d+)?) ?(?<unit>kcal|cal|大卡|p|c|f)(?![\p{L}\p{N}])/giv;
const macroOf: Partial<
	Record<string, "calories" | "protein" | "carbs" | "fat">
> = {
	kcal: "calories",
	cal: "calories",
	大卡: "calories",
	p: "protein",
	c: "carbs",
	f: "fat",
};

const kilocalories = (value: number) => Math.round(value);
const grams = (value: number) => Math.round(value * 10) / 10;

// 1 item of a meal: "2 eggs", "雞蛋2顆", "ramen 500kcal", or "450kcal 30p".
// Typed amounts are totals and win outright; otherwise a known food gives its
// serving × the quantity, and an unknown one logs with no amounts at all.
function mealOf(
	item: string,
	at: number,
	{ progress, language }: ParseContext,
): MealDraft | undefined {
	const typed: Partial<
		Record<"calories" | "protein" | "carbs" | "fat", number>
	> = {};

	for (const { groups } of item.matchAll(macroPattern)) {
		const field = macroOf[groups?.unit?.toLowerCase() ?? ""];

		if (field) {
			typed[field] = Number(groups?.value);
		}
	}

	const rest = item.replaceAll(macroPattern, "").replaceAll(/ +/gv, " ").trim();
	const {
		amount,
		times,
		food = rest,
	} = (leadingQuantity.exec(rest) ?? trailingQuantity.exec(rest))?.groups ?? {};
	const servings = amountOf(amount ?? times ?? "1");
	const hasTyped = Object.keys(typed).length > 0;

	if (servings === undefined || servings <= 0 || (!food && !hasTyped)) {
		return undefined;
	}

	const base = { kind: "meal", at: iso(at), servings } as const;

	if (hasTyped) {
		return {
			...base,
			food: food || messagesOf(language).log.quickAdd,
			...typed,
			isKnown: true,
		};
	}

	const match = matchFood(food, language, progress.meals);

	if (!match) {
		return { ...base, food, isKnown: false };
	}

	const scaled = (
		value: number | undefined,
		round: (value: number) => number,
	) => (value === undefined ? undefined : round(value * servings));

	return {
		...base,
		food: match.label,
		calories: scaled(match.calories, kilocalories),
		protein: scaled(match.protein, grams),
		carbs: scaled(match.carbs, grams),
		fat: scaled(match.fat, grams),
		isKnown: true,
	};
}

// Items split on "," "+" "、", and "，", which NFKC already made ",".
function mealsOf(text: string, at: number, context: ParseContext): ParseResult {
	const drafts = text
		.split(/[,+、]/v)
		.map((item) => item.trim())
		.filter(Boolean)
		.map((item) => mealOf(item, at, context));

	return drafts.every((draft): draft is MealDraft => draft !== undefined)
		? parsed(...drafts)
		: failed("badNumber");
}

const isWithin = (value: number, minimum: number, maximum: number) =>
	value >= minimum && value <= maximum;

// "7.5h", "7h30m", "450m", "30min", "30분", "7小時", or a bare "450".
function minutesOf(text: string): number | undefined {
	if (/^\d+(?:\.\d+)?$/v.test(text)) {
		return Number(text);
	}

	const { hours, minutes } =
		/^(?:(?<hours>\d+(?:\.\d+)?)(?:h|시간|小時))?(?:(?<minutes>\d+(?:\.\d+)?)(?:m(?:in)?|분|分鐘?))?$/iv.exec(
			text,
		)?.groups ?? {};

	return hours === undefined && minutes === undefined
		? undefined
		: Number(hours ?? 0) * 60 + Number(minutes ?? 0);
}

// "500", "500ml", "0.5l", or "2 glasses", where a glass, cup, 杯, or 잔 is 250 ml.
function millilitersOf(text: string): number | undefined {
	const { value = "", unit = "ml" } =
		/^(?<value>[\d.\/⁄]+) ?(?<unit>ml|l|glass(?:es)?|cups?|杯|잔)?$/iv.exec(
			text,
		)?.groups ?? {};
	const amount = amountOf(value);
	const glass = /^(?:ml|l)$/iv.test(unit) ? undefined : 250;

	if (amount === undefined) {
		return undefined;
	}

	return Math.round(
		amount * (glass ?? (unit.toLowerCase() === "l" ? 1000 : 1)),
	);
}

const wholeOf = (text: string) =>
	/^\d+$/v.test(text.replaceAll(",", ""))
		? Number(text.replaceAll(",", ""))
		: undefined;

const water: Parser = (text, at) => {
	const milliliters = text ? millilitersOf(text) : 250;

	if (milliliters === undefined) {
		return failed("badNumber");
	}

	return isWithin(milliliters, 1, 5000)
		? parsed({ kind: "water", at: iso(at), milliliters })
		: failed("outOfRange");
};

const bodyFields: Partial<
	Record<string, readonly ["weight" | "waist" | "bodyFat", number, number]>
> = {
	wt: ["weight", 30, 300],
	waist: ["waist", 40, 250],
	bf: ["bodyFat", 3, 60],
};

// "wt 72.4", "waist 82", "bf 18", or several at once: "wt 72.4 bf 18".
const body: Parser = (text, at, _context, prefix) => {
	const tokens = [prefix, ...text.split(" ")];
	const entry: Partial<Record<"weight" | "waist" | "bodyFat", number>> = {};

	for (let index = 0; index < tokens.length; index += 2) {
		const field = bodyFields[tokens[index]?.toLowerCase() ?? ""];
		const value = amountOf(
			(tokens[index + 1] ?? "").replace(/(?:kg|cm|%)$/iv, ""),
		);

		if (!field || value === undefined) {
			return failed("badNumber");
		}

		const [key, minimum, maximum] = field;

		if (!isWithin(value, minimum, maximum)) {
			return failed("outOfRange");
		}

		entry[key] = value;
	}

	return parsed({ kind: "body", at: iso(at), ...entry });
};

const clockPattern =
	/^(?<fromHour>\d{1,2}):(?<fromMinute>\d{2})-(?<toHour>\d{1,2}):(?<toMinute>\d{2})$/v;

// "23:30-7:10" in minutes, across midnight, and its wake time on the day of
// `at`, or the day before when that is still to come.
function spanOf(
	text: string,
	at: number,
	now: number,
): { minutes: number; wakeAt: number } | undefined {
	const clock = clockPattern.exec(text)?.groups;

	if (!clock) {
		return undefined;
	}

	const [fromHour = 0, fromMinute = 0, toHour = 0, toMinute = 0] = [
		clock.fromHour,
		clock.fromMinute,
		clock.toHour,
		clock.toMinute,
	].map(Number);

	if (Math.max(fromHour, toHour) > 23 || Math.max(fromMinute, toMinute) > 59) {
		return undefined;
	}

	const wake = new Date(at);
	wake.setHours(toHour, toMinute, 0, 0);

	if (wake.getTime() > now) {
		wake.setDate(wake.getDate() - 1);
	}

	return {
		minutes:
			(toHour * 60 + toMinute - fromHour * 60 - fromMinute + 1440) % 1440,
		wakeAt: wake.getTime(),
	};
}

// "sl 23:30-7:10 q4" stamps the wake time; "sl 7.5h q3" woke up just now.
const sleep: Parser = (text, at, { now }) => {
	const [span = "", ...rest] = text.split(" ");
	const scores = rest.map(
		(token) => /^q(?<score>[1-5])$/iv.exec(token)?.groups?.score,
	);
	const { minutes, wakeAt } = spanOf(span, at, now) ?? {
		// A bare number up to 24 is hours, and a larger one is minutes.
		minutes: /^\d+(?:\.\d+)?$/v.test(span)
			? Number(span) * (Number(span) <= 24 ? 60 : 1)
			: minutesOf(span),
		wakeAt: at,
	};

	if (
		minutes === undefined ||
		!isWithin(minutes, 1, 1440) ||
		scores.includes(undefined)
	) {
		return failed("badSleep");
	}

	const quality = scores.at(-1);

	return parsed({
		kind: "sleep",
		at: iso(wakeAt),
		minutes: Math.round(minutes),
		...(quality === undefined ? {} : { quality: Number(quality) }),
	});
};

// "m 4 e3 s2 #work #friends": the mood, then energy, stress, and tags.
const mood: Parser = (text, at) => {
	const [score = "", ...rest] = text.split(" ");
	const tags: string[] = [];
	const ratings: Partial<Record<"energy" | "stress", number>> = {};

	if (!/^[1-5]$/v.test(score)) {
		return failed("badMood");
	}

	for (const token of rest) {
		const rating = /^(?<scale>[es])(?<value>[1-5])$/iv.exec(token)?.groups;

		if (token.length > 1 && token.startsWith("#")) {
			tags.push(token.slice(1));
		} else if (rating) {
			ratings[rating.scale?.toLowerCase() === "e" ? "energy" : "stress"] =
				Number(rating.value);
		} else {
			return failed("badMood");
		}
	}

	return parsed({
		kind: "mood",
		at: iso(at),
		score: Number(score),
		...ratings,
		...(tags.length > 0 ? { tags } : {}),
	});
};

const keyOf = (name: string) => name.normalize("NFKC").toLowerCase();

// "h read", "h read 30" for an amount, and "h read s" to skip it today.
const habit: Parser = (text, at, { progress }) => {
	const words = text.split(" ").filter(Boolean);
	const skipped = words.length > 1 && words.at(-1)?.toLowerCase() === "s";

	if (skipped) {
		words.pop();
	}

	const last = words.length > 1 ? (words.at(-1) ?? "") : "";
	const amount = amountOf(last);

	if (amount === undefined && /^[\d.\/⁄]+$/v.test(last)) {
		return failed("badNumber");
	}

	if (amount !== undefined) {
		words.pop();
	}

	const typed = words.join(" ");

	if (!typed) {
		return failed("empty");
	}

	if (amount === 0) {
		return failed("outOfRange");
	}

	// The spelling logged before, so "Read" and "read" stay 1 habit.
	const name =
		progress.habits.findLast((logged) => keyOf(logged.name) === keyOf(typed))
			?.name ?? typed;

	return parsed({
		kind: "habit",
		at: iso(at),
		name,
		...(amount === undefined ? {} : { amount }),
		...(skipped ? { skipped } : {}),
	});
};

const steps: Parser = (text, at) => {
	const count = wholeOf(text);

	if (count === undefined) {
		return failed("badNumber");
	}

	return isWithin(count, 1, 100_000)
		? parsed({ kind: "steps", at: iso(at), count })
		: failed("outOfRange");
};

const note: Parser = (text, at) => {
	if (!text) {
		return failed("empty");
	}

	return text.length > 2000
		? failed("tooLong")
		: parsed({ kind: "note", at: iso(at), text });
};

const goalRules: Partial<
	Record<
		string,
		readonly [keyof Goals, (text: string) => number | undefined, number, number]
	>
> = {
	water: ["water", millilitersOf, 250, 10_000],
	sleep: ["sleep", minutesOf, 240, 720],
	steps: ["steps", wholeOf, 1000, 50_000],
	focus: ["focusSessions", wholeOf, 1, 16],
};

// "goal water 2.5l", "goal sleep 8h", "goal steps 9000", or "goal focus 6".
const goal: Parser = (text, at) => {
	const [name = "", ...rest] = text.split(" ");
	const rule = goalRules[name.toLowerCase()];

	if (!rule) {
		return failed("badGoal");
	}

	const [key, read, minimum, maximum] = rule;
	const value = read(rest.join(" "));

	if (value === undefined) {
		return failed("badNumber");
	}

	return isWithin(value, minimum, maximum)
		? parsed({ kind: "goal", at: iso(at), goal: key, value: Math.round(value) })
		: failed("outOfRange");
};

const setPattern =
	/^(?<weight>\d+(?:\.\d+)?)[x×*](?<reps>\d+)(?:[x×*](?<count>\d+))?$/iv;

type WorkoutParts = {
	sets: Array<Readonly<{ reps: number; weight: number }>>;
	minutes?: number;
	distance?: number;
	intensity: Intensity;
};

// The sets, minutes, distance, and intensity after a workout's name.
function workoutPartsOf(tokens: readonly string[]): WorkoutParts | ParseError {
	const parts: WorkoutParts = { sets: [], intensity: "moderate" };

	for (const token of tokens) {
		const set = setPattern.exec(token)?.groups;
		const kilometers = /^(?<value>\d+(?:\.\d+)?)km?$/iv.exec(token)?.groups;
		const intensity = intensityOf(token);
		const minutes = minutesOf(token);

		if (set) {
			const reps = Number(set.reps);
			const count = Number(set.count ?? 1);

			const weight = Number(set.weight);

			if (
				!isWithin(reps, 1, 1000) ||
				!isWithin(count, 1, 100) ||
				weight > 1000
			) {
				return "outOfRange";
			}

			parts.sets.push(
				...Array.from({ length: count }, () => ({ reps, weight })),
			);
		} else if (kilometers) {
			parts.distance = Number(kilometers.value);

			if (!isWithin(parts.distance, 0.01, 1000)) {
				return "outOfRange";
			}
		} else if (intensity) {
			parts.intensity = intensity;
		} else if (minutes === undefined) {
			return "badNumber";
		} else {
			parts.minutes = minutes;
		}
	}

	return parts;
}

type Subject = Readonly<{
	activity?: WorkoutActivity;
	exercise?: string;
	name?: string;
	rest: string;
}>;

// What a workout line names: a known activity, a known exercise, or new words
// that run until the first number or intensity.
function subjectOf(text: string): Subject {
	const activity = leadingActivity(text);

	if (activity) {
		return { activity: activity.value, rest: activity.rest };
	}

	const exercise = leadingExercise(text);

	if (exercise) {
		return { exercise: exercise.value, rest: exercise.rest };
	}

	const words = text.split(" ");
	const end = words.findIndex(
		(word) => /^\d/v.test(word) || intensityOf(word) !== undefined,
	);
	const cut = end === -1 ? words.length : end;

	return {
		name: words.slice(0, cut).join(" "),
		rest: words.slice(cut).join(" "),
	};
}

// The typed sets of an exercise, or else the sets of its last session, the
// way Hevy prefills them.
function setsOf(subject: Subject, parts: WorkoutParts, progress: Progress) {
	const exercise =
		subject.exercise ??
		(parts.sets.length > 0 ? subject.name?.toLowerCase() : undefined);

	if (exercise === undefined) {
		return [];
	}

	return parts.sets.length > 0 || !subject.exercise
		? parts.sets.map((set) => ({ exercise, ...set }))
		: (progress.workouts
				.findLast((logged) =>
					logged.sets?.some((set) => set.exercise === exercise),
				)
				?.sets?.filter((set) => set.exercise === exercise) ?? []);
}

// "wo run 30m hard 5k" for cardio; "wo bench 60x5x3" for 3 sets of 5 at 60
// kg; "wo bench" alone repeats the sets of the last bench session.
const workout: Parser = (text, at, { progress }) => {
	const subject = subjectOf(text);
	const parts = workoutPartsOf(subject.rest.split(" ").filter(Boolean));

	if (typeof parts === "string") {
		return failed(parts);
	}

	const sets = setsOf(subject, parts, progress);

	if (sets.length > 200) {
		return failed("outOfRange");
	}

	// A new name with sets is an exercise; without them, an activity.
	const activity =
		subject.activity ?? (sets.length > 0 ? "strength" : subject.name);

	if (subject.exercise && sets.length === 0) {
		return failed("noPreviousSets");
	}

	if (!activity || (sets.length > 0 && !sets[0]?.exercise)) {
		return failed("empty");
	}

	// Lifting and resting take about 3 minutes a set when no time is typed.
	// ponytail: a fixed pace; time the session with a typed "40m" for more.
	const minutes =
		parts.minutes ?? (sets.length > 0 ? sets.length * 3 : undefined);

	if (minutes === undefined) {
		return failed("noMinutes");
	}

	if (!isWithin(minutes, 1, 600)) {
		return failed("outOfRange");
	}

	const weight = profileNow(progress)?.weight;
	const met =
		workoutActivities.find((option) => option === activity) ?? "other";

	return parsed({
		kind: "workout",
		at: iso(at),
		activity,
		minutes,
		intensity: parts.intensity,
		...(weight === undefined
			? {}
			: { calories: caloriesOf(met, parts.intensity, minutes, weight) }),
		...(parts.distance === undefined ? {} : { distance: parts.distance }),
		...(sets.length > 0 ? { sets } : {}),
	});
};

// The prefix of a line picks its parser; a line without 1 is a meal.
const parsers: Partial<Record<string, Parser>> = {
	w: water,
	wt: body,
	waist: body,
	bf: body,
	sl: sleep,
	m: mood,
	h: habit,
	st: steps,
	n: note,
	goal,
	wo: workout,
};
