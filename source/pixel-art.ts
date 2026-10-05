import type { Gender, HealthGoal, Mood, WorkStyle } from "./i18n.js";
import type { Palette } from "./theme.js";

// The character stands on a stage as wide as its panel and 40 pixels tall.
// Each terminal cell draws 2 stacked pixels with "▀", foreground for the top
// and background for the bottom, so the stage takes 20 rows.
export const stageHeight = 40;

// 10 frames a second; slower motions hold a pose for several frames.
export const frameMilliseconds = 100;

export type Activity =
	| "idle"
	| "focus"
	| "break"
	| "eat"
	| "run"
	| "lift"
	| "stretch"
	| "levelUp";

export type Build = "slim" | "athletic" | "average" | "stocky" | "heavy";
export type Hair = "dark" | "grey" | "white";

// What the profile decides: the height in pixels, the body shape, the
// clothes for the work style, and the hair for the age.
export type Look = Readonly<{
	height: number;
	build: Build;
	gender: Gender;
	style: WorkStyle;
	hair: Hair;
	isMuscular: boolean;
}>;

export const defaultLook: Look = {
	height: 29,
	build: "average",
	gender: "other",
	style: "desk",
	hair: "dark",
	isMuscular: false,
};

type Profile = Readonly<{
	age: number;
	height: number;
	weight: number;
	bodyFat?: number;
	gender: Gender;
	workStyle: WorkStyle;
	goal: HealthGoal;
}>;

// Body fat that counts as lean, soft, and heavy, by gender.
const fatBands: Record<Gender, readonly [number, number, number]> = {
	female: [21, 32, 38],
	male: [13, 22, 28],
	other: [17, 27, 33],
};

// Body fat tells muscle from fat at the same weight; without it, BMI decides.
function buildOf(profile: Profile): Build {
	const bmi = profile.weight / (profile.height / 100) ** 2;

	if (profile.bodyFat === undefined) {
		if (bmi < 19.5) {
			return "slim";
		}

		if (bmi >= 30) {
			return "heavy";
		}

		return bmi >= 25 ? "stocky" : "average";
	}

	const [lean, soft, heavy] = fatBands[profile.gender];

	if (profile.bodyFat < lean) {
		return bmi >= 23 ? "athletic" : "slim";
	}

	if (profile.bodyFat >= heavy) {
		return "heavy";
	}

	return profile.bodyFat >= soft ? "stocky" : "average";
}

// 145 cm draws 26 pixels tall and 205 cm 34.
export function lookOf(profile: Profile | undefined): Look {
	if (!profile) {
		return defaultLook;
	}

	const build = buildOf(profile);
	let hair: Hair = "dark";

	if (profile.age >= 70) {
		hair = "white";
	} else if (profile.age >= 55) {
		hair = "grey";
	}

	return {
		height: Math.min(
			Math.max(Math.round(26 + (profile.height - 145) / 7.5), 24),
			35,
		),
		build,
		gender: profile.gender,
		style: profile.workStyle,
		hair,
		isMuscular: build === "athletic" || profile.goal === "buildMuscle",
	};
}

// Each equipment slot upgrades once from level 2 and again 4 levels later,
// staggered so every level from 2 to 9 changes exactly 1 piece.
export const gearOf = (level: number) => {
	const tier = (slot: number) =>
		Math.min(Math.max(Math.floor((level - 2 - slot) / 4) + 1, 0), 2);

	return { gadget: tier(0), wear: tier(1), headwear: tier(2), carry: tier(3) };
};

type Gear = ReturnType<typeof gearOf>;
type Point = readonly [number, number];
type Put = (x: number, y: number, key: string) => void;

// Rows from the ground up, and half widths around the center column x = 0.
type Body = Readonly<{
	hip: number;
	shoulder: number;
	chin: number;
	top: number;
	legs: number;
	knee: number;
	shin: number;
	chest: number;
	waist: number;
	hips: number;
	thigh: number;
	calf: number;
	ankle: number;
	arm: number;
	reach: number;
}>;

// The feet stand on row 2, in the middle of their shadow.
const ground = 2;

const frames: Record<Gender, readonly [number, number, number]> = {
	female: [4, 3, 5],
	male: [5, 4, 4],
	other: [4, 4, 4],
};

// A 7-row head and a neck take 8 of the height; legs take 55% of the rest.
function bodyOf(look: Look): Body {
	const span = look.height - 8;
	const legs = Math.round(span * 0.55);
	const torso = span - legs;
	let [chest, waist, hips] = frames[look.gender];

	switch (look.build) {
		case "slim": {
			chest -= look.gender === "male" ? 1 : 0;
			waist = Math.max(waist - 1, 2);
			hips = Math.max(hips - 1, 3);
			break;
		}

		case "athletic": {
			chest += 1;
			break;
		}

		case "stocky": {
			waist += 1;
			hips += 1;
			break;
		}

		case "heavy": {
			chest += 1;
			waist += 3;
			hips += 2;
			break;
		}

		case "average": {
			break;
		}
	}

	if (look.isMuscular && look.build !== "athletic") {
		chest += 1;
	}

	let thigh = Math.max(hips - 1, 3);

	if (look.build === "heavy") {
		thigh = hips;
	} else if (look.build === "slim") {
		thigh = Math.max(hips - 1, 2);
	}

	const hip = ground + legs;
	const shoulder = hip + torso - 1;
	const chin = shoulder + 2;

	return {
		hip,
		shoulder,
		chin,
		top: chin + 6,
		legs,
		knee: ground + Math.floor(legs / 2),
		shin: ground + Math.floor(legs / 4),
		chest,
		waist,
		hips,
		thigh,
		calf: Math.max(thigh - 1, 2),
		ankle: Math.max(thigh - 2, 2),
		arm: look.isMuscular || look.build === "heavy" ? 3 : 2,
		reach: torso + 3,
	};
}

// Facing the viewer: hands are absolute points in the body's coordinates.
type Front = Readonly<{
	view: "front";
	hands?: readonly [Point | undefined, Point | undefined];
	step?: number;
	bob?: number;
	nod?: number;
	turn?: number;
	eyes?: "open" | "closed";
	mouth?: "smile" | "open";
}>;

// In profile, walking or running toward +x.
type Side = Readonly<{
	view: "side";
	frame: number;
	gait: "walk" | "run";
	mouth?: "smile";
}>;

type Pose = Front | Side;

