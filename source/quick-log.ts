import { describeLog, goalText } from "./content.js";
import {
	caloriesOf,
	exerciseName,
	intensityOf,
	leadingActivity,
	leadingExercise,
	setGroupsOf,
} from "./exercises.js";
import { matchFood } from "./foods.js";
import { targetsOf } from "./health.js";
import {
	type Intensity,
	type Language,
	type Messages,
	messagesOf,
	type WorkoutActivity,
	workoutActivities,
} from "./i18n.js";
import {
	byTime,
	type EntryOf,
	fieldOf,
	type Goals,
	type Logged,
	type LogKind,
	logKinds,
	logsOf,
	type Progress,
	profileNow,
	todayOf,
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
// still work through a Chinese or Korean input method (water also takes 水 and
// 물); no prefix is a meal.
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
// English counters need a space on both sides, like the Hangul ones.
const englishCounter = String.raw`(?:slices?|bowls?|cups?|pieces?|servings?)(?= )`;
const chineseCounter = String.raw`[個颗顆杯碗片份塊條根盤隻]`;
const counter = String.raw`공기|그릇|인분|조각|마리|[個颗顆杯碗片份塊條根盤隻개잔장병캔]`;
// A weight, volume, or percent after the number is not a count of servings.
const unit = String.raw`(?! ?(?:%|(?:kg|g|ml|l|oz|lbs|lb)(?![\p{L}\p{N}])))`;
const quantity = String.raw`\d+[\/⁄]\d+|\d+(?:\.\d+)?`;
const leadingQuantity = new RegExp(
	String.raw`^(?<amount>${quantity})(?!\d|\.\d)${unit} ?(?:${chineseCounter}|${hangulCounter}(?= |$)|${englishCounter}|[x×](?= ))? ?(?<food>.+)$`,
	"v",
);
const trailingQuantity = new RegExp(
	String.raw`^(?<food>.+?) ?(?:(?<amount>${quantity}) ?(?:${counter})|[x×](?<times>\d+))$`,
	"v",
);
// The letters p, c, and f follow their number closely; "1 c rice" is a cup.
const macroPattern =
	/(?<value>\d+(?:\.\d+)?)(?:(?<short>[pcf])| ?(?<unit>kcal|cal|大卡))(?![\p{L}\p{N}])/giv;
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
		const field = macroOf[(groups?.short ?? groups?.unit ?? "").toLowerCase()];

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

// A bare number up to 24 is hours, and a larger one is minutes.
const sleepMinutesOf = (text: string) =>
	/^\d+(?:\.\d+)?$/v.test(text)
		? Number(text) * (Number(text) <= 24 ? 60 : 1)
		: minutesOf(text);

// "sl 23:30-7:10 q4" stamps the wake time; "sl 7.5h q3" woke up just now.
const sleep: Parser = (text, at, { now }) => {
	const [span = "", ...rest] = text.split(" ");
	const scores = rest.map(
		(token) => /^q(?<score>[1-5])$/iv.exec(token)?.groups?.score,
	);
	const { minutes, wakeAt } = spanOf(span, at, now) ?? {
		minutes: sleepMinutesOf(span),
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

export const keyOf = (name: string) => name.normalize("NFKC").toLowerCase();

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
	sleep: ["sleep", sleepMinutesOf, 240, 720],
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
		// The words as typed name the exercise when sets follow.
		return {
			activity: activity.value,
			name: text.slice(0, text.length - activity.rest.length).trim(),
			rest: activity.rest,
		};
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
				.toSorted(byTime)
				.findLast((logged) =>
					logged.sets?.some((set) => set.exercise === exercise),
				)
				?.sets?.filter((set) => set.exercise === exercise)
				.map((set) => ({ ...set })) ?? []);
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

// An entry as the draft that would log it again.
export function draftOf(log: Logged): Draft | undefined {
	switch (log.kind) {
		case "meal": {
			return {
				...log.entry,
				kind: "meal",
				servings: log.entry.servings ?? 1,
				isKnown: true,
			};
		}

		case "workout": {
			return { ...log.entry, kind: "workout" };
		}

		case "water": {
			return { ...log.entry, kind: "water" };
		}

		case "sleep": {
			return { ...log.entry, kind: "sleep" };
		}

		case "body": {
			return { ...log.entry, kind: "body" };
		}

		case "mood": {
			return { ...log.entry, kind: "mood" };
		}

		case "habit": {
			return { ...log.entry, kind: "habit" };
		}

		case "steps": {
			return { ...log.entry, kind: "steps" };
		}

		case "note": {
			return { ...log.entry, kind: "note" };
		}

		case "focus":
		case "event": {
			return undefined;
		}
	}
}

// "." logs the last line again, every item of it, stamped now.
const repeat: Parser = (_text, at, { progress }) => {
	const logs = logsOf(progress).filter(
		(log) => log.kind !== "event" && log.kind !== "focus",
	);
	const last = logs[0]?.at;
	const drafts = logs
		.filter((log) => log.at === last)
		.flatMap((log) => draftOf(log) ?? [])
		.map((draft) => ({ ...draft, at: iso(at) }));

	return drafts.length > 0 ? parsed(...drafts) : failed("nothingToRepeat");
};

// "copy y" logs yesterday's meals again today, each at the same time.
const copy: Parser = (text, _at, { progress, now }) => {
	const yesterday = new Date(now);
	yesterday.setDate(yesterday.getDate() - 1);
	const drafts = progress.meals
		.filter(
			(meal) => new Date(meal.at).toDateString() === yesterday.toDateString(),
		)
		.toSorted(byTime)
		.map((meal): Draft => {
			const today = new Date(meal.at);
			today.setDate(today.getDate() + 1);
			return {
				...meal,
				kind: "meal",
				at: today.toISOString(),
				servings: meal.servings ?? 1,
				isKnown: true,
			};
		});

	if (text.toLowerCase() !== "y") {
		return failed("badTime");
	}

	return drafts.length > 0 ? parsed(...drafts) : failed("nothingToCopy");
};

export type Added = Readonly<{ kind: LogKind; index: number }>;

// The entry a draft saves: a meal drops its flag, and 1 serving goes unsaid.
function entryOf(draft: Exclude<Draft, GoalDraft>): Logged {
	const index = -1;

	switch (draft.kind) {
		case "meal": {
			const { kind, isKnown, servings, ...meal } = draft;
			return {
				kind,
				at: draft.at,
				index,
				entry: { ...meal, ...(servings === 1 ? {} : { servings }) },
			};
		}

		case "workout": {
			const { kind, ...entry } = draft;
			return { kind, at: draft.at, index, entry };
		}

		case "water": {
			const { kind, ...entry } = draft;
			return { kind, at: draft.at, index, entry };
		}

		case "sleep": {
			const { kind, ...entry } = draft;
			return { kind, at: draft.at, index, entry };
		}

		case "body": {
			const { kind, ...entry } = draft;
			return { kind, at: draft.at, index, entry };
		}

		case "mood": {
			const { kind, ...entry } = draft;
			return { kind, at: draft.at, index, entry };
		}

		case "habit": {
			const { kind, ...entry } = draft;
			return { kind, at: draft.at, index, entry };
		}

		case "steps": {
			const { kind, ...entry } = draft;
			return { kind, at: draft.at, index, entry };
		}

		case "note": {
			const { kind, ...entry } = draft;
			return { kind, at: draft.at, index, entry };
		}
	}
}

// Appends every draft and says where each entry landed, so undo can find it;
// a goal changes the goals instead.
export function applyDrafts(
	progress: Progress,
	drafts: readonly Draft[],
): { next: Progress; added: Added[] } {
	let next = progress;
	const added: Added[] = [];

	for (const draft of drafts) {
		if (draft.kind === "goal") {
			next = { ...next, goals: { ...next.goals, [draft.goal]: draft.value } };
			continue;
		}

		const { kind, entry } = entryOf(draft);
		const field = fieldOf[kind];
		added.push({ kind, index: next[field].length });
		next = { ...next, [field]: [...next[field], entry] };
	}

	return { next, added };
}

// Removes the entries a line added, or any others by kind and index.
export function undoAdded(
	progress: Progress,
	added: readonly Added[],
): Progress {
	let next = progress;

	for (const kind of logKinds) {
		const indexes = new Set(
			added.filter((item) => item.kind === kind).map((item) => item.index),
		);
		const field = fieldOf[kind];

		if (indexes.size > 0) {
			next = {
				...next,
				[field]: next[field].filter((_, index) => !indexes.has(index)),
			};
		}
	}

	return next;
}

// Puts a deleted entry back where it was.
export function restoreLog(progress: Progress, log: Logged): Progress {
	const field = fieldOf[log.kind];
	const entries = progress[field];

	return {
		...progress,
		[field]: [
			...entries.slice(0, log.index),
			log.entry,
			...entries.slice(log.index),
		],
	};
}

const plain = (value: number) => String(Math.round(value * 10) / 10);

const isActivity = (activity: string): activity is WorkoutActivity =>
	(workoutActivities as readonly string[]).includes(activity);

// An entry as the line that logs it, in the given language, without its time:
// editing parses it again at the entry's own time.
export function lineOf(log: Logged, language: Language): string {
	const messages = messagesOf(language);
	const words = (...parts: Array<string | false | undefined>) =>
		parts.filter(Boolean).join(" ");
	const optional = <Value>(
		value: Value | undefined,
		text: (value: Value) => string,
	) => value !== undefined && text(value);

	switch (log.kind) {
		case "meal": {
			// The serving count leads, so no food name reads as something else.
			// ponytail: a comma in a food name splits it on parsing, and the grammar has no escape, so such a meal edits as 2 items.
			const { food, servings, calories, protein, carbs, fat } = log.entry;
			const count = String(Math.round((servings ?? 1) * 100) / 100);
			const plainly = `${count} ${food}`;
			return words(
				leadingQuantity.exec(plainly)?.groups?.food === food
					? plainly
					: `${count} x ${food}`,
				optional(calories, (value) => `${plain(value)}kcal`),
				optional(protein, (value) => `${plain(value)}p`),
				optional(carbs, (value) => `${plain(value)}c`),
				optional(fat, (value) => `${plain(value)}f`),
			);
		}

		case "workout": {
			const { activity, minutes, intensity, distance, sets } = log.entry;
			const groups = setGroupsOf(sets);
			const name = groups[0]
				? exerciseName(groups[0].exercise, language)
				: isActivity(activity)
					? messages.workoutActivity[activity]
					: activity;
			return words(
				"wo",
				name,
				...groups.map(
					(group) =>
						`${plain(group.weight)}x${group.reps}${group.count > 1 ? `x${group.count}` : ""}`,
				),
				`${plain(minutes)}m`,
				optional(intensity, (value) => messages.intensity[value]),
				optional(distance, (value) => `${plain(value)}km`),
			);
		}

		case "water": {
			return `w ${plain(log.entry.milliliters)}`;
		}

		case "sleep": {
			return words(
				"sl",
				`${log.entry.minutes}m`,
				optional(log.entry.quality, (value) => `q${value}`),
			);
		}

		case "body": {
			const { weight, waist, bodyFat } = log.entry;
			return words(
				optional(weight, (value) => `wt ${plain(value)}`),
				optional(waist, (value) => `waist ${plain(value)}`),
				optional(bodyFat, (value) => `bf ${plain(value)}`),
			);
		}

		case "mood": {
			const { score, energy, stress, tags = [] } = log.entry;
			return words(
				"m",
				String(score),
				optional(energy, (value) => `e${value}`),
				optional(stress, (value) => `s${value}`),
				...tags.map((tag) => `#${tag}`),
			);
		}

		case "habit": {
			const { name, amount, skipped } = log.entry;
			return words("h", name, optional(amount, plain), skipped && "s");
		}

		case "steps": {
			return `st ${log.entry.count}`;
		}

		case "note": {
			return `n ${log.entry.text}`;
		}

		case "focus":
		case "event": {
			return "";
		}
	}
}

// Whether an entry's line parses back to exactly that 1 entry: a food with a
// comma or a workout of 2 exercises would come back as 2, and editing it
// would then replace 1 entry with 2.
export function isEditable(
	log: Logged,
	progress: Progress,
	language: Language,
): boolean {
	if (
		log.kind === "workout" &&
		new Set(log.entry.sets?.map((set) => set.exercise)).size > 1
	) {
		return false;
	}

	const result = parseQuickLog(lineOf(log, language), {
		progress,
		now: Date.parse(log.at),
		language,
	});

	return (
		result.ok &&
		result.drafts.length === 1 &&
		result.drafts[0]?.kind === log.kind
	);
}

// What a draft will log, for the live preview: a meal nobody knows says how
// to give it kcal.
export function describeDraft(
	draft: Draft,
	messages: Messages,
	language: Language,
): string {
	if (draft.kind === "goal") {
		return goalText(draft.goal, draft.value, messages);
	}

	return draft.kind === "meal" && !draft.isKnown
		? messages.log.unknownFood(draft.food)
		: describeLog(entryOf(draft), language, messages);
}

function nameOf(draft: Draft, messages: Messages) {
	if (draft.kind === "meal") {
		return draft.servings === 1
			? draft.food
			: `${plain(draft.servings)} ${draft.food}`;
	}

	return draft.kind === "goal"
		? messages.log.goals[draft.goal]
		: messages.logs.kinds[draft.kind];
}

// The short names of what a line logged, for the footer.
export const summaryOf = (drafts: readonly Draft[], messages: Messages) =>
	drafts.map((draft) => nameOf(draft, messages)).join(", ");

export type Suggestion = Readonly<{ line: string; label: string }>;

const minuteOfDay = (at: number) => {
	const date = new Date(at);
	return date.getHours() * 60 + date.getMinutes();
};

// Within 90 minutes of now on the clock, on any day, across midnight too.
const isNearNow = (at: string, now: number) => {
	const gap = Math.abs(minuteOfDay(Date.parse(at)) - minuteOfDay(now));
	return Math.min(gap, 1440 - gap) <= 90;
};

const daysBefore = (now: number, days: number) => {
	const date = new Date(now);
	date.setDate(date.getDate() - days);
	return date.toDateString();
};

// A meal as the line that logs it again, without its nutrients: a lone
// serving drops its count when the food reads the same without it.
function mealLineOf(meal: EntryOf["meal"], language: Language) {
	const { calories, protein, carbs, fat, ...rest } = meal;
	const line = lineOf(
		{ kind: "meal", at: meal.at, index: 0, entry: rest },
		language,
	);
	const bare = line.replace(/^1 (?!x )/v, "");
	return leadingQuantity.test(bare) ? line : bare;
}

// The foods eaten around this time of day, most often first, then most
// recent: MacroFactor's "hourly go-to". Today's foods are already logged.
function usualFoodsOf(progress: Progress, now: number, language: Language) {
	const today = new Date(now).toDateString();
	const eatenToday = new Set(
		progress.meals
			.filter((meal) => new Date(meal.at).toDateString() === today)
			.map((meal) => keyOf(meal.food)),
	);
	const usual = new Map<
		string,
		{ meal: EntryOf["meal"]; count: number; last: number }
	>();

	for (const meal of progress.meals) {
		const key = keyOf(meal.food);
		const at = Date.parse(meal.at);
		const seen = usual.get(key);

		if (!eatenToday.has(key) && isNearNow(meal.at, now)) {
			usual.set(key, {
				meal: seen && seen.last > at ? seen.meal : meal,
				count: (seen?.count ?? 0) + 1,
				last: Math.max(seen?.last ?? 0, at),
			});
		}
	}

	return [...usual.values()]
		.toSorted(
			(left, right) => right.count - left.count || right.last - left.last,
		)
		.map(({ meal }) => mealLineOf(meal, language));
}

// Lines worth logging now, each logged as is with Enter: the usual foods of
// this hour, water when behind its pace from 7:00 to 22:00, the workout of
// this weekday last week, and habits done on 3 of the last 7 days.
export function suggestionsOf(
	progress: Progress,
	now: number,
	limit = 5,
): Suggestion[] {
	const language = progress.language ?? "en";
	const { log } = messagesOf(language);
	const today = todayOf(progress, now);
	const isOn = (at: string, day: string) => new Date(at).toDateString() === day;
	const foods = usualFoodsOf(progress, now, language).map((line) => ({
		line,
		label: log.reasons.usual,
	}));
	const { water } = targetsOf(profileNow(progress), progress.goals);
	const pace =
		water * Math.min(Math.max((minuteOfDay(now) - 7 * 60) / (15 * 60), 0), 1);
	// The workout the latest plan names for this weekday.
	const planned = progress.plans
		.at(-1)
		?.days.find((day) => day.weekday === new Date(now).getDay());
	const lastWeek = progress.workouts.findLast((workout) =>
		isOn(workout.at, daysBefore(now, 7)),
	);
	const workedOut = progress.workouts.some((workout) =>
		isOn(workout.at, daysBefore(now, 0)),
	);
	const habits = Map.groupBy(
		progress.habits.filter(
			(habit) =>
				!habit.skipped &&
				[1, 2, 3, 4, 5, 6, 7].some((days) =>
					isOn(habit.at, daysBefore(now, days)),
				),
		),
		(habit) => keyOf(habit.name),
	);
	const habitsToday = new Set(
		progress.habits
			.filter((habit) => isOn(habit.at, daysBefore(now, 0)))
			.map((habit) => keyOf(habit.name)),
	);
	const usualHabits = [...habits].flatMap(([key, done]) => {
		const days = new Set(done.map((habit) => new Date(habit.at).toDateString()))
			.size;
		return days >= 3 && !habitsToday.has(key)
			? [
					{
						line: `h ${done.at(-1)?.name ?? key}`,
						label: log.reasons.habit(days),
					},
				]
			: [];
	});

	return [
		...foods.slice(0, 2),
		...(today.water < pace ? [{ line: "w", label: log.reasons.water }] : []),
		...(planned && !workedOut
			? [
					{
						line: lineOf(
							{
								kind: "workout",
								at: new Date(now).toISOString(),
								index: 0,
								entry: { at: new Date(now).toISOString(), ...planned },
							},
							language,
						),
						label: log.reasons.plan,
					},
				]
			: []),
		...(lastWeek && !workedOut
			? [
					{
						line: lineOf(
							{ kind: "workout", at: lastWeek.at, index: 0, entry: lastWeek },
							language,
						),
						label: log.reasons.workout,
					},
				]
			: []),
		...usualHabits,
		...foods.slice(2),
	].slice(0, limit);
}

const leadingCount = new RegExp(
	String.raw`^ *(?:(?:${quantity}) ?(?:${counter}|${englishCounter}|[x×](?= ))? ?)?`,
	"v",
);

// The food name being typed at the end of a meal line, and everything before
// it, so a picked name can replace just that; nothing on a prefixed line.
export function completionOf(
	text: string,
): Readonly<{ head: string; query: string }> | undefined {
	const time = /^@\S+(?: \d{1,2}:\d{2})?(?: |$)/v.exec(text)?.[0] ?? "";
	const word = text.slice(time.length).split(" ")[0]?.toLowerCase() ?? "";

	if (Object.hasOwn(parsers, word)) {
		return undefined;
	}

	const start = Math.max(
		time.length,
		...[",", "+", "、", "，"].map((mark) => text.lastIndexOf(mark) + 1),
	);
	const item = text.slice(start);
	const count = leadingCount.exec(item)?.[0] ?? "";

	return {
		head: text.slice(0, start + count.length),
		query: item.slice(count.length),
	};
}

// The prefix of a line picks its parser; a line without 1 is a meal.
// The line with an estimate for 1 serving of a food it named, written as
// totals for every serving, so Enter logs it as typed amounts. Undefined when
// the line does not spell the food the way the parser read it (double spaces).
export function withEstimate(
	line: string,
	draft: MealDraft,
	estimate: Readonly<{
		calories: number;
		protein: number;
		carbs: number;
		fat: number;
	}>,
): string | undefined {
	const text = line.normalize("NFKC");
	const at = text.lastIndexOf(draft.food);
	const total = (value: number) => plain(value * draft.servings);

	if (at === -1) {
		return undefined;
	}

	return [
		text.slice(0, at),
		`${draft.food} ${Math.round(estimate.calories * draft.servings)}kcal ${total(estimate.protein)}p ${total(estimate.carbs)}c ${total(estimate.fat)}f`,
		text.slice(at + draft.food.length),
	].join("");
}

const parsers: Partial<Record<string, Parser>> = {
	w: water,
	water,
	水: water,
	물: water,
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
	// Prefixes are what people type, not identifiers.
	// eslint-disable-next-line @typescript-eslint/naming-convention
	".": repeat,
	copy,
};
