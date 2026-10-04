import type { Gender } from "./i18n.js";
import type { Palette } from "./theme.js";

// The character stands on a stage as wide as its panel and 30 pixels tall.
// Each terminal cell draws 2 stacked pixels with "▀", foreground for the top
// and background for the bottom, so the stage takes 15 rows.
export const stageHeight = 30;

export type Activity =
	| "idle"
	| "focus"
	| "break"
	| "eat"
	| "run"
	| "lift"
	| "stretch"
	| "levelUp";

export type Build = "slim" | "average" | "broad";
export type Body = Readonly<{ height: number; build: Build; gender: Gender }>;

export const defaultBody: Body = {
	height: 23,
	build: "average",
	gender: "other",
};

// 145 cm draws 20 pixels tall and 205 cm 26; the build follows the BMI.
export function bodyOf(
	profile:
		| Readonly<{ height: number; weight: number; gender: Gender }>
		| undefined,
): Body {
	if (!profile) {
		return defaultBody;
	}

	const bmi = profile.weight / (profile.height / 100) ** 2;
	let build: Build = "average";

	if (bmi < 20) {
		build = "slim";
	} else if (bmi >= 27) {
		build = "broad";
	}

	return {
		height: Math.min(
			Math.max(Math.round(20 + (profile.height - 145) / 10), 20),
			26,
		),
		build,
		gender: profile.gender,
	};
}

// Each equipment slot upgrades once from level 2 and again 4 levels later,
// staggered so every level from 2 to 9 changes exactly 1 piece.
export const gearOf = (level: number) => {
	const tier = (slot: number) =>
		Math.min(Math.max(Math.floor((level - 2 - slot) / 4) + 1, 0), 2);

	return { gadget: tier(0), top: tier(1), headwear: tier(2), back: tier(3) };
};

type Gear = ReturnType<typeof gearOf>;
type Point = readonly [number, number];

type Dims = Readonly<{
	legWidth: number;
	frontHip: number;
	backHip: number;
	legs: number;
	torso: number;
	left: number;
	right: number;
	shoulder: number;
	neck: number;
	arm: number;
}>;

const widthOf: Record<Build, number> = { slim: 4, average: 5, broad: 6 };

const dimsOf = (body: Body): Dims => {
	// Shoes, neck, a 4-row head, and its top row take 7 of the height.
	const span = body.height - 7;
	const torso = Math.round(span * 0.4);
	const legs = span - torso;
	const width = widthOf[body.build];
	const legWidth = body.build === "broad" ? 3 : 2;
	const right = Math.floor(width / 2) - 1;

	return {
		legWidth,
		frontHip: right - legWidth + 1,
		backHip: -Math.ceil(width / 2),
		legs,
		torso,
		left: -Math.ceil(width / 2),
		right: Math.floor(width / 2) - 1,
		shoulder: legs + torso,
		neck: legs + torso + 1,
		arm: torso - 1,
	};
};

// A pose in local coordinates: x grows toward where the character faces, y
// grows up from the ground. Hands are relative to their shoulders.
type Pose = Readonly<{
	front: Point;
	back: Point;
	frontHand: Point;
	backHand: Point;
	lift?: number;
	bob?: number;
	blink?: boolean;
}>;

type Draw = (put: (x: number, y: number, key: string) => void, d: Dims) => void;

type Scene = Readonly<{
	x: number;
	facing: 1 | -1;
	pose: (d: Dims) => Pose;
	props?: Draw[];
}>;

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

// Feet are relative to their own hip.
const standing = (d: Dims, hand: Point = [0, -d.arm]): Pose => ({
	front: [0, 0],
	back: [0, 0],
	frontHand: hand,
	backHand: [-1, -d.arm],
});

const walkFeet: ReadonlyArray<[Point, Point]> = [
	[
		[2, 0],
		[-1, 0],
	],
	[
		[0, 0],
		[0, 1],
	],
	[
		[-3, 0],
		[4, 0],
	],
	[
		[-2, 1],
		[2, 0],
	],
];
const runFeet: ReadonlyArray<[Point, Point]> = [
	[
		[3, 1],
		[-2, 2],
	],
	[
		[0, 0],
		[0, 3],
	],
	[
		[-4, 2],
		[5, 1],
	],
	[
		[-2, 3],
		[2, 0],
	],
];