// Props stay planted with `put`, or follow the breathing with `upper`.
type Draw = (put: Put, upper: Put, b: Body) => void;

type Scene = Readonly<{
	x: number;
	facing: 1 | -1;
	lift: number;
	pose: (b: Body) => Pose;
	props?: Draw[];
}>;

const span = (put: Put, from: number, to: number, y: number, key: string) => {
	for (let x = Math.min(from, to); x <= Math.max(from, to); x++) {
		put(x, y, key);
	}
};

const pointsOf = ([x0, y0]: Point, [x1, y1]: Point): Point[] => {
	const points: Point[] = [];
	const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);

	for (let step = 0; step <= steps; step++) {
		points.push([
			Math.round(x0 + ((x1 - x0) * step) / steps),
			Math.round(y0 + ((y1 - y0) * step) / steps),
		]);
	}

	return points;
};

// Where a hand rests with the arm hanging, nudged by `swing`.
const hanging = (b: Body, side: number, swing = 0): Point => [
	side * (b.chest + 1),
	b.shoulder - b.reach + 1 + swing,
];

const breathing = (t: number, every = 6) => Math.floor(t / every) % 2;

// The stage edges the character walks between.
const marginOf = (width: number) => {
	const minimum = 9;
	return { minimum, maximum: Math.max(width - 10, minimum + 1) };
};

export const homeOf = (width: number) => Math.floor(width / 2);

// Walks a path of stops at `speed` pixels a tick, returning the position
// and heading at tick `t`, or undefined once the path is done.
function along(stops: readonly number[], speed: number, t: number) {
	let remaining = t;

	for (let index = 1; index < stops.length; index++) {
		const from = stops[index - 1] ?? 0;
		const to = stops[index] ?? 0;
		const ticks = Math.ceil(Math.abs(to - from) / speed);

		if (remaining < ticks) {
			const facing: 1 | -1 = to >= from ? 1 : -1;
			return {
				x: from + facing * Math.min(remaining * speed, Math.abs(to - from)),
				facing,
			};
		}

		remaining -= ticks;
	}

	return undefined;
}

const pathTicks = (stops: readonly number[], speed: number) =>
	stops
		.slice(1)
		.reduce(
			(total, stop, index) =>
				total + Math.ceil(Math.abs(stop - (stops[index] ?? 0)) / speed),
			0,
		);

const pause = 24;

// Idle: pause, walk to 1 edge, pause, walk to the other, pause, walk home.
function wanderAt(t: number, width: number, anchor: number) {
	const { minimum, maximum } = marginOf(width);
	const legs = [
		[anchor, maximum],
		[maximum, minimum],
		[minimum, anchor],
	] as const;
	let remaining = t;

	for (const [from, to] of legs) {
		if (remaining < pause) {
			return { x: from, facing: 1 as const, resting: remaining };
		}

		remaining -= pause;
		const walked = along([from, to], 1, remaining);

		if (walked) {
			return { ...walked, walking: remaining };
		}

		remaining -= Math.abs(to - from);
	}

	return { x: anchor, facing: 1 as const, resting: 0 };
}

const runStops = (width: number, anchor: number) => {
	const { minimum, maximum } = marginOf(width);
	return [anchor, maximum, minimum, anchor];
};

const cycles: Record<Exclude<Activity, "idle" | "run">, number> = {
	focus: 16,
	break: 40,
	eat: 32,
	lift: 32,
	stretch: 40,
	levelUp: 16,
};

// How many ticks one loop of an activity takes.
export function cycleOf(
	activity: Activity,
	width: number,
	anchor = homeOf(width),
	mood: Mood = "content",
): number {
	if (activity === "idle") {
		const { minimum, maximum } = marginOf(width);
		return mood === "sleepy" ? 48 : 3 * pause + 2 * (maximum - minimum);
	}

	if (activity === "run") {
		return pathTicks(runStops(width, anchor), 2);
	}

	return cycles[activity];
}

const smileOf = (mood: Mood) => (mood === "happy" ? "smile" : undefined);

// A standing desk at the waist, with the laptop's lid facing out.
const desk: Draw = (put, _upper, b) => {
	const top = b.hip + 1;
	span(put, -9, 9, top, "L");
	span(put, -9, 9, top - 1, "x");

	for (let y = 0; y < top - 1; y++) {
		put(-8, y, "x");
		put(8, y, "x");
	}

	for (let y = top + 1; y <= top + 4; y++) {
		span(put, -3, 3, y, "d");
	}

	span(put, -3, 3, top + 1, "D");
	put(0, top + 3, "l");
};

const mug =
	([x, y]: Point, steam?: number): Draw =>
	(_put, upper) => {
		span(upper, x, x + 2, y, "Q");
		span(upper, x, x + 2, y + 1, "Q");
		span(upper, x, x + 2, y + 2, "U");
		upper(x + 1, y + 2, "o");
		upper(x + 3, y + 1, "Q");

		if (steam !== undefined) {
			const sway = Math.floor(steam / 3) % 2;
			upper(x + sway, y + 4, "v");
			upper(x + 1 - sway, y + 5, "v");
			upper(x + 2 - sway, y + 6, "v");
		}
	};

const apple =
	([x, y]: Point, isBitten: boolean): Draw =>
	(_put, upper) => {
		span(upper, x, x + 2, y, "F");
		span(upper, x, x + 2, y + 1, "F");
		span(upper, x, x + 1, y + 2, "F");
		upper(x + 2, y + 2, isBitten ? "w" : "F");
		upper(x, y + 1, "T");
		upper(x + 1, y + 3, "G");
		upper(x + 2, y + 4, "G");
	};

const barbell =
	(y: number): Draw =>
	(_put, upper, b) => {
		const end = b.chest + 7;
		span(upper, -end, end, y, "d");

		for (const x of [-end, -end + 1, end - 1, end]) {
			for (let dy = -2; dy <= 2; dy++) {
				upper(x, y + dy, Math.abs(x) === end ? "D" : "d");
			}
		}
	};

const sparkles =
	(t: number): Draw =>
	(put, _upper, b) => {
		const points: Point[] =
			t % 4 < 2
				? [
						[-9, b.top],
						[9, b.top + 3],
						[-11, b.shoulder],
						[11, b.shoulder - 3],
						[0, b.top + 5],
					]
				: [
						[-10, b.top + 3],
						[10, b.top],
						[-9, b.shoulder - 3],
						[9, b.shoulder],
						[-3, b.top + 4],
					];

		for (const [x, y] of points) {
			put(x, y, "y");
			put(x - 1, y, "y");
			put(x + 1, y, "y");
			put(x, y - 1, "y");
			put(x, y + 1, "y");
		}
	};

