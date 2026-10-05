import type { Gender, HealthGoal, Mood, WorkStyle } from "./i18n.js";
import type { Palette } from "./theme.js";

// The character stands on a stage as wide as its panel and 32 pixels tall.
// Each terminal cell draws 2 stacked pixels with "▀", foreground for the top
// and background for the bottom, so the stage takes 16 rows.
export const stageHeight = 32;

export type Activity =
	| "idle"
	| "focus"
	| "break"
	| "eat"
	| "run"
	| "lift"
	| "stretch"
	| "levelUp";

export type Build = "slim" | "average" | "stocky" | "heavy";
export type Hair = "dark" | "grey" | "white";

// What the profile decides: the height in pixels, the body shape, the
// clothes for the work style, and the hair for the age.
export type Look = Readonly<{
	height: number;
	build: Build;
	gender: Gender;
	style: WorkStyle;
	hair: Hair;
	goal?: HealthGoal;
}>;

export const defaultLook: Look = {
	height: 23,
	build: "average",
	gender: "other",
	style: "desk",
	hair: "dark",
};

type Profile = Readonly<{
	age: number;
	height: number;
	weight: number;
	gender: Gender;
	workStyle: WorkStyle;
	goal: HealthGoal;
}>;

// 145 cm draws 20 pixels tall and 205 cm 26; the build follows the BMI.
export function lookOf(profile: Profile | undefined): Look {
	if (!profile) {
		return defaultLook;
	}

	const bmi = profile.weight / (profile.height / 100) ** 2;
	let build: Build = "average";

	if (bmi < 19.5) {
		build = "slim";
	} else if (bmi >= 30) {
		build = "heavy";
	} else if (bmi >= 25) {
		build = "stocky";
	}

	let hair: Hair = "dark";

	if (profile.age >= 70) {
		hair = "white";
	} else if (profile.age >= 55) {
		hair = "grey";
	}

	return {
		height: Math.min(
			Math.max(Math.round(20 + (profile.height - 145) / 10), 19),
			27,
		),
		build,
		gender: profile.gender,
		style: profile.workStyle,
		hair,
		goal: profile.goal,
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
	chest: number;
	waist: number;
	hips: number;
	arm: number;
	reach: number;
}>;

// The feet stand on row 1, in the middle of their shadow.
const ground = 1;

const halfWidths: Record<Gender, readonly [number, number, number]> = {
	female: [3, 2, 3],
	male: [4, 3, 3],
	other: [3, 3, 3],
};

// A head of 5 rows and a neck take 6 of the height; legs take 56% of the rest.
function bodyOf(look: Look): Body {
	const span = look.height - 6;
	const legs = Math.round(span * 0.56);
	const torso = span - legs;
	let [chest, waist, hips] = halfWidths[look.gender];

	switch (look.build) {
		case "slim": {
			chest -= look.gender === "male" ? 1 : 0;
			waist = Math.max(waist - 1, 2);
			hips = Math.max(hips - 1, 2);
			break;
		}

		case "stocky": {
			waist += 1;
			break;
		}

		case "heavy": {
			chest += 1;
			waist += 2;
			hips += 1;
			break;
		}

		case "average": {
			break;
		}
	}

	if (look.goal === "buildMuscle") {
		chest += 1;
	}

	const hip = ground + legs;
	const shoulder = hip + torso - 1;
	const chin = shoulder + 2;

	return {
		hip,
		shoulder,
		chin,
		top: chin + 4,
		legs,
		chest,
		waist,
		hips,
		arm: look.build === "heavy" || look.goal === "buildMuscle" ? 2 : 1,
		reach: torso + 1,
	};
}

// Hands are absolute points in the character's own coordinates.
type Pose = Readonly<{
	hands?: readonly [Point | undefined, Point | undefined];
	step?: number;
	bob?: number;
	lift?: number;
	turn?: number;
	eyes?: "open" | "closed";
	mouth?: "smile" | "open";
}>;

// Props stay planted with `put`, or follow the breathing with `upper`.
type Draw = (put: Put, upper: Put, b: Body) => void;

type Scene = Readonly<{
	x: number;
	facing: 1 | -1;
	pose: (b: Body) => Pose;
	props?: Draw[];
}>;

const span = (put: Put, from: number, to: number, y: number, key: string) => {
	for (let x = from; x <= to; x++) {
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

const hanging = (b: Body, side: number, swing = 0): Point => [
	side * (b.chest + 1),
	b.shoulder - b.reach + swing,
];

// A standing desk at the waist, with the laptop's lid facing out.
const desk: Draw = (put, _upper, b) => {
	const top = b.hip + 1;
	span(put, -8, 8, top, "L");

	for (let y = 0; y < top; y++) {
		put(-7, y, "x");
		put(7, y, "x");
	}

	for (let y = top + 1; y <= top + 3; y++) {
		span(put, -2, 2, y, "d");
	}

	put(0, top + 2, "l");
};

const cup =
	([x, y]: Point, steam?: number): Draw =>
	(_put, upper) => {
		span(upper, x, x + 1, y, "Q");
		span(upper, x, x + 1, y + 1, "Q");
		upper(x, y + 1, "o");

		if (steam !== undefined) {
			upper(x + (steam % 2), y + 3, "v");
			upper(x + 1 - (steam % 2), y + 4, "v");
		}
	};

const apple =
	([x, y]: Point, isBitten: boolean): Draw =>
	(_put, upper) => {
		span(upper, x, x + 1, y, "F");
		upper(x, y + 1, "F");
		upper(x + 1, y + 1, isBitten ? "." : "F");
		upper(x + 1, y + 2, "G");
	};

const barbell =
	(y: number): Draw =>
	(_put, upper, b) => {
		const end = b.chest + 6;
		span(upper, -end, end, y, "d");

		for (const x of [-end, -end + 1, end - 1, end]) {
			span(upper, x, x, y - 1, "D");
			upper(x, y, "D");
			span(upper, x, x, y + 1, "D");
		}
	};

const sparkles =
	(points: readonly Point[]): Draw =>
	(put) => {
		for (const [x, y] of points) {
			put(x, y, "y");
		}
	};

const sleepyZ =
	(at: number): Draw =>
	(put, _upper, b) => {
		const rows = ["ZZZZ", "..Z.", ".Z..", "ZZZZ"];

		for (const [offset, row] of rows.entries()) {
			for (const [index, key] of [...row].entries()) {
				put(3 + (at % 2) + index, b.top + 4 + at - offset, key);
			}
		}
	};

// Standing in place between walks: breathing, blinking, looking about, and
// waving when every target is met.
const resting =
	(t: number, mood: Mood): Scene["pose"] =>
	(b) => {
		const isWaving = mood === "happy" && t >= 3 && t <= 5;
		let turn = 0;

		if (t === 2 || t === 3) {
			turn = -1;
		} else if (t === 4) {
			turn = 1;
		}

		return {
			mouth: mood === "happy" ? "smile" : undefined,
			bob: Math.floor(t / 2) % 2,
			eyes: t === 6 ? "closed" : "open",
			turn,
			lift: mood === "happy" && t === 1 ? 1 : 0,
			hands: isWaving
				? [undefined, [b.chest + 3 + (t % 2), b.top - 1]]
				: undefined,
		};
	};

const walking =
	(step: number, mood: Mood): Scene["pose"] =>
	(b) => ({
		mouth: mood === "happy" ? "smile" : undefined,
		turn: 1,
		step: [0, 1, 0, 3][step % 4],
		bob: step % 2 === 0 ? 1 : 0,
		hands: [
			hanging(b, -1, step % 4 === 3 ? 1 : 0),
			hanging(b, 1, step % 4 === 1 ? 1 : 0),
		],
	});

// Where the character stands and what it does on every tick of `counter`.
function sceneOf(
	activity: Activity,
	counter: number,
	width: number,
	mood: Mood,
): Scene {
	const home = Math.floor(width / 2);
	const minimum = 8;
	const maximum = Math.max(width - 9, minimum + 1);
	const travel = maximum - minimum;
	const tick = counter % 4;
	const mouth = mood === "happy" ? "smile" : undefined;

	if (activity === "idle" && mood === "sleepy") {
		// Dozing on its feet: nodding, yawning, with Zs drifting up.
		const at = counter % 6;
		const isYawning = at === 4;

		return {
			x: home,
			facing: 1,
			pose: (b) => ({
				eyes: "closed",
				bob: at % 3 === 0 ? 1 : 0,
				mouth: isYawning ? "open" : undefined,
				hands: isYawning ? [undefined, [2, b.chin]] : undefined,
			}),
			props: [sleepyZ(at)],
		};
	}

	if (activity === "idle") {
		// Wander: pause, walk across, pause and look about, walk back.
		const pause = 8;
		const at = counter % (2 * (pause + travel));

		if (at < pause) {
			return { x: minimum, facing: 1, pose: resting(at, mood) };
		}

		if (at < pause + travel) {
			const step = at - pause;
			return { x: minimum + step, facing: 1, pose: walking(step, mood) };
		}

		if (at < 2 * pause + travel) {
			return {
				x: maximum,
				facing: -1,
				pose: resting(at - pause - travel, mood),
			};
		}

		const step = at - 2 * pause - travel;
		return { x: maximum - step, facing: -1, pose: walking(step, mood) };
	}

	switch (activity) {
		case "run": {
			// Laps across the stage, 2 pixels a tick, with the arms bent.
			const lap = Math.max(Math.ceil(travel / 2), 1);
			const at = counter % (2 * lap);
			const forward = at < lap;
			const step = forward ? at : at - lap;

			return {
				x: forward
					? Math.min(minimum + step * 2, maximum)
					: Math.max(maximum - step * 2, minimum),
				facing: forward ? 1 : -1,
				pose: (b) => ({
					mouth,
					turn: 1,
					step: counter % 2 === 0 ? 1 : 3,
					bob: counter % 2,
					hands: [
						[-(b.chest + 2), b.hip + 2 + (counter % 2)],
						[b.chest + 2, b.hip + 3 - (counter % 2)],
					],
				}),
				props: [
					(put, _upper, b) => {
						put(-(b.chest + 4), b.top - 1 - (counter % 2), "v");
						put(-(b.chest + 6), b.hip + (counter % 3), "v");
					},
				],
			};
		}

		case "focus": {
			// Typing at a standing desk, the laptop's glow on the face.
			return {
				x: home,
				facing: 1,
				pose: (b) => ({
					mouth,
					bob: tick === 3 ? 1 : 0,
					hands: [
						[-3, b.hip + 2 + (tick % 2)],
						[3, b.hip + 3 - (tick % 2)],
					],
				}),
				props: [
					desk,
					(put, _upper, b) => {
						put(-3 + tick, b.top + 2 + (tick % 2), "y");
					},
				],
			};
		}

		case "break": {
			// A coffee, sipped every few ticks.
			const at = counter % 6;
			const isSipping = at >= 4;
			const hand = (b: Body): Point =>
				isSipping ? [2, b.chin] : [b.chest + 2, b.hip + 2];

			return {
				x: home,
				facing: 1,
				pose: (b) => ({
					mouth,
					bob: at % 2,
					eyes: isSipping ? "closed" : "open",
					hands: [undefined, hand(b)],
				}),
				props: [
					(put, upper, b) => {
						cup(hand(b), isSipping ? undefined : at)(put, upper, b);
					},
				],
			};
		}

		case "eat": {
			const isBiting = tick === 1 || tick === 2;
			const hand = (b: Body): Point =>
				isBiting ? [2, b.chin] : [b.chest + 2, b.hip + 3];

			return {
				x: home,
				facing: 1,
				pose: (b) => ({
					bob: tick === 2 ? 1 : 0,
					mouth: isBiting ? "open" : mouth,
					hands: [undefined, hand(b)],
				}),
				props: [
					(put, upper, b) => {
						const [x, y] = hand(b);
						apple([x, y - 1], tick === 3)(put, upper, b);
					},
				],
			};
		}

		case "lift": {
			// An overhead press: rack, press, lock out, lower.
			const height = (b: Body) =>
				[b.shoulder, b.shoulder + 3, b.top + 1, b.shoulder + 3][tick] ??
				b.shoulder;

			return {
				x: home,
				facing: 1,
				pose(b) {
					const y = height(b);
					const x = tick === 2 ? b.chest + 1 : b.chest + 2;
					return {
						mouth,
						bob: tick === 0 ? 1 : 0,
						hands: [
							[-x, y],
							[x, y],
						],
					};
				},
				props: [
					(put, upper, b) => {
						barbell(height(b))(put, upper, b);
					},
				],
			};
		}

		case "stretch": {
			// Reach up, rise on the toes, open the arms wide, and come down.
			return {
				x: home,
				facing: 1,
				pose(b) {
					const reaches: Point[] = [
						[1, b.top + 2],
						[1, b.top + 3],
						[b.chest + 6, b.shoulder],
						[b.chest + 4, b.shoulder + 4],
					];
					const [x, y] = reaches[tick] ?? [1, b.top + 2];
					return {
						mouth,
						bob: tick === 1 ? 0 : 1,
						lift: tick === 1 ? 1 : 0,
						eyes: tick === 1 ? "closed" : "open",
						hands: [
							[-x, y],
							[x, y],
						],
					};
				},
			};
		}

		case "levelUp": {
			const lift = [0, 2, 3, 1][tick] ?? 0;

			return {
				x: home,
				facing: 1,
				pose: (b) => ({
					mouth: "smile",
					lift,
					hands: [
						[-(b.chest + 3), b.top],
						[b.chest + 3, b.top],
					],
				}),
				props: [
					(put, upper, b) => {
						sparkles(
							tick % 2 === 0
								? [
										[-8, b.top],
										[8, b.top + 2],
										[-9, b.shoulder],
										[9, b.shoulder - 2],
									]
								: [
										[-9, b.top + 2],
										[9, b.top],
										[-8, b.shoulder - 2],
										[8, b.shoulder],
									],
						)(put, upper, b);
					},
				],
			};
		}
	}
}

export const intervalOf = (activity: Activity): number =>
	({
		idle: 220,
		focus: 180,
		break: 380,
		eat: 300,
		run: 110,
		lift: 420,
		stretch: 480,
		levelUp: 160,
	})[activity];

// How many ticks one loop of an activity takes on a stage of `width`.
export function cycleOf(activity: Activity, width: number): number {
	const travel = Math.max(width - 17, 1);

	if (activity === "idle") {
		return 2 * (8 + travel);
	}

	if (activity === "run") {
		return 2 * Math.max(Math.ceil(travel / 2), 1);
	}

	return activity === "break" ? 6 : 4;
}

type Paint = Readonly<{
	put: Put;
	upper: Put;
	b: Body;
	look: Look;
	gear: Gear;
	pose: Pose;
	counter: number;
}>;

// The tops by work style: a hoodie, a shirt under an apron, a tee, a tank.
const topOf: Record<WorkStyle, readonly [string, string]> = {
	desk: ["C", "c"],
	standing: ["Q", "U"],
	active: ["C", "c"],
	athlete: ["S", "z"],
};

// How much of the arm the sleeve covers, from the shoulder down.
const sleeveOf: Record<WorkStyle, number> = {
	desk: 1,
	standing: 0.5,
	active: 0.3,
	athlete: 0,
};

// Jeans and sneakers, chinos and shoes, cargo pants and boots, or shorts
// and running shoes.
const bottomOf: Record<
	WorkStyle,
	Readonly<{ pants: string; shade: string; shoe: string; shoeRows: number }>
> = {
	desk: { pants: "P", shade: "p", shoe: "w", shoeRows: 1 },
	standing: { pants: "N", shade: "n", shoe: "b", shoeRows: 1 },
	active: { pants: "O", shade: "V", shoe: "B", shoeRows: 2 },
	athlete: { pants: "x", shade: "S", shoe: "S", shoeRows: 1 },
};

const hairKeys: Record<Hair, string> = { dark: "h", grey: "H", white: "I" };

// An oval on the ground with the feet in its middle, shrinking in the air.
function paintShadow(put: Put, b: Body, lift: number) {
	const half = b.hips + 4 - Math.min(lift, 2);
	span(put, -half + 2, half - 2, ground - 1, "A");
	span(put, -half, half, ground, "A");
	span(put, -half + 2, half - 2, ground + 1, "A");
}

// Long hair falls behind the shoulders, so it goes on before the body.
function paintHairBehind({ upper, b, look, counter }: Paint) {
	const hair = hairKeys[look.hair];

	if (look.gender !== "female") {
		return;
	}

	if (look.style === "athlete") {
		// A ponytail that swings.
		const sway = counter % 4 < 2 ? 0 : 1;
		upper(3, b.chin + 3, hair);
		upper(4, b.chin + 2, hair);
		upper(4 + sway, b.chin + 1, hair);
		upper(4 + sway, b.chin, hair);
		return;
	}

	for (let y = b.shoulder - 2; y <= b.chin + 3; y++) {
		upper(-3, y, hair);
		upper(3, y, hair);
	}

	for (let y = b.shoulder - 1; y < b.chin; y++) {
		span(upper, -2, 2, y, hair);
	}
}

function paintLegs({ put, b, look, pose }: Paint) {
	const { pants, shade, shoe, shoeRows } = bottomOf[look.style];
	const thigh = b.hips;
	const calf = Math.max(thigh - 1, 2);
	const knee = ground + Math.floor(b.legs / 2);
	const shorts = ground + Math.round(b.legs * 0.55);

	for (const side of [-1, 1]) {
		const isLifted =
			(side === -1 && pose.step === 1) || (side === 1 && pose.step === 3);
		const sole = ground + (isLifted ? 1 : 0);

		for (let y = sole; y < b.hip; y++) {
			const width = y >= knee ? thigh : calf;
			let key = pants;

			if (y < sole + shoeRows) {
				key = shoe;
			} else if (look.style === "athlete" && y < shorts) {
				key = "s";
			}

			for (let x = 1; x <= width; x++) {
				put(side * x, y, key);
			}

			if (key === pants) {
				put(side * width, y, shade);
			}
		}

		// Shoes stick out a little past the ankle.
		put(side * (calf + 1), sole, shoe);

		if (look.style === "active") {
			put(side * thigh, knee + 1, "V");
			put(side * thigh, knee + 2, "V");
		}
	}

	// The thighs meet at the crotch, and all the way down on a heavy build.
	let crotch = b.hip - 1;

	if (look.build === "heavy") {
		crotch = look.style === "athlete" ? shorts : knee;
	}

	for (let y = crotch; y < b.hip; y++) {
		put(0, y, pants);
	}
}

function paintTorso({ upper, b, look, gear }: Paint) {
	const [main, shade] = topOf[look.style];
	const torso = b.shoulder - b.hip + 1;
	const chestRows = Math.ceil(torso * 0.45);
	const halfAt = (y: number) => {
		if (b.shoulder - y < chestRows) {
			return b.chest;
		}

		return y - b.hip < 2 ? Math.max(b.hips, b.waist) : b.waist;
	};

	for (let y = b.hip; y <= b.shoulder; y++) {
		const half = halfAt(y);
		span(upper, -half, half, y, main);
		upper(-half, y, shade);
		upper(half, y, shade);
	}

	span(upper, -1, 1, b.shoulder + 1, "s");

	switch (look.style) {
		case "desk": {
			// A hoodie: the hood behind the neck, drawstrings, a front pocket.
			upper(-2, b.shoulder + 1, shade);
			upper(2, b.shoulder + 1, shade);

			upper(-1, b.shoulder - 1, "w");
			upper(1, b.shoulder - 1, "w");

			span(upper, -2, 2, b.hip + 1, shade);
			break;
		}

		case "standing": {
			// A collared shirt under an apron that hangs over the thighs.
			upper(-1, b.shoulder, "w");
			upper(1, b.shoulder, "w");
			upper(0, b.shoulder, "s");

			for (const x of [-2, 2]) {
				upper(x, b.shoulder, "S");
				upper(x, b.shoulder - 1, "S");
			}

			for (let y = b.hip - 2; y <= b.shoulder - 2; y++) {
				span(upper, -b.waist, b.waist, y, "S");
			}

			span(upper, -1, 1, b.hip + 1, "z");
			break;
		}

		case "active": {
			upper(0, b.shoulder, shade);
			break;
		}

		case "athlete": {
			upper(0, b.shoulder, "s");
			span(upper, -b.chest, b.chest, b.shoulder - 2, shade);
			break;
		}
	}

	if (gear.wear === 2) {
		// An open jacket over whatever is underneath.
		for (let y = b.hip; y <= b.shoulder; y++) {
			const half = halfAt(y);
			span(upper, -half, -half + 1, y, "X");
			span(upper, half - 1, half, y, "X");
		}
	}

	if (gear.carry >= 1) {
		// Backpack straps over both shoulders.
		for (let y = b.shoulder - 3; y <= b.shoulder; y++) {
			upper(-(b.chest - 1), y, "B");
			upper(b.chest - 1, y, "B");
		}
	}

	if (gear.wear >= 1) {
		// A scarf around the neck, its end hanging down the chest.
		span(upper, -2, 2, b.shoulder + 1, "S");
		upper(1, b.shoulder, "z");
		upper(1, b.shoulder - 1, "z");
	}

	if (gear.carry === 2) {
		// A gold medal on its ribbon.
		upper(-1, b.shoulder, "z");
		upper(1, b.shoulder, "z");
		upper(0, b.shoulder - 1, "z");
		upper(0, b.shoulder - 2, "g");
	}
}

function paintArms({ upper, b, look, gear, pose }: Paint) {
	const isJacket = gear.wear === 2;
	const [main, shade] = isJacket ? ["X", "X"] : topOf[look.style];
	const sleeve = isJacket ? 1 : sleeveOf[look.style];

	for (const [index, side] of [-1, 1].entries()) {
		const joint: Point = [side * (b.chest + 1), b.shoulder];
		const hand = pose.hands?.[index] ?? hanging(b, side);
		const points = pointsOf(joint, hand);
		const covered = Math.round((points.length - 1) * sleeve);
		const isLevel = Math.abs(hand[0] - joint[0]) > Math.abs(hand[1] - joint[1]);
		const [thickX, thickY] = isLevel ? [0, -1] : [side, 0];

		for (const [step, [x, y]] of points.entries()) {
			const isHand = step === points.length - 1;
			const isSleeve =
				!isHand && (step < covered || (step === 0 && sleeve > 0));
			upper(x, y, isSleeve ? main : "s");

			if (b.arm === 2 && step < points.length - 2) {
				upper(x + thickX, y + thickY, isSleeve ? shade : "q");
			}
		}

		const wrist = points.at(-2);

		if (side === 1 && gear.gadget === 2 && wrist && points.length > 2) {
			upper(wrist[0], wrist[1], "t");
		}
	}
}

function paintHead({ upper, b, look, gear, pose }: Paint) {
	const { chin } = b;
	const hair = hairKeys[look.hair];
	const turn = pose.turn ?? 0;
	const jaw = look.build === "heavy" ? 2 : 1;

	span(upper, -jaw, jaw, chin, "s");
	span(upper, -2, 2, chin + 1, "s");
	span(upper, -2, 2, chin + 2, "s");
	span(upper, -2, 2, chin + 3, hair);
	span(upper, -1, 1, chin + 4, hair);

	const eye = pose.eyes === "closed" ? "q" : "e";
	upper(turn - 1, chin + 1, eye);
	upper(turn + 1, chin + 1, eye);

	let mouth = "q";

	if (pose.mouth === "smile") {
		mouth = "m";
	} else if (pose.mouth === "open") {
		mouth = "e";
	}

	upper(turn, chin, mouth);

	// Short hair with sideburns, a side-swept fringe, or a chin-length bob.
	if (look.gender === "male") {
		upper(-2, chin + 2, hair);
		upper(2, chin + 2, hair);
	} else if (look.gender === "female") {
		upper(-2, chin + 2, hair);
		upper(-1, chin + 2, hair);
		upper(2, chin + 2, hair);
	} else {
		for (const x of [-3, 3]) {
			for (let y = chin; y <= chin + 3; y++) {
				upper(x, y, hair);
			}
		}

		upper(-2, chin + 2, hair);
		upper(2, chin + 2, hair);
	}

	if (gear.gadget >= 1) {
		// Headphones: a band over the top and a cup on each ear.
		upper(-2, chin + 4, "k");
		upper(2, chin + 4, "k");
		span(upper, -1, 1, chin + 5, "k");

		for (const x of [-3, 3]) {
			upper(x, chin + 1, "k");
			upper(x, chin + 2, "k");
		}
	}

	if (gear.headwear === 1) {
		span(upper, -1, 1, chin + 4, "S");
		span(upper, -2, 2, chin + 3, "S");
		span(upper, -3 + turn, 3 + turn, chin + 2, "z");
	} else if (gear.headwear === 2) {
		span(upper, -2, 2, chin + 5, "g");

		for (const x of [-2, 0, 2]) {
			upper(x, chin + 6, "g");
		}

		upper(0, chin + 5, "t");
	}
}

export function paletteOf(palette: Palette): ReadonlyMap<string, string> {
	const { cloak, cloakShade, scarf, scarfShade, glow } = palette.sprite;

	return new Map([
		["A", "#121212"],
		["B", "#3E3226"],
		["b", "#6B4A2E"],
		["C", cloak],
		["c", cloakShade],
		["D", "#50555F"],
		["d", "#9AA0AA"],
		["e", "#2B2B2B"],
		["F", "#C8473F"],
		["G", "#6FA35A"],
		["g", "#D9B45A"],
		["H", "#9C9C9C"],
		["h", "#4A3222"],
		["I", "#E4E4E4"],
		["k", "#2B2B2B"],
		["L", "#4A505B"],
		["l", glow],
		["m", "#B5524A"],
		["N", "#B59A6A"],
		["n", "#937B52"],
		["O", "#5E6B45"],
		["o", "#5A3A25"],
		["P", "#3E6870"],
		["p", "#33565D"],
		["Q", "#E6E0D4"],
		["q", "#C99872"],
		["S", scarf],
		["s", "#E2B48C"],
		["t", glow],
		["U", "#B4AE9F"],
		["V", "#4A5536"],
		["v", "#9AA0A8"],
		["w", "#F2F2F2"],
		["X", "#2F3540"],
		["x", "#3D414B"],
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
}>;

// The pixel keys of 1 frame, row by row, "." where nothing is drawn.
export function composeScene({
	activity,
	counter,
	level,
	look,
	mood,
	width,
}: SceneInput): string[] {
	const canvas = Array.from({ length: stageHeight }, () =>
		Array.from({ length: width }, () => "."),
	);
	const scene = sceneOf(activity, counter, width, mood);
	const b = bodyOf(look);
	const pose = scene.pose(b);
	const lift = pose.lift ?? 0;
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

	const put = plant(lift);
	const upper = plant(lift - (pose.bob ?? 0));
	const paint: Paint = {
		put,
		upper,
		b,
		look,
		gear: gearOf(level),
		pose,
		counter,
	};

	paintShadow(plant(0), b, lift);
	paintHairBehind(paint);
	paintLegs(paint);
	paintTorso(paint);
	paintArms(paint);
	paintHead(paint);

	for (const draw of scene.props ?? []) {
		draw(put, upper, b);
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
