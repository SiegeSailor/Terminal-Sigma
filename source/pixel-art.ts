import type { Palette } from "./theme.js";

// The character is a 20x28 pixel canvas, facing right. Each terminal cell draws
// 2 stacked pixels with "▀", foreground for the top and background for the bottom.
export const spriteWidth = 20;
export const spriteHeight = 28;

// Rows start at column `x`; "." is transparent. Upper layers move when the
// character breathes, while the legs stay planted.
type Layer = Readonly<{
	x: number;
	y: number;
	rows: readonly string[];
	upper?: boolean;
}>;

type Frame = Readonly<{
	legs: Layer;
	behind?: readonly Layer[];
	front?: readonly Layer[];
	dy?: number;
	breathe?: boolean;
	blink?: boolean;
}>;

export type Activity =
	| "idle"
	| "focus"
	| "break"
	| "eat"
	| "run"
	| "lift"
	| "stretch"
	| "levelUp";

const layer = (x: number, y: number, ...rows: string[]): Layer => ({
	x,
	y,
	rows,
});
const upper = (x: number, y: number, ...rows: string[]): Layer => ({
	x,
	y,
	rows,
	upper: true,
});

const hood = upper(
	0,
	2,
	"......kkkk",
	"....kkHHHHkk",
	"..kkHHHHHHHhk",
	"kkHHHHHHHHhffk",
	"..kHHHHHHhffEfk",
	"...kHHHHHhfffk",
	"....khhHHhffk",
	"....kkkkkkkk",
);
const neckScarf = upper(4, 10, "kSSSSSSSk", ".ksSSSsk");
const torso = upper(
	4,
	12,
	".kCCCCCCk",
	".kcCCCCCCk",
	".kcCCCCCCk",
	".kcCCCCCk",
	".knnnnNnk",
	"kcCCkCCCCk",
	"kcCk.kCCCk",
	".kk...kkk",
);
const pauldron = upper(8, 11, "kaak", ".aaak", ".AAk");

const tails = [
	upper(0, 10, "sSSS", "SS..", "s..."),
	upper(0, 9, "s...", ".SSS", "..sS"),
	upper(0, 10, "..SS", ".SSs", "Ss.."),
	upper(0, 10, "SSSS", "ssss"),
] as const;
const [tailA, tailB, tailC, tailStream] = tails;

const hangingArm = upper(10, 14, "cck", "cck", "cck", "mm");
const standingLegs = layer(
	5,
	19,
	".kpk.kpk",
	".kPk.kppk",
	".kPk.kppk",
	".kPk.kppk",
	".kPk.kppk",
	".kbk.kbbk",
	"kbbk.kbbbk",
	"kkkk.kkkkk",
);

const stride = (back: string, front: string) =>
	layer(
		1,
		19,
		`.....k${back}${back}${front}${front}k`,
		`....k${back}k..k${front}${front}k`,
		`...k${back}k....k${front}${front}k`,
		`..k${back}k......k${front}k`,
		".kbk.......kpk",
		"kbk........kbbk",
		"kk.........kkkk",
	);
const passing = (raised: string, planted: string) =>
	layer(
		4,
		19,
		`..k${raised}${planted}${planted}k`,
		`.kbk${planted}${planted}k`,
		`kbbkk${planted}k`,
		`.kk.k${planted}${planted}k`,
		`....k${planted}k`,
		"....kbbk",
		"....kbbbk",
		"....kkkkk",
	);
const runLegs = [
	stride("P", "p"),
	passing("P", "p"),
	stride("p", "P"),
	passing("p", "P"),
] as const;
const armForward = upper(10, 13, "cc..", ".cck", "..mm");
const armBack = upper(7, 13, "..cc", ".cc.", "mm..");
const speedLines = [
	layer(0, 14, "vv", "", "", "", "v", "", "", "vv"),
	layer(0, 15, "v", "", "", "vv", "", "", "", "v"),
] as const;

