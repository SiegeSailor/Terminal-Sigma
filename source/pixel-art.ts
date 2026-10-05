import type { Gender, HealthGoal, Mood } from "./i18n.js";
import type { Palette } from "./theme.js";

// The pet lives on a stage as wide as its panel and 28 pixels tall. Each
// terminal cell draws 2 stacked pixels with "▀", foreground for the top and
// background for the bottom, so the stage takes 14 rows.
export const stageHeight = 28;

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

// What the profile decides: how tall and wide the pet is, what it wears on its
// head for the gender, and the accessory for the health goal.
export type Look = Readonly<{
	size: number;
	build: Build;
	gender: Gender;
	goal?: HealthGoal;
}>;

export const defaultLook: Look = { size: 1, build: "average", gender: "other" };

export function lookOf(
	profile:
		| Readonly<{
				height: number;
				weight: number;
				gender: Gender;
				goal: HealthGoal;
		  }>
		| undefined,
): Look {
	if (!profile) {
		return defaultLook;
	}

	const bmi = profile.weight / (profile.height / 100) ** 2;
	let build: Build = "average";

	if (bmi < 20) {
		build = "slim";
	} else if (bmi >= 27) {
		build = "broad";
	}

	return {
		size: Math.min(Math.max(Math.floor((profile.height - 150) / 12), 0), 3),
		build,
		gender: profile.gender,
		goal: profile.goal,
	};
}

// What today's logs decide: a badge for each kind logged today.
export type Badges = Readonly<{
	meal: boolean;
	workout: boolean;
	focus: boolean;
}>;

export const noBadges: Badges = { meal: false, workout: false, focus: false };

// Each equipment slot upgrades once from level 2 and again 4 levels later,
// staggered so every level from 2 to 9 changes exactly 1 piece.
export const gearOf = (level: number) => {
	const tier = (slot: number) =>
		Math.min(Math.max(Math.floor((level - 2 - slot) / 4) + 1, 0), 2);

	return { gadget: tier(0), wear: tier(1), headwear: tier(2), aura: tier(3) };
};

// The pet grows twice: a hatchling below level 4, an adult from level 7.
export const growthOf = (level: number) =>
	level >= 7 ? 2 : level >= 4 ? 1 : 0;

type Gear = ReturnType<typeof gearOf>;
type ArmPose = "down" | "mid" | "up" | "forward";

type Pose = Readonly<{
	step?: 0 | 1 | 2;
	arms?: readonly [ArmPose, ArmPose];
	lift?: number;
	squash?: number;
	eyes?: "open" | "closed" | "happy";
	look?: number;
}>;

type Put = (x: number, y: number, key: string) => void;

type Shape = Readonly<{ width: number; height: number; top: number }>;

type Draw = (put: Put, shape: Shape, counter: number) => void;

type Scene = Readonly<{
	x: number;
	facing: 1 | -1;
	pose: Pose;
	props?: Draw[];
}>;

const widthOf: Record<Build, number> = { slim: 13, average: 15, broad: 18 };

const shapeOf = (look: Look, level: number, squash = 0): Shape => {
	const growth = growthOf(level) - 1;
	const width = widthOf[look.build] + growth * 2 - squash;
	const height = 9 + look.size + growth * 2 + squash;

	return { width, height, top: height + 1 };
};

const span = (put: Put, from: number, to: number, y: number, key: string) => {
	for (let x = from; x <= to; x++) {
		put(x, y, key);
	}
};

const icon =
	(rows: readonly string[], x: number, y: number): Draw =>
	(put) => {
		for (const [offset, row] of rows.entries()) {
			for (const [index, key] of [...row].entries()) {
				put(x + index, y - offset, key);
			}
		}
	};

const sparkles =
	(points: ReadonlyArray<readonly [number, number]>): Draw =>
	(put, shape) => {
		for (const [x, y] of points) {
			put(x < 0 ? x : shape.width - 1 + x, y + shape.top, "y");
		}
	};

