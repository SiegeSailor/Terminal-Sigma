import test from "ava";
import type { Mood } from "../i18n.js";
import {
	type Activity,
	advance,
	bodyFatOf,
	composeScene,
	cycleOf,
	defaultLook,
	fatStages,
	fatStep,
	gearOf,
	homeOf,
	type Look,
	lookOf,
	type Motion,
	muscleStages,
	paletteOf,
	placeOf,
	stageHeight,
	startMotion,
	toSegments,
} from "../pixel-art.js";
import { themeNames, themes } from "../theme.js";
import { pngOf, sheetOf } from "./render-scenes.js";

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

const profileOf = (profile: Partial<Parameters<typeof lookOf>[0]> = {}) => ({
	age: 30,
	height: 170,
	weight: 65,
	gender: "other" as const,
	workStyle: "desk" as const,
	goal: "maintain" as const,
	...profile,
});

const lookFor = (profile: Partial<Parameters<typeof lookOf>[0]> = {}) =>
	lookOf(profileOf(profile));

const looks: Look[] = [
	defaultLook,
	lookFor({ height: 150, weight: 42, gender: "female", workStyle: "athlete" }),
	lookFor({
		height: 200,
		weight: 120,
		gender: "male",
		workStyle: "active",
		goal: "buildMuscle",
	}),
	lookFor({ gender: "female", workStyle: "standing", age: 72 }),
];