const stride = (
	d: Dims,
	feet: ReadonlyArray<[Point, Point]>,
	step: number,
	swing: number,
	lift = 0,
): Pose => {
	const [front, back] = feet[step % feet.length] ?? [
		[0, 0],
		[0, 0],
	];
	const sway = step % 2 === 0 ? swing : 0;
	const direction = step % 4 < 2 ? -1 : 1;

	return {
		front,
		back,
		frontHand: [direction * sway, -d.arm + (sway ? 1 : 0)],
		backHand: [-direction * sway, -d.arm + (sway ? 1 : 0)],
		lift: step % 2 === 1 ? lift : 0,
	};
};

const sparkle =
	(points: Point[]): Draw =>
	(put) => {
		for (const [x, y] of points) {
			put(x, y, "y");
		}
	};

const desk: Draw = (put, d) => {
	const top = d.legs + 1;

	for (let x = 3; x <= 9; x++) {
		put(x, top, "x");
	}

	for (let y = 0; y < top; y++) {
		put(8, y, "x");
	}

	for (let x = 4; x <= 7; x++) {
		put(x, top + 1, "L");
	}

	for (let y = top + 2; y <= top + 5; y++) {
		put(6, y, "l");
		put(7, y, "L");
	}
};

const cup =
	(at: (d: Dims) => Point, steamStep?: number): Draw =>
	(put, d) => {
		const [x, y] = at(d);
		put(x, y, "Q");
		put(x + 1, y, "Q");
		put(x, y + 1, "o");
		put(x + 1, y + 1, "Q");

		if (steamStep !== undefined) {
			const sway = steamStep % 2;
			put(x + sway, y + 3, "v");
			put(x + 1 - sway, y + 4, "v");
		}
	};

const apple =
	(at: (d: Dims) => Point, bitten = false): Draw =>
	(put, d) => {
		const [x, y] = at(d);
		put(x, y, "F");
		put(x + 1, y, bitten ? "." : "F");
		put(x, y + 1, "F");
		put(x + 1, y + 1, "F");
		put(x + 1, y + 2, "G");
	};

const dumbbell =
	(at: (d: Dims) => Point): Draw =>
	(put, d) => {
		const [x, y] = at(d);
		put(x, y - 1, "D");
		put(x, y, "d");
		put(x, y + 1, "D");
	};

const shoulderOf = (d: Dims): Point => [d.right, d.shoulder];
const handAt = (d: Dims, [dx, dy]: Point): Point => [
	d.right + dx,
	d.shoulder + dy,
];

