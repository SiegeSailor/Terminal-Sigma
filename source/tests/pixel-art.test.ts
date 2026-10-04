import test from "ava";
import {
	type Activity,
	type Body,
	bodyOf,
	composeScene,
	cycleOf,
	defaultBody,
	gearOf,
	paletteOf,
	stageHeight,
	toSegments,
} from "../pixel-art.js";
import { themeNames, themes } from "../theme.js";

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
const width = 24;
const bodies: Body[] = [
	defaultBody,
	bodyOf({ height: 150, weight: 42, gender: "female" }),
	bodyOf({ height: 205, weight: 120, gender: "male" }),
];

const scene = (activity: Activity, counter: number, body = defaultBody) =>
	composeScene({ activity, counter, level: 1, body, width });

// The rows and columns the character covers in a frame.
const extentOf = (frame: string[]) => {
	const rows = frame.filter((row) => /[^.]/v.test(row)).length;
	const columns = new Set(
		frame.flatMap((row) =>
			[...row].flatMap((key, column) => (key === "." ? [] : [column])),
		),
	);

	return { rows, columns: columns.size, left: Math.min(...columns) };
};

test("every scene fits its stage and uses only known colors", (t) => {
	for (const theme of themeNames) {
		const palette = paletteOf(themes[theme]);

		for (const body of bodies) {
			for (const level of [1, 5, 10]) {
				for (const activity of activities) {
					for (let counter = 0; counter < cycleOf(activity, width); counter++) {
						const frame = composeScene({
							activity,
							counter,
							level,
							body,
							width,
						});
						const unknown = [...frame.join("").replaceAll(".", "")].filter(
							(key) => !palette.has(key),
						);

						t.is(frame.length, stageHeight);
						t.true(frame.every((row) => row.length === width));
						t.deepEqual(
							unknown,
							[],
							`${activity} ${counter} at level ${level}`,
						);
					}
				}
			}
		}
	}
});

// The character must never look stuck: no frame survives 3 ticks in a row.
test("every animation keeps moving", (t) => {
	for (const activity of activities) {
		const cycle = cycleOf(activity, width);

		t.true(cycle >= 4, `${activity} loops over at least 4 frames`);

		for (let counter = 0; counter < cycle; counter++) {
			const frames = [0, 1, 2].map((offset) =>
				scene(activity, counter + offset).join("\n"),
			);

			t.false(
				frames[0] === frames[1] && frames[1] === frames[2],
				`${activity} holds still from frame ${counter}`,
			);
		}
	}
});

test("wanders across the stage while idle", (t) => {
	const lefts = new Set(
		Array.from(
			{ length: cycleOf("idle", width) },
			(_, counter) => extentOf(scene("idle", counter)).left,
		),
	);

	t.true(lefts.size >= 8);
});

test("draws the body from the profile", (t) => {
	t.deepEqual(bodyOf(undefined), defaultBody);
	t.like(bodyOf({ height: 145, weight: 40, gender: "female" }), {
		height: 20,
		build: "slim",
	});
	t.like(bodyOf({ height: 205, weight: 130, gender: "male" }), {
		height: 26,
		build: "broad",
	});

	const short = extentOf(scene("idle", 0, bodies[1]));
	const tall = extentOf(scene("idle", 0, bodies[2]));
	t.true(tall.rows > short.rows);
	t.true(tall.columns > short.columns);
});

test("renders 2 pixel rows per terminal row at full width", (t) => {
	const lines = toSegments(scene("idle", 0), paletteOf(themes.ember));

	t.is(lines.length, stageHeight / 2);

	for (const line of lines) {
		t.is(line.map((segment) => segment.text).join("").length, width);
	}
});

test("upgrades exactly 1 piece of equipment on each level from 2 to 9", (t) => {
	for (let level = 2; level <= 9; level++) {
		const before = Object.values(gearOf(level - 1));
		const after = Object.values(gearOf(level));
		const changed = after.filter((tier, slot) => tier !== before[slot]);

		t.is(changed.length, 1, `level ${level}`);
	}

	t.deepEqual(gearOf(1), { gadget: 0, top: 0, headwear: 0, back: 0 });
	t.deepEqual(gearOf(20), { gadget: 2, top: 2, headwear: 2, back: 2 });
});
