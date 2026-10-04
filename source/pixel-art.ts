// The character is a 16x20 pixel canvas. Each terminal cell draws 2 stacked
// pixels with "▀", foreground for the top and background for the bottom.
export const spriteWidth = 16;
export const spriteHeight = 20;

type Layer = Readonly<{ y: number; rows: readonly string[] }>;
type Frame = Readonly<{
	layers: readonly Layer[];
	dy?: number;
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

const rows = (count: number, row: string) =>
	Array.from({ length: count }, () => row);

const head: Layer = {
	y: 2,
	rows: [
		"....kkkkkkkk....",
		"...khhhhhhhhk...",
		"..khhhhhhhhhhk..",
		"..khsssssssshk..",
		"..kssessssessk..",
		"..ksrssmmssrsk..",
		"...kssssssssk...",
		"....kkksskkk....",
	],
};
const body: Layer = {
	y: 10,
	rows: [
		"...kaaaaaaaak...",
		"...kAaaaaaaAk...",
		"...kAaaaaaaAk...",
		"...knnnnnnnnk...",
		"...kppppppppk...",
	],
};
const straps: Layer = { y: 10, rows: rows(3, "......P..P......") };
const leftArm: Layer = {
	y: 10,
	rows: ["..kA............", "..kA............", "..ks............"],
};
const rightArm: Layer = {
	y: 10,
	rows: ["............Ak..", "............Ak..", "............sk.."],
};
const swingingArms: Layer = {
	y: 10,
	rows: ["..kA........Ak..", ".ks..........sk."],
};
const raisedArms: Layer = {
	y: 3,
	rows: [
		".s............s.",
		...rows(4, ".A............A."),
		...rows(3, "..A..........A.."),
	],
};
const standingLegs: Layer = {
	y: 15,
	rows: [
		"....kpp..ppk....",
		"....kpp..ppk....",
		"....kbb..bbk....",
		"...kbbb..bbbk...",
	],
};
const stridingLegs: Layer = {
	y: 15,
	rows: ["....kpp..ppk....", "...kpp....ppk...", "..kbb......bbk.."],
};
const passingLegs: Layer = {
	y: 15,
	rows: [
		".....kppppk.....",
		"......kppk......",
		"......kbbk......",
		".....kbbbbk.....",
	],
};
const sweat: Layer = { y: 3, rows: ["..............d."] };
const motionLines: Layer = {
	y: 15,
	rows: ["vv..............", "................", "v..............."],
};
const laptop: Layer = {
	y: 12,
	rows: [
		"..kggggggggggk..",
		"..kggggLLggggk..",
		"..kggggLLggggk..",
		"..kggggggggggk..",
		".kkkkkkkkkkkkkk.",
	],
};
const typingArms = (hands: string): Layer => ({
	y: 10,
	rows: ["..kA........Ak..", hands],
});
const cup: Layer = {
	y: 11,
	rows: [".............ccc", ".............chc", ".............ccc"],
};
const steam = (y: number, row: string): Layer => ({ y, rows: [row] });
const appleAtMouth: Layer = {
	y: 6,
	rows: [
		".........q......",
		".........ff.....",
		".........ff.....",
		"..........s.....",
		"..........AAk...",
	],
};
const appleInHand: Layer = {
	y: 11,
	rows: ["...............q", "..............ff", "..............ff"],
};
const chewing: Layer = { y: 7, rows: [".......oo......."] };
const dumbbellsUp: Layer = {
	y: 1,
	rows: [
		"GG............GG",
		"GG............GG",
		".s............s.",
		...rows(6, ".A............A."),
		"..A..........A..",
	],
};
const dumbbellsDown: Layer = {
	y: 7,
	rows: [
		"GG............GG",
		"GG............GG",
		".s............s.",
		".AA..........AA.",
	],
};
const sparkles = (top: string, y: number, bottom: string): Layer[] => [
	{ y: 0, rows: [top] },
	{ y, rows: [bottom] },
];

const weapons: readonly Layer[] = [
	{ y: 2, rows: ["..............O.", ...rows(15, "..............W.")] },
	{ y: 4, rows: [".O..............", ...rows(11, ".G..............")] },
	{
		y: 0,
		rows: [
			...rows(11, "..............B."),
			".............yyy",
			"..............n.",
			"..............n.",
		],
	},
];
const helmets: readonly Layer[][] = [
	[
		{
			y: 2,
			rows: [
				"....HHHHHHHH....",
				"...HHHHHHHHHH...",
				"..HHH......HHH..",
				...rows(3, "..HH........HH.."),
				"...H........H...",
			],
		},
	],
	[
		{
			y: 1,
			rows: ["...........V....", "....MMMMMMMM....", "...kMMMMMMMMk..."],
		},
		{ y: 6, rows: ["..kVVVVVVVVVVk.."] },
	],
	[
		{
			y: 0,
			rows: [
				".Y............Y.",
				".YY..........YY.",
				"..YYMMMMMMMMYY..",
				"...kMMMMMMMMk...",
				"..kMMMMMMMMMMk..",
			],
		},
	],
];

const arms = [leftArm, rightArm];

const animations: Record<Activity, { interval: number; frames: Frame[] }> = {
	idle: {
		interval: 300,
		frames: [
			...Array.from({ length: 11 }, () => ({
				layers: [...arms, standingLegs],
			})),
			{ layers: [...arms, standingLegs], blink: true },
		],
	},
	focus: {
		interval: 250,
		frames: [
			{
				layers: [
					typingArms("...ks......sk..."),
					standingLegs,
					laptop,
					steam(1, "............O..."),
				],
			},
			{
				layers: [
					typingArms("...kss....ssk..."),
					standingLegs,
					laptop,
					steam(0, "..............O."),
				],
			},
		],
	},
	break: {
		interval: 600,
		frames: [
			{
				layers: [...arms, standingLegs, cup, steam(10, "..............v.")],
			},
			{
				layers: [
					...arms,
					standingLegs,
					cup,
					steam(9, "..............v."),
					steam(8, ".............v.."),
				],
				blink: true,
			},
		],
	},
	eat: {
		interval: 400,
		frames: [
			{ layers: [leftArm, standingLegs, appleAtMouth] },
			{ layers: [...arms, standingLegs, appleInHand, chewing] },
		],
	},
	run: {
		interval: 180,
		frames: [
			{ layers: [swingingArms, stridingLegs, sweat, motionLines] },
			{ layers: [...arms, passingLegs], dy: -1 },
		],
	},
	lift: {
		interval: 500,
		frames: [
			{ layers: [dumbbellsUp, standingLegs, sweat] },
			{ layers: [dumbbellsDown, standingLegs] },
		],
	},
	stretch: {
		interval: 700,
		frames: [
			{ layers: [raisedArms, standingLegs] },
			{ layers: [...arms, standingLegs] },
		],
	},
	levelUp: {
		interval: 250,
		frames: [
			{
				layers: [
					raisedArms,
					standingLegs,
					...sparkles("...y........y...", 13, "y..............y"),
				],
			},
			{
				layers: [
					raisedArms,
					standingLegs,
					...sparkles("y..............y", 16, "..y..........y.."),
				],
				dy: -1,
			},
		],
	},
};

export const animationOf = (activity: Activity) => animations[activity];

// Each gear slot upgrades once from level 2 and again 4 levels later, staggered
// so every level from 2 to 9 changes exactly 1 piece.
export const gearOf = (level: number) => {
	const tier = (slot: number) =>
		Math.min(Math.max(Math.floor((level - 2 - slot) / 4) + 1, 0), 2);

	return {
		weapon: tier(0),
		armor: tier(1),
		helmet: tier(2),
		backpack: tier(3),
	};
};

const fixedColors: ReadonlyArray<[string, string]> = [
	["b", "#3a2a24"],
	["B", "#cfe8ff"],
	["c", "#f4f4f4"],
	["d", "#7fd3ff"],
	["e", "#2b2135"],
	["f", "#e5484d"],
	["g", "#9aa3ad"],
	["G", "#6e7681"],
	["h", "#6b4226"],
	["H", "#8e5cc4"],
	["k", "#2b2135"],
	["L", "#D97757"],
	["m", "#b5524f"],
	["M", "#b8c0cc"],
	["n", "#7a4f2a"],
	["o", "#7a2e2e"],
	["O", "#57e3f0"],
	["p", "#3d4f7a"],
	["q", "#4caf6a"],
	["r", "#f08c8c"],
	["s", "#f5c9a0"],
	["v", "#c8c8c8"],
	["V", "#57e3f0"],
	["W", "#9b6b3d"],
	["y", "#ffd84d"],
	["Y", "#f2e6c8"],
];
const armorColors = [
	["#4caf6a", "#2f7a45"],
	["#d9a440", "#9c7322"],
	["#4fb3e3", "#2a7fb0"],
] as const;
const backpackColors = ["#8a6d3b", "#c08a2e", "#57e3f0"] as const;

export function paletteOf(level: number): ReadonlyMap<string, string> {
	const gear = gearOf(level);
	const [armor, armorShade] = armorColors[gear.armor] ?? armorColors[0];

	return new Map([
		...fixedColors,
		["a", armor],
		["A", armorShade],
		["P", backpackColors[gear.backpack] ?? backpackColors[0]],
	]);
}

// The pixel keys of 1 frame, row by row, "." where nothing is drawn.
export function composeFrame(
	activity: Activity,
	frameIndex: number,
	level: number,
): string[] {
	const { frames } = animations[activity];
	const frame = frames[frameIndex % frames.length] ?? { layers: [] };
	const gear = gearOf(level);
	const canvas = rows(spriteHeight, ".".repeat(spriteWidth)).map((row) => [
		...row,
	]);
	const faceLayer: Layer = frame.blink
		? { y: head.y, rows: head.rows.map((row) => row.replaceAll("e", "s")) }
		: head;
	const layers = [
		weapons[gear.weapon],
		faceLayer,
		body,
		straps,
		...(helmets[gear.helmet] ?? []),
		...frame.layers,
	];

	for (const layer of layers) {
		if (!layer) {
			continue;
		}

		for (const [offset, row] of layer.rows.entries()) {
			const target = canvas[layer.y + offset + (frame.dy ?? 0)];

			for (const [x, key] of [...row].entries()) {
				if (target && key !== ".") {
					target[x] = key;
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
			const upper = palette.get(top[x] ?? ".");
			const lower = palette.get(bottom[x] ?? ".");
			const cell: Segment =
				upper === undefined
					? lower === undefined
						? { text: " " }
						: { text: "▄", color: lower }
					: { text: "▀", color: upper, backgroundColor: lower };
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