const table = layer(
	12,
	18,
	"xxxxxxxx",
	"......x.",
	"......x.",
	"......x.",
	"......x.",
	"......x.",
	"......x.",
	".....xxx",
);
const laptop = layer(
	13,
	12,
	"....lL",
	"....lL",
	"....lL",
	"....lL",
	"....lL",
	"LLLLLL",
);
const typing = [
	upper(10, 13, "cc..", ".cc.", "..cm", "...m"),
	upper(10, 13, "cc..", ".cc.", "..cm", "..m."),
] as const;
const codeBits = [
	layer(14, 9, "y", "", "..y", "", ".y"),
	layer(14, 7, ".y", "", "y", "", "..y"),
	layer(15, 5, "y", "", ".y", "", "y"),
	layer(14, 3, "..y", "", "y", "", ".y"),
] as const;

const cupLow = upper(10, 13, "cc..", ".ccm", "..QQ", "..Qo");
const cupRaised = upper(
	10,
	6,
	"...QQ",
	"...Qo",
	"..cm.",
	".cc..",
	".cc..",
	".cc..",
);
const steam = [
	layer(12, 12, ".v", "v.", ".v"),
	layer(12, 11, "v.", ".v", "v."),
	layer(14, 3, "v", ".v"),
] as const;

const appleAtMouth = upper(
	10,
	5,
	"...G.",
	"...FF",
	"...FF",
	"..cm.",
	".cc..",
	".cc..",
	".cc..",
);
const appleInHand = upper(10, 13, "cc...", ".cmF.", "..FFG");
const bitten = upper(10, 13, "cc...", ".cmF.", "..F.G");

const dumbbellUp = upper(
	13,
	0,
	"DDD",
	"DdD",
	"DDD",
	".m.",
	".c.",
	".c.",
	".c.",
	".c.",
	".c.",
	".c.",
	".c.",
	".c.",
	"cc.",
);
const dumbbellRacked = upper(13, 8, "DDD", "DdD", "DDD", ".m.", ".c.", "cc.");
const sweat = [layer(16, 6, "u"), layer(16, 8, "u")] as const;

const reachUp = upper(
	13,
	1,
	".m",
	".c",
	".c",
	".c",
	".c",
	".c",
	".c",
	".c",
	".c",
	".c",
	".c",
	"cc",
);
const reachForward = upper(10, 13, "ccccc", "....cmm");

const swordRaised = upper(
	13,
	0,
	".t.",
	".t.",
	".t.",
	".t.",
	"ggg",
	".m.",
	".c.",
	".c.",
	".c.",
	".c.",
	".c.",
	".c.",
	"cc.",
);
const sparkles = [
	layer(0, 1, ".y..........y", "", "", "", "", "", "y.................y"),
	layer(0, 3, "y.................y", "", "", "", "", "..y...........y"),
] as const;

const breathing = (legs: Layer, front: Layer[]): Frame[] => [
	{ legs, behind: [tailA], front },
	{ legs, behind: [tailB], front },
	{ legs, behind: [tailC], front, breathe: true },
	{ legs, behind: [tailB], front, breathe: true },
	{ legs, behind: [tailA], front },
	{ legs, behind: [tailB], front, blink: true },
	{ legs, behind: [tailC], front, breathe: true },
	{ legs, behind: [tailB], front, breathe: true },
];

