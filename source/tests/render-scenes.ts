// Renders scenes to PNG contact sheets for the art review:
//   npm run build && node build/tests/render-scenes.js scenes
import { Buffer } from "node:buffer";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { crc32, deflateSync } from "node:zlib";
import {
	type Activity,
	composeScene,
	cycleOf,
	defaultLook,
	fatStages,
	muscleStages,
	paletteOf,
	type SceneInput,
	stageHeight,
} from "../pixel-art.js";
import { quietSignals } from "../signals.js";
import { facialHairs, hairColors, hairStyles, skinTones } from "../i18n.js";
import { themes } from "../theme.js";

export type Rgb = readonly [number, number, number];

// Each pixel becomes a 6 × 6 block, with 2 pixels of gap between frames.
const scale = 6;
const gap = 2;
const background: Rgb = [30, 30, 30];
const width = 32;

const chunk = (type: string, data: Uint8Array) => {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
	const checksum = Buffer.alloc(4);
	checksum.writeUInt32BE(crc32(body));
	return Buffer.concat([length, body, checksum]);
};

// A truecolor PNG with no filtering, from rows of RGB triples.
export function pngOf(rows: ReadonlyArray<readonly Rgb[]>) {
	const header = Buffer.alloc(13);
	header.writeUInt32BE(rows[0]?.length ?? 0, 0);
	header.writeUInt32BE(rows.length, 4);
	header.writeUInt8(8, 8);
	header.writeUInt8(2, 9);
	const raw = Buffer.concat(rows.map((row) => Buffer.from([0, ...row.flat()])));

	return Buffer.concat([
		Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
		chunk("IHDR", header),
		chunk("IDAT", deflateSync(raw)),
		chunk("IEND", Buffer.alloc(0)),
	]);
}

const rgbOf = (hex: string): Rgb => [
	Number.parseInt(hex.slice(1, 3), 16),
	Number.parseInt(hex.slice(3, 5), 16),
	Number.parseInt(hex.slice(5, 7), 16),
];

// Frames laid out `perRow` to a row, scaled up, on the window's background.
export function sheetOf(
	frames: ReadonlyArray<readonly string[]>,
	perRow: number,
): Rgb[][] {
	const palette = paletteOf(themes.ember);
	const frameWidth = (frames[0]?.[0]?.length ?? 0) + gap;
	const frameHeight = stageHeight + gap;
	const rows: Rgb[][] = [];

	for (let y = 0; y < Math.ceil(frames.length / perRow) * frameHeight; y++) {
		const row: Rgb[] = [];

		for (let x = 0; x < perRow * frameWidth; x++) {
			const frame =
				frames[
					Math.floor(y / frameHeight) * perRow + Math.floor(x / frameWidth)
				];
			const hex = palette.get(
				frame?.[y % frameHeight]?.[x % frameWidth] ?? ".",
			);
			const color = hex ? rgbOf(hex) : background;

			for (let repeat = 0; repeat < scale; repeat++) {
				row.push(color);
			}
		}

		for (let repeat = 0; repeat < scale; repeat++) {
			rows.push(row);
		}
	}

	return rows;
}

const activities: Activity[] = [
	"idle",
	"focus",
	"break",
	"eat",
	"run",
	"lift",
	"stretch",
	"levelUp",
	"drink",
	"weigh",
	"write",
];

const base: SceneInput = {
	activity: "idle",
	counter: 0,
	level: 1,
	look: defaultLook,
	mood: "content",
	width,
};

// Each sheet is 1 PNG; later tasks add theirs here.
export const sheets: Record<string, SceneInput[]> = {
	activities: activities.flatMap((activity) =>
		Array.from({ length: 8 }, (_, step) => ({
			...base,
			activity,
			counter: Math.floor((cycleOf(activity, width) * step) / 8),
		})),
	),
	bodies: (["female", "male", "other"] as const).flatMap((gender) =>
		Array.from({ length: 8 }, (_, step) => ({
			...base,
			look: { ...defaultLook, gender, fat: Math.round((fatStages * step) / 7) },
		})),
	),
	// The widest bodies in profile, waving, and with the arms flung wide.
	widest: (["female", "male", "other"] as const).flatMap((gender) => {
		const look = {
			...defaultLook,
			gender,
			height: 35,
			fat: fatStages,
			muscle: muscleStages,
		};
		const frames = [
			{ counter: 26 },
			{ counter: 28 },
			{ counter: 30 },
			{ counter: 32 },
			{ counter: 4, mood: "happy" as const },
			{ counter: 9, mood: "happy" as const },
			{ activity: "stretch" as const, counter: 25 },
			{ activity: "lift" as const, counter: 12 },
		];
		return frames.map((frame) => ({ ...base, look, ...frame }));
	}),
	// Tall characters leveling up: the hop stays under the stage's top.
	tall: [33, 35].flatMap((height) =>
		[1, 5, 10].flatMap((level) =>
			[0, 4, 6, 8].map((counter) => ({
				...base,
				activity: "levelUp" as const,
				counter,
				level,
				look: { ...defaultLook, height },
			})),
		),
	),
	appearance: skinTones.flatMap((skinTone) =>
		hairStyles.map((hairStyle) => ({
			...base,
			look: { ...defaultLook, skinTone, hairStyle },
		})),
	),
	// Hair color, glasses, and facial hair, in front (even rows) and profile.
	appearanceExtras: hairColors.flatMap((hairColor) =>
		[false, true].flatMap((glasses) =>
			facialHairs.flatMap((facialHair) =>
				[0, 24].map((counter) => ({
					...base,
					activity: counter === 0 ? ("focus" as const) : ("run" as const),
					counter,
					look: { ...defaultLook, hairColor, glasses, facialHair },
				})),
			),
		),
	),
	ages: Array.from({ length: 12 }, (_, index) => ({
		...base,
		look: { ...defaultLook, age: 30 + index * 5, facialHair: "beard" as const },
	})),
	// Each signal beside the quiet frame, then bed head under headphones and a cap.
	signals: [
		...(
			[
				{},
				{ rest: "tired" },
				{ exertion: "sweaty" },
				{ exertion: "flushed" },
				{ isThirsty: true },
				{ isHungry: true },
				{ isFull: true },
				{ face: "bright" },
				{ face: "sad" },
				{ isBedHead: true },
			] as const
		).map((signals) => ({ ...base, signals: { ...quietSignals, ...signals } })),
		...[2, 5].map((level) => ({
			...base,
			level,
			signals: { ...quietSignals, isBedHead: true },
		})),
	],
	scenery: (["dawn", "day", "dusk", "night"] as const).flatMap((daylight) =>
		(["spring", "summer", "autumn", "winter"] as const).map((season) => ({
			...base,
			counter: 12,
			signals: {
				...quietSignals,
				daylight,
				season,
				room: { plant: "growing", dumbbells: true, books: true } as const,
			},
		})),
	),
	levels: Array.from({ length: 10 }, (_, index) => ({
		...base,
		level: index + 1,
	})),
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const folder = process.argv[2] ?? "scenes";
	mkdirSync(folder, { recursive: true });

	for (const [name, inputs] of Object.entries(sheets)) {
		writeFileSync(
			path.join(folder, `${name}.png`),
			pngOf(
				sheetOf(
					inputs.map((input) => composeScene(input)),
					8,
				),
			),
		);
	}

	console.log(`Wrote ${Object.keys(sheets).length} sheets to ${folder}`);
}
