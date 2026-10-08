import { matchFood } from "./foods.js";
import { type Language, messagesOf } from "./i18n.js";
import type { EntryOf, Goals, Progress } from "./progress.js";

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
		return Number(fraction.groups.top) / Number(fraction.groups.bottom);
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
		/^@(?<day>y|-\d+d)? ?(?:(?<hour>\d{1,2}):(?<minute>\d{2}))?(?: |$)/v.exec(
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
	const parser = parsers[word.toLowerCase()];

	return parser
		? parser(words.join(" "), timed.at, context, word.toLowerCase())
		: mealsOf(timed.rest, timed.at, context);
}

const iso = (at: number) => new Date(at).toISOString();

// Words that may follow a quantity, as in "2個", "1 碗", "2개", or "1 공기".
const counter = String.raw`공기|그릇|인분|조각|마리|[個颗顆杯碗片份塊條根盤隻개잔장병캔]`;
const quantity = String.raw`\d+[\/⁄]\d+|\d+(?:\.\d+)?`;
const leadingQuantity = new RegExp(
	String.raw`^(?<amount>${quantity}) ?(?:${counter}|[x×](?= ))? ?(?<food>.+)$`,
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

// The prefix of a line picks its parser; a line without 1 is a meal.
const parsers: Partial<Record<string, Parser>> = {};
