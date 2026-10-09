import test from "ava";
import {
	facialHairs,
	hairColors,
	hairStyles,
	type Mood,
	skinTones,
} from "../i18n.js";
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
	greyOf,
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
	const middle = { ...defaultLook, gender: "male" as const, fat: 10 };
	const widest = {
		...defaultLook,
		gender: "male" as const,
		height: 35,
		fat: fatStages,
		muscle: muscleStages,
	};
	const wanted = { activity: "idle", mood: "content" } as const;
	const reachOf = (look: Look) => {
		const xs = Array.from(
			{ length: cycleOf("idle", width, undefined, "content", look) },
			(_, counter) => placeOf("idle", counter, width, "content", 16, look).x,
		);
		return width - 1 - Math.max(...xs);
	};

	const unsettled: string[] = [];

	for (const [before, after] of [
		[slim, widest],
		[widest, slim],
		[middle, widest],
	] as const) {
		const target = reachOf(after);

		for (const anchor of [9, 16, 22]) {
			// Only anchors where the old look fits.
			if (anchor < reachOf(before) || anchor > width - 1 - reachOf(before)) {
				continue;
			}

			// Changed while resting at home, walking, and resting at each edge.
			for (const change of [0, 10, 23, 24, 40, 60, 75, 97, 120]) {
				let motion: Motion = {
					...startMotion("idle", "content", width, before),
					anchor,
				};
				let previous = placeOf("idle", 0, width, "content", anchor, before).x;

				for (let tick = 0; tick < 450; tick++) {
					const look = tick >= change ? after : before;
					motion = advance(motion, wanted, width, look);
					const { x } = placeOf(
						motion.activity,
						motion.tick,
						width,
						motion.mood,
						motion.anchor,
						look,
						motion.reach,
					);
					const name = `${before.gender} ${before.fat} to ${after.fat} at ${anchor} ${change} ${tick}`;
					t.true(Math.abs(x - previous) <= 2, `jumped at ${name}`);
					previous = x;

					// Adopted within a loop and a shuffle, with no clipping after.
					const isLate = tick >= change + 130;
					const isFitting = x >= target && x <= width - 1 - target;

					if (isLate && (motion.reach !== target || !isFitting)) {
						unsettled.push(name);
					}
				}
			}
		}
	}

	t.deepEqual(unsettled, [], "every look change is adopted");

	// The next activity starts with the wider margin when it fits in 2 pixels.
	const started = advance(
		{ ...startMotion("idle", "content", width, slim), anchor: 20, tick: 5 },
		{ activity: "break", mood: "content" },
		width,
		widest,
	);
	t.is(started.anchor, width - 1 - reachOf(widest));
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

test("draws every skin tone, hair style, hair color, and beard", (t) => {
	const kinds = <Value>(
		values: readonly Value[],
		lookAt: (value: Value) => Look,
	) =>
		new Set(
			values.map((value) =>
				[
					...scene({ look: lookAt(value) }),
					...scene({ look: lookAt(value), counter: 24 }),
				].join(""),
			),
		).size;

	t.is(
		kinds(skinTones, (skinTone) => ({ ...defaultLook, skinTone })),
		5,
	);
	t.is(
		kinds(hairStyles, (hairStyle) => ({ ...defaultLook, hairStyle })),
		6,
	);
	t.is(
		kinds(hairColors, (hairColor) => ({ ...defaultLook, hairColor })),
		4,
	);
	t.is(
		kinds(facialHairs, (facialHair) => ({ ...defaultLook, facialHair })),
		3,
	);
	t.not(
		scene({ look: { ...defaultLook, glasses: true } }).join(""),
		scene().join(""),
	);
});

test("keeps each gender's old hair when the profile has no appearance", (t) => {
	t.is(lookFor({ gender: "male" }).hairStyle, "short");
	t.is(lookFor({ gender: "female" }).hairStyle, "long");
	t.is(
		lookFor({ gender: "female", workStyle: "athlete" }).hairStyle,
		"ponytail",
	);
	t.is(lookFor({ gender: "other" }).hairStyle, "bob");
	t.like(lookFor({ hairStyle: "bun", skinTone: 5, glasses: true }), {
		hairStyle: "bun",
		skinTone: 5,
		glasses: true,
	});
});