// Where the character stands and what it does on every tick of `counter`.
function sceneOf(activity: Activity, counter: number, width: number): Scene {
	const home = 6;
	const minimum = 5;
	const maximum = Math.max(width - 7, minimum + 1);
	const span = maximum - minimum;

	switch (activity) {
		case "idle": {
			// Wander: pause, walk across, pause and look around, walk back.
			const pause = 8;
			const cycle = 2 * (pause + span);
			const tick = counter % cycle;
			const breathe = (d: Dims, at: number): Pose => ({
				...standing(d),
				bob: Math.floor(at / 2) % 2,
				blink: at % pause === 5,
			});

			if (tick < pause) {
				return {
					x: minimum,
					facing: tick === 3 || tick === 4 ? -1 : 1,
					pose: (d) => breathe(d, tick),
				};
			}

			if (tick < pause + span) {
				const step = tick - pause;
				return {
					x: minimum + step,
					facing: 1,
					pose: (d) => stride(d, walkFeet, step, 1),
				};
			}

			if (tick < 2 * pause + span) {
				const at = tick - pause - span;
				return {
					x: maximum,
					facing: at === 3 || at === 4 ? 1 : -1,
					pose: (d) => breathe(d, at),
				};
			}

			const step = tick - 2 * pause - span;
			return {
				x: maximum - step,
				facing: -1,
				pose: (d) => stride(d, walkFeet, step, 1),
			};
		}

		case "run": {
			// Laps across the panel, 2 pixels a tick.
			const lap = Math.max(Math.ceil(span / 2), 1);
			const tick = counter % (2 * lap);
			const forward = tick < lap;
			const step = forward ? tick : tick - lap;

			return {
				x: forward
					? Math.min(minimum + step * 2, maximum)
					: Math.max(maximum - step * 2, minimum),
				facing: forward ? 1 : -1,
				pose: (d) => stride(d, runFeet, counter, 2, 1),
				props: [
					sparkle(
						counter % 2 === 0
							? [
									[-6, 6],
									[-7, 9],
								]
							: [
									[-7, 7],
									[-6, 10],
								],
					),
				],
			};
		}

		case "focus": {
			const step = counter % 4;
			return {
				x: home,
				facing: 1,
				pose: (d) => ({
					...standing(d),
					frontHand: [4 - d.right + (step % 2), d.legs + 2 - d.shoulder],
					backHand: [3 - d.right, d.legs + 2 - d.shoulder],
					bob: step < 2 ? 0 : 1,
				}),
				props: [
					desk,
					(put, d) => {
						const top = d.legs + 7;
						put(6 + (step % 3), top + step, "y");
						put(8 - (step % 2), top + ((step + 2) % 4), "y");
					},
				],
			};
		}

		case "break": {
			const step = counter % 6;
			const sipping = step >= 4;
			const hand = (d: Dims): Point =>
				sipping ? [2, d.neck + 1 - d.shoulder] : [2, -d.arm + 2];

			return {
				x: home,
				facing: 1,
				pose: (d) => ({
					...standing(d, hand(d)),
					bob: step % 2,
					blink: sipping,
				}),
				props: [
					cup(
						(d) => {
							const [x, y] = handAt(d, hand(d));
							return [x + 1, y];
						},
						sipping ? undefined : step,
					),
				],
			};
		}

		case "eat": {
			const step = counter % 4;
			const atMouth = step === 1 || step === 2;
			const hand = (d: Dims): Point =>
				atMouth ? [2, d.neck + 1 - d.shoulder] : [2, -d.arm + 2];

			return {
				x: home,
				facing: 1,
				pose: (d) => ({ ...standing(d, hand(d)), bob: step === 2 ? 1 : 0 }),
				props: [
					apple((d) => {
						const [x, y] = handAt(d, hand(d));
						return [x + 1, y];
					}, step === 3),
				],
			};
		}

		case "lift": {
			const step = counter % 4;
			const hand = (d: Dims): Point =>
				step === 2 ? [1, d.arm] : [2, step === 0 ? -d.arm + 3 : 1];

			return {
				x: home,
				facing: 1,
				pose: (d) => ({
					...standing(d, hand(d)),
					backHand: [-1, -d.arm],
					bob: step % 2,
				}),
				props: [dumbbell((d) => handAt(d, hand(d)))],
			};
		}

		case "stretch": {
			const step = counter % 4;
			const up = step < 2;

			return {
				x: home,
				facing: 1,
				pose: (d) => ({
					...standing(d, up ? [step, d.arm] : [d.arm, step - 2]),
					backHand: up ? [-step, d.arm] : [d.arm - 1, step - 3],
					bob: step % 2,
				}),
			};
		}

		case "levelUp": {
			const step = counter % 4;
			const lift = [0, 2, 3, 1][step] ?? 0;

			return {
				x: home,
				facing: 1,
				pose: (d) => ({ ...standing(d, [1, d.arm]), lift }),
				props: [
					sparkle(
						step % 2 === 0
							? [
									[-5, 20],
									[5, 22],
									[-6, 12],
									[6, 14],
								]
							: [
									[-6, 22],
									[6, 20],
									[-5, 14],
									[5, 12],
								],
					),
				],
			};
		}
	}
}

export const intervalOf = (activity: Activity): number =>
	({
		idle: 200,
		focus: 180,
		break: 380,
		eat: 300,
		run: 110,
		lift: 400,
		stretch: 480,
		levelUp: 160,
	})[activity];

