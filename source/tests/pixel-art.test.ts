import test from "ava";
import {
	type Activity,
	animationOf,
	composeFrame,
	gearOf,
	paletteOf,
	spriteHeight,
	spriteWidth,
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

test("every frame fits the canvas and uses only known colors", (t) => {
	for (const level of [1, 5, 10]) {
		for (const theme of themeNames) {
			const palette = paletteOf(level, themes[theme]);

			for (const activity of activities) {
				for (const [index] of animationOf(activity).frames.entries()) {
					const frame = composeFrame(activity, index, level);
					const unknown = [...frame.join("").replaceAll(".", "")].filter(
						(key) => !palette.has(key),
					);

					t.is(frame.length, spriteHeight);
					t.true(frame.every((row) => row.length === spriteWidth));
					t.deepEqual(unknown, [], `${activity} ${index} at level ${level}`);
				}
			}
		}
	}
});

// The character must never look stuck, so no frame repeats the one before it.
test("every animation changes on every frame", (t) => {
	for (const activity of activities) {
		const { frames } = animationOf(activity);

		t.true(frames.length >= 4, `${activity} has at least 4 frames`);

		for (const [index] of frames.entries()) {
			t.notDeepEqual(
				composeFrame(activity, index, 1),
				composeFrame(activity, index + 1, 1),
				`${activity} frame ${index} differs from the next`,
			);
		}
	}
});

test("renders 2 pixel rows per terminal row at full width", (t) => {
	const lines = toSegments(
		composeFrame("idle", 0, 1),
		paletteOf(1, themes.ember),
	);

	t.is(lines.length, spriteHeight / 2);

	for (const line of lines) {
		t.is(line.map((segment) => segment.text).join("").length, spriteWidth);
	}
});

test("upgrades exactly 1 piece of gear on each level from 2 to 9", (t) => {
	for (let level = 2; level <= 9; level++) {
		const before = Object.values(gearOf(level - 1));
		const after = Object.values(gearOf(level));
		const changed = after.filter((tier, slot) => tier !== before[slot]);

		t.is(changed.length, 1, `level ${level}`);
	}

	t.deepEqual(gearOf(1), { weapon: 0, armor: 0, hood: 0, relic: 0 });
	t.deepEqual(gearOf(20), { weapon: 2, armor: 2, hood: 2, relic: 2 });
});
