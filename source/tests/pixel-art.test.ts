import test from "ava";
import type { Mood } from "../i18n.js";
import {
	type Activity,
	type Badges,
	composeScene,
	cycleOf,
	defaultLook,
	gearOf,
	type Look,
	lookOf,
	noBadges,
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
const looks: Look[] = [
	defaultLook,
	lookOf({ height: 150, weight: 42, gender: "female", goal: "loseFat" }),
	lookOf({ height: 195, weight: 110, gender: "male", goal: "buildMuscle" }),
];
const all: Badges = { meal: true, workout: true, focus: true };

type Scene = Partial<{
	activity: Activity;
	counter: number;
	level: number;
	look: Look;
	mood: Mood;
	badges: Badges;
}>;

const scene = (input: Scene = {}) =>
	composeScene({
		activity: "idle",
		counter: 0,
		level: 1,
		look: defaultLook,
		mood: "content",
		badges: noBadges,
		width,
		...input,
	});

// The rows and columns the pet covers, ignoring the badge corner.
const extentOf = (frame: string[]) => {
	const cells = frame.flatMap((row, y) =>
		[...row].flatMap((key, x) =>
			key === "." || y < 4 ? [] : [[x, y] as const],
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
						const frame = scene({
							activity,
							counter,
							level,
							look,
							badges: all,
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

// The pet must never look stuck: no frame survives 3 ticks in a row.
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

test("grows with the profile and the level", (t) => {
	t.deepEqual(lookOf(undefined), defaultLook);

	const small = extentOf(scene({ look: looks[1] }));
	const big = extentOf(scene({ look: looks[2] }));
	t.true(big.rows > small.rows, "taller for a taller profile");
	t.true(big.columns > small.columns, "wider for a heavier profile");

	const young = extentOf(scene({ level: 1 }));
	const grown = extentOf(scene({ level: 9 }));
	t.true(grown.rows > young.rows && grown.columns > young.columns);
});

test("shows the mood and today's badges", (t) => {
	const sleepy = scene({ mood: "sleepy" }).join("");
	const happy = scene({ mood: "happy" }).join("");

	t.true(sleepy.includes("z"), "Zs while asleep");
	t.false(happy.includes("z"));
	t.notDeepEqual(scene({ mood: "content" }), scene({ mood: "happy" }));

	const corner = (frame: string[]) => frame.slice(0, 4).join("");
	t.notRegex(corner(scene()), /[TFD]/v);
	t.true(corner(scene({ badges: { ...noBadges, focus: true } })).includes("T"));
	t.true(corner(scene({ badges: { ...noBadges, meal: true } })).includes("F"));
	t.true(
		corner(scene({ badges: { ...noBadges, workout: true } })).includes("D"),
	);
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

	t.deepEqual(gearOf(1), { gadget: 0, wear: 0, headwear: 0, aura: 0 });
	t.deepEqual(gearOf(20), { gadget: 2, wear: 2, headwear: 2, aura: 2 });
});
