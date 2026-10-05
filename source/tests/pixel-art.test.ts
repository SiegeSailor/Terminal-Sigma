import test from "ava";
import type { Mood } from "../i18n.js";
import {
	type Activity,
	composeScene,
	cycleOf,
	defaultLook,
	gearOf,
	type Look,
	lookOf,
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
const moods: Mood[] = ["sleepy", "content", "happy"];
const width = 32;

const lookFor = (profile: Partial<Parameters<typeof lookOf>[0]> = {}) =>
	lookOf({
		age: 30,
		height: 170,
		weight: 65,
		gender: "other",
		workStyle: "desk",
		goal: "maintain",
		...profile,
	});

const looks: Look[] = [
	defaultLook,
	lookFor({ height: 150, weight: 42, gender: "female", workStyle: "athlete" }),
	lookFor({
		height: 195,
		weight: 120,
		gender: "male",
		workStyle: "active",
		goal: "buildMuscle",
	}),
	lookFor({ gender: "female", workStyle: "standing", age: 72 }),
];

type Scene = Partial<{
	activity: Activity;
	counter: number;
	level: number;
	look: Look;
	mood: Mood;
}>;

const scene = (input: Scene = {}) =>
	composeScene({
		activity: "idle",
		counter: 0,
		level: 1,
		look: defaultLook,
		mood: "content",
		width,
		...input,
	});

// The rows and columns the body covers, leaving out its shadow.
const extentOf = (frame: string[]) => {
	const cells = frame.flatMap((row, y) =>
		[...row].flatMap((key, x) =>
			key === "." || key === "A" ? [] : [[x, y] as const],
		),
	);
	const xs = cells.map(([x]) => x);
	const ys = cells.map(([, y]) => y);

	return {
		rows: Math.max(...ys) - Math.min(...ys) + 1,
		columns: Math.max(...xs) - Math.min(...xs) + 1,
		left: Math.min(...xs),
	};
};

test("every scene fits its stage and uses only known colors", (t) => {
	for (const theme of themeNames) {
		const palette = paletteOf(themes[theme]);

		for (const look of looks) {
			for (const level of [1, 5, 10]) {
				for (const activity of activities) {
					for (let counter = 0; counter < cycleOf(activity, width); counter++) {
						const frame = scene({ activity, counter, level, look });
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
test("every animation keeps moving, in every mood", (t) => {
	for (const mood of moods) {
		for (const activity of activities) {
			const cycle = cycleOf(activity, width);

			for (let counter = 0; counter < cycle; counter++) {
				const [first, second, third] = [0, 1, 2].map((offset) =>
					scene({ activity, mood, counter: counter + offset }).join("\n"),
				);

				t.false(
					first === second && second === third,
					`${activity} holds still while ${mood} from frame ${counter}`,
				);
			}
		}
	}
});

test("wanders across the stage while idle", (t) => {
	const lefts = new Set(
		Array.from(
			{ length: cycleOf("idle", width) },
			(_, counter) => extentOf(scene({ counter })).left,
		),
	);

	t.true(lefts.size >= 8);
});

test("draws the body from the profile", (t) => {
	t.deepEqual(lookOf(undefined), defaultLook);

	const extentFor = (profile: Parameters<typeof lookFor>[0]) =>
		extentOf(scene({ look: lookFor(profile) }));

	t.true(
		extentFor({ height: 195 }).rows > extentFor({ height: 150 }).rows,
		"taller for a taller profile",
	);
	t.true(
		extentFor({ weight: 110 }).columns > extentFor({ weight: 55 }).columns,
		"wider for a heavier profile",
	);
	t.true(
		extentFor({ gender: "male" }).columns >
			extentFor({ gender: "female" }).columns,
		"broader shoulders for a man",
	);

	const styles = (["desk", "standing", "active", "athlete"] as const).map(
		(workStyle) => scene({ look: lookFor({ workStyle }) }).join(""),
	);
	t.is(new Set(styles).size, 4, "dressed for each work style");
	t.true(
		scene({ look: lookFor({ age: 60 }) })
			.join("")
			.includes("H"),
	);
	t.true(
		scene({ look: lookFor({ age: 75 }) })
			.join("")
			.includes("I"),
	);
});

test("dresses up with the level", (t) => {
	const frames = Array.from({ length: 9 }, (_, index) =>
		scene({ level: index + 1 }).join(""),
	);

	t.is(new Set(frames).size, 9, "every level from 1 to 9 looks different");
	t.true(frames[8]?.includes("g"), "a crown and a medal at level 9");
});

test("shows the mood on the face", (t) => {
	const sleepy = scene({ mood: "sleepy" }).join("");

	t.true(sleepy.includes("Z"), "Zs while dozing");
	t.false(scene().join("").includes("Z"));
	t.true(scene({ mood: "happy" }).join("").includes("m"), "a smile");
	t.false(scene().join("").includes("m"));
});

test("casts an oval shadow under the feet", (t) => {
	const frame = scene();
	const rowsWithShadow = frame.flatMap((row, y) =>
		row.includes("A") ? [y] : [],
	);

	t.deepEqual(rowsWithShadow, [
		stageHeight - 3,
		stageHeight - 2,
		stageHeight - 1,
	]);

	const widthAt = (y: number) =>
		[...(frame[y] ?? "")].filter((key) => key !== ".").length;
	t.true(widthAt(stageHeight - 2) > widthAt(stageHeight - 1), "an oval");
});

test("renders 2 pixel rows per terminal row at full width", (t) => {
	const lines = toSegments(scene(), paletteOf(themes.ember));

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

	t.deepEqual(gearOf(1), { gadget: 0, wear: 0, headwear: 0, carry: 0 });
	t.deepEqual(gearOf(20), { gadget: 2, wear: 2, headwear: 2, carry: 2 });
});