// How many ticks one loop of an activity takes on a stage of `width`.
export function cycleOf(activity: Activity, width: number): number {
	const walk = Math.max(width - 7, 6) - 5;

	if (activity === "idle") {
		return 2 * (8 + walk);
	}

	if (activity === "run") {
		return 2 * Math.max(Math.ceil(walk / 2), 1);
	}

	return activity === "break" ? 6 : 4;
}

type Put = (x: number, y: number, key: string) => void;

// Everything a painter needs; `upper` follows the breathing, `put` stays planted.
type Paint = Readonly<{
	put: Put;
	upper: Put;
	d: Dims;
	body: Body;
	gear: Gear;
	pose: Pose;
	counter: number;
}>;

const span = (put: Put, from: number, to: number, y: number, key: string) => {
	for (let x = from; x <= to; x++) {
		put(x, y, key);
	}
};

function paintArm(
	{ upper, gear }: Paint,
	shoulder: Point,
	hand: Point,
	isFront: boolean,
) {
	const points = pointsOf(shoulder, [
		shoulder[0] + hand[0],
		shoulder[1] + hand[1],
	]);
	const sleeve = gear.top === 0 ? "U" : "c";
	const skin = isFront ? "s" : "q";

	for (const [index, [x, y]] of points.entries()) {
		const isHand = index === points.length - 1;
		const isBare = gear.top === 0 && index >= 2;
		upper(x, y, isHand || isBare ? skin : sleeve);
	}

	const wrist = points.at(-2);

	if (isFront && gear.gadget === 2 && wrist && points.length > 2) {
		upper(wrist[0], wrist[1], "t");
	}
}

// Behind the body: a cape that flares and ripples, or a backpack.
function paintBack({ upper, d, gear, counter }: Paint) {
	if (gear.back === 2) {
		for (let row = 0; row <= d.torso + 3; row++) {
			const flare = Math.floor(row / 3) + ((counter + row) % 4 < 2 ? 0 : 1);
			upper(d.left - 1 - flare, d.shoulder - row, "z");
			span(upper, d.left - flare, d.left, d.shoulder - row, "S");
		}
	} else if (gear.back === 1) {
		for (let row = 1; row <= 5; row++) {
			upper(d.left - 1, d.shoulder - row, row === 1 ? "B" : "b");
			upper(d.left - 2, d.shoulder - row, "b");
		}
	}
}

function paintLegs({ put, d, pose }: Paint) {
	const leg = (hip: number, foot: Point, pants: string, shoe: string) => {
		const footX = hip + foot[0];

		for (const [x, y] of pointsOf([hip, d.legs], [footX, foot[1] + 1])) {
			span(put, x, x + d.legWidth - 1, y, pants);
		}

		span(put, footX, footX + d.legWidth, foot[1], shoe);
	};

	leg(d.backHip, pose.back, "P", "W");
	leg(d.frontHip, pose.front, "p", "w");
}

// Men carry width at the shoulders, women at the hips.
function paintTorso({ upper, d, body, gear }: Paint) {
	const [coat, shade] = gear.top === 0 ? ["T", "U"] : ["C", "c"];

	for (let row = 0; row < d.torso; row++) {
		const narrowed =
			(body.gender === "female" && row >= d.torso - 2) ||
			(body.gender === "male" && row < 2);
		const left = d.left + (narrowed ? 1 : 0);
		upper(left, d.legs + 1 + row, shade);
		span(upper, left + 1, d.right, d.legs + 1 + row, coat);
	}

	if (gear.top === 1) {
		span(upper, d.left, d.left + 1, d.shoulder + 1, shade);
	} else if (gear.top === 2) {
		for (let row = 0; row < d.torso; row++) {
			upper(d.right, d.legs + 1 + row, "S");
		}

		upper(d.right - 1, d.shoulder, "S");
	}
}