const animations: Record<Activity, { interval: number; frames: Frame[] }> = {
	idle: {
		interval: 220,
		frames: breathing(standingLegs, [hangingArm]),
	},
	focus: {
		interval: 160,
		frames: codeBits.map((bits, index) => ({
			legs: standingLegs,
			behind: [index % 2 === 0 ? tailA : tailB, table],
			front: [laptop, typing[index % 2] ?? hangingArm, bits],
			breathe: index >= 2,
		})),
	},
	break: {
		interval: 380,
		frames: [
			{ legs: standingLegs, behind: [tailA], front: [cupLow, steam[0]] },
			{
				legs: standingLegs,
				behind: [tailB],
				front: [cupLow, steam[1]],
				breathe: true,
			},
			{
				legs: standingLegs,
				behind: [tailC],
				front: [cupLow, steam[0]],
				breathe: true,
			},
			{
				legs: standingLegs,
				behind: [tailB],
				front: [cupRaised, steam[2]],
				blink: true,
			},
			{
				legs: standingLegs,
				behind: [tailA],
				front: [cupRaised, steam[2]],
				blink: true,
			},
			{ legs: standingLegs, behind: [tailB], front: [cupLow, steam[1]] },
		],
	},
	eat: {
		interval: 300,
		frames: [
			{ legs: standingLegs, behind: [tailA], front: [appleInHand] },
			{ legs: standingLegs, behind: [tailB], front: [appleAtMouth] },
			{
				legs: standingLegs,
				behind: [tailC],
				front: [appleAtMouth],
				breathe: true,
			},
			{ legs: standingLegs, behind: [tailB], front: [bitten], breathe: true },
		],
	},
	run: {
		interval: 110,
		frames: runLegs.map((legs, index) => ({
			legs,
			behind: [tailStream, speedLines[index % 2] ?? tailStream],
			front: [index % 2 === 0 ? armForward : armBack],
			dy: index % 2 === 0 ? 0 : -1,
		})),
	},
	lift: {
		interval: 420,
		frames: [
			{ legs: standingLegs, behind: [tailA], front: [dumbbellRacked] },
			{
				legs: standingLegs,
				behind: [tailB],
				front: [dumbbellUp, sweat[0]],
				dy: -1,
			},
			{
				legs: standingLegs,
				behind: [tailC],
				front: [dumbbellUp, sweat[1]],
				dy: -1,
			},
			{
				legs: standingLegs,
				behind: [tailB],
				front: [dumbbellRacked],
				breathe: true,
			},
		],
	},
	stretch: {
		interval: 520,
		frames: [
			{ legs: standingLegs, behind: [tailA], front: [reachUp], dy: -1 },
			{ legs: standingLegs, behind: [tailB], front: [reachUp], dy: -1 },
			{
				legs: standingLegs,
				behind: [tailC],
				front: [reachForward],
				breathe: true,
			},
			{
				legs: standingLegs,
				behind: [tailB],
				front: [reachForward],
				breathe: true,
			},
		],
	},
	levelUp: {
		interval: 160,
		frames: sparkles.flatMap((burst, index) => [
			{
				legs: standingLegs,
				behind: [tailStream],
				front: [swordRaised, burst],
				dy: -1,
			},
			{
				legs: standingLegs,
				behind: [index === 0 ? tailA : tailC],
				front: [swordRaised, burst],
			},
		]),
	},
};

export const animationOf = (activity: Activity) => animations[activity];

// Each gear slot upgrades once from level 2 and again 4 levels later, staggered
// so every level from 2 to 9 changes exactly 1 piece.
export const gearOf = (level: number) => {
	const tier = (slot: number) =>
		Math.min(Math.max(Math.floor((level - 2 - slot) / 4) + 1, 0), 2);

	return { weapon: tier(0), armor: tier(1), hood: tier(2), relic: tier(3) };
};

const weapons: readonly Layer[] = [
	upper(2, 13, ".g.", "xxx", ".W.", ".W.", ".W.", ".W.", ".W.", ".w."),
	upper(
		2,
		11,
		".g.",
		".g.",
		"xxx",
		".w.",
		".W.",
		".W.",
		".W.",
		".W.",
		".W.",
		".W.",
		".W.",
		".w.",
	),
	upper(
		1,
		10,
		"..t",
		"..g",
		".xxx",
		".tw",
		".tw",
		".tw",
		".tw",
		".tw",
		".tw",
		".tw",
		".tw",
		".tw",
		"..t",
	),
];
const hoods: readonly Layer[] = [
	upper(0, 0, ""),
	upper(4, 4, "SSSSSSS"),
	upper(4, 0, ".Y....Y", ".YY..YY"),
];
// The relic is a companion orb that bobs beside the character.
const relics: ReadonlyArray<(bob: number) => Layer[]> = [
	() => [],
	(bob) => [layer(17, 4 + bob, "t")],
	(bob) => [layer(16, 3 + bob, ".y.", "ytt", ".tt")],
];
const orbBob = [0, 0, 1, 1] as const;

