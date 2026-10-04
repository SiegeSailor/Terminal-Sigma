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
		const palette = paletteOf(level);

		for (const activity of activities) {
			for (const [index] of animationOf(activity).frames.entries()) {
				const frame = composeFrame(activity, index, level);
				const where = `${activity} frame ${index} at level ${level}`;

				t.is(frame.length, spriteHeight, where);

				for (const row of frame) {
					t.is(row.length, spriteWidth, where);

					for (const key of row.replaceAll(".", "")) {
						t.true(palette.has(key), `${where} uses unknown "${key}"`);
					}
				}
			}
		}
	}
});

test("renders 2 pixel rows per terminal row at full width", (t) => {
	const lines = toSegments(composeFrame("idle", 0, 1), paletteOf(1));

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

	t.deepEqual(gearOf(1), { weapon: 0, armor: 0, helmet: 0, backpack: 0 });
	t.deepEqual(gearOf(20), { weapon: 2, armor: 2, helmet: 2, backpack: 2 });
});