const sleepyZ =
	(t: number): Draw =>
	(put, _upper, b) => {
		const rise = Math.floor((t % 24) / 3);
		const rows = ["ZZZZ", "..Z.", ".Z..", "ZZZZ"];

		for (const [offset, row] of rows.entries()) {
			for (const [index, key] of [...row].entries()) {
				put(4 + (rise % 2) + index, b.top + 1 + rise - offset, key);
			}
		}
	};

// Standing still between walks: breathing, blinking, looking about, shaking
// out the hands, and waving when every target is met.
const resting =
	(t: number, mood: Mood): Scene["pose"] =>
	(b) => {
		let turn = 0;

		if (t >= 8 && t < 12) {
			turn = -1;
		} else if (t >= 12 && t < 16) {
			turn = 1;
		}

		const isWaving = mood === "happy" && t >= 2 && t < 14;
		const isShaking = t >= 16 && t < 22;
		const shake = isShaking ? t % 2 : 0;
		let hands: Front["hands"] = [
			hanging(b, -1, shake),
			hanging(b, 1, isShaking ? 1 - shake : 0),
		];

		if (isWaving) {
			hands = [
				hanging(b, -1),
				[b.chest + 3 + (Math.floor(t / 2) % 2), b.top - 1],
			];
		}

		return {
			view: "front",
			mouth: smileOf(mood),
			bob: breathing(t),
			eyes: t === 5 || t === 6 ? "closed" : "open",
			turn,
			hands,
		};
	};

// Where the character stands and what it does on tick `t` of an activity
// that began at `anchor`. Every loop starts and ends at the anchor.
function sceneOf(
	activity: Activity,
	t: number,
	width: number,
	mood: Mood,
	anchor: number,
): Scene {
	const cycle = cycleOf(activity, width, anchor, mood);
	const at = t % cycle;
	const mouth = smileOf(mood);
	const still = (pose: Scene["pose"], props?: Draw[], lift = 0): Scene => ({
		x: anchor,
		facing: 1,
		lift,
		pose,
		props,
	});

	if (activity === "idle" && mood === "sleepy") {
		// Dozing on its feet: nodding off, yawning, with Zs drifting up.
		const isYawning = at >= 36 && at < 44;

		return still(
			(b) => ({
				view: "front",
				eyes: "closed",
				nod: at % 16 >= 8 ? 1 : 0,
				bob: breathing(at, 8),
				mouth: isYawning ? "open" : undefined,
				hands: isYawning ? [undefined, [2, b.chin]] : undefined,
			}),
			[sleepyZ(at)],
		);
	}

	switch (activity) {
		case "idle": {
			const place = wanderAt(at, width, anchor);

			if ("walking" in place) {
				return {
					x: place.x,
					facing: place.facing,
					lift: 0,
					pose: () => ({
						view: "side",
						frame: place.walking,
						gait: "walk",
						mouth,
					}),
				};
			}

			return {
				x: place.x,
				facing: 1,
				lift: mood === "happy" && place.resting === 1 ? 1 : 0,
				pose: resting(place.resting, mood),
			};
		}

		case "run": {
			// A lap out to 1 edge, across to the other, and back home.
			const place = along(runStops(width, anchor), 2, at) ?? {
				x: anchor,
				facing: 1 as const,
			};

			return {
				x: place.x,
				facing: place.facing,
				lift: 0,
				pose: () => ({ view: "side", frame: at, gait: "run", mouth }),
				props: [
					(put, _upper, b) => {
						put(-(b.chest + 3), b.top - 1 - (at % 2), "v");
						put(-(b.chest + 5), b.hip + (at % 3), "v");
					},
				],
			};
		}

		case "focus": {
			// Typing at a standing desk, the screen glowing.
			const key = Math.floor(at / 2) % 2;

			return still(
				(b) => ({
					view: "front",
					mouth,
					bob: breathing(at, 8),
					hands: [
						[-3, b.hip + 3 + key],
						[3, b.hip + 4 - key],
					],
				}),
				[
					desk,
					(put, _upper, b) => {
						put(-2 + (at % 5), b.top + 2 + key, "y");
					},
				],
			);
		}

		case "break": {
			// A coffee, sipped every few seconds.
			const isSipping = at >= 28;
			const hand = (b: Body): Point =>
				isSipping ? [2, b.chin] : [b.chest + 2, b.hip + 2];

			return still(
				(b) => ({
					view: "front",
					mouth,
					bob: breathing(at, isSipping ? 2 : 6),
					eyes: isSipping ? "closed" : "open",
					hands: [undefined, hand(b)],
				}),
				[
					(put, upper, b) => {
						const [x, y] = hand(b);
						mug([x, y + 1], isSipping ? undefined : at)(put, upper, b);
					},
				],
			);
		}

		case "eat": {
			// Raise the apple, take a bite, chew, and lower it.
			const isRaised = at >= 12 && at < 24;
			const isChewing = at >= 16 && at < 24;
			const hand = (b: Body): Point =>
				isRaised ? [2, b.chin - 1] : [b.chest + 2, b.hip + 3];

			return still(
				(b) => ({
					view: "front",
					bob: breathing(at, 4),
					mouth: isChewing && at % 2 === 0 ? "open" : mouth,
					hands: [undefined, hand(b)],
				}),
				[
					(put, upper, b) => {
						const [x, y] = hand(b);
						apple([x, y], at >= 18)(put, upper, b);
					},
				],
			);
		}

		case "lift": {
			// An overhead press: rack, press, lock out, lower, rest.
			const height = (b: Body) => {
				const rack = b.shoulder;
				const lockout = b.top + 2;

				if (at < 8 || at >= 28) {
					return rack;
				}

				if (at < 12) {
					return rack + Math.round(((lockout - rack) * (at - 7)) / 4);
				}

				if (at < 20) {
					return lockout;
				}

				return lockout - Math.round(((lockout - rack) * (at - 19)) / 8);
			};

			return still(
				(b) => {
					const y = height(b);
					const isLocked = at >= 12 && at < 20;
					const x = isLocked ? b.chest + 1 : b.chest + 3;
					return {
						view: "front",
						mouth,
						bob: breathing(at, isLocked ? 2 : 4),
						hands: [
							[-x, y],
							[x, y],
						],
					};
				},
				[
					(put, upper, b) => {
						barbell(height(b) + 1)(put, upper, b);
					},
				],
			);
		}

		case "stretch": {
			// Reach up, rise on the toes, open the arms wide, shake them out.
			const phase = Math.floor(at / 10);

			return still(
				(b) => {
					const reaches: Point[] = [
						[1, b.top + 3],
						[1, b.top + 4],
						[b.chest + 8, b.shoulder + 1],
						[b.chest + 1, b.shoulder - b.reach + 1 + (at % 2)],
					];
					const [x, y] = reaches[phase] ?? [1, b.top + 3];
					return {
						view: "front",
						mouth,
						bob: breathing(at, 5),
						eyes: phase === 1 ? "closed" : "open",
						hands: [
							[-x, phase === 3 ? y + 1 - (at % 2) : y],
							[x, y],
						],
					};
				},
				undefined,
				phase === 1 ? 1 : 0,
			);
		}

		case "levelUp": {
			// Crouch, jump with both arms up, land, with sparkles.
			const lift = [0, 0, 0, 1, 2, 3, 4, 4, 3, 2, 1, 0, 0, 0, 0, 0][at] ?? 0;

			return still(
				(b) => ({
					view: "front",
					mouth: "smile",
					bob: at < 3 || at > 11 ? 1 : 0,
					hands: [
						[-(b.chest + 4), b.top + 1],
						[b.chest + 4, b.top + 1],
					],
				}),
				[sparkles(at)],
				lift,
			);
		}
	}
}