const armorColors = [
	["#6B4A35", "#4A3324"],
	["#A3ACB8", "#6A7380"],
	["#D9B45A", "#9C7A2E"],
] as const;

export function paletteOf(
	level: number,
	palette: Palette,
): ReadonlyMap<string, string> {
	const gear = gearOf(level);
	const [armor, armorShade] = armorColors[gear.armor] ?? armorColors[0];
	const { cloak, cloakShade, scarf, scarfShade, glow } = palette.sprite;

	return new Map([
		["A", armorShade],
		["a", armor],
		["b", "#3B2D25"],
		["C", cloak],
		["c", cloakShade],
		["D", "#50555F"],
		["d", "#8A8F99"],
		["E", glow],
		["F", "#C8473F"],
		["f", "#241F2B"],
		["G", "#5F8F4E"],
		["g", "#B8913A"],
		["H", cloak],
		["h", cloakShade],
		["k", "#15121A"],
		["L", "#4A505B"],
		["l", glow],
		["m", "#C99272"],
		["N", armor],
		["n", "#4A3628"],
		["o", "#5A3A25"],
		["P", "#23252F"],
		["p", "#2E3140"],
		["Q", "#E6E0D4"],
		["S", scarf],
		["s", scarfShade],
		["t", glow],
		["u", "#8FC6E8"],
		["v", "#9AA0A8"],
		["W", "#8792A0"],
		["w", "#C9D3DE"],
		["x", "#3D414B"],
		["Y", "#E8DCC0"],
		["y", palette.soft],
	]);
}

// The pixel keys of 1 frame, row by row, "." where nothing is drawn. The
// counter keeps running across frames, so the relic bobs on its own beat.
export function composeFrame(
	activity: Activity,
	counter: number,
	level: number,
): string[] {
	const { frames } = animations[activity];
	const frame = frames[counter % frames.length] ?? frames[0];
	const gear = gearOf(level);
	const canvas = Array.from({ length: spriteHeight }, () =>
		Array.from({ length: spriteWidth }, () => "."),
	);

	if (!frame) {
		return canvas.map((row) => row.join(""));
	}

	const lowerDy = frame.dy ?? 0;
	const upperDy = lowerDy + (frame.breathe ? 1 : 0);
	const head: Layer = frame.blink
		? { ...hood, rows: hood.rows.map((row) => row.replaceAll("E", "f")) }
		: hood;
	const layers = [
		weapons[gear.weapon],
		...(frame.behind ?? []),
		frame.legs,
		torso,
		neckScarf,
		head,
		hoods[gear.hood],
		pauldron,
		...(frame.front ?? []),
		...(relics[gear.relic]?.(orbBob[counter % orbBob.length] ?? 0) ?? []),
	];

	for (const item of layers) {
		if (!item) {
			continue;
		}

		const dy = item.upper ? upperDy : lowerDy;

		for (const [offset, row] of item.rows.entries()) {
			const target = canvas[item.y + offset + dy];

			for (const [index, key] of [...row].entries()) {
				if (target && key !== "." && item.x + index < spriteWidth) {
					target[item.x + index] = key;
				}
			}
		}
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

	for (let y = 0; y < frame.length; y += 2) {
		const top = frame[y] ?? "";
		const bottom = frame[y + 1] ?? "";
		const line: Segment[] = [];

		for (let x = 0; x < spriteWidth; x++) {
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