const laptop: Draw = (put, { width }) => {
	span(put, width + 3, width + 8, 0, "x");

	for (let y = 1; y <= 2; y++) {
		put(width + 7, y, "x");
	}

	span(put, width + 3, width + 7, 3, "L");

	for (let y = 4; y <= 7; y++) {
		put(width + 6, y, "l");
		put(width + 7, y, "L");
	}
};

const held =
	(rows: readonly string[], dy: (shape: Shape) => number): Draw =>
	(put, shape) => {
		icon(rows, shape.width + 2, dy(shape))(put, shape, 0);
	};

// Where the pet stands and what it does on every tick of `counter`.
function sceneOf(
	activity: Activity,
	counter: number,
	width: number,
	shape: Shape,
	mood: Mood,
): Scene {
	const home = 3;
	const minimum = 3;
	const maximum = Math.max(width - shape.width - 3, minimum + 1);
	const travel = maximum - minimum;
	const tick = counter % 4;

	if (activity === "idle" && mood === "sleepy") {
		// Napping in place: breathing, with Zs drifting up.
		return {
			x: Math.floor((width - shape.width) / 2),
			facing: 1,
			pose: { squash: tick < 2 ? 0 : 1, eyes: "closed" },
			props: [
				(put, { width: body, top }) => {
					const rise = counter % 6;
					icon(
						["zzzz", "..z.", ".z..", "zzzz"],
						body - 2 + rise,
						top + 4 + rise,
					)(put, shape, 0);
				},
			],
		};
	}

	if (activity === "idle") {
		// Wander: pause, walk across, pause and look about, walk back.
		const pause = 6;
		const cycle = 2 * (pause + travel);
		const at = counter % cycle;
		const isHappy = mood === "happy";
		const walk = (step: number): Pose => ({
			step: step % 2 === 0 ? 1 : 2,
			look: 1,
			lift: isHappy && step % 2 === 1 ? 1 : 0,
			eyes: isHappy ? "happy" : "open",
		});
		const rest = (moment: number): Pose => ({
			squash: Math.floor(moment / 2) % 2,
			eyes: isHappy ? "happy" : moment === 4 ? "closed" : "open",
			arms: isHappy && moment % 2 === 0 ? ["up", "up"] : undefined,
		});

		if (at < pause) {
			return {
				x: minimum,
				facing: at === 2 || at === 3 ? -1 : 1,
				pose: rest(at),
			};
		}

		if (at < pause + travel) {
			return { x: minimum + at - pause, facing: 1, pose: walk(at - pause) };
		}

		if (at < 2 * pause + travel) {
			const moment = at - pause - travel;
			return {
				x: maximum,
				facing: moment === 2 || moment === 3 ? 1 : -1,
				pose: rest(moment),
			};
		}

		const step = at - 2 * pause - travel;
		return { x: maximum - step, facing: -1, pose: walk(step) };
	}

	switch (activity) {
		case "run": {
			const lap = Math.max(Math.ceil(travel / 2), 1);
			const at = counter % (2 * lap);
			const forward = at < lap;
			const step = forward ? at : at - lap;

			return {
				x: forward
					? Math.min(minimum + step * 2, maximum)
					: Math.max(maximum - step * 2, minimum),
				facing: forward ? 1 : -1,
				pose: {
					step: counter % 2 === 0 ? 1 : 2,
					lift: counter % 2,
					look: 1,
					arms: counter % 2 === 0 ? ["up", "down"] : ["down", "up"],
				},
				props: [icon(["vv.", "...", ".vv"], -6, 6)],
			};
		}

		case "focus": {
			return {
				x: home,
				facing: 1,
				pose: {
					look: 1,
					squash: tick < 2 ? 0 : 1,
					arms: ["down", tick % 2 === 0 ? "forward" : "mid"],
				},
				props: [
					laptop,
					(put, { width: body }) => {
						put(body + 5 + (tick % 2), 9 + tick, "y");
						put(body + 7 - (tick % 2), 9 + ((tick + 2) % 4), "y");
					},
				],
			};
		}

		case "break": {
			const step = counter % 6;
			const sipping = step >= 4;

			return {
				x: home,
				facing: 1,
				pose: {
					look: 1,
					squash: step % 2,
					eyes: sipping ? "closed" : "open",
					arms: ["down", sipping ? "up" : "mid"],
				},
				props: [
					held(["QQ", "Qc"], (shape) =>
						sipping ? shape.top - 1 : Math.ceil(shape.height / 2) + 2,
					),
					...(sipping
						? []
						: [
								held(
									step % 2 === 0 ? [".v", "v."] : ["v.", ".v"],
									(shape) => Math.ceil(shape.height / 2) + 5,
								),
							]),
				],
			};
		}

		case "eat": {
			const atMouth = tick === 1 || tick === 2;

			return {
				x: home,
				facing: 1,
				pose: {
					look: 1,
					squash: tick === 2 ? 1 : 0,
					eyes: tick === 2 ? "happy" : "open",
					arms: ["down", atMouth ? "up" : "mid"],
				},
				props: [
					held(tick === 3 ? [".G", "F.", "FF"] : [".G", "FF", "FF"], (shape) =>
						atMouth ? shape.top - 2 : Math.ceil(shape.height / 2) + 2,
					),
				],
			};
		}

		case "lift": {
			const up = tick === 1 || tick === 2;

			return {
				x: home,
				facing: 1,
				pose: {
					arms: up ? ["up", "up"] : ["mid", "mid"],
					lift: tick === 2 ? 1 : 0,
					squash: up ? 0 : 1,
				},
				props: [
					(put, shape) => {
						const y = up ? shape.top + 3 : Math.ceil(shape.height / 2) + 4;
						span(put, -3, shape.width + 2, y, "d");
						icon(["DD", "DD", "DD"], -4, y + 1)(put, shape, 0);
						icon(["DD", "DD", "DD"], shape.width + 2, y + 1)(put, shape, 0);
					},
				],
			};
		}

		case "stretch": {
			return {
				x: home,
				facing: 1,
				pose: {
					arms: tick < 2 ? ["up", "up"] : ["mid", "mid"],
					squash: tick < 2 ? -1 : 1,
					eyes: tick === 1 ? "closed" : "open",
				},
			};
		}

		case "levelUp": {
			return {
				x: home,
				facing: 1,
				pose: {
					arms: ["up", "up"],
					lift: [0, 2, 3, 1][tick] ?? 0,
					eyes: "happy",
				},
				props: [
					sparkles(
						tick % 2 === 0
							? [
									[-3, 2],
									[3, 4],
									[-4, -3],
									[4, -1],
								]
							: [
									[-4, 4],
									[4, 2],
									[-3, -1],
									[3, -3],
								],
					),
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
		lift: 400,
		stretch: 480,
		levelUp: 160,
	})[activity];

// How many ticks one loop of an activity takes on a stage of `width`.
export function cycleOf(activity: Activity, width: number): number {
	const travel = Math.max(width - 21, 4);

	if (activity === "idle") {
		return 2 * (6 + travel);
	}

	if (activity === "run") {
		return 2 * Math.max(Math.ceil(travel / 2), 1);
	}

	return activity === "break" ? 6 : 4;
}

type Paint = Readonly<{
	put: Put;
	shape: Shape;
	look: Look;
	gear: Gear;
	pose: Pose;
	counter: number;
}>;

// Behind the body: a cape that flares and ripples, or sparkles of the aura.
function paintBehind({ put, shape, gear, counter }: Paint) {
	if (gear.wear === 2) {
		for (let y = 2; y <= shape.top - 2; y++) {
			const flare =
				Math.floor((shape.top - y) / 3) + ((counter + y) % 4 < 2 ? 0 : 1);
			span(put, -1 - flare, -1, y, y === 2 ? "s" : "S");
		}
	}

	if (gear.aura === 2) {
		const sway = counter % 2;
		put(-3 - sway, shape.top - 1, "y");
		put(shape.width + 2 + sway, shape.top - 3, "y");
		put(-2, 3 + sway, "y");
	}
}

// 4 short legs, like the Claude Code mascot; sneakers for an endurance goal.
function paintLegs({ put, shape, look, pose }: Paint) {
	const columns = [1, 3, shape.width - 4, shape.width - 2];
	const foot = look.goal === "endurance" ? "w" : "o";

	for (const [index, x] of columns.entries()) {
		const isLifted =
			(pose.step === 1 && index % 2 === 0) ||
			(pose.step === 2 && index % 2 === 1);

		if (!isLifted) {
			put(x, 0, foot);
		}

		put(x, 1, "o");
	}
}

function paintBody({ put, shape, look, gear }: Paint) {
	const { width, top } = shape;

	for (let y = 2; y <= top; y++) {
		const isEdge = y === 2 || y === top;
		span(
			put,
			isEdge ? 1 : 0,
			isEdge ? width - 2 : width - 1,
			y,
			y === 2 ? "o" : "O",
		);
	}

	span(put, 1, 2, top - 1, "h");

	if (look.goal === "loseFat") {
		span(put, 0, width - 1, top - 1, "w");
	} else if (look.goal === "maintain") {
		const middle = Math.floor(width / 2);
		icon(["r.r", "rrr", ".r."], middle - 1, 6)(put, shape, 0);
	}

	if (gear.wear === 1) {
		span(put, 0, width - 1, top - 5, "S");
		put(-1, top - 5, "S");
		put(-2, top - 6, "s");
	}
}

function paintFace({ put, shape, pose, counter }: Paint) {
	const look = pose.look ?? 0;
	const eyeY = shape.top - 3;
	const eyes = [
		Math.round(shape.width * 0.3) + look,
		Math.round(shape.width * 0.7) - 1 + look,
	];

	for (const x of eyes) {
		if (pose.eyes === "closed") {
			span(put, x, x + 1, eyeY, "e");
		} else if (pose.eyes === "happy") {
			put(x - 1, eyeY, "e");
			put(x, eyeY + 1, "e");
			put(x + 1, eyeY, "e");
			put(x, eyeY - 2, "r");
		} else {
			put(x, eyeY, "e");
			put(x, eyeY + 1, counter % 23 === 0 ? "O" : "e");
		}
	}
}

// Side nubs; a muscle goal makes them bigger.
function paintArms({ put, shape, look, pose }: Paint) {
	const size = look.goal === "buildMuscle" ? 3 : 2;
	const [back, front] = pose.arms ?? ["down", "down"];
	const rowOf = (arm: ArmPose) =>
		({
			down: 3 + size - 1,
			mid: Math.ceil(shape.height / 2) + size,
			up: shape.top + size - 1,
			forward: Math.ceil(shape.height / 2) + size,
		})[arm];

	const nub = (x: number, arm: ArmPose) => {
		const reach = arm === "forward" ? 1 : 0;

		for (let row = 0; row < size; row++) {
			span(
				put,
				x + reach,
				x + reach + size - 1,
				rowOf(arm) - row,
				row === size - 1 ? "o" : "O",
			);
		}
	};

	nub(-size, back);
	nub(shape.width, front);
}

// Gender sets an ornament at the back of the head, level the gear on top.
function paintHead({ put, shape, look, gear, counter }: Paint) {
	const { width, top } = shape;

	if (look.gender === "female") {
		icon(["r.r", "rrr", "r.r"], 0, top + 3)(put, shape, 0);
	} else if (look.gender === "male") {
		put(1, top + 1, "O");
		put(2, top + 2, "O");
		put(3, top + 1, "O");
	} else {
		put(2, top + 1, "G");
		put(1, top + 2, "G");
		put(3, top + 3, "G");
	}

	if (gear.gadget >= 1) {
		span(put, 5, width - 2, top + 1, "k");
		icon(["S", "S"], -1, top - 1)(put, shape, 0);
		icon(["S", "S"], width, top - 1)(put, shape, 0);
	}

	if (gear.gadget === 2) {
		put(width - 3, top + 2, "k");
		put(width - 3, top + 3, counter % 2 === 0 ? "t" : "y");
	}

	if (gear.headwear === 1) {
		span(put, 5, width - 3, top + 1, "S");
		span(put, 6, width - 4, top + 2, "S");
		span(put, width - 2, width, top + 1, "s");
	} else if (gear.headwear === 2) {
		span(put, 6, width - 3, top + 1, "g");
		put(6, top + 2, "g");
		put(Math.floor((width + 3) / 2), top + 2, "g");
		put(width - 3, top + 2, "g");
		put(Math.floor((width + 3) / 2), top + 1, "t");
	}

	if (gear.aura >= 1) {
		const bob = counter % 4 < 2 ? 0 : 1;
		put(width + 4, top + 2 + bob, "t");
		put(width + 4, top + 3 + bob, "y");
	}
}

export function paletteOf(palette: Palette): ReadonlyMap<string, string> {
	const { cloak, cloakShade, glow } = palette.sprite;

	return new Map([
		["c", "#5A3A25"],
		["D", "#50555F"],
		["d", "#8A8F99"],
		["e", "#1E1E1E"],
		["F", "#C8473F"],
		["G", "#6FA35A"],
		["g", "#D9B45A"],
		["h", palette.soft],
		["k", "#2B2B2B"],
		["L", "#4A505B"],
		["l", glow],
		["O", palette.accent],
		["o", palette.deep],
		["Q", "#E6E0D4"],
		["r", "#E87A90"],
		["S", cloak],
		["s", cloakShade],
		["T", "#E5533D"],
		["t", glow],
		["v", "#9AA0A8"],
		["w", "#F2F2F2"],
		["x", "#3D414B"],
		["y", palette.soft],
		["z", "#C8C8C8"],
	]);
}

export type SceneInput = Readonly<{
	activity: Activity;
	counter: number;
	level: number;
	look: Look;
	mood: Mood;
	badges: Badges;
	width: number;
}>;

// The pixel keys of 1 frame, row by row, "." where nothing is drawn.
export function composeScene({
	activity,
	counter,
	level,
	look,
	mood,
	badges,
	width,
}: SceneInput): string[] {
	const canvas = Array.from({ length: stageHeight }, () =>
		Array.from({ length: width }, () => "."),
	);
	const plain = (column: number, y: number, key: string) => {
		const row = canvas[stageHeight - 1 - y];

		if (row && column >= 0 && column < width && key !== ".") {
			row[column] = key;
		}
	};

	const baseShape = shapeOf(look, level);
	const scene = sceneOf(activity, counter, width, baseShape, mood);
	const shape = shapeOf(look, level, scene.pose.squash ?? 0);
	const lift = scene.pose.lift ?? 0;
	// Local x runs from the body's left edge toward where the pet faces.
	const put: Put = (x, y, key) => {
		const column =
			scene.facing === 1 ? scene.x + x : scene.x + baseShape.width - 1 - x;
		plain(column, y + lift, key);
	};

	const paint: Paint = {
		put,
		shape,
		look,
		gear: gearOf(level),
		pose: scene.pose,
		counter,
	};

	paintBehind(paint);
	paintLegs(paint);
	paintBody(paint);
	paintFace(paint);
	paintArms(paint);
	paintHead(paint);

	for (const draw of scene.props ?? []) {
		draw(put, shape, counter);
	}

	// Today's badges float in the top right corner, whatever the pet does.
	const icons = [
		badges.focus ? ["GGG", "TTT", "TTT"] : undefined,
		badges.meal ? [".G.", "FFF", ".F."] : undefined,
		badges.workout ? ["D.D", "DdD", "D.D"] : undefined,
	].filter((rows) => rows !== undefined);

	for (const [index, rows] of icons.entries()) {
		icon(rows, width - 4 - index * 4, stageHeight - 2)(plain, shape, 0);
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