// Where the character is on tick `t` of an activity, to keep moving from
// there when the next one begins.
export function placeOf(
	activity: Activity,
	t: number,
	width: number,
	mood: Mood,
	anchor: number,
): Readonly<{ x: number; lift: number }> {
	const scene = sceneOf(activity, t, width, mood, anchor);
	return { x: scene.x, lift: scene.lift };
}

// The animation's state: what is playing, where it began, and for how long.
export type Motion = Readonly<{
	activity: Activity;
	mood: Mood;
	anchor: number;
	tick: number;
}>;

export const startMotion = (
	activity: Activity,
	mood: Mood,
	width: number,
): Motion => ({ activity, mood, anchor: homeOf(width), tick: 0 });

// 1 frame later. A new activity starts where the character stands: idling
// gives way at once, and anything else first finishes its loop back home, so
// the character never jumps.
export function advance(
	motion: Motion,
	wanted: Readonly<{ activity: Activity; mood: Mood }>,
	width: number,
): Motion {
	const isSame =
		wanted.activity === motion.activity && wanted.mood === motion.mood;

	if (!isSame) {
		const { x, lift } = placeOf(
			motion.activity,
			motion.tick,
			width,
			motion.mood,
			motion.anchor,
		);

		if (motion.activity === "idle" || (x === motion.anchor && lift === 0)) {
			return { ...wanted, anchor: x, tick: 0 };
		}
	}

	return { ...motion, tick: motion.tick + 1 };
}

type Paint = Readonly<{
	put: Put;
	upper: Put;
	b: Body;
	look: Look;
	gear: Gear;
	counter: number;
}>;

type Tones = Readonly<{ main: string; shade: string; light: string }>;

// The tops by work style: a hoodie, a shirt under an apron, a tee, a tank.
const topOf: Record<WorkStyle, Tones> = {
	desk: { main: "C", shade: "c", light: "E" },
	standing: { main: "Q", shade: "U", light: "w" },
	active: { main: "C", shade: "c", light: "E" },
	athlete: { main: "S", shade: "z", light: "T" },
};

// How much of the arm the sleeve covers, from the shoulder down.
const sleeveOf: Record<WorkStyle, number> = {
	desk: 1,
	standing: 0.5,
	active: 0.35,
	athlete: 0,
};

// Jeans and sneakers, chinos and shoes, cargo pants and boots, or shorts
// and running shoes.
const bottomOf: Record<
	WorkStyle,
	Tones & Readonly<{ shoe: string; sole: string; shoeRows: number }>
> = {
	desk: {
		main: "P",
		shade: "p",
		light: "R",
		shoe: "w",
		sole: "Y",
		shoeRows: 2,
	},
	standing: {
		main: "N",
		shade: "n",
		light: "N",
		shoe: "b",
		sole: "o",
		shoeRows: 2,
	},
	active: {
		main: "O",
		shade: "V",
		light: "O",
		shoe: "B",
		sole: "e",
		shoeRows: 3,
	},
	athlete: {
		main: "x",
		shade: "x",
		light: "x",
		shoe: "S",
		sole: "w",
		shoeRows: 2,
	},
};

const hairOf: Record<Hair, readonly [string, string]> = {
	dark: ["h", "i"],
	grey: ["H", "J"],
	white: ["I", "K"],
};

// An oval on the ground with the feet in its middle, shrinking in the air.
function paintShadow(put: Put, b: Body, lift: number) {
	const half = b.hips + 5 - Math.min(lift, 3);
	span(put, -half + 3, half - 3, ground - 2, "A");
	span(put, -half + 1, half - 1, ground - 1, "A");
	span(put, -half, half, ground, "A");
	span(put, -half + 2, half - 2, ground + 1, "A");
}

// Long hair falls behind the shoulders, so it goes on before the body.
function paintHairBehind({ upper, b, look, counter }: Paint, nod: number) {
	const [hair, light] = hairOf[look.hair];
	const head = (x: number, y: number, key: string) => {
		upper(x, y - nod, key);
	};

	if (look.gender === "other") {
		for (let y = b.chin + 1; y <= b.chin + 4; y++) {
			head(-4, y, hair);
			head(4, y, hair);
		}

		return;
	}

	if (look.gender !== "female") {
		return;
	}

	if (look.style === "athlete") {
		// A ponytail that swings.
		const sway = Math.floor(counter / 3) % 2;
		head(4, b.chin + 4, hair);
		head(5, b.chin + 3, hair);
		head(5 + sway, b.chin + 2, light);
		head(5 + sway, b.chin + 1, hair);
		return;
	}

	for (let y = b.shoulder - 3; y <= b.chin + 4; y++) {
		head(-4, y, hair);
		head(4, y, y % 3 === 0 ? light : hair);
	}

	for (let y = b.shoulder - 2; y < b.chin; y++) {
		span(upper, -3, 3, y, hair);
	}
}

