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
	paletteOf,
	type SceneInput,
	stageHeight,
} from "../pixel-art.js";
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
