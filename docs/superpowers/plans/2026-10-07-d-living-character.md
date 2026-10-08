# Living Character Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the character follow every small change in the profile and the logs: a body that fills out every 2 points of body fat, muscle that grows with strength work, hair that greys year by year, a chosen skin tone, hair, glasses, and beard, a face and body that show tonight's sleep, today's water, food, workout, and mood, and a stage that shows the time of day, the season, and what the user has earned.

**Architecture:** Everything stays procedural half-block art painted by `composeScene`, so every theme still recolors it and nothing needs an asset license. A new pure module, `source/signals.ts`, turns `progress` and `now` into `Signals` about right now; `lookOf` turns the profile into continuous stages instead of 5 named builds; the painters read both. Color variants (skin tones, hair colors, grey and white hair) are applied in 1 place, the `plant` function that writes each pixel, so no painter needs to know them. A dev-only script renders scenes to PNG contact sheets for the art review the pixel-art rule requires.

**Tech Stack:** TypeScript 6, Ink 7 (`useAnimation`), `node:zlib` (`deflateSync`, `crc32`) for PNGs, AVA 7.

**Spec:** [`2026-10-07-roadmap.md`](./2026-10-07-roadmap.md), section "Paint the Character, Do Not Import It" and the contracts for Plan D. Depends on [Plan A](./2026-10-07-a-environment-settings.md) (`isReducedMotion`, the `env` prop) and [Plan C](./2026-10-07-c-daily-logging.md) (the log arrays, `profileNow`, `targetsOf(profile, goals)`, `todayOf`, `streakOf`, `activityOfKind`).

## Global Constraints

- Read `.claude/rules/pixel-art.md` before every task; every input must change the character visibly, not by a pixel that nobody notices
- Render the affected scenes to PNG with `node build/tests/render-scenes.js <folder>` and look at them before committing any art; the tests cannot tell ugly art from good
- Every key a frame uses must exist in `paletteOf`; skin, hair, and props keep fixed colors, clothes take the theme's `sprite` tones
- The character never jumps: every activity starts and ends at its anchor with `lift` 0, and nothing moves more than 2 pixels in 1 tick
- `composeScene` with no `signals` draws exactly what it draws today for the same look, so the motion tests keep their meaning
- xo enforces `react-hooks/purity` (no `Date.now()` during render) and `react-hooks/immutability` (no writes to props inside a component)
- Every user-facing string in all 3 languages; every new action appends an event; every new `progress.json` field is optional
- Run `npx prettier --write` on every changed file before `npm test`, whose first step is `prettier --check`
- `npm test` passes after every task

## Review Focus

- The heaviest, most muscular, tallest profile walking to either edge of the stage: its body never runs off the stage
- A user who has never logged water or food: no thirst or hunger bubble ever appears
- A backdated entry (`@-2d`) appended after newer ones: signals read the newest entry by its timestamp, not its position in the array
- Midnight and the seasons: the sky and the season follow local time, so 23:30 is night and January is winter
- `TERMINAL_SIGMA_MOTION=reduced`: no falling particles and no gliding bars, while the character itself keeps its 10 fps life

---

### Task 1: Scene Review Sheets

**Files:**

- Create: `source/tests/render-scenes.ts`
- Test: `source/tests/pixel-art.test.ts`

**Interfaces:**

- Consumes: `composeScene`, `paletteOf`, `stageHeight`, `cycleOf`, `defaultLook`, `type SceneInput` from `source/pixel-art.ts`; `themes` from `source/theme.ts`
- Produces: `pngOf(rows: ReadonlyArray<ReadonlyArray<Rgb>>): Buffer`, `sheetOf(frames: ReadonlyArray<readonly string[]>, perRow: number): Rgb[][]`, `type Rgb = readonly [number, number, number]`, and the exported `sheets: Record<string, SceneInput[]>` that later tasks extend

The file sits under `source/tests/` so it compiles with the tests and stays out of the NPM package (`"!build/tests/"` in `files`), and its name has no `.test.` so AVA never runs it.

- [ ] **Step 1: Write the failing test**

Append to `source/tests/pixel-art.test.ts`:

```ts
import { pngOf, sheetOf } from "./render-scenes.js";

test("encodes a contact sheet of scenes as a PNG", (t) => {
	const png = pngOf(sheetOf([scene(), scene({ counter: 24 })], 2));

	t.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
	// IHDR's width and height, after the signature, the length, and the type.
	t.is(png.readUInt32BE(16), 2 * (width + 2) * 6);
	t.is(png.readUInt32BE(20), (stageHeight + 2) * 6);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run build`
Expected: FAIL — `Cannot find module './render-scenes.js'`.

- [ ] **Step 3: Write the script**

```ts
// source/tests/render-scenes.ts
// Renders scenes to PNG contact sheets for the art review:
//   npm run build && node build/tests/render-scenes.js scenes
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

const chunk = (type: string, data: Buffer) => {
	const length = Buffer.alloc(4);
	length.writeUInt32BE(data.length);
	const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
	const checksum = Buffer.alloc(4);
	checksum.writeUInt32BE(crc32(body));
	return Buffer.concat([length, body, checksum]);
};

// A truecolor PNG with no filtering, from rows of RGB triples.
export function pngOf(rows: ReadonlyArray<ReadonlyArray<Rgb>>): Buffer {
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
```

- [ ] **Step 4: Run the test, then the script**

Run: `npm run build && npx ava build/tests/pixel-art.test.js && node build/tests/render-scenes.js "$TMPDIR/scenes"`
Expected: the tests PASS, and the script prints `Wrote 2 sheets to …`. Open `activities.png` and `levels.png`; they show today's character, 8 frames per activity.

- [ ] **Step 5: Ignore the output folder and commit**

Add `scenes/` to `.gitignore` and `.prettierignore`.

```bash
git add source/tests/render-scenes.ts source/tests/pixel-art.test.ts .gitignore .prettierignore
git commit -m "test: render scenes to PNG contact sheets for review"
```

---

### Task 2: Signals from the Logs

**Files:**

- Create: `source/signals.ts`
- Test: `source/tests/signals.test.ts`

**Interfaces:**