function legKeyOf(
	look: Look,
	b: Body,
	at: Readonly<{ x: number; y: number; sole: number; width: number }>,
	side: number,
) {
	const bottom = bottomOf[look.style];
	const shorts = ground + Math.round(b.legs * 0.55);

	if (at.y < at.sole + bottom.shoeRows) {
		return at.y === at.sole ? bottom.sole : bottom.shoe;
	}

	if (look.style === "athlete" && at.y < shorts) {
		return at.y === b.knee - 1 && at.x === 2 ? "q" : "s";
	}

	if (at.x === at.width) {
		return side < 0 ? bottom.light : bottom.shade;
	}

	return at.y === at.sole + bottom.shoeRows ? bottom.shade : bottom.main;
}

function paintLegsFront({ put, b, look }: Paint, pose: Front) {
	const bottom = bottomOf[look.style];
	const shorts = ground + Math.round(b.legs * 0.55);

	for (const side of [-1, 1]) {
		const isLifted =
			(side === -1 && pose.step === 1) || (side === 1 && pose.step === 3);
		const sole = ground + (isLifted ? 1 : 0);

		for (let y = sole; y < b.hip; y++) {
			let width = b.ankle;

			if (y < sole + bottom.shoeRows) {
				width = b.ankle + 1;
			} else if (y >= b.knee) {
				width = b.thigh;
			} else if (y >= b.shin) {
				width = b.calf;
			}

			for (let x = 1; x <= width; x++) {
				put(side * x, y, legKeyOf(look, b, { x, y, sole, width }, side));
			}
		}

		if (look.style === "active") {
			put(side * b.thigh, b.knee + 1, "V");
			put(side * b.thigh, b.knee + 2, "V");
			put(side * (b.thigh - 1), b.knee + 2, "V");
		}

		if (look.style === "athlete") {
			put(side * b.thigh, shorts + 1, "S");
		}
	}

	// The thighs meet at the crotch, and all the way down on a heavy build.
	let crotch = b.hip - 2;

	if (look.build === "heavy") {
		crotch = look.style === "athlete" ? shorts : b.knee;
	}

	for (let y = crotch; y < b.hip; y++) {
		put(0, y, bottom.main);
	}
}

function paintTorsoFront({ upper, b, look, gear }: Paint) {
	const top = topOf[look.style];
	const torso = b.shoulder - b.hip + 1;
	const chestRows = Math.ceil(torso * 0.45);
	const halfAt = (y: number) => {
		if (b.shoulder - y < chestRows) {
			return b.chest;
		}

		return y - b.hip < 2 ? Math.max(b.hips, b.waist) : b.waist;
	};

	for (let y = b.hip; y < b.shoulder; y++) {
		const half = halfAt(y);
		span(upper, -half, half, y, top.main);
		upper(-half, y, top.light);
		upper(half, y, top.shade);
	}

	// The shoulder line runs out over the tops of the arms.
	const shoulderKey = look.style === "athlete" ? "s" : top.main;
	span(upper, -(b.chest + 1), b.chest + 1, b.shoulder, shoulderKey);
	span(upper, -(b.chest - 2), b.chest - 2, b.shoulder, top.main);

	if (look.build === "heavy") {
		// The belly's curve.
		span(upper, -(b.waist - 1), b.waist - 1, b.hip + 1, top.shade);
	}

	// The neck, shadowed under the chin.
	span(upper, -1, 1, b.shoulder + 1, "s");
	upper(1, b.shoulder + 1, "q");

	switch (look.style) {
		case "desk": {
			// A hoodie: the hood around the neck, drawstrings, a front pocket.
			span(upper, -3, -2, b.shoulder + 1, top.shade);
			span(upper, 2, 3, b.shoulder + 1, top.shade);
			span(upper, -2, 2, b.shoulder, top.shade);

			for (const x of [-1, 1]) {
				upper(x, b.shoulder - 1, "w");
				upper(x, b.shoulder - 2, "w");
			}

			span(upper, -3, 3, b.hip + 2, top.shade);
			span(upper, -3, 3, b.hip + 1, top.main);
			upper(-3, b.hip + 1, top.shade);
			upper(3, b.hip + 1, top.shade);
			span(upper, -(b.waist - 1), b.waist - 1, b.hip, top.shade);
			break;
		}

		case "standing": {
			// A collared shirt under an apron that hangs over the thighs.
			span(upper, -2, 2, b.shoulder, "w");
			upper(0, b.shoulder, "s");

			for (const x of [-2, 2]) {
				upper(x, b.shoulder - 1, "S");
				upper(x, b.shoulder - 2, "S");
			}

			for (let y = b.hip - 3; y <= b.shoulder - 3; y++) {
				span(upper, -b.waist, b.waist, y, "S");
				upper(b.waist, y, "z");
				upper(-b.waist, y, "T");
			}

			span(upper, -2, 2, b.hip + 1, "z");
			span(upper, -1, 1, b.hip + 2, "S");
			upper(-(b.waist + 1), b.hip + 2, "S");
			upper(b.waist + 1, b.hip + 2, "S");
			break;
		}

		case "active": {
			// A crew-neck tee with a chest pocket.
			span(upper, -1, 1, b.shoulder, top.shade);
			upper(-2, b.shoulder - 2, top.shade);
			upper(-3, b.shoulder - 2, top.shade);
			break;
		}

		case "athlete": {
			// A racerback tank with a stripe; abs show on a lean build.
			span(upper, -1, 1, b.shoulder, "s");
			span(upper, -b.chest, b.chest, b.shoulder - 3, top.shade);

			if (look.build === "athletic") {
				for (let y = b.hip + 2; y < b.shoulder - 4; y += 2) {
					upper(-1, y, top.shade);
					upper(1, y, top.shade);
				}
			}

			break;
		}
	}

	if (gear.wear === 2) {
		// An open jacket over whatever is underneath.
		for (let y = b.hip; y <= b.shoulder; y++) {
			const half = y === b.shoulder ? b.chest + 1 : halfAt(y);
			span(upper, -half, -half + 1, y, "M");
			span(upper, half - 1, half, y, "X");
		}

		upper(-2, b.shoulder, "M");
		upper(2, b.shoulder, "X");
	}

	if (gear.carry >= 1) {
		// Backpack straps over both shoulders.
		for (let y = b.shoulder - 4; y <= b.shoulder; y++) {
			upper(-(b.chest - 1), y, "B");
			upper(b.chest - 1, y, "B");
		}

		upper(-(b.chest - 1), b.shoulder - 3, "d");
		upper(b.chest - 1, b.shoulder - 3, "d");
	}

	if (gear.wear >= 1) {
		// A scarf around the neck, its end hanging down the chest.
		span(upper, -2, 2, b.shoulder + 1, "S");
		span(upper, -2, 2, b.shoulder, "z");

		for (let y = b.shoulder - 3; y < b.shoulder; y++) {
			upper(1, y, "S");
			upper(2, y, "z");
		}
	}

	if (gear.carry === 2) {
		// A gold medal on its ribbon.
		upper(-1, b.shoulder - 1, "z");
		upper(1, b.shoulder - 1, "z");
		upper(0, b.shoulder - 2, "z");
		span(upper, -1, 0, b.shoulder - 3, "g");
		span(upper, -1, 0, b.shoulder - 4, "g");
	}
}