// Facing forward, with the hair at the back of the head.
function paintHead({ upper, d, body, pose }: Paint) {
	const n = d.neck;
	span(upper, -1, 0, n, "q");

	for (let row = 1; row <= 4; row++) {
		span(upper, -1, 1, n + row, "s");
		upper(-2, n + row, "h");
	}

	upper(2, n + 2, "s");
	upper(1, n + 3, pose.blink ? "s" : "e");
	span(upper, -2, 1, n + 5, "h");
	upper(-1, n + 4, "h");

	if (body.gender === "female") {
		for (let y = n - 2; y <= n + 4; y++) {
			upper(-3, y, "h");
		}

		span(upper, -2, -2, n - 1, "h");
		upper(-2, n, "h");
		upper(0, n + 4, "h");
	} else if (body.gender === "other") {
		for (let y = n + 1; y <= n + 3; y++) {
			upper(-3, y, "h");
		}
	}
}

// Headphones go on first, so a cap or a crown sits over their band.
function paintHeadgear({ upper, d, gear }: Paint) {
	const n = d.neck;

	if (gear.gadget === 1) {
		upper(-2, n, "S");
		upper(1, n, "S");
	} else if (gear.gadget === 2) {
		span(upper, -2, 1, n + 5, "k");
		upper(-1, n + 2, "S");
		upper(-1, n + 3, "S");
	}

	if (gear.headwear === 1) {
		span(upper, -2, 1, n + 5, "S");
		span(upper, -2, 0, n + 6, "S");
		span(upper, 2, 3, n + 5, "z");
	} else if (gear.headwear === 2) {
		span(upper, -2, 1, n + 6, "g");
		upper(-2, n + 7, "g");
		upper(0, n + 7, "g");
		upper(-1, n + 6, "t");
	}
}

function drawCharacter(paint: Paint) {
	const { d, pose } = paint;
	paintBack(paint);
	paintArm(paint, [d.left + 1, d.shoulder], pose.backHand, false);
	paintLegs(paint);
	paintTorso(paint);
	paintHead(paint);
	paintHeadgear(paint);
	paintArm(paint, shoulderOf(d), pose.frontHand, true);
}

export function paletteOf(palette: Palette): ReadonlyMap<string, string> {
	const { cloak, cloakShade, scarf, scarfShade, glow } = palette.sprite;

	return new Map([
		["B", "#3E3226"],
		["b", "#5A4632"],
		["C", cloak],
		["c", cloakShade],
		["D", "#50555F"],
		["d", "#8A8F99"],
		["e", "#2B2B2B"],
		["F", "#C8473F"],
		["G", "#5F8F4E"],
		["g", "#D9B45A"],
		["h", "#6B4A2E"],
		["k", "#2B2B2B"],
		["L", "#4A505B"],
		["l", glow],
		["o", "#5A3A25"],
		["P", "#3E6870"],
		["p", "#4F8189"],
		["Q", "#E6E0D4"],
		["q", "#C99872"],
		["S", scarf],
		["s", "#E2B48C"],
		["T", "#DCD7CC"],
		["t", glow],
		["U", "#B4AE9F"],
		["v", "#9AA0A8"],
		["W", "#C8C8C8"],
		["w", "#F2F2F2"],
		["x", "#3D414B"],
		["y", palette.soft],
		["z", scarfShade],
	]);
}

export type SceneInput = Readonly<{
	activity: Activity;
	counter: number;
	level: number;
	body: Body;
	width: number;
}>;

// The pixel keys of 1 frame, row by row, "." where nothing is drawn.
export function composeScene({
	activity,
	counter,
	level,
	body,
	width,
}: SceneInput): string[] {
	const canvas = Array.from({ length: stageHeight }, () =>
		Array.from({ length: width }, () => "."),
	);
	const scene = sceneOf(activity, counter, width);
	const d = dimsOf(body);
	const pose = scene.pose(d);
	const lift = pose.lift ?? 0;
	const put = (x: number, y: number, key: string) => {
		const column = scene.x + scene.facing * x;
		const row = canvas[stageHeight - 1 - (y + lift)];

		if (row && column >= 0 && column < width && key !== ".") {
			row[column] = key;
		}
	};

	drawCharacter({
		put,
		upper(x, y, key) {
			put(x, y - (pose.bob ?? 0), key);
		},
		d,
		body,
		gear: gearOf(level),
		pose,
		counter,
	});

	for (const draw of scene.props ?? []) {
		draw(put, d);
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