- Consumes: from Plan C, `profileNow(progress)`, `todayOf(progress, now).water`, `logsOf(progress)` (newest first, with `kind`), `workoutExperience(workout)` in `source/progress.ts`, and `targetsOf(profile, goals)` in `source/health.ts`
- Produces:
  - `type Daylight = "night" | "dawn" | "day" | "dusk"`, `type Season = "spring" | "summer" | "autumn" | "winter"`
  - `type Room = Readonly<{ plant: "none" | "growing" | "wilting"; dumbbells: boolean; books: boolean }>`
  - `type Signals = Readonly<{ rest: "tired" | "fine"; isThirsty: boolean; isHungry: boolean; isFull: boolean; exertion: "none" | "sweaty" | "flushed"; face: "sad" | "neutral" | "bright"; isBedHead: boolean; daylight?: Daylight; season?: Season; room: Room }>`
  - `quietSignals: Signals` (nothing to show: no sky, no season, no room)
  - `daylightOf(now: number): Daylight`, `seasonOf(now: number): Season`
  - `strengthLoadOf(progress: Progress, now: number): number`
  - `signalsOf(progress: Progress, now: number): Signals`
  - `stageSignalsOf(signals: Signals, isReduced: boolean): Signals` (drops the season's particles under reduced motion)

Every rule reads entries by their timestamps, never by their place in an array, because a backdated entry is appended after newer ones.

- [ ] **Step 1: Write the failing tests**

```ts
// source/tests/signals.test.ts
import test from "ava";
import { progressSchema } from "../progress.js";
import {
	daylightOf,
	quietSignals,
	seasonOf,
	signalsOf,
	stageSignalsOf,
	strengthLoadOf,
} from "../signals.js";

// 15:00 local time on a Wednesday in October.
const now = new Date(2026, 9, 7, 15, 0).getTime();
const ago = (minutes: number) => new Date(now - minutes * 60_000).toISOString();
const hours = 60;
const days = 24 * hours;

// Every array filled in, as loadProgress would, so later fields never break it.
const empty = progressSchema.parse({ language: "en" });

test("says nothing about a journey with nothing logged", (t) => {
	t.deepEqual(signalsOf(empty, now), {
		...quietSignals,
		daylight: "day",
		season: "autumn",
	});
});

test("reads the clock and the calendar in local time", (t) => {
	t.is(daylightOf(new Date(2026, 9, 7, 23, 30).getTime()), "night");
	t.is(daylightOf(new Date(2026, 9, 7, 4, 59).getTime()), "night");
	t.is(daylightOf(new Date(2026, 9, 7, 6, 0).getTime()), "dawn");
	t.is(daylightOf(new Date(2026, 9, 7, 12, 0).getTime()), "day");
	t.is(daylightOf(new Date(2026, 9, 7, 19, 0).getTime()), "dusk");
	t.is(seasonOf(new Date(2027, 0, 15).getTime()), "winter");
	t.is(seasonOf(new Date(2027, 3, 15).getTime()), "spring");
	t.is(seasonOf(new Date(2027, 6, 15).getTime()), "summer");
});

test("is tired after a short night, fine after a full one", (t) => {
	t.is(
		signalsOf({ ...empty, sleep: [{ at: ago(8 * hours), minutes: 300 }] }, now)
			.rest,
		"tired",
	);
	t.is(
		signalsOf({ ...empty, sleep: [{ at: ago(8 * hours), minutes: 480 }] }, now)
			.rest,
		"fine",
	);
	t.is(
		signalsOf({ ...empty, sleep: [{ at: ago(2 * days), minutes: 300 }] }, now)
			.rest,
		"fine",
		"an old short night no longer counts",
	);
});

test("gets thirsty behind on water, only for someone who logs water", (t) => {
	t.false(signalsOf(empty, now).isThirsty, "never logged water");
	t.true(
		signalsOf(
			{ ...empty, water: [{ at: ago(26 * hours), milliliters: 250 }] },
			now,
		).isThirsty,
	);
	t.false(
		signalsOf({ ...empty, water: [{ at: ago(10), milliliters: 1500 }] }, now)
			.isThirsty,
	);
});

test("gets hungry 5 hours after a meal, and full right after a big one", (t) => {
	const meal = (minutesAgo: number, calories: number) => ({
		at: ago(minutesAgo),
		food: "Bibimbap",
		calories,
	});

	t.false(signalsOf(empty, now).isHungry, "never logged food");
	t.true(signalsOf({ ...empty, meals: [meal(6 * hours, 500)] }, now).isHungry);
	t.false(signalsOf({ ...empty, meals: [meal(hours, 500)] }, now).isHungry);
	t.true(signalsOf({ ...empty, meals: [meal(30, 1000)] }, now).isFull);
	t.false(signalsOf({ ...empty, meals: [meal(90, 1000)] }, now).isFull);
});

test("sweats after a workout and flushes after a hard one", (t) => {
	const workout = (minutesAgo: number, intensity: "moderate" | "vigorous") => ({
		at: ago(minutesAgo),
		activity: "running",
		minutes: 30,
		intensity,
	});

	t.is(
		signalsOf({ ...empty, workouts: [workout(10, "vigorous")] }, now).exertion,
		"flushed",
	);
	t.is(
		signalsOf({ ...empty, workouts: [workout(10, "moderate")] }, now).exertion,
		"sweaty",
	);
	t.is(
		signalsOf({ ...empty, workouts: [workout(25, "moderate")] }, now).exertion,
		"none",
	);
});

test("wears today's latest mood, reading by time, not by order", (t) => {
	t.is(
		signalsOf({ ...empty, moods: [{ at: ago(hours), score: 2 }] }, now).face,
		"sad",
	);
	t.is(
		signalsOf({ ...empty, moods: [{ at: ago(hours), score: 5 }] }, now).face,
		"bright",
	);
	t.is(
		signalsOf(
			{
				...empty,
				// The second was backdated, so it is older though it comes later.
				moods: [
					{ at: ago(30), score: 5 },
					{ at: ago(3 * hours), score: 1 },
				],
			},
			now,
		).face,
		"bright",
	);
});

test("wakes with bed head after a week away", (t) => {
	const old = { at: ago(8 * days), text: "back soon" };

	t.true(signalsOf({ ...empty, notes: [old] }, now).isBedHead);
	t.false(
		signalsOf({ ...empty, notes: [old, { at: ago(5), text: "back" }] }, now)
			.isBedHead,
	);
});

test("fills the room with what was earned", (t) => {
	const strength = Array.from({ length: 10 }, (_, index) => ({
		at: ago((index + 1) * days),
		activity: "strength",
		minutes: 30,
		intensity: "moderate" as const,
	}));
	const focus = Array.from({ length: 60 }, (_, index) => ({
		at: ago(index * hours),
		minutes: 25,
	}));
	const room = signalsOf({ ...empty, workouts: strength, focus }, now).room;

	t.true(room.dumbbells);
	t.true(room.books, "25 hours of focus");
	t.is(
		signalsOf({ ...empty, water: [{ at: ago(10), milliliters: 250 }] }, now)
			.room.plant,
		"growing",
	);
	t.is(
		signalsOf(
			{ ...empty, water: [{ at: ago(3 * days), milliliters: 250 }] },
			now,
		).room.plant,
		"wilting",
	);
});

test("weighs only the last 28 days of strength work", (t) => {
	const strength = (daysAgo: number) => ({
		at: ago(daysAgo * days),
		activity: "strength",
		minutes: 60,
		intensity: "moderate" as const,
	});

	t.is(
		strengthLoadOf(
			{ ...empty, workouts: [strength(1), strength(20), strength(40)] },
			now,
		),
		180,
	);
});

test("drops falling particles under reduced motion", (t) => {
	const signals = signalsOf(empty, now);

	t.is(stageSignalsOf(signals, true).season, undefined);
	t.is(stageSignalsOf(signals, true).daylight, "day");
	t.is(stageSignalsOf(signals, false), signals);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run build`
Expected: FAIL — `Cannot find module '../signals.js'`.

- [ ] **Step 3: Write the module**

```ts
// source/signals.ts
import { targetsOf } from "./health.js";
import {
	logsOf,
	profileNow,
	type Progress,
	todayOf,
	workoutExperience,
} from "./progress.js";

export type Daylight = "night" | "dawn" | "day" | "dusk";
export type Season = "spring" | "summer" | "autumn" | "winter";

export type Room = Readonly<{
	plant: "none" | "growing" | "wilting";
	dumbbells: boolean;
	books: boolean;
}>;

// What the logs say about right now, for the character and its stage.
export type Signals = Readonly<{
	rest: "tired" | "fine";
	isThirsty: boolean;
	isHungry: boolean;
	isFull: boolean;
	exertion: "none" | "sweaty" | "flushed";
	face: "sad" | "neutral" | "bright";
	isBedHead: boolean;
	daylight?: Daylight;
	season?: Season;
	room: Room;
}>;

export const quietSignals: Signals = {
	rest: "fine",
	isThirsty: false,
	isHungry: false,
	isFull: false,
	exertion: "none",
	face: "neutral",
	isBedHead: false,
	room: { plant: "none", dumbbells: false, books: false },
};

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

type Timed = Readonly<{ at: string }>;

// Entries between `within` ago and now, newest first by their timestamps.
const recentOf = <Entry extends Timed>(
	entries: readonly Entry[],
	now: number,
	within: number,
) =>
	entries
		.filter((entry) => {
			const age = now - Date.parse(entry.at);
			return age >= 0 && age <= within;
		})
		.toSorted((left, right) => Date.parse(right.at) - Date.parse(left.at));

const isSameDay = (at: string, now: number) =>
	new Date(at).toDateString() === new Date(now).toDateString();

export function daylightOf(now: number): Daylight {
	const hourOfDay = new Date(now).getHours();

	if (hourOfDay < 5 || hourOfDay >= 22) {
		return "night";
	}

	if (hourOfDay < 8) {
		return "dawn";
	}

	return hourOfDay < 18 ? "day" : "dusk";
}

// ponytail: northern hemisphere, where Taiwan, Korea, and most users are;
// add a hemisphere variable if someone in the south asks.
const seasonsByMonth = [
	"winter",
	"winter",
	"spring",
	"spring",
	"spring",
	"summer",
	"summer",
	"summer",
	"autumn",
	"autumn",
	"autumn",
	"winter",
] as const;

export const seasonOf = (now: number): Season =>
	seasonsByMonth[new Date(now).getMonth()] ?? "winter";

// Intensity-weighted strength minutes of the last 28 days, which build muscle.
export const strengthLoadOf = (progress: Progress, now: number) =>
	recentOf(
		progress.workouts.filter((workout) => workout.activity === "strength"),
		now,
		28 * day,
	).reduce((total, workout) => total + workoutExperience(workout), 0);

export function signalsOf(progress: Progress, now: number): Signals {
	const targets = targetsOf(profileNow(progress), progress.goals);
	const clock = new Date(now);
	const hourOfDay = clock.getHours() + clock.getMinutes() / 60;
	const [lastSleep] = recentOf(progress.sleep, now, 20 * hour);
	const [lastMeal] = recentOf(progress.meals, now, 3 * day);
	const [lastWorkout] = recentOf(progress.workouts, now, 30 * minute);
	const [mood] = recentOf(progress.moods, now, day).filter((entry) =>
		isSameDay(entry.at, now),
	);
	const [lastWater] = recentOf(progress.water, now, Number.POSITIVE_INFINITY);
	const [lastEntry] = logsOf(progress).filter((log) => log.kind !== "event");

	// Behind on water: under 40% of the pace from 7:00 to 22:00, past 11:00,
	// for someone who logged water this week.
	const pace = Math.min(Math.max((hourOfDay - 7) / 15, 0), 1);
	const isThirsty =
		recentOf(progress.water, now, 7 * day).length > 0 &&
		hourOfDay >= 11 &&
		hourOfDay < 22 &&
		todayOf(progress, now).water < 0.4 * targets.water * pace;

	const isHungry =
		lastMeal !== undefined &&
		hourOfDay >= 9 &&
		hourOfDay < 22 &&
		now - Date.parse(lastMeal.at) >= 5 * hour;

	const lastHourCalories = recentOf(progress.meals, now, hour).reduce(
		(total, meal) => total + (meal.calories ?? 0),
		0,
	);

	let exertion: Signals["exertion"] = "none";

	if (lastWorkout?.intensity === "vigorous") {
		exertion = "flushed";
	} else if (lastWorkout && now - Date.parse(lastWorkout.at) <= 20 * minute) {
		exertion = "sweaty";
	}

	let face: Signals["face"] = "neutral";

	if (mood && mood.score <= 2) {
		face = "sad";
	} else if (mood && mood.score >= 4) {
		face = "bright";
	}

	let plant: Room["plant"] = "none";

	if (lastWater) {
		plant = now - Date.parse(lastWater.at) <= 2 * day ? "growing" : "wilting";
	}

	return {
		rest: lastSleep && lastSleep.minutes < 360 ? "tired" : "fine",
		isThirsty,
		isHungry,
		isFull: lastHourCalories >= 0.4 * targets.calories,
		exertion,
		face,
		isBedHead:
			lastEntry !== undefined &&
			!isSameDay(lastEntry.at, now) &&
			now - Date.parse(lastEntry.at) >= 7 * day,
		daylight: daylightOf(now),
		season: seasonOf(now),
		room: {
			plant,
			dumbbells:
				progress.workouts.filter((workout) => workout.activity === "strength")
					.length >= 10,
			books:
				progress.focus.reduce((total, focus) => total + focus.minutes, 0) >=
				25 * 60,
		},
	};
}

// Falling particles are motion; the sky and the room stay.
export const stageSignalsOf = (
	signals: Signals,
	isReduced: boolean,
): Signals => (isReduced ? { ...signals, season: undefined } : signals);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run build && npx ava build/tests/signals.test.js`
Expected: PASS, 11 tests. If `targetsOf(undefined).water` is not 2,600 ml, recompute the thirst threshold in the test from Plan C's default: 0.4 × water × 8/15 must stay above 0 and below 1,500.

- [ ] **Step 5: Commit**

```bash
git add source/signals.ts source/tests/signals.test.ts
git commit -m "feat: read rest, thirst, hunger, effort, and mood from the logs"
```

---

### Task 3: A Body That Fills Out Every 2 Points of Body Fat

**Files:**

- Modify: `source/pixel-art.ts:22-117` (`Build`, `Look`, `lookOf`), `:132-231` (`Body`, `bodyOf`), `:286-298` (`hanging`, `marginOf`), and the painters that read `look.build`, `look.isMuscular`, or `b.chest + 1` for a hanging hand
- Modify: `source/tests/render-scenes.ts` (a `bodies` sheet)
- Test: `source/tests/pixel-art.test.ts`

**Interfaces:**

- Consumes: `Signals` is not used yet
- Produces:
  - `Look` without `build` and `isMuscular`, with `fat: number` (0 to `fatStages`) and `muscle: number` (0 to `muscleStages`)
  - `fatStages = 21`, `muscleStages = 3`, `fatStep = 2`
  - `bodyFatOf(profile): number` (given, or Deurenberg's estimate)
  - `lookOf(profile: Profile | undefined, strengthLoad = 0): Look`
  - `bodyOf(look: Look, isFull = false)` stays private

The new body grows 1 feature per stage, in a fixed order, so every stage draws differently and the shape fills out evenly; the order lives in `fatFeatures`. The walk's margins move from 9 to 11 pixels so the widest body (a half width of 11 with its arms) never leaves the 32-pixel stage.

- [ ] **Step 1: Write the failing tests**

In `source/tests/pixel-art.test.ts`, import `bodyFatOf`, `fatStages`, `fatStep`, and `muscleStages`, then replace the test "tells muscle from fat at the same weight by body fat" with:

```ts
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

	for (const gender of ["female", "male", "other"] as const) {
		const frames = Array.from({ length: fatStages + 1 }, (_, fat) => {
			const look = { ...defaultLook, gender, fat };
			// The front at rest and the side mid-stride, since a belly shows in profile.
			return [...scene({ look }), ...scene({ look, counter: 24 })].join("\n");
		});

		t.is(new Set(frames).size, fatStages + 1, gender);
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
});

test("stands 1 pixel taller for every 5 cm", (t) => {
	const heights = [150, 155, 160, 165, 170, 175, 180, 185].map(
		(height) => lookFor({ height }).height,
	);

	t.is(new Set(heights).size, heights.length);
});

test("keeps the widest body on the stage at both walking edges", (t) => {
	const widest = {
		...defaultLook,
		gender: "male" as const,
		height: 35,
		fat: fatStages,
		muscle: muscleStages,
	};

	for (const counter of [0, 24]) {
		// At home, the middle of the 32-pixel stage, the body may reach 11 each way.
		t.true(extentOf(scene({ look: widest, counter })).columns <= 23);
	}
});
```

Add a helper beside `lookFor`, and make `lookFor` use it:

```ts
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
```

`extentOf` measures a frame at its home position, the middle column 16, so a column count of 23 means a half width of 11.

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run build`
Expected: FAIL — `fatStages` and `bodyFatOf` are not exported, and `Look` has no `fat`.

- [ ] **Step 3: Replace builds with stages in `lookOf`**

In `source/pixel-art.ts`, delete `type Build`, `fatBands`, and `buildOf`, and replace `Look`, `defaultLook`, and `lookOf`:

```ts
// What the profile decides: the height in pixels, how much fat and muscle the
// body carries as stages, the clothes for the work style, and the hair for
// the age.
export type Look = Readonly<{
	height: number;
	fat: number;
	muscle: number;
	gender: Gender;
	style: WorkStyle;
	hair: Hair;
}>;

export const defaultLook: Look = {
	height: 29,
	fat: 5,
	muscle: 0,
	gender: "other",
	style: "desk",
	hair: "dark",
};

// The leanest body fat drawn, by gender; every 2 points above it is 1 stage.
const leanFloor: Record<Gender, number> = { female: 14, male: 6, other: 10 };
export const fatStep = 2;

// Each stage of body fat adds 1 feature, in this order, so every stage draws
// a different body and the shape fills out evenly. Stage 0 is the leanest.
const fatFeatures = [
	"waist",
	"cheeks",
	"hips",
	"belly",
	"thigh",
	"waist",
	"jaw",
	"hips",
	"belly",
	"arm",
	"waist",
	"chin",
	"thigh",
	"hips",
	"belly",
	"calf",
	"waist",
	"chest",
	"thigh",
	"hips",
	"belly",
] as const;
export const fatStages = fatFeatures.length;

// Muscle fills out the chest, the arms, then the shoulders.
const muscleFeatures = ["chest", "arm", "shoulder"] as const;
export const muscleStages = muscleFeatures.length;

// 150 intensity-weighted minutes of strength work in 28 days is 1 stage.
export const muscleMinutes = 150;

type Feature = (typeof fatFeatures)[number] | (typeof muscleFeatures)[number];

const countOf = (features: readonly Feature[]) => {
	const counts: Record<Feature, number> = {
		arm: 0,
		belly: 0,
		calf: 0,
		cheeks: 0,
		chest: 0,
		chin: 0,
		hips: 0,
		jaw: 0,
		shoulder: 0,
		thigh: 0,
		waist: 0,
	};

	for (const feature of features) {
		counts[feature] += 1;
	}

	return counts;
};

const clamp = (value: number, minimum: number, maximum: number) =>
	Math.min(Math.max(value, minimum), maximum);

const bmiOf = (profile: Profile) =>
	profile.weight / (profile.height / 100) ** 2;

const sexOf: Record<Gender, number> = { female: 0, male: 1, other: 0.5 };

// Body fat as given, or else Deurenberg's estimate from BMI and age:
// 1.2 × BMI + 0.23 × age − 10.8 × sex − 5.4 (Br J Nutr 1991;65:105-114).
export const bodyFatOf = (profile: Profile) =>
	profile.bodyFat ??
	1.2 * bmiOf(profile) +
		0.23 * profile.age -
		10.8 * sexOf[profile.gender] -
		5.4;

// 145 cm draws 26 pixels tall, and every 5 cm adds 1, from 22 to 35.
export function lookOf(profile: Profile | undefined, strengthLoad = 0): Look {
	if (!profile) {
		return defaultLook;
	}

	const fat = clamp(
		Math.round((bodyFatOf(profile) - leanFloor[profile.gender]) / fatStep),
		0,
		fatStages,
	);
	const muscle = clamp(
		(profile.goal === "buildMuscle" ? 1 : 0) +
			(profile.workStyle === "athlete" ? 1 : 0) +
			// Lean yet heavy for the height means muscle.
			(fat <= 3 && bmiOf(profile) >= 23 ? 1 : 0) +
			Math.min(Math.floor(strengthLoad / muscleMinutes), 2),
		0,
		muscleStages,
	);
	let hair: Hair = "dark";

	if (profile.age >= 70) {
		hair = "white";
	} else if (profile.age >= 55) {
		hair = "grey";
	}

	return {
		height: clamp(Math.round(26 + (profile.height - 145) / 5), 22, 35),
		fat,
		muscle,
		gender: profile.gender,
		style: profile.workStyle,
		hair,
	};
}
```

- [ ] **Step 4: Build the body from the stages**

Add to `Body`: `side: number` (where the hands hang), `belly: number` (how far the lower torso sticks out in profile), `cheeks: boolean`, `jaw: number`, `doubleChin: boolean`, and `shoulderCap: number`. Replace `bodyOf`:

```ts
// A 7-row head and a neck take 8 of the height; legs take 55% of the rest.
// A big meal in the last hour shows for that hour.
function bodyOf(look: Look, isFull = false): Body {
	const span = look.height - 8;
	const legs = Math.round(span * 0.55);
	const torso = span - legs;
	const [frameChest, frameWaist, frameHips] = frames[look.gender];
	const fat = countOf(fatFeatures.slice(0, look.fat));
	const strong = countOf(muscleFeatures.slice(0, look.muscle));
	const full = isFull ? 1 : 0;
	const chest = frameChest + fat.chest + strong.chest;
	const waist = Math.max(frameWaist - 1, 2) + fat.waist + full;
	const thigh = Math.max(frameHips - 2, 2) + fat.thigh;
	const hip = ground + legs;
	const shoulder = hip + torso - 1;
	const chin = shoulder + 2;

	return {
		hip,
		shoulder,
		chin,
		top: chin + 6,
		legs,
		knee: ground + Math.floor(legs / 2),
		shin: ground + Math.floor(legs / 4),
		chest,
		waist,
		hips: Math.max(frameHips - 1, 3) + fat.hips,
		thigh,
		calf: Math.max(thigh - 1, 2) + fat.calf,
		ankle: Math.max(thigh - 2, 2),
		arm: Math.min(2 + fat.arm + strong.arm, 4),
		reach: torso + 3,
		// The hands hang just outside the wider of the chest and the waist.
		side: Math.max(chest, waist) + 1,
		belly: fat.belly + full,
		cheeks: fat.cheeks > 0,
		jaw: 2 + fat.jaw,
		doubleChin: fat.chin > 0,
		shoulderCap: strong.shoulder,
	};
}
```

Then update the readers:

```ts
// Where a hand rests with the arm hanging, nudged by `swing`.
const hanging = (b: Body, side: number, swing = 0): Point => [
	side * b.side,
	b.shoulder - b.reach + 1 + swing,
];

// The stage edges the character walks between, wide enough for the widest body.
const marginOf = (width: number) => {
	const minimum = 11;
	return { minimum, maximum: Math.max(width - 12, minimum + 1) };
};
```

- In the `break` scene, the resting hand becomes `[b.side + 1, b.hip + 2]`; in `eat`, `[b.side + 1, b.hip + 3]`; in `stretch`, the last reach becomes `[b.side, b.shoulder - b.reach + 1 + (at % 2)]`
- In `paintLegsFront`, the thighs meet all the way down from stage 14: replace `if (look.build === "heavy")` with `if (look.fat >= 14)`
- In `paintTorsoFront`, the shoulder line reaches over the caps: `span(upper, -(b.chest + 1 + b.shoulderCap), b.chest + 1 + b.shoulderCap, b.shoulder, shoulderKey);`; the belly's curve shows from 3 stages of belly: `if (b.belly >= 3)`; and the abs show on a lean, muscular athlete: `if (look.fat <= 3 && look.muscle >= 2)`
- In `paintHeadFront`, replace `const jaw = look.build === "heavy" ? 3 : 2;` with `const jaw = b.jaw;`, and after the skin rows add:

```ts
if (b.cheeks) {
	head(-4, chin + 1, "s");
	head(4, chin + 1, "q");
}

if (b.doubleChin) {
	span(head, -2, 2, chin - 1, "q");
}
```

- In `paintSide`, replace the heavy and stocky branches with `if (!isChest) { forward += b.belly; }`

- [ ] **Step 5: Add a sheet of bodies**

In `source/tests/render-scenes.ts`, add to `sheets`:

```ts
bodies: (["female", "male", "other"] as const).flatMap((gender) =>
	Array.from({ length: 8 }, (_, step) => ({
		...base,
		look: { ...defaultLook, gender, fat: Math.round((fatStages * step) / 7) },
	})),
),
```

- [ ] **Step 6: Run the tests and look at the sheet**

Run: `npm run build && npx ava build/tests/pixel-art.test.js && node build/tests/render-scenes.js "$TMPDIR/scenes"`
Expected: PASS. In `bodies.png`, each row grows from lean to heavy without a jump between neighbors, the hands always hang outside the waist, and the heaviest male in profile keeps his belly inside the frame.

- [ ] **Step 7: Commit**

```bash
git add source/pixel-art.ts source/tests/pixel-art.test.ts source/tests/render-scenes.ts
git commit -m "feat: fill out the body every 2 points of body fat and with strength work"
```

---

### Task 4: Skin, Hair, Glasses, Beards, and the Years

**Files:**

- Modify: `source/i18n.ts:23-35` (the appearance value lists, beside `genders`)
- Modify: `source/progress.ts` (`profileSchema`)
- Modify: `source/pixel-art.ts` (`Look`, `defaultLook`, the local `Profile`, `lookOf`, `paintHairBehind`, `paintHeadFront`, `paintSideHead`, `composeScene`'s `plant`, `paletteOf`; delete `Hair` and `hairOf`)
- Modify: `source/tests/render-scenes.ts` (`appearance` and `ages` sheets)
- Test: `source/tests/pixel-art.test.ts`, `source/tests/progress.test.ts`

**Interfaces:**

- Consumes: Task 3's `Look` and `lookOf`
- Produces:
  - In `i18n.ts`: `skinTones = [1, 2, 3, 4, 5]`, `hairStyles = ["short", "long", "bob", "ponytail", "bun", "buzz"]`, `hairColors = ["black", "brown", "blonde", "red"]`, `facialHairs = ["none", "stubble", "beard"]`, each `as const` with its type `SkinTone`, `HairStyle`, `HairColor`, `FacialHair`
  - `profile.skinTone?`, `profile.hairStyle?`, `profile.hairColor?`, `profile.glasses?`, `profile.facialHair?`
  - `Look` gains `age`, `skinTone`, `hairStyle`, `hairColor`, `glasses`, `facialHair`, and loses `hair`
  - `greyOf(age: number): number` and `whiteOf(age: number): number`, each from 0 to 1

Every painter now draws hair with the 2 keys `h` (main) and `i` (light), and skin with `s` and `q`. `composeScene`'s `plant` recolors those 4 keys as it writes each pixel: skin by the tone, hair by the color, and hair to grey `H`/`J` or white `I`/`K` by a fixed rank per pixel, temples first, so the same pixels stay grey from frame to frame and more turn grey every year from 35.

- [ ] **Step 1: Write the failing tests**

Append to `source/tests/pixel-art.test.ts`, importing `facialHairs`, `hairColors`, `hairStyles`, and `skinTones` from `../i18n.js` and `greyOf` from `../pixel-art.js`:

```ts
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
```

Append to `source/tests/progress.test.ts`:

```ts
test("saves an appearance and rejects a style it does not know", (t) => {
	const file = temporaryFile();
	const profile = {
		name: "Ken",
		age: 30,
		height: 175,
		weight: 70,
		gender: "male",
		workStyle: "desk",
		goal: "maintain",
	} as const;

	saveProgress(file, {
		...sample,
		profile: { ...profile, skinTone: 4, hairStyle: "bun", glasses: true },
	});
	t.like(loadProgress(file).profile, {
		skinTone: 4,
		hairStyle: "bun",
		glasses: true,
	});

	writeFileSync(
		file,
		JSON.stringify({ ...sample, profile: { ...profile, hairStyle: "mohawk" } }),
	);
	t.throws(() => loadProgress(file), { message: /unreadable/v });
});
```

The existing checks that age 60 shows `H` and age 75 shows `I` keep passing: by 60, every temple pixel is grey, and by 75, every temple pixel is white.

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run build`
Expected: FAIL — `skinTones` is not exported from `../i18n.js`, and `Look` has no `skinTone`.

- [ ] **Step 3: Add the value lists and the schema fields**

In `source/i18n.ts`, after `healthGoals`:

```ts
export const skinTones = [1, 2, 3, 4, 5] as const;
export type SkinTone = (typeof skinTones)[number];

export const hairStyles = [
	"short",
	"long",
	"bob",
	"ponytail",
	"bun",
	"buzz",
] as const;
export type HairStyle = (typeof hairStyles)[number];

export const hairColors = ["black", "brown", "blonde", "red"] as const;
export type HairColor = (typeof hairColors)[number];

export const facialHairs = ["none", "stubble", "beard"] as const;
export type FacialHair = (typeof facialHairs)[number];
```

In `source/progress.ts`, import them and add to `profileSchema`:

```ts
// The character's appearance, added after 1.6.0, so all optional.
skinTone: zod.literal(skinTones).optional(),
hairStyle: zod.enum(hairStyles).optional(),
hairColor: zod.enum(hairColors).optional(),
glasses: zod.boolean().optional(),
facialHair: zod.enum(facialHairs).optional(),
```

- [ ] **Step 4: Carry the appearance in the look**

In `source/pixel-art.ts`, import the 4 types from `./i18n.js`, delete `type Hair` and `hairOf`, add the optional appearance fields to the local `Profile` type, and replace `Look`, `defaultLook`, and the end of `lookOf`:

```ts
export type Look = Readonly<{
	height: number;
	fat: number;
	muscle: number;
	gender: Gender;
	style: WorkStyle;
	age: number;
	skinTone: SkinTone;
	hairStyle: HairStyle;
	hairColor: HairColor;
	glasses: boolean;
	facialHair: FacialHair;
}>;

export const defaultLook: Look = {
	height: 29,
	fat: 5,
	muscle: 0,
	gender: "other",
	style: "desk",
	age: 30,
	skinTone: 3,
	hairStyle: "bob",
	hairColor: "brown",
	glasses: false,
	facialHair: "none",
};

// Before appearance existed, gender and work style chose the hair.
const hairStyleOf = (profile: Profile): HairStyle => {
	if (profile.gender === "female") {
		return profile.workStyle === "athlete" ? "ponytail" : "long";
	}

	return profile.gender === "male" ? "short" : "bob";
};
```

```ts
return {
	height: clamp(Math.round(26 + (profile.height - 145) / 5), 22, 35),
	fat,
	muscle,
	gender: profile.gender,
	style: profile.workStyle,
	age: profile.age,
	skinTone: profile.skinTone ?? 3,
	hairStyle: profile.hairStyle ?? hairStyleOf(profile),
	hairColor: profile.hairColor ?? "brown",
	glasses: profile.glasses ?? false,
	facialHair: profile.facialHair ?? "none",
};
```

Remove the `let hair` block from `lookOf`.

- [ ] **Step 5: Recolor skin and hair where each pixel is written**

Add above `composeScene`:

```ts
// Skin as [main, shade] and hair as [main, light]; tone 3 and brown are the
// keys every painter writes, so they map to themselves.
const skinKeys: Record<SkinTone, readonly [string, string]> = {
	1: ["6", "7"],
	2: ["8", "9"],
	3: ["s", "q"],
	4: ["a", "f"],
	5: ["j", "k"],
};
const hairKeys: Record<HairColor, readonly [string, string]> = {
	black: ["0", "1"],
	brown: ["h", "i"],
	blonde: ["2", "3"],
	red: ["4", "5"],
};

// How much of the hair is grey, from 35 to 70, and white, from 60 to 85.
export const greyOf = (age: number) => clamp((age - 35) / 35, 0, 1);
export const whiteOf = (age: number) => clamp((age - 60) / 25, 0, 1);

// A fixed rank for every hair pixel, temples first, so hair greys from the
// sides up and a grey pixel stays grey from frame to frame.
const rankOf = (x: number, y: number) =>
	(Math.abs(x) >= 3 ? 0 : 0.5) + ((((x * 3 + y * 5) % 8) + 8) % 8) / 16;

function recolorOf(look: Look) {
	const [skin, skinShade] = skinKeys[look.skinTone];
	const [hair, hairLight] = hairKeys[look.hairColor];
	const grey = greyOf(look.age);
	const white = whiteOf(look.age);

	return (key: string, x: number, y: number) => {
		if (key === "s") {
			return skin;
		}

		if (key === "q") {
			return skinShade;
		}

		if (key !== "h" && key !== "i") {
			return key;
		}

		const rank = rankOf(x, y);

		if (rank < white) {
			return key === "h" ? "I" : "K";
		}

		if (rank < grey) {
			return key === "h" ? "H" : "J";
		}

		return key === "h" ? hair : hairLight;
	};
}
```

In `composeScene`, create `const recolor = recolorOf(look);` and write `row[column] = recolor(key, x, y);` inside `plant` instead of `row[column] = key;`. Add the new keys to `paletteOf`, keeping the map alphabetical by key:

```ts
["0", "#1E1A19"],
["1", "#3B3431"],
["2", "#C49A55"],
["3", "#E3C483"],
["4", "#8A3A20"],
["5", "#B65A36"],
["6", "#F5D9C4"],
["7", "#E0B9A0"],
["8", "#EBC4A0"],
["9", "#D4A47F"],
["a", "#B5815D"],
["f", "#946245"],
["j", "#7B5139"],
["k", "#5C3A27"],
["W", "#9FD4F2"],
```

`W` is water and sweat, used from Task 6 on.

- [ ] **Step 6: Paint hair by style, and the face by age**

Replace `paintHairBehind`:

```ts
// Long hair, a bob, and a ponytail fall behind the head, so they go on first.
function paintHairBehind({ upper, b, look, counter }: Paint, nod: number) {
	const head = (x: number, y: number, key: string) => {
		upper(x, y - nod, key);
	};

	switch (look.hairStyle) {
		case "bob": {
			for (let y = b.chin + 1; y <= b.chin + 4; y++) {
				head(-4, y, "h");
				head(4, y, "h");
			}

			break;
		}

		case "ponytail": {
			// A ponytail that swings.
			const sway = Math.floor(counter / 3) % 2;
			head(4, b.chin + 4, "h");
			head(5, b.chin + 3, "h");
			head(5 + sway, b.chin + 2, "i");
			head(5 + sway, b.chin + 1, "h");
			break;
		}

		case "long": {
			for (let y = b.shoulder - 3; y <= b.chin + 4; y++) {
				head(-4, y, "h");
				head(4, y, y % 3 === 0 ? "i" : "h");
			}

			for (let y = b.shoulder - 2; y < b.chin; y++) {
				span(upper, -3, 3, y, "h");
			}

			break;
		}

		case "bun":
		case "buzz":
		case "short": {
			break;
		}
	}
}
```

In `paintFront`, pass the stooped nod: `paintHairBehind(paint, (pose.nod ?? 0) + (paint.look.age >= 72 ? 1 : 0));`.

Replace `paintHeadFront` up to the headphones (the gear block from `if (gear.gadget >= 1)` on stays as it is):

```ts
function paintHeadFront({ upper, b, look, gear }: Paint, pose: Front) {
	// Past 72, the head sits 1 pixel lower, as the back rounds.
	const nod = (pose.nod ?? 0) + (look.age >= 72 ? 1 : 0);
	const head = (x: number, y: number, key: string) => {
		upper(x, y - nod, key);
	};

	const { chin, jaw } = b;
	const turn = pose.turn ?? 0;

	span(head, -jaw, jaw, chin, "s");
	head(-jaw, chin, "q");
	head(jaw, chin, "q");

	for (let y = chin + 1; y <= chin + 4; y++) {
		span(head, -3, 3, y, "s");
	}

	head(3, chin + 1, "q");
	head(3, chin + 2, "q");

	if (b.cheeks) {
		head(-4, chin + 1, "s");
		head(4, chin + 1, "q");
	}

	if (b.doubleChin) {
		span(head, -2, 2, chin - 1, "q");
	}

	// Lines that come with the years: smile lines from 50, crow's feet from 62.
	if (look.age >= 50) {
		head(turn - 2, chin + 1, "q");
		head(turn + 2, chin + 1, "q");
	}

	if (look.age >= 62) {
		head(turn - 3, chin + 3, "q");
		head(turn + 3, chin + 3, "q");
	}

	// A beard along the jaw and up the cheeks, or stubble on the chin.
	if (look.facialHair === "beard") {
		span(head, -jaw, jaw, chin, "h");

		for (const x of [-3, -2, 2, 3]) {
			head(x, chin + 1, "h");
		}
	} else if (look.facialHair === "stubble") {
		for (let x = 1 - jaw; x < jaw; x += 2) {
			head(x, chin, "i");
		}
	}

	// The crown, with a lighter streak unless it is cropped close.
	span(head, -3, 3, chin + 5, "h");
	span(head, -2, 2, chin + 6, "h");

	if (look.hairStyle !== "buzz") {
		span(head, -2, 1, chin + 5, "i");
		head(-1, chin + 6, "i");
	}

	// Eyes, brows, the shadow under the nose, and the mouth.
	const eye = pose.eyes === "closed" ? "q" : "e";
	head(turn - 2, chin + 3, eye);
	head(turn + 2, chin + 3, eye);
	head(turn - 2, chin + 4, "h");
	head(turn + 2, chin + 4, "h");
	head(turn, chin + 2, "q");

	if (pose.mouth === "smile") {
		span(head, turn - 1, turn + 1, chin + 1, "m");
		head(turn - 2, chin + 2, "r");
		head(turn + 2, chin + 2, "r");
	} else if (pose.mouth === "open") {
		span(head, turn - 1, turn, chin + 1, "e");
	} else {
		span(head, turn - 1, turn, chin + 1, "q");
	}

	// The fringe or sideburns of each style.
	switch (look.hairStyle) {
		case "short": {
			head(-3, chin + 4, "h");
			head(3, chin + 4, "h");
			break;
		}

		case "long":
		case "ponytail":
		case "bun": {
			span(head, -3, -1, chin + 4, "h");
			head(3, chin + 4, "h");
			head(-3, chin + 3, "h");
			head(3, chin + 3, "h");
			break;
		}

		case "bob": {
			span(head, -3, -2, chin + 4, "h");
			head(3, chin + 4, "h");
			break;
		}

		case "buzz": {
			break;
		}
	}

	if (look.hairStyle === "bun") {
		// A knot on top of the head.
		span(head, -1, 1, chin + 7, "h");
		span(head, -1, 1, chin + 8, "h");
		head(0, chin + 8, "i");
	}

	// Ears show beside short hair, unless headphones cover them.
	if (
		(look.hairStyle === "short" || look.hairStyle === "buzz") &&
		gear.gadget === 0
	) {
		head(-4, chin + 2, "q");
		head(-4, chin + 3, "s");
		head(4, chin + 2, "q");
		head(4, chin + 3, "q");
	}

	if (look.glasses) {
		// Thin frames around both eyes and over the nose.
		for (const x of [turn - 3, turn - 1, turn, turn + 1, turn + 3]) {
			head(x, chin + 3, "d");
		}
	}
```

Replace `paintSideHead` up to its headphones block:

```ts
function paintSideHead({ upper: body, b, look, gear }: Paint, pose: Side) {
	// Past 72, the head leans 1 pixel forward and down.
	const lean = look.age >= 72 ? 1 : 0;
	const upper: Put = (x, y, key) => {
		body(x + lean, y - lean, key);
	};

	const { chin } = b;

	// The neck stays on the body, and the head in profile has its nose
	// forward and its hair behind.
	span(body, -1, 1, b.shoulder + 1, "s");
	body(-1, b.shoulder + 1, "q");
	span(upper, -1, 2, chin, "s");
	upper(-1, chin, "q");
	span(upper, -2, 3, chin + 1, "s");

	for (let y = chin + 2; y <= chin + 4; y++) {
		span(upper, -3, 3, y, "s");
	}

	upper(4, chin + 2, "s");
	span(upper, -3, 3, chin + 5, "h");
	span(upper, -2, 2, chin + 6, "h");

	if (look.hairStyle !== "buzz") {
		upper(0, chin + 5, "i");
	}

	span(upper, -3, -1, chin + 4, "h");
	span(upper, -3, -2, chin + 3, "h");
	upper(-3, chin + 2, "h");
	upper(-1, chin + 3, "q");
	upper(2, chin + 3, "e");
	upper(2, chin + 4, "h");
	upper(3, chin + 1, pose.mouth === "smile" ? "m" : "q");

	if (look.age >= 50) {
		upper(2, chin + 1, "q");
	}

	if (look.facialHair === "beard") {
		span(upper, -1, 2, chin, "h");
		upper(-2, chin + 1, "h");
		upper(-1, chin + 1, "h");
	} else if (look.facialHair === "stubble") {
		upper(0, chin, "i");
		upper(2, chin, "i");
	}

	switch (look.hairStyle) {
		case "long": {
			for (let y = b.shoulder - 3; y <= chin + 3; y++) {
				span(upper, -4, -3, y, "h");
			}

			break;
		}

		case "ponytail": {
			const sway = Math.floor(pose.frame / 2) % 2;
			upper(-4, chin + 4, "h");
			upper(-5, chin + 3 - sway, "h");
			upper(-5, chin + 2 - sway, "i");
			break;
		}

		case "bob": {
			for (let y = chin + 1; y <= chin + 3; y++) {
				upper(-3, y, "h");
				upper(-4, y, "h");
			}

			break;
		}

		case "bun": {
			upper(-4, chin + 5, "h");
			upper(-4, chin + 6, "h");
			upper(-5, chin + 6, "i");
			break;
		}

		case "buzz":
		case "short": {
			break;
		}
	}

	if (look.glasses) {
		upper(1, chin + 3, "d");
		upper(3, chin + 3, "d");
	}
```

- [ ] **Step 7: Add the sheets**

In `source/tests/render-scenes.ts`, import `hairStyles` and `skinTones` from `../i18n.js` and add to `sheets`:

```ts
appearance: skinTones.flatMap((skinTone) =>
	hairStyles.map((hairStyle) => ({
		...base,
		look: { ...defaultLook, skinTone, hairStyle },
	})),
),
ages: Array.from({ length: 12 }, (_, index) => ({
	...base,
	look: { ...defaultLook, age: 30 + index * 5, facialHair: "beard" as const },
})),
```

- [ ] **Step 8: Run the tests and look at the sheets**

Run: `npm run build && npx ava build/tests/pixel-art.test.js build/tests/progress.test.js && node build/tests/render-scenes.js "$TMPDIR/scenes"`
Expected: PASS. In `appearance.png`, every style reads as itself at every tone; in `ages.png`, the temples go grey first and the beard greys with the hair.

- [ ] **Step 9: Commit**

```bash
git add source/i18n.ts source/progress.ts source/pixel-art.ts source/tests/pixel-art.test.ts source/tests/progress.test.ts source/tests/render-scenes.ts
git commit -m "feat: draw skin tones, hair styles, glasses, beards, and greying with age"
```

---

### Task 5: Choose the Appearance from Profile

**Files:**

- Modify: `source/components/entry-form.tsx:32-38` (props), `:113-128` (the select input)
- Modify: `source/content.ts` (`appearanceFieldsOf`, `appearanceOf`)
- Modify: `source/progress.ts` (`eventActions`)
- Modify: `source/i18n.ts` (all 3 languages)
- Modify: `source/app.tsx` (the Profile panel, a preview of the look, `submitAppearance`)
- Test: `source/tests/dashboard.test.tsx`, `source/tests/data.test.ts`

**Interfaces:**

- Consumes: Task 4's value lists and `lookOf`; Plan C's `profileNow`
- Produces:
  - `EntryForm` prop `onFocus?: (key: string, value: string) => void`, called as the cursor moves in a select field
  - `appearanceFieldsOf(messages: Messages, profile: Profile | undefined): Field[]`
  - `appearanceOf(values: Readonly<Record<string, string>>): Partial<Pick<Profile, "skinTone" | "hairStyle" | "hairColor" | "glasses" | "facialHair">>`
  - Event action `appearanceSaved`; `messages.profileSections`, `messages.appearance`

**Profile** now opens a choice of 2 sections, "Body and goal" (the form it opened before) and "Appearance". Like the theme picker, the appearance previews on the character as the cursor moves, and nothing is saved until the last field.

- [ ] **Step 1: Write the failing tests**

Append to `source/tests/data.test.ts` (import `appearanceOf` from `../content.js`):

```ts
test("reads an appearance from the form's values, ignoring what is missing", (t) => {
	t.deepEqual(appearanceOf({ skinTone: "4", glasses: "yes" }), {
		skinTone: 4,
		glasses: true,
	});
	t.deepEqual(appearanceOf({ hairStyle: "mohawk", skinTone: "9" }), {});
	t.deepEqual(appearanceOf({}), {});
});
```

Append to `source/tests/dashboard.test.tsx`:

```tsx
test("chooses an appearance, previewing it before saving", async (t) => {
	const profile = {
		name: "Nova",
		age: 30,
		height: 170,
		weight: 65,
		gender: "other",
		workStyle: "desk",
		goal: "maintain",
	} as const;
	const { file, stdin, lastFrame, unmount } = start({ ...empty, profile });

	// Profile, then Appearance.
	await type(stdin, ["5", "\r", down, "\r"]);
	t.true((lastFrame() ?? "").includes("Skin tone"));

	// Tan, then the defaults for style, color, and facial hair, then glasses.
	await type(stdin, [down, "\r", "\r", "\r", "\r", up, "\r"]);
	t.like(loadProgress(file).profile, {
		skinTone: 4,
		hairStyle: "bob",
		glasses: true,
	});
	t.true(actionsIn(file).includes("appearanceSaved"));
	t.true((lastFrame() ?? "").includes("Appearance saved"));

	unmount();
});

test("asks for the body first when there is no profile", async (t) => {
	const { stdin, lastFrame, unmount } = start();

	await type(stdin, ["5", "\r", down, "\r", "\r", "\r", "\r", "\r", "\r"]);
	t.true((lastFrame() ?? "").includes("body and goal first"));

	unmount();
});
```

Update the existing test "saves a profile and turns it into targets": after `"5", "\r",` add `"\r",` to choose "Body and goal".

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run build`
Expected: FAIL — `appearanceOf` is not exported from `../content.js`.

- [ ] **Step 3: Let a form report the focused option**

In `source/components/entry-form.tsx`, add `onFocus?: (key: string, value: string) => void;` to `EntryFormProps`, destructure it, and pass it to the select's `Choice`:

```tsx
<Choice
	key={current.key}
	initialValue={defaultOf(current)}
	options={[
		...(current.combinations ?? []).map((combination, index) => ({
			label: `↺ ${combination.label}`,
			value: `${combinationPrefix}${index}`,
		})),
		...current.options,
	]}
	onFocus={(value) => {
		onFocus?.(current.key, value);
	}}
	onSelect={accept}
/>
```

- [ ] **Step 4: Add the fields and the reader**

In `source/content.ts`, import `facialHairs`, `hairColors`, `hairStyles`, `skinTones` from `./i18n.js` and `lookOf` from `./pixel-art.js`, then add:

```ts
// The appearance as select fields, each starting on what the character wears now.
export function appearanceFieldsOf(
	messages: Messages,
	profile: Profile | undefined,
): Field[] {
	const look = lookOf(profile);
	const { appearance } = messages;
	const select = <Value extends string | number>(
		key: string,
		label: string,
		values: readonly Value[],
		names: Record<Value, string>,
		current: Value,
	): Field => ({
		key,
		label,
		kind: "select",
		options: values.map((value) => ({
			label: names[value],
			value: String(value),
		})),
		defaultValue: String(current),
	});

	return [
		select(
			"skinTone",
			appearance.skinTone,
			skinTones,
			appearance.skinTones,
			look.skinTone,
		),
		select(
			"hairStyle",
			appearance.hairStyle,
			hairStyles,
			appearance.hairStyles,
			look.hairStyle,
		),
		select(
			"hairColor",
			appearance.hairColor,
			hairColors,
			appearance.hairColors,
			look.hairColor,
		),
		select(
			"facialHair",
			appearance.facialHair,
			facialHairs,
			appearance.facialHairs,
			look.facialHair,
		),
		select(
			"glasses",
			appearance.glasses,
			["yes", "no"] as const,
			{ yes: appearance.yes, no: appearance.no },
			look.glasses ? "yes" : "no",
		),
	];
}

// What the form's values say about the appearance; unknown values drop out.
export function appearanceOf(values: Readonly<Record<string, string>>) {
	const skinTone = skinTones.find((tone) => String(tone) === values.skinTone);
	const hairStyle = hairStyles.find((style) => style === values.hairStyle);
	const hairColor = hairColors.find((color) => color === values.hairColor);
	const facialHair = facialHairs.find((hair) => hair === values.facialHair);

	return {
		...(skinTone === undefined ? {} : { skinTone }),
		...(hairStyle === undefined ? {} : { hairStyle }),
		...(hairColor === undefined ? {} : { hairColor }),
		...(facialHair === undefined ? {} : { facialHair }),
		...(values.glasses === undefined
			? {}
			: { glasses: values.glasses === "yes" }),
	};
}
```

- [ ] **Step 5: Add the event and the strings in all 3 languages**

Append `"appearanceSaved"` to `eventActions` in `source/progress.ts`. In `source/i18n.ts`, import the 4 appearance types and add to `en`:

```ts
// events
appearanceSaved: () => "Changed the appearance",
// new top-level sections
profileSections: {
	body: "Body and goal",
	appearance: "Appearance",
	back: "Back",
},
appearance: {
	title: "Appearance",
	skinTone: "Skin tone",
	hairStyle: "Hair style",
	hairColor: "Hair color",
	facialHair: "Facial hair",
	glasses: "Glasses",
	skinTones: {
		1: "Lightest",
		2: "Light",
		3: "Medium",
		4: "Tan",
		5: "Deep",
	} satisfies Record<SkinTone, string>,
	hairStyles: {
		short: "Short",
		long: "Long",
		bob: "Bob",
		ponytail: "Ponytail",
		bun: "Bun",
		buzz: "Buzz cut",
	} satisfies Record<HairStyle, string>,
	hairColors: {
		black: "Black",
		brown: "Brown",
		blonde: "Blonde",
		red: "Red",
	} satisfies Record<HairColor, string>,
	facialHairs: {
		none: "None",
		stubble: "Stubble",
		beard: "Beard",
	} satisfies Record<FacialHair, string>,
	yes: "Yes",
	no: "No",
	saved: "Appearance saved. Your character changed to match.",
	needsProfile: "Fill in your body and goal first; your appearance is saved with them.",
},
```

Add to `traditionalChinese`:

```ts
appearanceSaved: () => "變更外觀",
profileSections: { body: "身體與目標", appearance: "外觀", back: "返回" },
appearance: {
	title: "外觀",
	skinTone: "膚色",
	hairStyle: "髮型",
	hairColor: "髮色",
	facialHair: "鬍子",
	glasses: "眼鏡",
	skinTones: { 1: "最淺", 2: "淺", 3: "中等", 4: "小麥色", 5: "深" },
	hairStyles: {
		short: "短髮",
		long: "長髮",
		bob: "鮑伯頭",
		ponytail: "馬尾",
		bun: "包頭",
		buzz: "平頭",
	},
	hairColors: { black: "黑色", brown: "棕色", blonde: "金色", red: "紅色" },
	facialHairs: { none: "無", stubble: "鬍渣", beard: "落腮鬍" },
	yes: "是",
	no: "否",
	saved: "外觀已儲存，角色也跟著改變了。",
	needsProfile: "請先填寫身體與目標，外觀會和它們一起儲存。",
},
```

Add to `korean`:

```ts
appearanceSaved: () => "외모 변경",
profileSections: { body: "신체와 목표", appearance: "외모", back: "뒤로" },
appearance: {
	title: "외모",
	skinTone: "피부 톤",
	hairStyle: "헤어스타일",
	hairColor: "머리 색",
	facialHair: "수염",
	glasses: "안경",
	skinTones: { 1: "가장 밝음", 2: "밝음", 3: "중간", 4: "구릿빛", 5: "어두움" },
	hairStyles: {
		short: "짧은 머리",
		long: "긴 머리",
		bob: "단발",
		ponytail: "포니테일",
		bun: "올림머리",
		buzz: "버즈컷",
	},
	hairColors: { black: "검정", brown: "갈색", blonde: "금발", red: "빨강" },
	facialHairs: { none: "없음", stubble: "짧은 수염", beard: "턱수염" },
	yes: "예",
	no: "아니요",
	saved: "외모를 저장했습니다. 캐릭터도 바뀌었어요.",
	needsProfile: "먼저 신체와 목표를 입력하세요. 외모는 그것과 함께 저장됩니다.",
},
```

- [ ] **Step 6: Open the sections in `App`, and preview the look**

In `source/app.tsx`, add state:

```tsx
const [profileSection, setProfileSection] = React.useState<
	"body" | "appearance"
>();
// The appearance options focused so far, previewed on the character.
const [draftAppearance, setDraftAppearance] = React.useState<
	Record<string, string>
>({});
```

In `backToMenu`, add `setProfileSection(undefined);` and `setDraftAppearance({});`. Add the handler after `submitProfile`:

```tsx
const submitAppearance = (values: Record<string, string>) => {
	if (!progress.profile) {
		setDraftAppearance({});
		setProfileSection("body");
		say(messages.appearance.needsProfile, "error");
		return;
	}

	const next = withEvent(
		{ ...progress, profile: { ...progress.profile, ...appearanceOf(values) } },
		"appearanceSaved",
	);

	if (commit(next)) {
		backToMenu(messages.appearance.saved);
	}
};
```

Build the Profile panel with a function, since a nested ternary fails xo:

```tsx
const profilePanel = () => {
	if (profileSection === "body") {
		return (
			<EntryForm
				key="body"
				fields={profileFieldsOf(messages, profileNow(progress), name)}
				messages={messages}
				title={messages.form.profileTitle}
				onSubmit={submitProfile}
			/>
		);
	}

	if (profileSection === "appearance") {
		return (
			<EntryForm
				key="appearance"
				fields={appearanceFieldsOf(messages, progress.profile)}
				messages={messages}
				title={messages.appearance.title}
				onFocus={(key, value) => {
					setDraftAppearance((current) => ({ ...current, [key]: value }));
				}}
				onSubmit={submitAppearance}
			/>
		);
	}

	return (
		<Titled title={messages.menu.profile}>
			<Choice
				key="sections"
				options={[
					{ label: messages.profileSections.body, value: "body" },
					{ label: messages.profileSections.appearance, value: "appearance" },
					{ label: messages.profileSections.back, value: "back" },
				]}
				onSelect={(value) => {
					if (value === "back") {
						backToMenu();
					} else {
						setProfileSection(value === "appearance" ? "appearance" : "body");
					}
				}}
			/>
		</Titled>
	);
};
```

Use `profile: profilePanel(),` in `panels`. Show the preview on the character:

```tsx
const current = profileNow(progress);
const shownProfile = current
	? { ...current, ...appearanceOf(draftAppearance) }
	: undefined;
```

and pass `look={lookOf(shownProfile)}` to `Character` (Task 6 adds the strength load). In the `hints` lookup Plan C built, change the Profile entry so a Profile with no section open picks from a list:

```tsx
		profile: profileSection ? messages.hints.form : messages.hints.select,
```

- [ ] **Step 7: Run the tests**

Run: `npm test`
Expected: PASS, including both new dashboard tests and the updated profile test.

- [ ] **Step 8: Commit**

```bash
git add source/components/entry-form.tsx source/content.ts source/progress.ts source/i18n.ts source/app.tsx source/tests/dashboard.test.tsx source/tests/data.test.ts
git commit -m "feat: choose the character's appearance, previewing it live"
```

---

### Task 6: The Day on the Character

**Files:**

- Modify: `source/pixel-art.ts` (`Paint`, `SceneInput`, `composeScene`, `paintHeadFront`, `paintSideHead`, new `paintSweat` and `paintWish`)
- Modify: `source/components/character.tsx` (the `signals` prop)
- Modify: `source/app.tsx` (compute and pass the signals and the strength load)
- Modify: `source/tests/render-scenes.ts` (a `signals` sheet)
- Test: `source/tests/pixel-art.test.ts`

**Interfaces:**

- Consumes: Task 2's `Signals`, `quietSignals`, `signalsOf`, `strengthLoadOf`, `stageSignalsOf`; Plan A's `isReducedMotion(env)`
- Produces: `SceneInput.signals?: Signals` (defaults to `quietSignals`); `Character` prop `signals: Signals`

What each signal draws:

| Signal              | Drawn As                                                                  |
| ------------------- | ------------------------------------------------------------------------- |
| `exertion: flushed` | Red cheeks, and sweat                                                     |
| `exertion: sweaty`  | 2 drops running down the temples                                          |
| `face: bright`      | A smile, even when not every target is met                                |
| `face: sad`         | Brows knit toward the nose                                                |
| `isBedHead`         | 3 strands sticking up from the crown, until a cap covers them             |
| `isFull`            | The waist and the belly 1 pixel fuller                                    |
| `isHungry`          | A thought bubble with an apple while idling, every other 2 seconds        |
| `isThirsty`         | A thought bubble with a water drop while idling, taking turns with hunger |
| `rest: tired`       | Shadows under the eyes                                                    |

- [ ] **Step 1: Write the failing test**

Append to `source/tests/pixel-art.test.ts` (import `quietSignals` and `type Signals` from `../signals.js`):

```ts
test("shows how the day is going", (t) => {
	const base = scene().join("");
	const showing = (signals: Partial<Signals>) =>
		scene({ signals: { ...quietSignals, ...signals } }).join("");

	t.is(showing({}), base, "quiet signals draw nothing new");
	t.not(showing({ rest: "tired" }), base, "shadows under the eyes");
	t.true(showing({ exertion: "sweaty" }).includes("W"), "sweat");
	t.true(showing({ exertion: "flushed" }).includes("r"), "red cheeks");
	t.true(showing({ isThirsty: true }).includes("W"), "a water bubble");
	t.true(showing({ isHungry: true }).includes("F"), "an apple bubble");
	t.not(showing({ isFull: true }), base, "a fuller belly");
	t.true(showing({ face: "bright" }).includes("m"), "a smile");
	t.not(showing({ face: "sad" }), base, "knit brows");
	t.not(showing({ isBedHead: true }), base, "bed head");
	t.false(
		scene({ activity: "focus", signals: { ...quietSignals, isThirsty: true } })
			.join("")
			.includes("W"),
		"no bubble while busy",
	);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run build`
Expected: FAIL — `signals` does not exist in `SceneInput`.

- [ ] **Step 3: Paint the signals**

In `source/pixel-art.ts`, import `quietSignals` and `type Signals` from `./signals.js`. Add `signals: Signals;` to `Paint`, and `signals?: Signals;` to `SceneInput`. In `composeScene`, destructure `signals = quietSignals`, build the body with `const b = bodyOf(look, signals.isFull);`, and add `signals` to `paint`.

In `paintHeadFront`, destructure `signals` from the paint, then:

1. Before the eyes, choose the mouth and the brows:

```ts
// Today's mood shows even when the targets do not say so.
const mouth = pose.mouth ?? (signals.face === "bright" ? "smile" : undefined);
// On a sad day the brows knit toward the nose.
const brow = signals.face === "sad" ? 1 : 2;
```

2. Draw the brows at `turn - brow` and `turn + brow` instead of `turn - 2` and `turn + 2`, and switch on `mouth` instead of `pose.mouth`.
3. Right after the nose shadow and before the mouth:

```ts
// Shadows under the eyes after a short night, red cheeks after a hard workout.
if (signals.rest === "tired") {
	head(turn - 2, chin + 2, "q");
	head(turn + 2, chin + 2, "q");
}

if (signals.exertion === "flushed") {
	head(turn - 2, chin + 2, "r");
	head(turn + 2, chin + 2, "r");
}
```

4. After the crown and before the fringe:

```ts
if (signals.isBedHead) {
	head(-2, chin + 7, "h");
	head(1, chin + 7, "h");
	head(3, chin + 6, "i");
}
```

In `paintSideHead`, destructure `signals`, and after the crown add:

```ts
if (signals.isBedHead) {
	upper(-2, chin + 7, "h");
	upper(0, chin + 7, "h");
}
```

Add 2 painters after `paintFront`:

```ts
// Drops running down the temples after a workout.
function paintSweat({ upper, b, counter, signals }: Paint) {
	if (signals.exertion === "none") {
		return;
	}

	upper(-4, b.chin + 4 - (counter % 4), "W");
	upper(4, b.chin + 3 - ((counter + 2) % 4), "W");
}

// A thought bubble of a water drop or an apple, shown every other 2 seconds
// while idling; thirst and hunger take turns.
function paintWish({ upper, b, counter, signals }: Paint) {
	const wishes = [
		...(signals.isThirsty ? (["water"] as const) : []),
		...(signals.isHungry ? (["food"] as const) : []),
	];

	if (wishes.length === 0 || Math.floor(counter / 20) % 2 === 1) {
		return;
	}

	const wish = wishes[Math.floor(counter / 40) % wishes.length];
	const x = b.side + 2;
	const y = b.top - 1;
	upper(x - 1, y - 2, "v");
	upper(x, y - 1, "v");

	if (wish === "water") {
		upper(x + 2, y + 2, "W");
		span(upper, x + 1, x + 3, y + 1, "W");
		span(upper, x + 1, x + 3, y, "W");
		upper(x + 2, y - 1, "W");
	} else {
		span(upper, x + 1, x + 3, y + 1, "F");
		span(upper, x + 1, x + 3, y, "F");
		upper(x + 2, y + 2, "G");
	}
}
```

In `composeScene`, after painting the front or the side:

```ts
paintSweat(paint);

if (activity === "idle" && mood !== "sleepy") {
	paintWish(paint);
}
```

- [ ] **Step 4: Pass the signals from `App`**

In `source/components/character.tsx`, add `signals: Signals;` to `CharacterProps` and pass `signals` to `composeScene`. In `source/app.tsx`, import `signalsOf`, `stageSignalsOf`, and `strengthLoadOf` from `./signals.js`, and give `Character`:

```tsx
look={lookOf(shownProfile, strengthLoadOf(progress, now))}
signals={stageSignalsOf(signalsOf(progress, now), isReducedMotion(env))}
```

- [ ] **Step 5: Add a sheet**

In `source/tests/render-scenes.ts`, import `quietSignals` from `../signals.js` and add:

```ts
signals: (
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
```

- [ ] **Step 6: Run the tests and look at the sheet**

Run: `npm run build && npm test && node build/tests/render-scenes.js "$TMPDIR/scenes"`
Expected: PASS. In `signals.png`, each state reads at a glance without covering the eyes.

- [ ] **Step 7: Commit**

```bash
git add source/pixel-art.ts source/components/character.tsx source/app.tsx source/tests/pixel-art.test.ts source/tests/render-scenes.ts
git commit -m "feat: show sleep, water, food, effort, and mood on the character"
```

---

### Task 7: Drinking, Weighing In, and Writing

**Files:**

- Modify: `source/pixel-art.ts:12-20` (`Activity`), `:255-264` (`Scene`), `:370-377` (`cycles`), `sceneOf`, `composeScene`
- Modify: `source/content.ts` (`activityOfKind`)
- Modify: `source/i18n.ts` (`activity` in all 3 languages)
- Modify: `source/tests/render-scenes.ts` (the `activities` list)
- Test: `source/tests/pixel-art.test.ts`, `source/tests/data.test.ts`

**Interfaces:**

- Consumes: Plan C's `activityByKind` record behind `activityOfKind(kind: LogKind): Activity`
- Produces: activities `"drink"`, `"weigh"`, and `"write"`; `Scene.ground?: Draw[]`, painted on the ground under a lifted character

- [ ] **Step 1: Write the failing tests**

In `source/tests/pixel-art.test.ts`, add `"drink"`, `"weigh"`, and `"write"` to `activities`. Every existing test then covers them: known colors, never holding still for 6 ticks, and never jumping. Append to `source/tests/data.test.ts`:

```ts
test("plays an animation for every kind of log", (t) => {
	t.is(activityOfKind("water"), "drink");
	t.is(activityOfKind("body"), "weigh");
	t.is(activityOfKind("steps"), "weigh");

	for (const kind of ["mood", "habit", "note"] as const) {
		t.is(activityOfKind(kind), "write");
	}
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run build`
Expected: FAIL — `"drink"` is not assignable to `Activity`.

- [ ] **Step 3: Add the activities**

In `source/pixel-art.ts`, add `| "drink" | "weigh" | "write"` to `Activity`, `drink: 24, weigh: 24, write: 32,` to `cycles`, and `ground?: Draw[];` to `Scene`. Give `still` a 4th parameter:

```ts
const still = (
	pose: Scene["pose"],
	props?: Draw[],
	lift = 0,
	grounded?: Draw[],
): Scene => ({ x: anchor, facing: 1, lift, pose, props, ground: grounded });
```

In `composeScene`, right after `paintShadow`, paint what stays on the ground:

```ts
for (const draw of scene.ground ?? []) {
	draw(plant(0), plant(0), b);
}
```

Add a prop beside `mug`:

```ts
const bottle =
	([x, y]: Point): Draw =>
	(_put, upper) => {
		for (let dy = 0; dy < 4; dy++) {
			span(upper, x, x + 1, y + dy, "W");
		}

		span(upper, x, x + 1, y + 4, "d");
	};
```

Add 3 cases to `sceneOf`:

```ts
case "drink": {
	// Lift the bottle, drink with the eyes closed, and lower it.
	const isDrinking = at >= 8 && at < 18;
	const hand = (b: Body): Point =>
		isDrinking ? [1, b.chin + 1] : [b.side + 1, b.hip + 2];

	return still(
		(b) => ({
			view: "front",
			mouth: isDrinking ? "open" : mouth,
			eyes: isDrinking ? "closed" : "open",
			bob: breathing(at, 2),
			hands: [undefined, hand(b)],
		}),
		[
			(put, upper, b) => {
				bottle(hand(b))(put, upper, b);
			},
		],
	);
}

case "weigh": {
	// Step onto the scale, look down while it settles, and step off.
	const isOn = at >= 4 && at < 20;

	return still(
		(b) => ({
			view: "front",
			mouth,
			bob: breathing(at, 4),
			nod: isOn && at >= 8 ? 1 : 0,
			hands: [hanging(b, -1), hanging(b, 1)],
		}),
		undefined,
		isOn ? 1 : 0,
		[
			(put) => {
				span(put, -5, 5, ground - 1, "d");
				span(put, -5, 5, ground, "D");
				put(0, ground - 1, Math.floor(at / 3) % 2 === 0 ? "y" : "d");
			},
		],
	);
}

case "write": {
	// Jot in a notebook held at the chest, the pencil moving along the line.
	const stroke = Math.floor(at / 2) % 4;

	return still(
		(b) => ({
			view: "front",
			mouth,
			bob: breathing(at, 8),
			nod: 1,
			hands: [
				[-2, b.shoulder - 3],
				[stroke - 1, b.shoulder - 2],
			],
		}),
		[
			(_put, upper, b) => {
				for (let y = b.shoulder - 5; y <= b.shoulder - 2; y++) {
					span(upper, -3, 2, y, "Q");
				}

				span(upper, -3, 2, b.shoulder - 1, "U");
				upper(stroke - 1, b.shoulder - 3 + (stroke % 2), "g");
			},
		],
	);
}
```

- [ ] **Step 4: Map the logs and label the activities**

In `source/content.ts`, change these entries of Plan C's `activityByKind` record, keeping the rest:

````ts
	water: "drink",
	body: "weigh",
	mood: "write",
	habit: "write",
	steps: "weigh",
	note: "write",
``` In `source/i18n.ts`, add to `activity`: in `en`, `drink: "Drinking water…", weigh: "Weighing in…", write: "Writing…"`; in `traditionalChinese`, `drink: "喝水中…", weigh: "量體重中…", write: "寫字中…"`; in `korean`, `drink: "물 마시는 중…", weigh: "체중 재는 중…", write: "쓰는 중…"`. In `source/tests/render-scenes.ts`, add the 3 activities to `activities`.

- [ ] **Step 5: Run the tests and look at the sheet**

Run: `npm run build && npm test && node build/tests/render-scenes.js "$TMPDIR/scenes"`
Expected: PASS. In `activities.png`, the bottle reaches the mouth, the feet land on the scale, and the pencil moves along the page.

- [ ] **Step 6: Commit**

```bash
git add source/pixel-art.ts source/content.ts source/i18n.ts source/tests/pixel-art.test.ts source/tests/data.test.ts source/tests/render-scenes.ts
git commit -m "feat: drink, weigh in, and write to match water, body, and journal logs"
````

---

### Task 8: The Sky, the Season, the Room, and the Streak

**Files:**

- Modify: `source/pixel-art.ts` (new `paintScenery` and `paintRoom`, called first in `composeScene`)
- Modify: `source/components/character.tsx` (the `streak` prop)
- Modify: `source/app.tsx` (pass the streak label)
- Modify: `source/i18n.ts` (`streak` in all 3 languages)
- Modify: `source/tests/render-scenes.ts` (a `scenery` sheet)
- Test: `source/tests/pixel-art.test.ts`, `source/tests/dashboard.test.tsx`

**Interfaces:**

- Consumes: Task 2's `Signals.daylight`, `Signals.season`, and `Signals.room`; Plan C's `streakOf(progress, now)`
- Produces: `Character` prop `streak?: string`; `messages.streak(days: number): string`

The scenery is painted straight onto the stage before the shadow, so the character always stands in front of it.

| Signal                | Drawn As                                                      |
| --------------------- | ------------------------------------------------------------- |
| `daylight: dawn`      | A sun rising at the left                                      |
| `daylight: day`       | A small sun high at the left                                  |
| `daylight: dusk`      | A red sun setting at the right                                |
| `daylight: night`     | A crescent moon and 4 twinkling stars                         |
| `room.books`          | 3 book spines by the right edge                               |
| `room.dumbbells`      | A dumbbell on the floor at the right edge                     |
| `room.plant: growing` | A potted plant at the left edge                               |
| `room.plant: wilting` | The same plant, drooping and brown                            |
| `season`              | 5 falling petals, fireflies after dark, leaves, or snowflakes |

- [ ] **Step 1: Write the failing tests**

Append to `source/tests/pixel-art.test.ts`:

```ts
test("paints the sky, the season, and the room behind the character", (t) => {
	const plain = scene();
	const count = (frame: string[], key: string) =>
		[...frame.join("")].filter((pixel) => pixel === key).length;
	const night = scene({
		signals: { ...quietSignals, daylight: "night", season: "winter" },
	});

	t.true(count(night, "Q") > 0, "a moon");
	t.true(count(night, "w") > count(plain, "w"), "snow");

	for (const [y, row] of plain.entries()) {
		for (const [x, key] of [...row].entries()) {
			if (key !== ".") {
				t.is(night[y]?.[x], key, "the character stays in front");
			}
		}
	}

	t.is(
		count(
			scene({
				signals: { ...quietSignals, daylight: "day", season: "summer" },
			}),
			"y",
		),
		0,
		"no fireflies by day",
	);

	const room = scene({
		signals: {
			...quietSignals,
			room: { plant: "growing", dumbbells: true, books: true },
		},
	});
	t.true(count(room, "o") > 0, "a pot");
	t.true(count(room, "D") > 0, "a dumbbell");
	t.not(
		scene({
			signals: {
				...quietSignals,
				room: { ...quietSignals.room, plant: "wilting" },
			},
		}).join(""),
		scene({
			signals: {
				...quietSignals,
				room: { ...quietSignals.room, plant: "growing" },
			},
		}).join(""),
	);
});
```

Append to `source/tests/dashboard.test.tsx`:

```tsx
test("shows the streak beside the character's name", async (t) => {
	const day = 86_400_000;
	const { lastFrame, unmount } = start({
		...empty,
		notes: [
			{ at: new Date(Date.now() - day).toISOString(), text: "yesterday" },
			{ at: new Date().toISOString(), text: "today" },
		],
	});

	await settle();
	t.true((lastFrame() ?? "").includes("2-day streak"));

	unmount();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run build && npx ava build/tests/pixel-art.test.js build/tests/dashboard.test.js`
Expected: FAIL — no moon, and no streak in the frame.

- [ ] **Step 3: Paint the sky, the season, and the room**

Add to `source/pixel-art.ts` above `composeScene`:

```ts
const particleKeys: Record<Season, readonly string[]> = {
	spring: ["r"],
	summer: ["y"],
	autumn: ["g", "F"],
	winter: ["w"],
};

// The sun or the moon by the clock, and the season's particles falling, all
// behind the character.
function paintScenery(canvas: string[][], signals: Signals, counter: number) {
	const width = canvas[0]?.length ?? 0;
	const dot = (x: number, y: number, key: string) => {
		const row = canvas[stageHeight - 1 - y];

		if (row && x >= 0 && x < width) {
			row[x] = key;
		}
	};

	switch (signals.daylight) {
		case "night": {
			for (const [x, y] of [
				[width - 3, 38],
				[width - 2, 38],
				[width - 4, 37],
				[width - 4, 36],
				[width - 3, 35],
				[width - 2, 35],
			] as const) {
				dot(x, y, "Q");
			}

			for (const [index, [x, y]] of (
				[
					[2, 37],
					[8, 39],
					[width - 10, 38],
					[width - 16, 36],
				] as const
			).entries()) {
				if ((counter + index * 5) % 20 < 14) {
					dot(x, y, "y");
				}
			}

			break;
		}

		case "dawn": {
			span(dot, 0, 4, 30, "g");
			span(dot, 1, 3, 31, "g");
			break;
		}

		case "day": {
			for (let y = 36; y <= 38; y++) {
				span(dot, 1, 3, y, "g");
			}

			break;
		}

		case "dusk": {
			span(dot, width - 5, width - 1, 30, "F");
			span(dot, width - 4, width - 2, 31, "F");
			break;
		}

		case undefined: {
			break;
		}
	}

	const isGlowing = signals.daylight === "night" || signals.daylight === "dusk";

	if (signals.season && (signals.season !== "summer" || isGlowing)) {
		const keys = particleKeys[signals.season];

		for (let index = 0; index < 5; index++) {
			const fall = (counter + index * 9) % stageHeight;
			const drift = signals.season === "winter" ? 0 : Math.floor(fall / 4) % 2;
			dot(
				(index * 7 + 3 + drift) % width,
				stageHeight - 1 - fall,
				keys[index % keys.length] ?? "w",
			);
		}
	}
}

// What the logs have earned, standing on the floor at the stage's edges.
function paintRoom(canvas: string[][], room: Signals["room"]) {
	const width = canvas[0]?.length ?? 0;
	const dot = (x: number, y: number, key: string) => {
		const row = canvas[stageHeight - 1 - y];

		if (row && x >= 0 && x < width) {
			row[x] = key;
		}
	};

	if (room.plant !== "none") {
		span(dot, 0, 2, ground, "o");
		span(dot, 0, 2, ground + 1, "o");
		dot(1, ground + 2, "G");
		dot(1, ground + 3, "G");

		if (room.plant === "growing") {
			dot(0, ground + 4, "G");
			dot(2, ground + 5, "G");
			dot(1, ground + 6, "G");
		} else {
			dot(0, ground + 3, "n");
			dot(2, ground + 2, "n");
		}
	}

	if (room.dumbbells) {
		dot(width - 5, ground, "D");
		span(dot, width - 4, width - 2, ground, "d");
		dot(width - 1, ground, "D");
		dot(width - 5, ground + 1, "D");
		dot(width - 1, ground + 1, "D");
	}

	if (room.books) {
		dot(width - 8, ground, "F");
		dot(width - 8, ground + 1, "P");
		dot(width - 8, ground + 2, "g");
		dot(width - 7, ground, "F");
		dot(width - 7, ground + 1, "P");
	}
}
```

Import `type Season` from `./signals.js`. In `composeScene`, before `paintShadow`, call `paintScenery(canvas, signals, counter);` and `paintRoom(canvas, signals.room);`.

- [ ] **Step 4: Show the streak**

In `source/i18n.ts`, add `streak: (days: number) => \`${days}-day streak\`,` to `en`, `streak: (days) => \`連續 ${days} 天\`,` to `traditionalChinese`, and `streak: (days) => \`${days}일 연속\`,`to`korean`. In `source/components/character.tsx`, add `streak?: string;` to the props and draw it between the name and the level:

```tsx
<Box gap={1} justifyContent="space-between">
	<Text bold wrap="truncate-end">
		{name}
	</Text>
	{streak ? (
		<Box flexShrink={0}>
			<Text color={palette.soft}>{streak}</Text>
		</Box>
	) : null}
	<Box flexShrink={0}>
		<Text color={palette.accent}>{level}</Text>
	</Box>
</Box>
```

In `source/app.tsx`, import `streakOf` from `./insights.js` and pass:

```tsx
streak={
	streakOf(progress, now) >= 2 ? messages.streak(streakOf(progress, now)) : undefined
}
```

- [ ] **Step 5: Add a sheet**

In `source/tests/render-scenes.ts`, add:

```ts
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
```

- [ ] **Step 6: Run the tests and look at the sheet**

Run: `npm run build && npm test && node build/tests/render-scenes.js "$TMPDIR/scenes"`
Expected: PASS. In `scenery.png`, the sky stays in the top corners, the particles never hide the face for long, and the room's items sit on the floor line.

- [ ] **Step 7: Commit**

```bash
git add source/pixel-art.ts source/components/character.tsx source/app.tsx source/i18n.ts source/tests/pixel-art.test.ts source/tests/dashboard.test.tsx source/tests/render-scenes.ts
git commit -m "feat: show the time of day, the season, earned items, and the streak"
```

---

### Task 9: Gliding Bars and Experience on the Label

**Files:**

- Create: `source/motion.ts`
- Modify: `source/components/today-panel.tsx` (`Bar`, a `useGlide` hook, the `isReduced` prop)
- Modify: `source/app.tsx` (`Flash`, `record`, the activity label, `TodayPanel`'s props)
- Test: `source/tests/data.test.ts`, `source/tests/dashboard.test.tsx`

**Interfaces:**

- Produces: `easeOutCubic(progress: number): number`, `tweenOf(from: number, to: number, elapsed: number, duration: number): number`, `glideMilliseconds = 500`; `TodayPanel` prop `isReduced?: boolean`

Each bar in Today glides to its new length over half a second with an ease-out curve, instead of jumping, and the character's label says what the log earned, such as `Eating… +5 XP`.

- [ ] **Step 1: Write the failing tests**

Append to `source/tests/data.test.ts` (import from `../motion.js`):

```ts
test("eases out toward the target and lands on it", (t) => {
	t.is(easeOutCubic(0), 0);
	t.is(easeOutCubic(1), 1);
	t.is(easeOutCubic(2), 1);
	t.true(easeOutCubic(0.5) > 0.5, "fast first, then slow");
	t.is(tweenOf(10, 20, 0, 500), 10);
	t.is(tweenOf(10, 20, 500, 500), 20);
	t.is(tweenOf(10, 20, 100, 0), 20);
});
```

Append to `source/tests/dashboard.test.tsx`:

```tsx
test("says what a log earned on the character's label", async (t) => {
	const { stdin, lastFrame, unmount } = start();

	// Log, then 1 glass of water. Recent shows "+1 XP" too, so look for the
	// label itself.
	await type(stdin, ["1", "\r", "w", "\r"]);
	t.true(await shows(lastFrame, "Drinking water… +1 XP"));

	unmount();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run build`
Expected: FAIL — `Cannot find module '../motion.js'`.

- [ ] **Step 3: Write the easing**

```ts
// source/motion.ts
// Fast at first and gentle at the end, from 0 to 1.
export const easeOutCubic = (progress: number) =>
	1 - (1 - Math.min(Math.max(progress, 0), 1)) ** 3;

export const tweenOf = (
	from: number,
	to: number,
	elapsed: number,
	duration: number,
) =>
	duration <= 0 ? to : from + (to - from) * easeOutCubic(elapsed / duration);

export const glideMilliseconds = 500;
```

- [ ] **Step 4: Glide the bars**

In `source/components/today-panel.tsx`, import `useAnimation` from `ink` and the 2 names from `../motion.js`, add `isReduced?: boolean` to `TodayPanelProps` and pass it to every `Bar`, then:

```tsx
// Glides from the shown value to a new one; useAnimation's clock keeps the
// render pure, which xo's react-hooks/purity requires.
function useGlide(value: number, isReduced: boolean) {
	const [span, setSpan] = React.useState({ from: value, to: value });
	const isMoving = !isReduced && span.from !== span.to;
	const { time, reset } = useAnimation({ interval: 40, isActive: isMoving });
	const shown = isMoving
		? tweenOf(span.from, span.to, time, glideMilliseconds)
		: span.to;

	React.useEffect(() => {
		if (value !== span.to) {
			setSpan({ from: shown, to: value });
			reset();
		}
	}, [value, span.to, shown, reset]);

	React.useEffect(() => {
		if (isMoving && time >= glideMilliseconds) {
			setSpan({ from: span.to, to: span.to });
		}
	}, [isMoving, time, span.to]);

	return isReduced ? value : shown;
}

function Bar({
	metric,
	width,
	isReduced,
}: Readonly<{ metric: Metric; width: number; isReduced: boolean }>) {
	const palette = usePalette();
	const percent = useGlide(percentOf(metric), isReduced);
	const filled = Math.round((percent / 100) * width);

	return (
		<Text>
			<Text color={metric.color}>{"▀".repeat(filled)}</Text>
			<Text color={palette.border}>{"▀".repeat(width - filled)}</Text>
		</Text>
	);
}
```

In `source/app.tsx`, pass `isReduced={isReducedMotion(env)}` to `TodayPanel`.

- [ ] **Step 5: Put the earned experience on the label**

In `source/app.tsx`, extend `Flash` to `Readonly<{ activity: Activity; until: number; experience: number }>`. In `record`, compute `const gained = experienceOf(next) - experienceOf(progress);` after `next` is final, and pass `experience: gained` to `setFlash`. After the label is chosen:

```tsx
if (flash && flash.until > now && flash.experience > 0) {
	activityLabel = `${activityLabel} +${flash.experience} XP`;
}
```

- [ ] **Step 6: Run the tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add source/motion.ts source/components/today-panel.tsx source/app.tsx source/tests/data.test.ts source/tests/dashboard.test.tsx
git commit -m "feat: glide Today's bars and show earned experience on the character"
```

---

### Task 10: Document the Living Character

**Files:**

- Modify: `README.md` (the Character section, the Profile row of the menu, the Progress File values table)
- Modify: `.claude/rules/pixel-art.md` (inputs, painters, keys, review sheets)
- Modify: `CLAUDE.md` (Repository Layout)

- [ ] **Step 1: Rewrite the Character section of `README.md`**

Replace the table and the paragraph after it in "Character" with:

```markdown
Your character is drawn from 4 sources, and every small change shows:

| Shaped By    | What Changes                                                                                                                                                                                                                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Appearance   | Skin tone, hair style and color, glasses, and facial hair, chosen under **Profile** → **Appearance** with a live preview                                                                                                                                                                           |
| Level        | 1 piece of gear per level up to level 9: headphones, a scarf, a cap, a backpack, a smartwatch, a jacket, sunglasses in place of the cap, and a medal                                                                                                                                               |
| Profile      | 1 pixel of height every 5 cm; a fuller body every 2 points of body fat, estimated from your weight, height, and age when you leave it out; hair that greys from the temples a little more every year from 35                                                                                       |
| Today's Logs | Muscle from your strength work over 28 days, shadows under the eyes after under 6 hours of sleep, sweat and red cheeks after a workout, a thought bubble when you are behind on water or due a meal, a fuller belly after a big meal, your logged mood on its face, and bed head after a week away |

The stage follows the clock and the calendar: a sun or a moon by the time of day, and petals, fireflies, leaves, or snow by the season. A plant appears once you log water and wilts after 2 days without, a dumbbell after 10 strength workouts, and books after 25 hours of focus. Your streak shows beside your name from 2 days in a row. With `TERMINAL_SIGMA_MOTION=reduced`, nothing falls and the bars stop gliding.
```

Add to the Progress File values table:

```markdown
| `profile.facialHair` | `beard`, `none`, or `stubble` |
| `profile.glasses` | `true` or `false` |
| `profile.hairColor` | `black`, `blonde`, `brown`, or `red` |
| `profile.hairStyle` | `bob`, `bun`, `buzz`, `long`, `ponytail`, or `short` |
| `profile.skinTone` | `1`, the lightest, to `5`, the deepest |
```

and `appearanceSaved` to the `events.action` row.

- [ ] **Step 2: Update `.claude/rules/pixel-art.md`**

Replace the "What Shapes It" table with 5 rows, keeping alphabetical order: Activity (unchanged, plus `drink`, `weigh`, and `write`), Level (unchanged), Look (`lookOf(profile, strengthLoad)`: height every 5 cm, `fat` stages every 2 points of body fat from `fatFeatures`, `muscle` stages from `muscleFeatures`, and the appearance with age), Mood (unchanged), and Signals (`signalsOf` in `signals.ts`: rest, thirst, hunger, fullness, exertion, the logged mood, bed head, the sky, the season, and the room). Add these paragraphs:

```markdown
Painters write skin only as `s` and `q`, and hair only as `h` and `i`; `plant` in `composeScene` recolors them by skin tone, hair color, and age, ranking each hair pixel so the temples grey first. A new stage of fat or muscle must change a pixel in the front or side frame at the default height, or the test fails. Stage 0 to 21 of fat and 0 to 3 of muscle keep the widest body within 11 pixels of its center, which is why the walk's margins are 11.

`paintScenery` and `paintRoom` write straight onto the stage before the shadow, so the character always stands in front of them, and with `quietSignals` nothing extra is drawn, which keeps the motion tests honest.

Render the sheets with `npm run build && node build/tests/render-scenes.js scenes` and look at every sheet a change touches; add a sheet to `sheets` in [`render-scenes.ts`](../../source/tests/render-scenes.ts) for a new input.
```

- [ ] **Step 3: Update `CLAUDE.md`**

Add rows to the Repository Layout table, in alphabetical order: ``| [`source/motion.ts`](./source/motion.ts) | Easing for the gliding bars |`` and ``| [`source/signals.ts`](./source/signals.ts) | What the logs say about right now, for the character and its stage |``. Change the `pixel-art.ts` row to "The character rig: its body from continuous stages of fat and muscle, its appearance and age, its gear from the level, the signals of the day, and every scene".

- [ ] **Step 4: Check and commit**

Run: `npx prettier --check README.md CLAUDE.md .claude/rules/pixel-art.md`
Expected: all pass.

```bash
git add README.md CLAUDE.md .claude/rules/pixel-art.md
git commit -m "docs: describe the living character and its review sheets"
```