// An arm from the shoulder to the hand, sleeved by the work style.
function paintArm(
	{ upper, b, look, gear }: Paint,
	side: number,
	hand: Point,
	depth: "far" | "level" | "near" = "level",
) {
	const isJacket = gear.wear === 2;
	const tones: Tones = isJacket
		? { main: "X", shade: "X", light: "M" }
		: topOf[look.style];
	const sleeve = isJacket ? 1 : sleeveOf[look.style];
	const joint: Point = [side * (b.chest + 1), b.shoulder - 1];
	const points = pointsOf(joint, hand);
	const covered = Math.round((points.length - 1) * sleeve);
	const isLevel = Math.abs(hand[0] - joint[0]) > Math.abs(hand[1] - joint[1]);
	const [dx, dy] = isLevel ? [0, -1] : [side, 0];
	const edgeTone = side < 0 ? tones.light : tones.shade;

	for (const [step, [x, y]] of points.entries()) {
		const isHand = step >= points.length - 2;
		const isSleeve = !isHand && (step < covered || (step === 0 && sleeve > 0));
		let width = Math.max(b.arm - 1, 2);

		if (isHand) {
			width = 2;
		} else if (step < points.length / 2) {
			width = b.arm;
		}

		let key = isSleeve ? tones.main : "s";
		let edge = isSleeve ? edgeTone : "q";

		// In profile, the far arm sinks into shadow and the near one catches
		// the light, so both read against the torso.
		if (depth === "far") {
			key = isSleeve ? tones.shade : "q";
			edge = key;
		} else if (depth === "near" && isSleeve) {
			key = tones.light;
		}

		for (let index = 0; index < width; index++) {
			upper(x + dx * index, y + dy * index, index === width - 1 ? edge : key);
		}
	}

	const wrist = points.at(-3);

	if (side === 1 && depth !== "far" && gear.gadget === 2 && wrist) {
		upper(wrist[0], wrist[1], "t");
		upper(wrist[0] + dx, wrist[1] + dy, "e");
	}
}

function paintHeadFront({ upper, b, look, gear }: Paint, pose: Front) {
	const nod = pose.nod ?? 0;
	const head = (x: number, y: number, key: string) => {
		upper(x, y - nod, key);
	};

	const { chin } = b;
	const [hair, light] = hairOf[look.hair];
	const turn = pose.turn ?? 0;
	const jaw = look.build === "heavy" ? 3 : 2;

	span(head, -jaw, jaw, chin, "s");
	head(-jaw, chin, "q");
	head(jaw, chin, "q");

	for (let y = chin + 1; y <= chin + 4; y++) {
		span(head, -3, 3, y, "s");
	}

	head(3, chin + 1, "q");
	head(3, chin + 2, "q");
	span(head, -3, 3, chin + 5, hair);
	span(head, -2, 1, chin + 5, light);
	span(head, -2, 2, chin + 6, hair);
	head(-1, chin + 6, light);

	// Eyes, brows, the shadow under the nose, and the mouth.
	const eye = pose.eyes === "closed" ? "q" : "e";
	head(turn - 2, chin + 3, eye);
	head(turn + 2, chin + 3, eye);
	head(turn - 2, chin + 4, hair);
	head(turn + 2, chin + 4, hair);
	head(turn, chin + 2, "q");

	if (pose.mouth === "smile") {
		span(head, turn - 1, turn + 1, chin + 1, "m");
		head(turn - 2, chin + 2, "r");
		head(turn + 2, chin + 2, "r");
	} else if (pose.mouth === "open") {
		span(head, turn - 1, turn, chin + 1, "e");
	} else {
		span(head, turn - 1, turn, chin + 1, "q");
	}

	// Short hair with sideburns and ears, a side-swept fringe, or a bob.
	if (look.gender === "male") {
		head(-3, chin + 4, hair);
		head(3, chin + 4, hair);
	} else if (look.gender === "female") {
		span(head, -3, -1, chin + 4, hair);
		head(3, chin + 4, hair);
		head(-3, chin + 3, hair);
		head(3, chin + 3, hair);
	} else {
		span(head, -3, -2, chin + 4, hair);
		head(3, chin + 4, hair);
	}

	if (look.gender === "male" && gear.gadget === 0) {
		head(-4, chin + 2, "q");
		head(-4, chin + 3, "s");
		head(4, chin + 2, "q");
		head(4, chin + 3, "q");
	}

	if (gear.gadget >= 1) {
		// Headphones: a band over the top and a cup on each ear.
		head(-3, chin + 6, "e");
		head(3, chin + 6, "e");
		span(head, -2, 2, chin + 7, "e");

		for (const x of [-4, 4]) {
			for (let y = chin + 2; y <= chin + 4; y++) {
				head(x, y, y === chin + 3 ? "S" : "e");
			}
		}
	}

	if (gear.headwear === 1) {
		// A cap with its brim over the forehead.
		span(head, -2, 2, chin + 7, "S");
		span(head, -3, 3, chin + 6, "S");
		head(-2, chin + 6, "T");
		span(head, -4 + turn, 4 + turn, chin + 5, "z");
	} else if (gear.headwear === 2) {
		// Sunglasses with a glint.
		span(head, -3, -1, chin + 3, "e");
		span(head, 1, 3, chin + 3, "e");
		head(0, chin + 3, "e");
		head(-2, chin + 3, "w");
	}
}

// Where each foot is on every frame of a stride, toward +x.
const gaits = {
	walk: {
		feet: [4, 3, 1, -1, -3, -4, -2, 2],
		lift: [0, 0, 0, 0, 0, 1, 2, 1],
		bob: [1, 0, 0, 0, 1, 0, 0, 0],
	},
	run: {
		feet: [5, 2, -2, -5, -2, 3],
		lift: [0, 0, 1, 3, 4, 2],
		bob: [1, 0, 0, 1, 0, 0],
	},
} as const;