type Scene = Partial<{
	activity: Activity;
	anchor: number;
	reach: number;
	width: number;
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

// The character must never look stuck: no frame survives 6 ticks in a row.
test("every animation keeps moving, in every mood", (t) => {
	for (const mood of moods) {
		for (const activity of activities) {
			const cycle = cycleOf(activity, width, undefined, mood);

			for (let counter = 0; counter < cycle; counter++) {
				const frames = new Set(
					[0, 1, 2, 3, 4, 5].map((offset) =>
						scene({ activity, mood, counter: counter + offset }).join("\n"),
					),
				);

				t.true(
					frames.size > 1,
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

test("walks in profile, with the feet apart and pointing ahead", (t) => {
	// The sole row of a stride: the shoes' grey soles, in 2 separate runs.
	const soles = (frame: string[]) =>
		(frame[stageHeight - 3] ?? "")
			.replaceAll(/[^Y]/gv, " ")
			.trim()
			.split(/ +/v);
	const standing = scene({ counter: 0 });
	const striding = scene({ counter: 24 });

	t.is(soles(striding).length, 2, "both feet on the ground, apart");
	t.notDeepEqual(striding, standing);
	t.true(
		extentOf(scene({ counter: 24 })).columns < extentOf(standing).columns + 4,
		"the body turns side on",
	);
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

test("tells muscle from fat at the same weight by body fat", (t) => {
	const profile = { gender: "male", height: 178, weight: 82 } as const;

	t.is(lookFor({ ...profile, bodyFat: 10 }).fat, 2);
	t.is(lookFor({ ...profile, bodyFat: 30 }).fat, 12);
	t.is(lookFor(profile).fat, 8, "Deurenberg's estimate without body fat");
	t.is(
		lookFor({ ...profile, bodyFat: 10 }).muscle,
		1,
		"lean and heavy is muscle",
	);
	t.notDeepEqual(
		scene({ look: lookFor({ ...profile, bodyFat: 10 }) }),
		scene({ look: lookFor({ ...profile, bodyFat: 30 }) }),
	);
});

test("draws a different body for every 2 points of body fat", (t) => {
	t.is(fatStep, 2);

	// Any walk margin will do, and skips measuring every look.
	const reach = 9;

	for (const gender of ["female", "male", "other"] as const) {
		for (const [height, style] of [
			[22, "athlete"],
			[22, "desk"],
			[29, "desk"],
			[35, "athlete"],
		] as const) {
			const frames = Array.from({ length: fatStages + 1 }, (_, fat) => {
				const look = { ...defaultLook, gender, height, style, fat };
				// The front at rest and the side mid-stride, since a belly shows in profile.
				return [
					...scene({ look, reach }),
					...scene({ look, reach, counter: 24 }),
				].join("\n");
			});

			for (const [fat, frame] of frames.entries()) {
				t.not(
					frame,
					frames[fat - 1],
					`${gender} ${height} ${style}: stage ${fat} is stage ${fat - 1}`,
				);
			}
		}
	}

	t.is(lookFor({ gender: "male", bodyFat: 6 }).fat, 0);
	t.is(lookFor({ gender: "male", bodyFat: 8 }).fat, 1);
	t.is(lookFor({ gender: "male", bodyFat: 60 }).fat, fatStages);
	t.true(
		Array.from(
			{ length: 40 },
			(_, kilos) => lookFor({ weight: 50 + kilos }).fat,
		).every((fat, index, all) => index === 0 || fat >= (all[index - 1] ?? 0)),
		"never leaner for more weight",
	);
	// 1.2 × 22.04 + 0.23 × 30 − 0 − 5.4 = 27.95 for a 30-year-old woman, 165 cm and 60 kg.
	t.true(
		Math.abs(
			bodyFatOf(profileOf({ gender: "female", weight: 60, height: 165 })) -
				27.95,
		) < 0.05,
	);
});

test("grows muscle with strength work, up to a limit", (t) => {
	t.is(lookFor().muscle, 0);
	t.is(lookFor({ goal: "buildMuscle" }).muscle, 1);
	t.is(lookOf(profileOf(), 150).muscle, 1);
	t.is(lookOf(profileOf(), 100_000).muscle, 2, "logs add at most 2");

	const frames = Array.from({ length: muscleStages + 1 }, (_, muscle) =>
		scene({ look: { ...defaultLook, muscle } }).join(""),
	);
	t.is(new Set(frames).size, muscleStages + 1);

	// Every stage shows, not by a pixel: at least 6 pixels in the front view.
	for (const gender of ["female", "male", "other"] as const) {
		for (let muscle = 1; muscle <= muscleStages; muscle++) {
			const draw = (stage: number) =>
				scene({ look: { ...defaultLook, gender, muscle: stage } });
			const differing = draw(muscle).reduce(
				(total, row, y) =>
					total +
					[...row].filter((key, x) => key !== draw(muscle - 1)[y]?.[x]).length,
				0,
			);
			t.true(
				differing >= 6,
				`${gender}: muscle ${muscle} differs by ${differing}`,
			);
		}
	}
});

test("draws both arms and both sides of the body alike", (t) => {
	const middle = homeOf(width);

	for (const gender of ["female", "male", "other"] as const) {
		for (let fat = 0; fat <= fatStages; fat++) {
			for (let muscle = 0; muscle <= muscleStages; muscle++) {
				const look = { ...defaultLook, gender, fat, muscle };
				const frame = scene({ look, reach: 9 });

				// Below the shoulders, where the hair and the ears are not.
				for (let y = 2; y < look.height - 7; y++) {
					const row = frame[stageHeight - 1 - y] ?? "";
					const covered = (x: number) => (row[x] ?? ".") !== ".";

					for (let offset = 1; offset <= middle; offset++) {
						t.is(
							covered(middle + offset),
							covered(middle - offset),
							`${gender} fat ${fat} muscle ${muscle} row ${y} offset ${offset}`,
						);
					}
				}
			}
		}
	}
});

test("stands 1 pixel taller for every 5 cm", (t) => {
	const heights = [150, 155, 160, 165, 170, 175, 180, 185].map(
		(height) => lookFor({ height }).height,
	);

	t.is(new Set(heights).size, heights.length);
});

test("keeps every body on the stage at both walking edges", (t) => {
	// The shadow, the barbell, the cup, the sparkles, the Zs, and the swaying hair are not
	// the body.
	const bodyOf = (frame: string[]) =>
		frame.join("").replaceAll(/[.AdDyZhiHIQ]/gv, "").length;
	const looks: Look[] = [];

	for (const gender of ["female", "male"] as const) {
		for (const fat of [0, fatStages]) {
			for (const muscle of [0, muscleStages]) {
				for (const height of [22, 35]) {
					for (const style of ["desk", "athlete"] as const) {
						looks.push({ ...defaultLook, gender, fat, muscle, height, style });
					}
				}
			}
		}
	}

	// The same pose on a stage wide enough that nothing clips; arms flung wide
	// hold back by the room at the edge, so they are drawn with that room.
	const wide = 96;

	for (const look of looks) {
		const home = homeOf(width);
		const cycle = cycleOf("idle", width, undefined, "happy", look);
		const xs = Array.from(
			{ length: cycle },
			(_, counter) => placeOf("idle", counter, width, "happy", home, look).x,
		);
		const [minimum, maximum] = [Math.min(...xs), Math.max(...xs)] as const;
		// The idle rests 24 ticks at home, then at the right edge, then the left.
		const restAt = new Map([
			[maximum, 24 + maximum - home],
			[minimum, 48 + 2 * maximum - home - minimum],
		]);
		const name = `${look.gender} ${look.height} fat ${look.fat} muscle ${look.muscle} ${look.style}`;

		for (const [anchor, start] of restAt) {
			// The idle pauses at an edge, in every mood, as it does at home.
			for (const mood of ["content", "happy"] as const) {
				for (let rest = 0; rest < 24; rest++) {
					const edge = scene({ look, mood, counter: start + rest });
					const free = scene({
						look,
						mood,
						counter: rest,
						width: wide,
						anchor: homeOf(wide),
					});
					t.is(bodyOf(edge), bodyOf(free), `${name} ${mood} idle at ${anchor}`);
				}
			}

			for (const activity of activities) {
				if (activity === "idle" || activity === "run") {
					continue;
				}

				for (
					let counter = 0;
					counter < cycleOf(activity, width, anchor, "happy", look);
					counter++
				) {
					const edge = scene({
						look,
						activity,
						counter,
						anchor,
						mood: "happy",
					});
					const free = scene({
						look,
						activity,
						counter,
						anchor: Math.min(anchor, width - 1 - anchor),
						width: wide,
						mood: "happy",
					});
					t.is(
						bodyOf(edge),
						bodyOf(free),
						`${name} ${activity} ${counter} at ${anchor}`,
					);
				}
			}
		}
	}
});

test("dresses up with the level, with nothing on top of the head", (t) => {
	const frames = Array.from({ length: 9 }, (_, index) =>
		scene({ level: index + 1 }).join(""),
	);

	t.is(new Set(frames).size, 9, "every level from 1 to 9 looks different");
	t.false(frames[7]?.includes("g"), "no crown at level 8");
	t.true(frames[8]?.includes("g"), "a medal at level 9");
});

test("shows the mood on the face", (t) => {
	t.true(scene({ mood: "sleepy" }).join("").includes("Z"), "Zs while dozing");
	t.false(scene().join("").includes("Z"));
	t.true(scene({ mood: "happy" }).join("").includes("m"), "a smile");
	t.false(scene().join("").includes("m"));
});

test("casts an oval shadow under the feet", (t) => {
	const frame = scene();
	const rows = frame.flatMap((row, y) => (row.includes("A") ? [y] : []));

	t.deepEqual(rows, [
		stageHeight - 4,
		stageHeight - 3,
		stageHeight - 2,
		stageHeight - 1,
	]);

	const widthAt = (y: number) =>
		[...(frame[y] ?? "")].filter((key) => key !== ".").length;
	t.true(widthAt(stageHeight - 3) > widthAt(stageHeight - 1), "an oval");
});

test("never jumps between animations, and comes home after a run", (t) => {
	const plan: Array<[number, Activity, Mood]> = [
		[37, "idle", "content"],
		[20, "eat", "content"],
		[45, "idle", "content"],
		[60, "run", "happy"],
		[30, "idle", "happy"],
		[16, "levelUp", "happy"],
		[10, "idle", "sleepy"],
	];
	let motion: Motion = startMotion("idle", "content", width);
	let previous = placeOf("idle", 0, width, "content", motion.anchor);
	let runHome: number | undefined;
	const anchors: number[] = [];

	for (const [ticks, activity, mood] of plan) {
		for (let tick = 0; tick < ticks; tick++) {
			motion = advance(motion, { activity, mood }, width);
			const place = placeOf(
				motion.activity,
				motion.tick,
				width,
				motion.mood,
				motion.anchor,
			);

			t.true(Math.abs(place.x - previous.x) <= 2, `jumped at ${activity}`);
			t.true(Math.abs(place.lift - previous.lift) <= 1);
			previous = place;

			if (motion.activity === "run") {
				runHome ??= motion.anchor;
			}
		}

		anchors.push(motion.anchor);
	}

	// The idle after the run starts where the run began.
	t.is(anchors[4], runHome);
});

test("keeps the walk steady when the look changes", (t) => {
	const slim = { ...defaultLook, gender: "female" as const, fat: 0, muscle: 0 };
	const widest = {
		...defaultLook,
		gender: "male" as const,
		height: 35,
		fat: fatStages,
		muscle: muscleStages,
	};
	// The shadow's middle column is where the character stands.
	const standing = (motion: Motion, look: Look) => {
		const columns = scene({
			activity: motion.activity,
			counter: motion.tick,
			anchor: motion.anchor,
			reach: motion.reach,
			look,
			mood: motion.mood,
		}).flatMap((row) => [...row].flatMap((key, x) => (key === "A" ? [x] : [])));

		return (Math.min(...columns) + Math.max(...columns)) / 2;
	};

	const wanted = { activity: "idle", mood: "content" } as const;
	let motion = startMotion("idle", "content", width, slim);
	let look: Look = slim;
	let previous = standing(motion, look);

	// Walk for 100 ticks, with the look turning wider in the middle of it.
	for (let tick = 0; tick < 100; tick++) {
		if (tick === 40) {
			look = widest;
		}

		motion = advance(motion, wanted, width, look);
		const place = standing(motion, look);
		t.true(Math.abs(place - previous) <= 2, `jumped at tick ${tick}`);
		previous = place;
	}

	// The next activity starts with the wider margin, fitted on the stage.
	const xs = Array.from(
		{ length: cycleOf("idle", width, undefined, "content", widest) },
		(_, counter) => placeOf("idle", counter, width, "content", 16, widest).x,
	);
	const reach = width - 1 - Math.max(...xs);

	for (const anchor of [9, 20, 25]) {
		const started = advance(
			{ ...startMotion("idle", "content", width, slim), anchor, tick: 5 },
			{ activity: "break", mood: "content" },
			width,
			widest,
		);
		t.true(started.anchor >= reach && started.anchor <= width - 1 - reach);
	}
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

test("encodes a contact sheet of scenes as a PNG", (t) => {
	const png = pngOf(sheetOf([scene(), scene({ counter: 24 })], 2));

	t.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
	// IHDR's width and height, after the signature, the length, and the type.
	t.is(png.readUInt32BE(16), 2 * (width + 2) * 6);
	t.is(png.readUInt32BE(20), (stageHeight + 2) * 6);
});