test("greys from the temples, a little more every year from 35", (t) => {
	const greyIn = (age: number) =>
		[...scene({ look: { ...defaultLook, age } }).join("")].filter((key) =>
			"HJIK".includes(key),
		).length;

	t.is(greyIn(34), 0);

	// The first grey pixels sit at the temples, 3 or more columns from the center.
	const columnsOf = (age: number, keys: string) =>
		scene({ activity: "focus", look: { ...defaultLook, age } }).flatMap((row) =>
			[...row].flatMap((key, column) => (keys.includes(key) ? [column] : [])),
		);
	const crown = columnsOf(30, "hi");
	const center = (Math.min(...crown) + Math.max(...crown)) / 2;
	const first = columnsOf(45, "HJ");
	t.true(first.length > 0);
	t.true(first.every((column) => Math.abs(column - center) >= 3));
	t.is(greyOf(35), 0);
	t.is(greyOf(70), 1);

	const ages = [40, 45, 50, 55, 60, 65, 70, 75, 80, 85];
	t.is(
		new Set(
			ages.map((age) => scene({ look: { ...defaultLook, age } }).join("")),
		).size,
		ages.length,
		"every 5 years looks different",
	);
	t.true(
		[36, 40, 45, 50, 55, 60, 65, 70].every(
			(age, index, all) =>
				index === 0 || greyIn(age) >= greyIn(all[index - 1] ?? age),
		),
		"never less grey with age",
	);
});

test("keeps the same pixels grey on a moving head", (t) => {
	const look = { ...defaultLook, age: 50 };
	const hairy = /[hiHJIK]/v;

	// The grey mask around the head, mirrored to face right, across a cycle.
	const maskAt = (input: Scene) => {
		const rows = scene({ look, ...input });
		const top = rows.findIndex((row) => hairy.test(row));
		const columns = [...(rows[top] ?? "")].flatMap((key, column) =>
			hairy.test(key) ? [column] : [],
		);
		const center = Math.round(((columns[0] ?? 0) + (columns.at(-1) ?? 0)) / 2);
		const window = rows.slice(top, top + 5).map((row) =>
			Array.from({ length: 15 }, (_, index) => {
				const key = row[center - 7 + index] ?? ".";
				return "HJIK".includes(key) ? "G" : hairy.test(key) ? "h" : ".";
			}).join(""),
		);
		const eyes = rows
			.slice(top, top + 9)
			.map((row) => row.slice(center - 4, center + 5))
			.find((row) => row.includes("e"));
		const faceLeft =
			eyes !== undefined &&
			[...eyes].filter((key) => key === "e").length === 1 &&
			eyes.indexOf("e") < 4;

		return (
			faceLeft ? window.map((row) => [...row].toReversed().join("")) : window
		).flatMap((row, y) =>
			[...row].flatMap((key, x) =>
				key === "." ? [] : [[`${x},${y}`, key] as const],
			),
		);
	};

	for (const input of [
		{ activity: "idle" as const, mood: "sleepy" as const },
		{ activity: "eat" as const },
		{ activity: "run" as const },
		{ activity: "focus" as const },
	]) {
		// A hair pixel that shows in 2 frames is grey in both or in neither;
		// a prop may cover it in between.
		const seen = new Map<string, string>();
		let flips = 0;

		for (let counter = 0; counter < 48; counter++) {
			for (const [place, key] of maskAt({ ...input, counter })) {
				if (seen.get(place) === undefined) {
					seen.set(place, key);
				} else if (seen.get(place) !== key) {
					flips++;
				}
			}
		}

		t.is(flips, 0, `${input.activity} keeps its grey`);
	}
});

test("draws stubble and glasses in more than a pixel or 2", (t) => {
	const differences = (look: Partial<Look>, activity: Activity) => {
		const draw = (extra: Partial<Look>) =>
			scene({ activity, counter: 2, look: { ...defaultLook, ...extra } });
		const [a, b] = [draw(look), draw({})];

		return a.reduce(
			(sum, row, index) =>
				sum +
				[...row].filter((key, column) => key !== b[index]?.[column]).length,
			0,
		);
	};

	for (const [activity, minimum] of [
		["focus", 5],
		["run", 4],
	] as const) {
		t.true(differences({ facialHair: "stubble" }, activity) >= minimum);
		t.true(differences({ glasses: true }, activity) >= minimum);
	}
});