function paintSideLeg(
	{ put, b, look }: Paint,
	gait: (typeof gaits)[Side["gait"]],
	index: number,
	isFar: boolean,
) {
	const bottom = bottomOf[look.style];
	const footX = gait.feet[index] ?? 0;
	const lift = gait.lift[index] ?? 0;
	const sole = ground + lift;
	const hip: Point = [0, b.hip - 1];
	const knee: Point = [
		Math.round(footX / 2) + 1 + Math.min(lift, 2),
		Math.round((b.hip + sole) / 2) + Math.floor(lift / 2),
	];
	const ankle: Point = [footX, sole + bottom.shoeRows];
	const pants = isFar ? bottom.shade : bottom.main;
	const skin = isFar ? "q" : "s";
	const shorts = ground + Math.round(b.legs * 0.55);

	for (const [from, to, width] of [
		[hip, knee, b.thigh - 1],
		[knee, ankle, b.calf - 1],
	] as const) {
		for (const [x, y] of pointsOf(from, to)) {
			const key = look.style === "athlete" && y < shorts ? skin : pants;
			span(put, x - Math.floor(width / 2), x + Math.ceil(width / 2), y, key);
		}
	}

	// The shoe points the way it walks, toe first.
	for (let row = 0; row < bottom.shoeRows; row++) {
		const key = row === 0 ? bottom.sole : bottom.shoe;
		span(put, footX - 1, footX + (row === 0 ? 3 : 2), sole + row, key);
	}
}

function paintSideHead({ upper, b, look, gear }: Paint, pose: Side) {
	const { chin } = b;
	const [hair, light] = hairOf[look.hair];

	// The neck and the head in profile, nose forward and hair behind.
	span(upper, -1, 1, b.shoulder + 1, "s");
	upper(-1, b.shoulder + 1, "q");
	span(upper, -1, 2, chin, "s");
	upper(-1, chin, "q");
	span(upper, -2, 3, chin + 1, "s");

	for (let y = chin + 2; y <= chin + 4; y++) {
		span(upper, -3, 3, y, "s");
	}

	upper(4, chin + 2, "s");
	span(upper, -3, 3, chin + 5, hair);
	span(upper, -2, 2, chin + 6, hair);
	upper(0, chin + 5, light);
	span(upper, -3, -1, chin + 4, hair);
	span(upper, -3, -2, chin + 3, hair);
	upper(-3, chin + 2, hair);
	upper(-1, chin + 3, "q");
	upper(2, chin + 3, "e");
	upper(2, chin + 4, hair);
	upper(3, chin + 1, pose.mouth === "smile" ? "m" : "q");

	if (look.gender === "female" && look.style !== "athlete") {
		for (let y = b.shoulder - 3; y <= chin + 3; y++) {
			span(upper, -4, -3, y, hair);
		}
	} else if (look.gender === "female") {
		const sway = Math.floor(pose.frame / 2) % 2;
		upper(-4, chin + 4, hair);
		upper(-5, chin + 3 - sway, hair);
		upper(-5, chin + 2 - sway, light);
	} else if (look.gender === "other") {
		for (let y = chin + 1; y <= chin + 3; y++) {
			upper(-3, y, hair);
			upper(-4, y, hair);
		}
	}

	if (gear.gadget >= 1) {
		span(upper, -1, 1, chin + 7, "e");

		for (let y = chin + 2; y <= chin + 4; y++) {
			upper(-1, y, y === chin + 3 ? "S" : "e");
		}
	}

	if (gear.headwear === 1) {
		span(upper, -3, 2, chin + 6, "S");
		span(upper, -2, 1, chin + 7, "S");
		span(upper, 2, 5, chin + 5, "z");
	} else if (gear.headwear === 2) {
		span(upper, 1, 3, chin + 3, "e");
		upper(0, chin + 4, "e");
	}
}

// The body in profile, facing +x, on frame `frame` of the gait.
function paintSide(paint: Paint, pose: Side) {
	const { put, b, look, gear } = paint;
	const gait = gaits[pose.gait];
	const count = gait.feet.length;
	const frame = pose.frame % count;
	const other = (frame + count / 2) % count;
	const bob = gait.bob[frame] ?? 0;
	const upper: Put = (x, y, key) => {
		put(x, y - bob, key);
	};

	const sideways: Paint = { ...paint, upper };
	const top = topOf[look.style];
	const back = Math.max(b.chest - 2, 2);
	const front = b.chest - 1;

	// Arms swing against the legs; running bends them at the elbow.
	const arm = (index: number, isFar: boolean) => {
		const swing = -(gait.feet[index] ?? 0);
		const hand: Point =
			pose.gait === "run"
				? [Math.round(swing * 0.7) + 2, b.shoulder - Math.round(b.reach / 2)]
				: [Math.round(swing * 0.75), b.shoulder - b.reach + 1];
		paintArm(
			{ ...sideways, b: { ...b, chest: -1 } },
			1,
			hand,
			isFar ? "far" : "near",
		);
	};

	// The far arm and leg first, in shadow.
	arm(other, true);
	paintSideLeg(paint, gait, other, true);
	paintSideLeg(paint, gait, frame, false);

	// The torso, deeper at the chest, with a belly or hips where they are.
	const torso = b.shoulder - b.hip + 1;
	const chestRows = Math.ceil(torso * 0.45);

	for (let y = b.hip; y <= b.shoulder; y++) {
		const isChest = b.shoulder - y < chestRows;
		let forward = front;
		let behind = back;

		if (!isChest && look.build === "heavy") {
			forward += 2;
		} else if (!isChest && look.build === "stocky") {
			forward += 1;
		}

		if (y - b.hip < 2 && look.gender === "female") {
			behind += 1;
		}

		span(upper, -behind, forward, y, top.main);
		upper(-behind, y, top.shade);
		upper(forward, y, top.light);
	}

	if (look.style === "standing") {
		for (let y = b.hip - 3; y <= b.shoulder - 2; y++) {
			upper(front, y, "S");
			upper(front - 1, y, "S");
		}
	} else if (look.style === "desk") {
		span(upper, -2, -1, b.shoulder + 1, top.shade);
		span(upper, 0, front, b.hip + 2, top.shade);
	}

	if (gear.wear === 2) {
		for (let y = b.hip; y <= b.shoulder; y++) {
			span(upper, -back, front - 2, y, "X");
		}
	}

	if (gear.carry >= 1) {
		// The backpack rides behind.
		for (let y = b.shoulder - 6; y <= b.shoulder - 1; y++) {
			span(upper, -back - 3, -back - 1, y, y === b.shoulder - 1 ? "b" : "B");
		}

		upper(-back - 2, b.shoulder - 3, "d");
	}

	if (gear.carry === 2) {
		upper(front, b.shoulder - 3, "g");
		upper(front - 1, b.shoulder - 1, "z");
	}

	paintSideHead(sideways, pose);

	if (gear.wear >= 1) {
		span(upper, -2, 2, b.shoulder + 1, "S");
		const flutter = Math.floor(pose.frame / 2) % 2;
		upper(-3, b.shoulder + 1 - flutter, "z");
		upper(-4, b.shoulder - flutter, "z");
	}

	// The near arm swings in front of the body.
	arm(frame, false);
}

function paintFront(paint: Paint, pose: Front) {
	const { b } = paint;
	paintHairBehind(paint, pose.nod ?? 0);
	paintLegsFront(paint, pose);
	paintTorsoFront(paint);

	for (const [index, side] of [-1, 1].entries()) {
		paintArm(paint, side, pose.hands?.[index] ?? hanging(b, side));
	}

	paintHeadFront(paint, pose);
}

const mix = (from: string, to: string, amount: number) => {
	const parse = (hex: string) =>
		[1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16));
	const [start, end] = [parse(from), parse(to)];

	return `#${start
		.map((value, index) =>
			Math.round(value + ((end[index] ?? value) - value) * amount)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
};

export function paletteOf(palette: Palette): ReadonlyMap<string, string> {
	const { cloak, cloakShade, scarf, scarfShade, glow } = palette.sprite;

	return new Map([
		["A", "#141414"],
		["B", "#3E3226"],
		["b", "#6B4A2E"],
		["C", cloak],
		["c", cloakShade],
		["D", "#50555F"],
		["d", "#9AA0AA"],
		["E", mix(cloak, "#FFFFFF", 0.16)],
		["e", "#2B2B2B"],
		["F", "#C8473F"],
		["G", "#6FA35A"],
		["g", "#D9B45A"],
		["H", "#9C9C9C"],
		["h", "#4A3222"],
		["I", "#E4E4E4"],
		["i", "#6B4A33"],
		["J", "#BDBDBD"],
		["K", "#C4C4C4"],
		["L", "#4A505B"],
		["l", glow],
		["M", "#424A58"],
		["m", "#B5524A"],
		["N", "#B59A6A"],
		["n", "#937B52"],
		["O", "#5E6B45"],
		["o", "#5A3A25"],
		["P", "#3E6870"],
		["p", "#33565D"],
		["Q", "#E6E0D4"],
		["q", "#C99872"],
		["R", "#4F8189"],
		["r", "#E8909A"],
		["S", scarf],
		["s", "#E2B48C"],
		["T", mix(scarf, "#FFFFFF", 0.22)],
		["t", glow],
		["U", "#B4AE9F"],
		["V", "#4A5536"],
		["v", "#9AA0A8"],
		["w", "#F2F2F2"],
		["X", "#2F3540"],
		["x", "#3D414B"],
		["Y", "#C8C8C8"],
		["y", palette.soft],
		["Z", "#C8C8C8"],
		["z", scarfShade],
	]);
}

export type SceneInput = Readonly<{
	activity: Activity;
	counter: number;
	level: number;
	look: Look;
	mood: Mood;
	width: number;
	anchor?: number;
}>;

// The pixel keys of 1 frame, row by row, "." where nothing is drawn.
export function composeScene({
	activity,
	counter,
	level,
	look,
	mood,
	width,
	anchor = homeOf(width),
}: SceneInput): string[] {
	const canvas = Array.from({ length: stageHeight }, () =>
		Array.from({ length: width }, () => "."),
	);
	const scene = sceneOf(activity, counter, width, mood, anchor);
	const b = bodyOf(look);
	const pose = scene.pose(b);
	// The character's x = 0 is its center column, mirrored when facing left.
	const plant =
		(rise: number): Put =>
		(x, y, key) => {
			const column = scene.x + scene.facing * x;
			const row = canvas[stageHeight - 1 - (y + rise)];

			if (row && column >= 0 && column < width && key !== ".") {
				row[column] = key;
			}
		};

	const put = plant(scene.lift);
	const bob = pose.view === "front" ? (pose.bob ?? 0) : 0;
	const paint: Paint = {
		put,
		upper: plant(scene.lift - bob),
		b,
		look,
		gear: gearOf(level),
		counter,
	};

	paintShadow(plant(0), b, scene.lift);

	if (pose.view === "side") {
		paintSide(paint, pose);
	} else {
		paintFront(paint, pose);
	}

	for (const draw of scene.props ?? []) {
		draw(put, paint.upper, b);
	}

	return canvas.map((row) => row.join(""));
}

export type Segment = Readonly<{
	text: string;
	color?: string;
	backgroundColor?: string;
}>;

// Pairs of pixel rows become 1 row of "▀"/"▄" cells, merged into styled runs.
export function toSegments(
	frame: readonly string[],
	palette: ReadonlyMap<string, string>,
): Segment[][] {
	const lines: Segment[][] = [];
	const width = frame[0]?.length ?? 0;

	for (let y = 0; y < frame.length; y += 2) {
		const top = frame[y] ?? "";
		const bottom = frame[y + 1] ?? "";
		const line: Segment[] = [];

		for (let x = 0; x < width; x++) {
			const upperColor = palette.get(top[x] ?? ".");
			const lowerColor = palette.get(bottom[x] ?? ".");
			const cell: Segment =
				upperColor === undefined
					? lowerColor === undefined
						? { text: " " }
						: { text: "▄", color: lowerColor }
					: { text: "▀", color: upperColor, backgroundColor: lowerColor };
			const previous = line.at(-1);

			if (
				previous &&
				previous.color === cell.color &&
				previous.backgroundColor === cell.backgroundColor &&
				previous.text.at(-1) === cell.text
			) {
				line[line.length - 1] = {
					...previous,
					text: previous.text + cell.text,
				};
			} else {
				line.push(cell);
			}
		}

		lines.push(line);
	}

	return lines;
}
