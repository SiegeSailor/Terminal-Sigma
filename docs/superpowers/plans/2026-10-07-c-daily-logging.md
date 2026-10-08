# Daily Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the meal and workout forms with 1 **Log** command line that records meals, workouts, water, sleep, body measurements, mood, habits, steps, and notes in a few keystrokes, suggests what you usually log at this hour, undoes a line, and feeds an editable **History** with a **Week** tab of trends, streaks, and correlations.

**Architecture:** Every rule lives in a pure `.ts` module that takes `now` explicitly: `source/progress.ts` gains the new arrays and derives capped experience; `source/health.ts` works out the water, sleep, steps, and focus targets; `source/foods.ts` holds the food table with carbs, fat, and servings; `source/exercises.ts` holds the activity words and the Compendium METs; `source/quick-log.ts` turns 1 line into drafts, applies and undoes them, writes an entry back as a line, and suggests lines; `source/insights.ts` computes the Week tab. 2 presentational components, `source/components/log-view.tsx` and `source/components/history-view.tsx`, call back into `App`, which alone saves, appends events, and flashes the character.

**Tech Stack:** TypeScript 6, Ink 7 (`useInput`, `usePaste`), zod 4, `String.prototype.normalize("NFKC")`, AVA 7, ink-testing-library 4. No new runtime dependency.

**Spec:** [`2026-10-07-roadmap.md`](./2026-10-07-roadmap.md), sections "Log from 1 Command Line" and "Shared Contracts". Runs after [Plan A](./2026-10-07-a-environment-settings.md) (the `configFile`, `initialConfig`, and `env` props, `Choice`'s `0` key, the Environment item) and [Plan B](./2026-10-07-b-quote-change-notice.md) (`source/components/header.tsx`).

## Global Constraints

- Every user-facing string goes into all 3 languages in `source/i18n.ts`; the `Messages` type rejects a missing key
- Every new user action appends an event through `withEvent` in `app.tsx`, with its text under `events` in all 3 languages: `goalChanged` (`goal:value`), `logDeleted` and `logEdited` (the entry's kind)
- Every new field of `progress.json` is optional or defaults to `[]`, and Task 2 loads a file written by 1.6.0
- Experience stays derived, never stored; the new kinds earn the roadmap's amounts, capped per local day in the order the entries happened
- Branching logic lives in pure functions in plain `.ts` modules that take `now` as a parameter; components stay presentational and never call `Date.now()` during render (xo's `react-hooks/purity`) or assign to a prop (`react-hooks/immutability`)
- Read colors from `usePalette()`, let Ink measure text (CJK and Hangul take 2 cells), key every view that shares a slot, let only the open view listen to input, and pick from lists with `Choice`
- xo's `@typescript-eslint/no-unsafe-type-assertion` rejects narrowing casts: build typed values instead of writing `as`
- Tests pass `App` a temporary `file` and their own `env`; they never touch `~/.terminal-sigma`
- `layoutOf` and its test change together, with `.claude/rules/terminal-layout.md` in the same task
- No new runtime dependency; a deliberate shortcut carries a `// ponytail:` comment naming its ceiling
- `npm test` (Prettier, xo, AVA) passes after every task; commit messages follow Conventional Commits and the `conventional-commit` skill

## Review Focus

These are the inputs most likely to bite a real user; each has a test in the task that owns its code:

- **A CJK Input Method Left in Full Width**: `ｗ　５００` and `２個雞蛋，吐司` parse exactly like `w 500` and `2個雞蛋, 吐司`, because the parser normalizes to NFKC first (Task 5)
- **Logging After Midnight**: at 00:20, `sl 23:30-7:10` is last night's sleep ending this morning, `@23:00` means yesterday, and a daily cap resets at local midnight, not UTC (Tasks 2 and 5)
- **A Food Starting with `u`**: typing `udon` never undoes anything; only the whole line `u` undoes, and only while the Log view is open (Task 10)
- **Pasting a Line with Its Newline**: a pasted `2 eggs, toast⏎` lands in the input whole and waits for Enter instead of logging half a line (Task 10)
- **Editing an Older Entry That Shares Its Timestamp**: editing the toast of `2 eggs, toast` from 3 days ago keeps that day and time, and replaces only the toast (Task 11)

---

### Task 1: Exercises and Their MET Values

**Files:**

- Create: `source/exercises.ts`
- Test: `source/tests/exercises.test.ts`

**Interfaces:**

- Consumes: `intensities`, `languages`, `messagesOf`, `workoutActivities`, and their types from `source/i18n.ts`
- Produces:
  - `caloriesOf(activity: WorkoutActivity, intensity: Intensity, minutes: number, kilograms: number): number`
  - `type Exercise = Readonly<{ id: string; names: Readonly<Record<Language, string>>; words: readonly string[] }>`, `exercises: readonly Exercise[]`
  - `leadingActivity(text: string): { value: WorkoutActivity; rest: string } | undefined`
  - `leadingExercise(text: string): { value: string; rest: string } | undefined`
  - `intensityOf(word: string): Intensity | undefined`
  - `exerciseName(id: string, language: Language): string`

The activity and intensity words include every name the dashboard shows in all 3 languages, so any line the dashboard writes parses back. Words are matched as whole words, longest first, so `근력 운동` wins over `근력` and `runner` matches nothing.

- [ ] **Step 1: Write the failing tests**

```ts
// source/tests/exercises.test.ts
import test from "ava";
import {
	caloriesOf,
	exerciseName,
	intensityOf,
	leadingActivity,
	leadingExercise,
} from "../exercises.js";
import {
	intensities,
	languages,
	messagesOf,
	workoutActivities,
} from "../i18n.js";

test("works out calories as MET × kg × hours", (t) => {
	// Running at 6 mph is 9.3 METs: 9.3 × 70 kg × 0.5 h.
	t.is(caloriesOf("running", "moderate", 30, 70), 326);
	t.is(caloriesOf("yoga", "light", 60, 60), 138);
	t.is(caloriesOf("strength", "vigorous", 45, 80), 360);
});

test("reads every activity and intensity the dashboard shows, in every language", (t) => {
	for (const language of languages) {
		const messages = messagesOf(language);

		for (const activity of workoutActivities) {
			t.is(
				leadingActivity(`${messages.workoutActivity[activity]} 30m`)?.value,
				activity,
			);
		}

		for (const intensity of intensities) {
			t.is(intensityOf(messages.intensity[intensity]), intensity);
		}
	}
});

test("matches aliases as whole words, longest first", (t) => {
	t.deepEqual(leadingActivity("jog 5k"), { value: "running", rest: "5k" });
	t.deepEqual(leadingActivity("근력 운동 40m"), {
		value: "strength",
		rest: "40m",
	});
	t.is(leadingActivity("runner 5k"), undefined);
	t.deepEqual(leadingExercise("Bench Press 60x5"), {
		value: "bench",
		rest: "60x5",
	});
	t.deepEqual(leadingExercise("臥推 60x5"), { value: "bench", rest: "60x5" });
	t.is(intensityOf("HARD"), "vigorous");
	t.is(intensityOf("輕鬆"), "light");
	t.is(intensityOf("sideways"), undefined);
});

test("names a known exercise in each language and keeps any other as typed", (t) => {
	t.is(exerciseName("bench", "ko"), "벤치프레스");
	t.is(exerciseName("farmer carry", "en"), "farmer carry");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run build`
Expected: FAIL — `tsc` reports `Cannot find module '../exercises.js'`.

- [ ] **Step 3: Write the module**

```ts
// source/exercises.ts
import {
	type Intensity,
	intensities,
	type Language,
	languages,
	messagesOf,
	type WorkoutActivity,
	workoutActivities,
} from "./i18n.js";

// METs from the 2024 Adult Compendium of Physical Activities, used as
// published with their activity codes: https://pacompendium.com/
const metValues: Record<WorkoutActivity, Record<Intensity, number>> = {
	// 12020 jogging, general; 12050 running 6 mph; 12080 running 7.5 mph.
	running: { light: 7.5, moderate: 9.3, vigorous: 11.8 },
	// 17170 2.5 mph; 17190 2.8 to 3.4 mph; 17220 4.0 to 4.4 mph, very brisk.
	walking: { light: 3, moderate: 3.8, vigorous: 5.5 },
	// 01010 leisure under 10 mph; 01016 moderate pace; 01017 vigorous pace.
	cycling: { light: 4, moderate: 7, vigorous: 9 },
	// 18240 freestyle, slow; 18290 crawl, medium speed; 18230 freestyle, fast.
	swimming: { light: 5.8, moderate: 8, vigorous: 9.8 },
	// 02054 multiple exercises, 8-15 reps; 02052 squats and deadlifts;
	// 02050 power lifting or body building, vigorous.
	strength: { light: 3.5, moderate: 5, vigorous: 6 },
	// 02175 general; 02180 Surya Namaskar; 02160 power yoga.
	yoga: { light: 2.3, moderate: 3.5, vigorous: 4 },
	// 02034, 02035, and 02040: circuit training, light to vigorous.
	other: { light: 3.5, moderate: 5, vigorous: 7.5 },
};

// Energy spent: MET × body weight in kg × hours.
export const caloriesOf = (
	activity: WorkoutActivity,
	intensity: Intensity,
	minutes: number,
	kilograms: number,
) => Math.round((metValues[activity][intensity] * kilograms * minutes) / 60);

// Words that name each activity and intensity, in every language, lowercase.
// Each includes the name the dashboard shows, so a shown line parses back.
const activityWords: Record<WorkoutActivity, readonly string[]> = {
	running: ["run", "jog", "jogging", "慢跑", "러닝", "조깅"],
	walking: ["walk", "hike", "走路", "散步", "산책"],
	cycling: ["bike", "cycle", "ride", "騎車", "單車", "사이클"],
	swimming: ["swim"],
	strength: ["lift", "weights", "gym", "重訓", "근력", "웨이트", "헬스"],
	yoga: [],
	other: [],
};

const intensityWords: Record<Intensity, readonly string[]> = {
	light: ["easy", "low", "輕鬆", "가볍게", "쉽게"],
	moderate: ["medium", "normal", "中等", "적당히"],
	vigorous: ["hard", "intense", "high", "激烈", "힘들게", "강하게"],
};

export type Exercise = Readonly<{
	id: string;
	names: Readonly<Record<Language, string>>;
	words: readonly string[];
}>;

// Common lifts; a set of 1 of these is stored under its id, any other
// exercise under the words as typed.
export const exercises: readonly Exercise[] = [
	{
		id: "bench",
		names: { en: "Bench press", "zh-TW": "臥推", ko: "벤치프레스" },
		words: ["bench", "bp"],
	},
	{
		id: "squat",
		names: { en: "Squat", "zh-TW": "深蹲", ko: "스쿼트" },
		words: ["squats"],
	},
	{
		id: "deadlift",
		names: { en: "Deadlift", "zh-TW": "硬舉", ko: "데드리프트" },
		words: ["dl"],
	},
	{
		id: "overheadPress",
		names: { en: "Overhead press", "zh-TW": "肩推", ko: "오버헤드 프레스" },
		words: ["ohp", "shoulder press"],
	},
	{
		id: "row",
		names: { en: "Barbell row", "zh-TW": "划船", ko: "바벨 로우" },
		words: ["row"],
	},
	{
		id: "pullUp",
		names: { en: "Pull-up", "zh-TW": "引體向上", ko: "턱걸이" },
		words: ["pullup", "pull up", "chin-up"],
	},
	{
		id: "pushUp",
		names: { en: "Push-up", "zh-TW": "伏地挺身", ko: "팔굽혀펴기" },
		words: ["pushup", "push up"],
	},
	{
		id: "lunge",
		names: { en: "Lunge", "zh-TW": "弓箭步", ko: "런지" },
		words: ["lunges"],
	},
	{
		id: "curl",
		names: { en: "Biceps curl", "zh-TW": "二頭彎舉", ko: "바이셉스 컬" },
		words: ["curl"],
	},
	{
		id: "dip",
		names: { en: "Dip", "zh-TW": "雙槓撐體", ko: "딥스" },
		words: ["dips"],
	},
	{
		id: "latPulldown",
		names: { en: "Lat pulldown", "zh-TW": "滑輪下拉", ko: "랫풀다운" },
		words: ["pulldown"],
	},
	{
		id: "legPress",
		names: { en: "Leg press", "zh-TW": "腿推", ko: "레그 프레스" },
		words: [],
	},
];

const namesOf = <Key extends string>(
	keys: readonly Key[],
	shown: (key: Key, language: Language) => string,
	words: Record<Key, readonly string[]>,
) =>
	keys.flatMap((key) =>
		[...languages.map((language) => shown(key, language)), ...words[key]].map(
			(word) => [word.toLowerCase(), key] as const,
		),
	);

// Every word, longest first, so "근력 운동" wins over "근력".
const byLength = <Value>(pairs: ReadonlyArray<readonly [string, Value]>) =>
	pairs.toSorted(([left], [right]) => right.length - left.length);

const activityNames = byLength(
	namesOf(
		workoutActivities,
		(activity, language) => messagesOf(language).workoutActivity[activity],
		activityWords,
	),
);
const intensityNames = byLength(
	namesOf(
		intensities,
		(intensity, language) => messagesOf(language).intensity[intensity],
		intensityWords,
	),
);
const exerciseNames = byLength(
	exercises.flatMap((exercise) =>
		[...Object.values(exercise.names), ...exercise.words].map(
			(word) => [word.toLowerCase(), exercise.id] as const,
		),
	),
);

// The value whose word starts the text as a whole word, and the rest after it.
function leading<Value>(
	pairs: ReadonlyArray<readonly [string, Value]>,
	text: string,
): { value: Value; rest: string } | undefined {
	const lower = text.toLowerCase();

	for (const [word, value] of pairs) {
		const after = lower.slice(word.length);

		if (lower.startsWith(word) && (after === "" || after.startsWith(" "))) {
			return { value, rest: text.slice(word.length).trim() };
		}
	}

	return undefined;
}

export const leadingActivity = (text: string) => leading(activityNames, text);
export const leadingExercise = (text: string) => leading(exerciseNames, text);
export const intensityOf = (word: string) =>
	intensityNames.find(([name]) => name === word.toLowerCase())?.[1];

export const exerciseName = (id: string, language: Language) =>
	exercises.find((exercise) => exercise.id === id)?.names[language] ?? id;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run build && npx ava build/tests/exercises.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 5: Run the gate and commit**

Run: `npm test`
Expected: Prettier, xo, and every AVA test pass. Fix formatting with `npx prettier --write source/exercises.ts source/tests/exercises.test.ts`.

```bash
git add source/exercises.ts source/tests/exercises.test.ts
git commit -m "feat: add exercises and Compendium MET values"
```

---

### Task 2: Every Kind in `progress.json`, Its Experience, and Its Description

**Files:**

- Modify: `source/progress.ts:28-46` (entry schemas), `:95-111` (`progressSchema` and types), `:161-197` (`Log` and `logsOf`), `:206-221` (`todayOf`)
- Modify: `source/exercises.ts` (append `setGroupsOf`)
- Modify: `source/i18n.ts` (the `logs` section in all 3 languages)
- Modify: `source/content.ts:528` (add `describeLog` above `dietFieldsOf`)
- Modify: `source/components/logs-view.tsx:3-62`, `:68-90`, `:192`; `source/app.tsx` (the Recent row key)
- Test: `source/tests/progress.test.ts`, `source/tests/data.test.ts`, `source/tests/exercises.test.ts`, `source/tests/health.test.ts`, `source/tests/dashboard.test.tsx`

**Interfaces:**

- Consumes: `exerciseName` from Task 1
- Produces:
  - `progressSchema` (now exported), and the types `Goals`, `Water`, `Sleep`, `Body`, `MoodEntry`, `Habit`, `Steps`, `Note`, with `Meal` gaining `carbs?`, `fat?`, `servings?` and `Workout` gaining `calories?`, `distance?`, `sets?`
  - `logKinds`, `type LogKind`, `fieldOf: Record<LogKind, keyof Progress>`, `type EntryOf`, `type Logged<Kind>` (`{ kind, at, index, entry }`), `type Log = Logged & { experience }`, `dailyCaps`
  - `logsOf(progress: Progress): Log[]`, newest first, every entry carrying its `index` in its own array
  - `todayOf(progress, now)` gaining `water`, `sleepMinutes`, `steps`, `mood`, `habitsDone`, `caloriesBurned`; `type Today`
  - `profileNow(progress: Progress): Profile | undefined`
  - `setGroupsOf(sets?: Workout["sets"]): SetGroup[]` in `source/exercises.ts`
  - `durationOf(minutes: number, messages: Messages): string` in `source/i18n.ts`, and `describeLog(log: Logged, language: Language, messages: Messages): string` in `source/content.ts`
  - `messages.logs.kinds: Record<LogKind, string>` and the entry strings `distance`, `burned`, `waterEntry`, `sleepEntry`, `quality`, `weight`, `waist`, `bodyFat`, `moodEntry`, `energy`, `stress`, `skipped`, `stepsEntry`, `hours`, `minutes`

The new arrays default to `[]`, so `Progress` now always holds them; tests build a `Progress` with `progressSchema.parse`, which fills them in. A step count is the day's count so far, as a watch shows it, so the highest of a day counts and a later entry earns only the thousands it adds. A weigh-in counts over the profile only when it is newer than the last `profileSaved` event, so editing the profile wins until the next weigh-in.

- [ ] **Step 1: Write the failing tests**

In `source/tests/progress.test.ts`, import `profileNow` and `progressSchema` instead of `type Progress`, and wrap `sample` in `progressSchema.parse({ … })`. In "counts only today's entries", add the new fields to the expected object:

```ts
		water: 0,
		sleepMinutes: 0,
		steps: 0,
		mood: undefined,
		habitsDone: 0,
		caloriesBurned: 0,
```

In "starts empty and round-trips through the file", expect every array:

```ts
t.deepEqual(loadProgress(file), {
	focus: [],
	meals: [],
	workouts: [],
	water: [],
	sleep: [],
	body: [],
	moods: [],
	habits: [],
	steps: [],
	notes: [],
	events: [],
});
```

Append:

```ts
// A local time on 3 October 2026, so day boundaries hold in any time zone.
const local = (hour: number, minute = 0, day = 3) =>
	new Date(2026, 9, day, hour, minute).toISOString();

test("still loads a file written by 1.6.0", (t) => {
	const file = temporaryFile();
	writeFileSync(
		file,
		JSON.stringify({
			language: "ko",
			theme: "moss",
			profile: {
				name: "Ken",
				age: 30,
				height: 175,
				weight: 70,
				bodyFat: 18,
				gender: "male",
				workStyle: "desk",
				goal: "buildMuscle",
			},
			focus: [{ at: "2026-10-03T09:00:00.000Z", minutes: 25 }],
			meals: [
				{
					at: "2026-10-03T08:00:00.000Z",
					food: "Oatmeal",
					calories: 350,
					protein: 12,
				},
			],
			workouts: [
				{
					at: "2026-10-03T07:00:00.000Z",
					activity: "running",
					minutes: 30,
					intensity: "moderate",
				},
			],
			quotes: {
				autoRefresh: true,
				interval: 1500,
				mode: "random",
				categories: ["wisdom"],
				excluded: [],
				author: "",
				work: "",
			},
			events: [
				{
					at: "2026-10-03T09:30:00.000Z",
					action: "themeChanged",
					detail: "moss",
				},
			],
		}),
	);

	const progress = loadProgress(file);
	t.is(progress.profile?.bodyFat, 18);
	t.deepEqual(
		[progress.water, progress.sleep, progress.body, progress.notes],
		[[], [], [], []],
	);
	t.is(progress.goals, undefined);
	t.is(experienceOf(progress), 25 + 5 + 45);
});

test("rejects entries that make no sense", (t) => {
	const parse = (value: unknown) => progressSchema.safeParse(value).success;

	t.false(parse({ body: [{ at: local(8) }] }), "a body entry needs a value");
	t.false(parse({ moods: [{ at: local(8), score: 6 }] }));
	t.false(parse({ water: [{ at: local(8), milliliters: 0 }] }));
	t.false(parse({ goals: { sleep: 60 } }));
	t.true(
		parse({
			body: [{ at: local(8), waist: 82 }],
			moods: [{ at: local(8), score: 4, tags: ["work"] }],
			habits: [{ at: local(8), name: "read", skipped: true }],
			goals: { water: 2500 },
		}),
	);
});

test("numbers every entry within its own array", (t) => {
	const breakfast = progressSchema.parse({
		meals: [
			{ at: local(8), food: "Egg", servings: 2 },
			{ at: local(8), food: "Toast" },
		],
	});

	t.deepEqual(
		logsOf(breakfast).map((log) => [log.kind, log.index]),
		[
			["meal", 0],
			["meal", 1],
		],
	);
});

test("caps the small kinds per local day, in the order they happened", (t) => {
	const progress = progressSchema.parse({
		water: [
			...Array.from({ length: 10 }, (_, minute) => ({
				at: local(9, minute),
				milliliters: 250,
			})),
			{ at: local(9, 0, 4), milliliters: 250 },
		],
		steps: [
			{ at: local(12), count: 4000 },
			{ at: local(20), count: 8400 },
			{ at: local(21), count: 30_000 },
		],
		habits: [
			{ at: local(7), name: "read" },
			{ at: local(8), name: "stretch", skipped: true },
		],
		moods: [1, 2, 3].map((hour) => ({ at: local(hour), score: 4 })),
		notes: [
			{ at: local(1), text: "first" },
			{ at: local(2), text: "second" },
		],
		sleep: [{ at: local(7), minutes: 450, quality: 4 }],
		body: [{ at: local(6), weight: 72.4 }],
	});
	const earned = (kind: string) =>
		logsOf(progress)
			.filter((log) => log.kind === kind)
			.map((log) => log.experience)
			.toReversed();

	t.deepEqual(earned("water"), [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 1]);
	t.deepEqual(earned("steps"), [4, 4, 12], "the highest count of a day counts");
	t.deepEqual(earned("habit"), [5, 0], "a skip earns nothing");
	t.deepEqual(earned("mood"), [3, 3, 0]);
	t.deepEqual(earned("note"), [3, 0]);
	t.is(experienceOf(progress), 9 + 20 + 5 + 6 + 3 + 10 + 5);
});

test("sums today's water, sleep, steps, mood, habits, and burned calories", (t) => {
	const progress = progressSchema.parse({
		water: [
			{ at: local(9), milliliters: 250 },
			{ at: local(13), milliliters: 500 },
		],
		sleep: [
			{ at: local(7), minutes: 420 },
			{ at: local(7, 0, 2), minutes: 300 },
		],
		steps: [
			{ at: local(12), count: 4000 },
			{ at: local(20), count: 8400 },
		],
		moods: [
			{ at: local(21), score: 2 },
			{ at: local(9), score: 4 },
		],
		habits: [
			{ at: local(7), name: "Read" },
			{ at: local(22), name: "read" },
			{ at: local(7), name: "stretch", skipped: true },
		],
		workouts: [
			{ at: local(18), activity: "running", minutes: 30, calories: 326 },
		],
	});

	t.like(todayOf(progress, Date.parse(local(23))), {
		water: 750,
		sleepMinutes: 420,
		steps: 8400,
		mood: 2,
		habitsDone: 1,
		caloriesBurned: 326,
	});
});

test("takes the latest weigh-in over the profile, unless the profile is newer", (t) => {
	const profile = {
		name: "Ken",
		age: 30,
		height: 175,
		weight: 70,
		gender: "male",
		workStyle: "desk",
		goal: "maintain",
	} as const;
	const progress = progressSchema.parse({
		profile,
		events: [{ at: local(8), action: "profileSaved" }],
		body: [
			{ at: local(7), weight: 75 },
			{ at: local(9), weight: 72.4 },
			{ at: local(10), waist: 82, bodyFat: 18.5 },
		],
	});

	t.like(profileNow(progress), { weight: 72.4, bodyFat: 18.5, height: 175 });
	t.like(
		profileNow({ ...progress, body: [{ at: local(7), weight: 75 }] }),
		{ weight: 70 },
		"a weigh-in before the profile was saved",
	);
	t.is(profileNow(progressSchema.parse({})), undefined);
});
```

In `source/tests/data.test.ts`, import `describeLog` from `../content.js`, `type Language` beside `messagesOf`, and `type EntryOf, type Logged, type LogKind, progressSchema` from `../progress.js` in place of `type Progress`; replace `empty` with `const empty = progressSchema.parse({ language: "en" });`; then append:

```ts
test("describes every kind of entry in the language on now", (t) => {
	const describe = (log: Logged, language: Language = "en") =>
		describeLog(log, language, messagesOf(language));
	const entry = <Kind extends LogKind>(
		kind: Kind,
		fields: Omit<EntryOf[Kind], "at">,
	) => ({ kind, at, index: 0, entry: { ...fields, at } });
	const bench = (weight: number, reps: number) => ({
		exercise: "bench",
		weight,
		reps,
	});

	t.is(
		describe(
			entry("meal", { food: "Egg", servings: 2, calories: 144, protein: 12 }),
		),
		"2 × Egg · 144 kcal · 12 g protein",
	);
	t.is(
		describe(
			entry("workout", {
				activity: "strength",
				minutes: 9,
				intensity: "moderate",
				sets: [bench(60, 5), bench(60, 5), bench(65, 3)],
			}),
		),
		"Strength · 9 min · Moderate · Bench press 60×5×2, 65×3",
	);
	t.is(
		describe(
			entry("workout", {
				activity: "running",
				minutes: 30,
				intensity: "vigorous",
				distance: 5,
				calories: 413,
			}),
		),
		"Running · 30 min · Vigorous · 5 km · 413 kcal burned",
	);
	t.is(describe(entry("water", { milliliters: 1500 })), "1,500 ml of water");
	t.is(
		describe(entry("sleep", { minutes: 460, quality: 4 })),
		"Slept 7h 40m · quality 4/5",
	);
	t.is(
		describe(entry("body", { weight: 72.4, bodyFat: 18 })),
		"72.4 kg · body fat 18%",
	);
	t.is(
		describe(entry("mood", { score: 4, energy: 3, tags: ["work", "friends"] })),
		"Mood 4/5 · energy 3/5 · #work #friends",
	);
	t.is(describe(entry("habit", { name: "read", amount: 30 })), "read · 30");
	t.is(
		describe(entry("habit", { name: "read", skipped: true })),
		"Skipped read",
	);
	t.is(describe(entry("steps", { count: 8400 })), "8,400 steps");
	t.is(describe(entry("note", { text: "grateful" })), "grateful");
	t.is(describe(entry("sleep", { minutes: 480 }), "zh-TW"), "睡了 8 小時");
	t.is(describe(entry("water", { milliliters: 500 }), "ko"), "물 500ml");
});
```

In `source/tests/exercises.test.ts`, import `setGroupsOf` and append:

```ts
test("groups identical sets into runs", (t) => {
	const set = (weight: number, reps: number) => ({
		exercise: "bench",
		weight,
		reps,
	});

	t.deepEqual(setGroupsOf([set(60, 5), set(60, 5), set(60, 5), set(65, 3)]), [
		{ exercise: "bench", weight: 60, reps: 5, count: 3 },
		{ exercise: "bench", weight: 65, reps: 3, count: 1 },
	]);
	t.deepEqual(setGroupsOf([{ exercise: "dip", reps: 8 }]), [
		{ exercise: "dip", weight: 0, reps: 8, count: 1 },
	]);
	t.deepEqual(setGroupsOf(undefined), []);
});
```

In `source/tests/health.test.ts`, import `type Profile, progressSchema, todayOf` from `../progress.js`, and build `today` from a real empty day:

```ts
const today = {
	...todayOf(progressSchema.parse({}), 0),
	meals: 1,
	calories: 600,
	protein: 30,
	workoutMinutes: 10,
};
```

In `source/tests/dashboard.test.tsx`, import `progressSchema` beside `loadProgress`, replace `empty` with `const empty = progressSchema.parse({ language: "en" });`, and start the first-run test with `start(progressSchema.parse({}))`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run build`
Expected: FAIL — `tsc` reports that `progressSchema`, `profileNow`, `describeLog`, and `setGroupsOf` are not exported.

- [ ] **Step 3: Add the schemas**

Replace lines 28-46 of `source/progress.ts` (from `const timestamp` through `workoutSchema`):

```ts
const timestamp = zod.iso.datetime({ offset: true });
const rating = zod.number().int().min(1).max(5);

// Fields added after 1.0.0 stay optional, so older files keep loading.
const focusSchema = zod.object({
	at: timestamp,
	minutes: zod.number().positive(),
});
// Amounts are totals for the entry, already multiplied by its servings.
const mealSchema = zod.object({
	at: timestamp,
	food: zod.string().min(1),
	calories: zod.number().nonnegative().optional(),
	protein: zod.number().nonnegative().optional(),
	carbs: zod.number().nonnegative().optional(),
	fat: zod.number().nonnegative().optional(),
	servings: zod.number().positive().optional(),
});
const setSchema = zod.object({
	exercise: zod.string().min(1),
	reps: zod.number().int().min(1),
	weight: zod.number().nonnegative().optional(),
});
const workoutSchema = zod.object({
	at: timestamp,
	activity: zod.string().min(1),
	minutes: zod.number().positive(),
	intensity: zod.enum(intensities).optional(),
	calories: zod.number().nonnegative().optional(),
	distance: zod.number().positive().optional(),
	sets: zod.array(setSchema).optional(),
});
const waterSchema = zod.object({
	at: timestamp,
	milliliters: zod.number().min(1).max(5000),
});
// Stamped with the wake time, so a night counts toward the day it ends.
const sleepSchema = zod.object({
	at: timestamp,
	minutes: zod.number().int().min(1).max(1440),
	quality: rating.optional(),
});
const bodySchema = zod
	.object({
		at: timestamp,
		weight: zod.number().min(30).max(300).optional(),
		waist: zod.number().min(40).max(250).optional(),
		bodyFat: zod.number().min(3).max(60).optional(),
	})
	.refine(
		(body) =>
			body.weight !== undefined ||
			body.waist !== undefined ||
			body.bodyFat !== undefined,
		"A body entry needs a weight, a waist, or a body fat.",
	);
const moodSchema = zod.object({
	at: timestamp,
	score: rating,
	energy: rating.optional(),
	stress: rating.optional(),
	tags: zod.array(zod.string().min(1)).optional(),
});
const habitSchema = zod.object({
	at: timestamp,
	name: zod.string().min(1),
	amount: zod.number().positive().optional(),
	skipped: zod.boolean().optional(),
});
// The day's count so far, as a watch shows it; the highest of a day counts.
const stepsSchema = zod.object({
	at: timestamp,
	count: zod.number().int().min(1).max(100_000),
});
const noteSchema = zod.object({
	at: timestamp,
	text: zod.string().min(1).max(2000),
});
const goalsSchema = zod.object({
	water: zod.number().int().min(250).max(10_000).optional(),
	sleep: zod.number().int().min(240).max(720).optional(),
	steps: zod.number().int().min(1000).max(50_000).optional(),
	focusSessions: zod.number().int().min(1).max(16).optional(),
});
```

Replace `progressSchema` and the types below it (lines 95-111):

```ts
export const progressSchema = zod.object({
	language: zod.enum(languages).optional(),
	theme: zod.enum(themeNames).optional(),
	profile: profileSchema.optional(),
	quotes: quotesSchema.optional(),
	goals: goalsSchema.optional(),
	focus: zod.array(focusSchema).default([]),
	meals: zod.array(mealSchema).default([]),
	workouts: zod.array(workoutSchema).default([]),
	water: zod.array(waterSchema).default([]),
	sleep: zod.array(sleepSchema).default([]),
	body: zod.array(bodySchema).default([]),
	moods: zod.array(moodSchema).default([]),
	habits: zod.array(habitSchema).default([]),
	steps: zod.array(stepsSchema).default([]),
	notes: zod.array(noteSchema).default([]),
	events: zod.array(eventSchema).default([]),
});

export type Progress = zod.infer<typeof progressSchema>;
export type Profile = zod.infer<typeof profileSchema>;
export type Goals = zod.infer<typeof goalsSchema>;
export type Focus = zod.infer<typeof focusSchema>;
export type Meal = zod.infer<typeof mealSchema>;
export type Workout = zod.infer<typeof workoutSchema>;
export type Water = zod.infer<typeof waterSchema>;
export type Sleep = zod.infer<typeof sleepSchema>;
export type Body = zod.infer<typeof bodySchema>;
export type MoodEntry = zod.infer<typeof moodSchema>;
export type Habit = zod.infer<typeof habitSchema>;
export type Steps = zod.infer<typeof stepsSchema>;
export type Note = zod.infer<typeof noteSchema>;
export type Event = zod.infer<typeof eventSchema>;
```

- [ ] **Step 4: Derive the logs and their capped experience**

Replace `type Log` and `logsOf` (lines 161-197), keeping `experienceOf` and `levelOf` below them:

```ts
export const logKinds = [
	"focus",
	"meal",
	"workout",
	"water",
	"sleep",
	"body",
	"mood",
	"habit",
	"steps",
	"note",
	"event",
] as const;
export type LogKind = (typeof logKinds)[number];

// The array in progress.json that holds each kind.
export const fieldOf = {
	focus: "focus",
	meal: "meals",
	workout: "workouts",
	water: "water",
	sleep: "sleep",
	body: "body",
	mood: "moods",
	habit: "habits",
	steps: "steps",
	note: "notes",
	event: "events",
} as const satisfies Record<LogKind, keyof Progress>;

export type EntryOf = {
	[Kind in LogKind]: Progress[(typeof fieldOf)[Kind]][number];
};

// An entry with its kind and its position in its own array, which edit and
// delete use, since the items of 1 line share a timestamp.
export type Logged<Kind extends LogKind = LogKind> = {
	[Each in Kind]: Readonly<{
		kind: Each;
		at: string;
		index: number;
		entry: EntryOf[Each];
	}>;
}[Kind];

export type Log = Logged & Readonly<{ experience: number }>;

// Small kinds earn a little, capped per local day so logging cannot be farmed.
export const dailyCaps: Partial<Record<LogKind, number>> = {
	body: 5,
	habit: 25,
	mood: 6,
	note: 3,
	sleep: 10,
	steps: 20,
	water: 8,
};

function experienceEach(log: Logged): number {
	switch (log.kind) {
		case "focus": {
			return log.entry.minutes;
		}

		case "meal": {
			return experiencePerMeal;
		}

		case "workout": {
			return workoutExperience(log.entry);
		}

		case "habit": {
			return log.entry.skipped ? 0 : 5;
		}

		case "steps": {
			return Math.floor(log.entry.count / 1000);
		}

		case "body": {
			return 5;
		}

		case "sleep": {
			return 10;
		}

		case "mood":
		case "note": {
			return 3;
		}

		case "water": {
			return 1;
		}

		case "event": {
			return 0;
		}
	}
}

const listed = <Kind extends LogKind>(
	kind: Kind,
	entries: ReadonlyArray<EntryOf[Kind]>,
): Array<Logged<Kind>> =>
	entries.map((entry, index) => ({ kind, at: entry.at, index, entry }));

const byTime = (left: { at: string }, right: { at: string }) =>
	Date.parse(left.at) - Date.parse(right.at);

// Every entry, newest first, with the experience it earned. Entries earn in
// the order they happened, so whatever passes a daily cap earns nothing.
export function logsOf(progress: Progress): Log[] {
	const spent = new Map<string, number>();
	const bestSteps = new Map<string, number>();
	const logs = [
		...listed("focus", progress.focus),
		...listed("meal", progress.meals),
		...listed("workout", progress.workouts),
		...listed("water", progress.water),
		...listed("sleep", progress.sleep),
		...listed("body", progress.body),
		...listed("mood", progress.moods),
		...listed("habit", progress.habits),
		...listed("steps", progress.steps),
		...listed("note", progress.notes),
		...listed("event", progress.events),
	]
		.toSorted(byTime)
		.map((log): Log => {
			const day = `${log.kind} ${new Date(log.at).toDateString()}`;
			let each = experienceEach(log);

			// A later count of the same day earns only the thousands it adds.
			if (log.kind === "steps") {
				const best = bestSteps.get(day) ?? 0;
				bestSteps.set(day, Math.max(best, log.entry.count));
				each = Math.max(each - Math.floor(best / 1000), 0);
			}

			const cap = dailyCaps[log.kind];

			if (cap === undefined) {
				return { ...log, experience: each };
			}

			const used = spent.get(day) ?? 0;
			const experience = Math.min(each, cap - used);
			spent.set(day, used + experience);
			return { ...log, experience };
		});

	return logs.toSorted((left, right) => byTime(right, left));
}
```

Replace `todayOf` (lines 206-221), adding `profileNow` after it:

```ts
export function todayOf(progress: Progress, now: number) {
	const today = new Date(now).toDateString();
	const isToday = ({ at }: { at: string }) =>
		new Date(at).toDateString() === today;
	const meals = progress.meals.filter((meal) => isToday(meal));
	const workouts = progress.workouts.filter((workout) => isToday(workout));
	const total = <Entry>(
		entries: readonly Entry[],
		amount: (entry: Entry) => number | undefined,
	) => entries.reduce((sum, entry) => sum + (amount(entry) ?? 0), 0);

	return {
		focusSessions: progress.focus.filter((focus) => isToday(focus)).length,
		meals: meals.length,
		calories: total(meals, (meal) => meal.calories),
		protein: total(meals, (meal) => meal.protein),
		workoutMinutes: total(workouts, (workout) => workout.minutes),
		water: total(
			progress.water.filter((water) => isToday(water)),
			(water) => water.milliliters,
		),
		// Last night: every sleep that ended today.
		sleepMinutes: total(
			progress.sleep.filter((sleep) => isToday(sleep)),
			(sleep) => sleep.minutes,
		),
		steps: Math.max(
			0,
			...progress.steps
				.filter((steps) => isToday(steps))
				.map((steps) => steps.count),
		),
		mood: progress.moods
			.filter((mood) => isToday(mood))
			.toSorted(byTime)
			.at(-1)?.score,
		habitsDone: new Set(
			progress.habits
				.filter((habit) => isToday(habit) && !habit.skipped)
				.map((habit) => habit.name.toLowerCase()),
		).size,
		caloriesBurned: total(workouts, (workout) => workout.calories),
	};
}

export type Today = ReturnType<typeof todayOf>;

// The profile with the latest weigh-in, when it is newer than the profile:
// weight and body fat change far more often than the rest of it.
export function profileNow(progress: Progress): Profile | undefined {
	const { profile } = progress;

	if (!profile) {
		return undefined;
	}

	const savedAt = Math.max(
		0,
		...progress.events
			.filter((event) => event.action === "profileSaved")
			.map((event) => Date.parse(event.at)),
	);
	const latest = (field: "weight" | "bodyFat") =>
		progress.body
			.filter(
				(body) => body[field] !== undefined && Date.parse(body.at) > savedAt,
			)
			.toSorted(byTime)
			.at(-1)?.[field];
	const weight = latest("weight") ?? profile.weight;
	const bodyFat = latest("bodyFat") ?? profile.bodyFat;

	return { ...profile, weight, ...(bodyFat === undefined ? {} : { bodyFat }) };
}
```

- [ ] **Step 5: Group the sets**

In `source/exercises.ts`, add `import type { Workout } from "./progress.js";` under the `i18n.js` import, and append:

```ts
export type SetGroup = Readonly<{
	exercise: string;
	weight: number;
	reps: number;
	count: number;
}>;

// Runs of identical sets, so 3 sets of 60 kg × 5 read as 60×5×3.
export function setGroupsOf(sets: Workout["sets"] = []): SetGroup[] {
	const groups: SetGroup[] = [];

	for (const { exercise, reps, weight = 0 } of sets) {
		const last = groups.at(-1);

		if (
			last?.exercise === exercise &&
			last.weight === weight &&
			last.reps === reps
		) {
			groups[groups.length - 1] = { ...last, count: last.count + 1 };
		} else {
			groups.push({ exercise, weight, reps, count: 1 });
		}
	}

	return groups;
}
```

- [ ] **Step 6: Describe every kind in all 3 languages**

In `source/i18n.ts`, import `type LogKind` beside `type EventAction` from `./progress.js`. Replace the `logs` section of `en`:

```ts
	logs: {
		title: "Logs",
		all: "All",
		kinds: {
			focus: "Focus",
			meal: "Diet",
			workout: "Workout",
			water: "Water",
			sleep: "Sleep",
			body: "Body",
			mood: "Mood",
			habit: "Habit",
			steps: "Steps",
			note: "Note",
			event: "Action",
		} satisfies Record<LogKind, string>,
		empty: "Nothing logged yet.",
		summary: (count: number, xp: number) =>
			`${count} ${count === 1 ? "log" : "logs"} · ${xp} XP`,
		focusEntry: (minutes: number) => `${minutes}-minute focus`,
		mealEntry: (food: string, calories: string, protein: string) =>
			`${food} · ${calories} kcal · ${protein} g protein`,
		workoutEntry: (activity: string, minutes: number, intensity: string) =>
			`${activity} · ${minutes} min · ${intensity}`,
		distance: (kilometers: string) => `${kilometers} km`,
		burned: (calories: string) => `${calories} kcal burned`,
		waterEntry: (milliliters: string) => `${milliliters} ml of water`,
		sleepEntry: (duration: string) => `Slept ${duration}`,
		quality: (score: number) => `quality ${score}/5`,
		weight: (kilograms: string) => `${kilograms} kg`,
		waist: (centimeters: string) => `waist ${centimeters} cm`,
		bodyFat: (percent: string) => `body fat ${percent}%`,
		moodEntry: (score: number) => `Mood ${score}/5`,
		energy: (score: number) => `energy ${score}/5`,
		stress: (score: number) => `stress ${score}/5`,
		skipped: (name: string) => `Skipped ${name}`,
		stepsEntry: (count: string) => `${count} steps`,
		hours: (hours: number) => `${hours}h`,
		minutes: (minutes: number) => `${minutes}m`,
	},
```

Replace the `logs` section of `traditionalChinese`:

```ts
	logs: {
		title: "所有紀錄",
		all: "全部",
		kinds: {
			focus: "專注",
			meal: "飲食",
			workout: "運動",
			water: "喝水",
			sleep: "睡眠",
			body: "身體",
			mood: "心情",
			habit: "習慣",
			steps: "步數",
			note: "筆記",
			event: "操作",
		},
		empty: "尚無紀錄。",
		summary: (count, xp) => `共 ${count} 筆 · ${xp} XP`,
		focusEntry: (minutes) => `專注 ${minutes} 分鐘`,
		mealEntry: (food, calories, protein) =>
			`${food} · ${calories} 大卡 · 蛋白質 ${protein} 克`,
		workoutEntry: (activity, minutes, intensity) =>
			`${activity} · ${minutes} 分鐘 · ${intensity}`,
		distance: (kilometers) => `${kilometers} 公里`,
		burned: (calories) => `消耗 ${calories} 大卡`,
		waterEntry: (milliliters) => `喝水 ${milliliters} 毫升`,
		sleepEntry: (duration) => `睡了 ${duration}`,
		quality: (score) => `品質 ${score}/5`,
		weight: (kilograms) => `${kilograms} 公斤`,
		waist: (centimeters) => `腰圍 ${centimeters} 公分`,
		bodyFat: (percent) => `體脂 ${percent}%`,
		moodEntry: (score) => `心情 ${score}/5`,
		energy: (score) => `精力 ${score}/5`,
		stress: (score) => `壓力 ${score}/5`,
		skipped: (name) => `略過 ${name}`,
		stepsEntry: (count) => `${count} 步`,
		hours: (hours) => `${hours} 小時`,
		minutes: (minutes) => `${minutes} 分`,
	},
```

Replace the `logs` section of `korean`:

```ts
	logs: {
		title: "전체 기록",
		all: "전체",
		kinds: {
			focus: "집중",
			meal: "식단",
			workout: "운동",
			water: "물",
			sleep: "수면",
			body: "신체",
			mood: "기분",
			habit: "습관",
			steps: "걸음",
			note: "메모",
			event: "활동",
		},
		empty: "아직 기록이 없습니다.",
		summary: (count, xp) => `${count}개 · ${xp} XP`,
		focusEntry: (minutes) => `${minutes}분 집중`,
		mealEntry: (food, calories, protein) =>
			`${food} · ${calories} kcal · 단백질 ${protein}g`,
		workoutEntry: (activity, minutes, intensity) =>
			`${activity} · ${minutes}분 · ${intensity}`,
		distance: (kilometers) => `${kilometers}km`,
		burned: (calories) => `${calories} kcal 소모`,
		waterEntry: (milliliters) => `물 ${milliliters}ml`,
		sleepEntry: (duration) => `${duration} 수면`,
		quality: (score) => `만족도 ${score}/5`,
		weight: (kilograms) => `${kilograms}kg`,
		waist: (centimeters) => `허리 ${centimeters}cm`,
		bodyFat: (percent) => `체지방 ${percent}%`,
		moodEntry: (score) => `기분 ${score}/5`,
		energy: (score) => `에너지 ${score}/5`,
		stress: (score) => `스트레스 ${score}/5`,
		skipped: (name) => `${name} 건너뜀`,
		stepsEntry: (count) => `${count}걸음`,
		hours: (hours) => `${hours}시간`,
		minutes: (minutes) => `${minutes}분`,
	},
```

Append to the end of `source/i18n.ts`, beside `formatNumber`:

```ts
// "7h 40m", "7 小時 40 分", "7시간 40분".
export function durationOf(minutes: number, messages: Messages) {
	const hours = Math.floor(minutes / 60);
	const rest = Math.round(minutes % 60);

	return [
		hours > 0 ? messages.logs.hours(hours) : "",
		rest > 0 || hours === 0 ? messages.logs.minutes(rest) : "",
	]
		.filter(Boolean)
		.join(" ");
}
```

In `source/content.ts`, import `exerciseName, setGroupsOf` from `./exercises.js`, `durationOf` and `type WorkoutActivity` from `./i18n.js`, and `type Logged` from `./progress.js`, then add above `dietFieldsOf`:

```ts
const isWorkoutActivity = (activity: string): activity is WorkoutActivity =>
	(workoutActivities as readonly string[]).includes(activity);

const joined = (...parts: Array<string | false>) =>
	parts.filter(Boolean).join(" · ");

function describeWorkout(
	workout: Workout,
	language: Language,
	messages: Messages,
) {
	const { activity, minutes, intensity, sets, distance, calories } = workout;
	const format = (value: number) => formatNumber(language, value);
	const groups = setGroupsOf(sets).map((group, index, all) => {
		const name =
			all[index - 1]?.exercise === group.exercise
				? ""
				: `${exerciseName(group.exercise, language)} `;
		const count = group.count > 1 ? `×${group.count}` : "";
		return `${name}${format(group.weight)}×${group.reps}${count}`;
	});

	return joined(
		messages.logs.workoutEntry(
			isWorkoutActivity(activity)
				? messages.workoutActivity[activity]
				: activity,
			minutes,
			intensity ? messages.intensity[intensity] : "-",
		),
		groups.join(", "),
		distance !== undefined && messages.logs.distance(format(distance)),
		calories !== undefined && messages.logs.burned(format(calories)),
	);
}

// 1 entry as a line of the logs, in the language on now.
export function describeLog(
	log: Logged,
	language: Language,
	messages: Messages,
): string {
	const { logs } = messages;
	const format = (value: number) => formatNumber(language, value);
	const optional = <Value>(
		value: Value | undefined,
		text: (value: Value) => string,
	) => value !== undefined && text(value);

	switch (log.kind) {
		case "focus": {
			return logs.focusEntry(log.entry.minutes);
		}

		case "meal": {
			const { food, servings, calories, protein } = log.entry;
			return logs.mealEntry(
				servings === undefined ? food : `${format(servings)} × ${food}`,
				calories === undefined ? "-" : format(calories),
				protein === undefined ? "-" : format(protein),
			);
		}

		case "workout": {
			return describeWorkout(log.entry, language, messages);
		}

		case "water": {
			return logs.waterEntry(format(log.entry.milliliters));
		}

		case "sleep": {
			return joined(
				logs.sleepEntry(durationOf(log.entry.minutes, messages)),
				optional(log.entry.quality, logs.quality),
			);
		}

		case "body": {
			return joined(
				optional(log.entry.weight, (weight) => logs.weight(format(weight))),
				optional(log.entry.waist, (waist) => logs.waist(format(waist))),
				optional(log.entry.bodyFat, (fat) => logs.bodyFat(format(fat))),
			);
		}

		case "mood": {
			const { score, energy, stress, tags = [] } = log.entry;
			return joined(
				logs.moodEntry(score),
				optional(energy, logs.energy),
				optional(stress, logs.stress),
				tags.map((tag) => `#${tag}`).join(" "),
			);
		}

		case "habit": {
			const { name, amount, skipped } = log.entry;
			return skipped
				? logs.skipped(name)
				: joined(name, optional(amount, format));
		}

		case "steps": {
			return logs.stepsEntry(format(log.entry.count));
		}

		case "note": {
			return log.entry.text;
		}

		case "event": {
			return describeEvent(messages, log.entry);
		}
	}
}
```

- [ ] **Step 7: Show every kind in the logs and Recent**

In `source/components/logs-view.tsx`, replace everything from the `i18n.js` import through the old `describeLog` (lines 3-52) with:

```tsx
import type { Language, Messages } from "../i18n.js";
import { describeLog } from "../content.js";
import type { Log } from "../progress.js";
import { usePalette } from "../theme.js";

export { describeLog } from "../content.js";

const filters = ["all", "focus", "meal", "workout", "event"] as const;
type Filter = (typeof filters)[number];
```

Point `kindLabels` at the new labels:

```tsx
const kindLabels = (messages: Messages): Record<Filter, string> => ({
	all: messages.logs.all,
	focus: messages.logs.kinds.focus,
	meal: messages.logs.kinds.meal,
	workout: messages.logs.kinds.workout,
	event: messages.logs.kinds.event,
});
```

In `LogRow`, color every kind and label it from `messages.logs.kinds`:

```tsx
const kindColor: Record<Log["kind"], string> = {
	focus: palette.metrics.focus,
	meal: palette.metrics.protein,
	workout: palette.metrics.workout,
	water: palette.soft,
	sleep: palette.deep,
	body: palette.metrics.character,
	mood: palette.accent,
	habit: palette.metrics.calories,
	steps: palette.metrics.workout,
	note: palette.soft,
	event: palette.soft,
};
```

```tsx
<Text color={kindColor[log.kind]} wrap="truncate-end">
	{messages.logs.kinds[log.kind]}
</Text>
```

Items of 1 line share a timestamp, so key rows by index: in both `LogsView` and the Recent block of `source/app.tsx`, change `key={`${log.kind}-${log.at}`}` to `key={`${log.kind}-${log.index}`}`.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm run build && npx ava build/tests/progress.test.js build/tests/data.test.js build/tests/exercises.test.js build/tests/health.test.js`
Expected: PASS.

- [ ] **Step 9: Run the gate and commit**

Run: `npm test`
Expected: everything passes.

```bash
git add source/progress.ts source/exercises.ts source/i18n.ts source/content.ts source/components/logs-view.tsx source/app.tsx source/tests/progress.test.ts source/tests/data.test.ts source/tests/exercises.test.ts source/tests/health.test.ts source/tests/dashboard.test.tsx
git commit -m "feat: log water, sleep, body, mood, habits, steps, and notes"
```

---

### Task 3: Water, Sleep, Steps, and Focus Targets

**Files:**

- Modify: `source/health.ts` (whole file)
- Modify: `source/progress.ts` (remove `dailyGoals`)
- Modify: `source/content.ts` (`sectionsOf`, `moodOf`, `menuEntriesOf`, `profileFieldsOf`)
- Modify: `source/app.tsx` (`HealthSummary`, the character's look, and the profile form)
- Modify: `source/i18n.ts` (`health` in all 3 languages)
- Test: `source/tests/health.test.ts`

**Interfaces:**

- Consumes: `profileNow`, `type Goals`, `type Today` from Task 2; `durationOf` from Task 2
- Produces:
  - `type Targets = Readonly<{ calories; protein; workoutMinutes; water; sleep; steps; focusSessions }>`, water in ml and sleep in minutes
  - `targetsOf(profile: Profile | undefined, goals?: Progress["goals"]): Targets`, every goal winning over its default
  - `adviceOf(profile, today, language, messages, goals?)`, gaining a water line and a sleep line after the calories line
  - `messages.health.waterLeft(milliliters, glasses)`, `waterDone`, `sleepUnknown`, `sleepShort(slept, target)`, `sleepDone`

The defaults, with sources: water is the drinks share, about 80%, of the [National Academies' adequate intake](https://www.nationalacademies.org/news/report-sets-dietary-intake-levels-for-water-salt-and-potassium-to-maintain-health-and-reduce-chronic-disease-risk) of 3.7 L for men and 2.7 L for women (3,000, 2,200, and 2,600 ml for `other`); sleep is [7 hours or more, as the AASM recommends](https://aasm.org/seven-or-more-hours-of-sleep-per-night-a-health-necessity-for-adults/); steps are where [mortality stops falling](https://doaj.org/article/c3639c468b4348958202e52793ab979d), about 8,000 under 60 and 7,000 from 60; focus stays at 4 sessions. Every caller now passes `profileNow(progress)`, so calories and protein follow the latest weigh-in.

- [ ] **Step 1: Write the failing tests**

Replace `source/tests/health.test.ts` with:

```ts
import test from "ava";
import { adviceOf, targetsOf } from "../health.js";
import { messagesOf } from "../i18n.js";
import { type Profile, progressSchema, todayOf } from "../progress.js";

const desk: Profile = {
	name: "Ken",
	age: 30,
	height: 175,
	weight: 70,
	gender: "male",
	workStyle: "desk",
	goal: "maintain",
};

const today = {
	...todayOf(progressSchema.parse({}), 0),
	meals: 1,
	calories: 600,
	protein: 30,
	workoutMinutes: 10,
};

test("falls back to general targets without a profile", (t) => {
	t.deepEqual(targetsOf(undefined), {
		calories: 2000,
		protein: 50,
		workoutMinutes: 30,
		water: 2600,
		sleep: 420,
		steps: 8000,
		focusSessions: 4,
	});
});

test("works targets out of body, work style, and goal", (t) => {
	// Resting 1,648.75 kcal x 1.2 for desk work.
	t.deepEqual(targetsOf(desk), {
		calories: 1980,
		protein: 70,
		workoutMinutes: 30,
		water: 3000,
		sleep: 420,
		steps: 8000,
		focusSessions: 4,
	});

	// Resting 1,330.25 kcal x 1.55, minus 500, at 2.0 g protein per kg.
	t.deepEqual(
		targetsOf({
			...desk,
			age: 28,
			height: 165,
			weight: 60,
			gender: "female",
			workStyle: "active",
			goal: "loseFat",
		}),
		{
			calories: 1560,
			protein: 120,
			workoutMinutes: 45,
			water: 2200,
			sleep: 420,
			steps: 8000,
			focusSessions: 4,
		},
	);

	// With body fat, Katch-McArdle: 370 + 21.6 x 59.5 kg of lean mass, x 1.2.
	t.is(targetsOf({ ...desk, bodyFat: 15 }).calories, 1990);

	// Protein stops at 2.2 g per kg, however hard the training.
	t.is(
		targetsOf({ ...desk, workStyle: "athlete", goal: "buildMuscle" }).protein,
		154,
	);
});

test("lowers the steps from 60 and lets goals win", (t) => {
	t.is(targetsOf({ ...desk, age: 65 }).steps, 7000);
	t.like(targetsOf(desk, { water: 2500, sleep: 480, focusSessions: 6 }), {
		water: 2500,
		sleep: 480,
		steps: 8000,
		focusSessions: 6,
		calories: 1980,
	});
	t.is(targetsOf(undefined, { steps: 10_000 }).steps, 10_000);
});

test("advises what is left of today, and when a target is met", (t) => {
	const messages = messagesOf("en");
	const advice = adviceOf(
		{ ...desk, goal: "buildMuscle" },
		today,
		"en",
		messages,
	);

	t.deepEqual(
		advice.map((item) => item.text),
		[
			"35 more minutes of exercise today: a strength session.",
			"110 g of protein to go today, e.g. a chicken breast has about 30 g.",
			"1,680 kcal left in today's budget.",
			"3,000 ml of water to go today, about 12 glasses.",
			"Log last night's sleep, e.g. sl 23:30-7:10.",
		],
	);

	const done = adviceOf(
		desk,
		{
			...today,
			protein: 80,
			workoutMinutes: 30,
			calories: 2500,
			water: 2500,
			sleepMinutes: 420,
		},
		"en",
		messages,
		{ water: 2500 },
	);
	t.deepEqual(
		done.map((item) => item.isDone),
		[true, true, false, true, true],
	);
	t.is(
		adviceOf(desk, { ...today, sleepMinutes: 370 }, "en", messages)[4]?.text,
		"You slept 6h 10m; aim for 7h tonight.",
	);
	t.is(
		done[2]?.text,
		"520 kcal over today's budget; keep the next meal light.",
	);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run build`
Expected: FAIL — `tsc` reports that `targetsOf` takes 1 argument and that `water` does not exist on `Targets`.

- [ ] **Step 3: Work out the targets and the advice**

Replace `source/health.ts` with:

```ts
import {
	durationOf,
	formatNumber,
	type Gender,
	type HealthGoal,
	type Language,
	type Messages,
	type WorkStyle,
} from "./i18n.js";
import type { Goals, Profile, Today } from "./progress.js";

export type Targets = Readonly<{
	calories: number;
	protein: number;
	workoutMinutes: number;
	// Milliliters, minutes, and a count.
	water: number;
	sleep: number;
	steps: number;
	focusSessions: number;
}>;

// Without a profile: the common 2,000 kcal reference, 50 g protein, and 30
// active minutes; the rest follow from the profile when there is one.
const defaultTargets: Targets = {
	calories: 2000,
	protein: 50,
	workoutMinutes: 30,
	water: 2600,
	sleep: 420,
	steps: 8000,
	focusSessions: 4,
};

// What to drink a day: the beverage share of the National Academies' adequate
// intake of 3.7 L for men and 2.7 L for women, about 80% of all water, since
// food brings the rest. "other" takes the middle.
const waterTarget: Record<Gender, number> = {
	male: 3000,
	female: 2200,
	other: 2600,
};

// Physical activity levels, from sedentary to very active.
const activityFactor: Record<WorkStyle, number> = {
	desk: 1.2,
	standing: 1.375,
	active: 1.55,
	athlete: 1.725,
};

// Mifflin-St Jeor's constant, averaged when gender is not given.
const genderConstant: Record<Gender, number> = {
	male: 5,
	female: -161,
	other: -78,
};

const calorieShift: Record<HealthGoal, number> = {
	loseFat: -500,
	maintain: 0,
	buildMuscle: 300,
	endurance: 200,
};

// Grams of protein per kilogram of body weight, within the 0.8 to 2.2 g that
// sports nutrition guidance covers.
const proteinPerKilogram: Record<HealthGoal, number> = {
	loseFat: 1.8,
	maintain: 1,
	buildMuscle: 2,
	endurance: 1.4,
};

const proteinForWork: Record<WorkStyle, number> = {
	desk: 0,
	standing: 0.1,
	active: 0.2,
	athlete: 0.3,
};

const workoutMinutes: Record<HealthGoal, number> = {
	loseFat: 45,
	maintain: 30,
	buildMuscle: 45,
	endurance: 60,
};

// The targets for the body, work style, and goal, with the user's own goals
// for water, sleep, steps, and focus winning over the defaults.
export function targetsOf(
	profile: Profile | undefined,
	goals: Goals = {},
): Targets {
	return { ...bodyTargetsOf(profile), ...goals };
}

function bodyTargetsOf(profile: Profile | undefined): Targets {
	if (!profile) {
		return defaultTargets;
	}

	const { weight, height, age, gender, workStyle, goal, bodyFat } = profile;
	// Katch-McArdle from lean mass when body fat is known, else Mifflin-St Jeor.
	const restingCalories =
		bodyFat === undefined
			? 10 * weight + 6.25 * height - 5 * age + genderConstant[gender]
			: 370 + 21.6 * weight * (1 - bodyFat / 100);
	const calories =
		restingCalories * activityFactor[workStyle] + calorieShift[goal];
	const proteinRate = Math.min(
		proteinPerKilogram[goal] + proteinForWork[workStyle],
		2.2,
	);

	return {
		calories: Math.round(Math.max(calories, 1200) / 10) * 10,
		protein: Math.round(weight * proteinRate),
		workoutMinutes: workoutMinutes[goal],
		water: waterTarget[gender],
		// 7 hours or more, as the AASM recommends for adults.
		sleep: 420,
		// Mortality stops falling at about 8,000 steps under 60, 7,000 from 60.
		steps: age < 60 ? 8000 : 7000,
		focusSessions: 4,
	};
}

export type Advice = Readonly<{ text: string; isDone: boolean }>;

// What is left of today, most pressing first.
export function adviceOf(
	profile: Profile | undefined,
	today: Today,
	language: Language,
	messages: Messages,
	goals?: Goals,
): Advice[] {
	const targets = targetsOf(profile, goals);
	const goal = profile?.goal ?? "maintain";
	const protein = targets.protein - today.protein;
	const minutes = targets.workoutMinutes - today.workoutMinutes;
	const calories = targets.calories - today.calories;
	const water = targets.water - today.water;
	const { health } = messages;
	let sleep: Advice = { text: health.sleepUnknown, isDone: false };

	if (today.sleepMinutes >= targets.sleep) {
		sleep = { text: health.sleepDone, isDone: true };
	} else if (today.sleepMinutes > 0) {
		sleep = {
			text: health.sleepShort(
				durationOf(today.sleepMinutes, messages),
				durationOf(targets.sleep, messages),
			),
			isDone: false,
		};
	}

	return [
		minutes > 0
			? {
					text: health.workoutLeft(minutes, health.suggestion[goal]),
					isDone: false,
				}
			: { text: health.workoutDone, isDone: true },
		protein > 0
			? { text: health.proteinLeft(protein), isDone: false }
			: { text: health.proteinDone, isDone: true },
		calories >= 0
			? {
					text: health.caloriesLeft(formatNumber(language, calories)),
					isDone: false,
				}
			: {
					text: health.caloriesOver(formatNumber(language, -calories)),
					isDone: false,
				},
		water > 0
			? {
					text: health.waterLeft(
						formatNumber(language, water),
						Math.ceil(water / 250),
					),
					isDone: false,
				}
			: { text: health.waterDone, isDone: true },
		sleep,
	];
}
```

Remove `export const dailyGoals = { focusSessions: 4 };` from `source/progress.ts`.

- [ ] **Step 4: Add the advice in all 3 languages**

In `source/i18n.ts`, add after `workoutDone` in the `health` section of `en`:

```ts
		waterLeft: (milliliters: string, glasses: number) =>
			`${milliliters} ml of water to go today, about ${glasses} ${glasses === 1 ? "glass" : "glasses"}.`,
		waterDone: "Water target met for today.",
		sleepUnknown: "Log last night's sleep, e.g. sl 23:30-7:10.",
		sleepShort: (slept: string, target: string) =>
			`You slept ${slept}; aim for ${target} tonight.`,
		sleepDone: "You slept enough last night.",
```

Of `traditionalChinese`:

```ts
		waterLeft: (milliliters, glasses) =>
			`今天還要喝 ${milliliters} 毫升水，大約 ${glasses} 杯。`,
		waterDone: "今天的喝水目標已達成。",
		sleepUnknown: "記錄昨晚的睡眠，例如：sl 23:30-7:10。",
		sleepShort: (slept, target) =>
			`昨晚睡了 ${slept}，今晚試著睡滿 ${target}。`,
		sleepDone: "昨晚睡得很充足。",
```

Of `korean`:

```ts
		waterLeft: (milliliters, glasses) =>
			`오늘 물을 ${milliliters}ml 더 마셔야 합니다. 약 ${glasses}잔입니다.`,
		waterDone: "오늘 물 목표를 달성했습니다.",
		sleepUnknown: "지난밤 수면을 기록하세요. 예: sl 23:30-7:10",
		sleepShort: (slept, target) =>
			`지난밤 ${slept} 잤습니다. 오늘 밤은 ${target}을 목표로 하세요.`,
		sleepDone: "지난밤 충분히 잤습니다.",
```

- [ ] **Step 5: Pass the latest profile and the goals everywhere**

In `source/content.ts`, drop the `dailyGoals` import, import `profileNow` from `./progress.js`, and:

1. In `sectionsOf`, replace `const targets = targetsOf(progress.profile);` with `const profile = profileNow(progress);` and `const targets = targetsOf(profile, progress.goals);`, pass `profile` and `progress.goals` to `adviceOf(profile, today, language, messages, progress.goals)`, and use `targets.focusSessions` in both places the Focus metric read `dailyGoals.focusSessions`.
2. In `moodOf`, use `const targets = targetsOf(profileNow(progress), progress.goals);` and `today.focusSessions >= targets.focusSessions`.
3. In `menuEntriesOf`, use `const targets = targetsOf(profileNow(state.progress), state.progress.goals);`.

In `source/app.tsx`, import `profileNow` from `./progress.js`, draw the character with `look={lookOf(profileNow(progress))}`, and in `HealthSummary` replace `const { profile } = progress;` and `targetsOf(profile)` with:

```tsx
const profile = profileNow(progress);
const targets = targetsOf(profile, progress.goals);
```

and map `adviceOf(profile, today, language, messages, progress.goals)`.

The profile form must start from the same weight, or pressing Enter through it would save the old weight as newer than the weigh-in. In `App`, pass `profileFieldsOf(messages, profileNow(progress), name)`, and in `profileFieldsOf` round the defaults, since a weigh-in may carry a decimal and the field takes whole numbers:

```ts
		// A weigh-in may carry a decimal; the field takes whole kilograms.
		defaultValue: profile ? String(Math.round(profile.weight)) : undefined,
```

```ts
		defaultValue:
			profile?.bodyFat === undefined
				? undefined
				: String(Math.round(profile.bodyFat)),
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run build && npx ava build/tests/health.test.js build/tests/data.test.js`
Expected: PASS.

- [ ] **Step 7: Run the gate and commit**

Run: `npm test`
Expected: everything passes.

```bash
git add source/health.ts source/progress.ts source/content.ts source/app.tsx source/i18n.ts source/tests/health.test.ts
git commit -m "feat: add water, sleep, steps, and focus targets with goals"
```

---

### Task 4: Carbs, Fat, and Servings for Every Food

**Files:**

- Modify: `source/foods.ts` (whole file)
- Create: `DATA-LICENSES.md`
- Modify: `package.json` (`files`)
- Test: `source/tests/foods.test.ts`

**Interfaces:**

- Consumes: `type Meal` with `carbs`, `fat`, and `servings` from Task 2
- Produces:
  - `type Food = Readonly<{ names: Record<Language, string>; calories; protein; carbs; fat; serving: Record<Language, string> }>`
  - `foodsOf(table: string): Food[]`, which reads 1 food per line: `en|zh-TW|ko|kcal|protein|carbs|fat|serving en|serving zh-TW|serving ko`
  - `commonFoods: readonly Food[]`, `commonFoodCount`
  - `type Suggestion` gaining `carbs?`, `fat?`, `serving?`; the user's own meals are now per serving
  - `matchFood(text: string, language: Language, meals: readonly Meal[]): Suggestion | undefined`

The table keeps every food's existing kcal and protein. Its carbs and fat come from the closest food in [USDA FNDDS 2021-2023](https://fdc.nal.usda.gov/download-datasets/) (CC0), scaled to the serving's kcal: grams = kcal ÷ FNDDS kcal per 100 g × 100, then carbs and fat = FNDDS per 100 g × grams ÷ 100, rounded. The FNDDS food behind each row, by `fdcId`, for review:

| Foods                                                    | FNDDS `fdcId`                                        |
| -------------------------------------------------------- | ---------------------------------------------------- |
| Chicken breast, thigh, fried chicken                     | 2705956, 2706029, 2705973                            |
| Salmon, tuna, steak, ground beef, pork chop              | 2706286, 2706311, 2705824, 2705854, 2705867          |
| Bacon, ham, sausage, shrimp, tofu                        | 2705889, 2705880, 2706191, 2706363, 2707435          |
| Egg, boiled, scrambled, omelette                         | 2707152, 2707154, 2707198, 2707200                   |
| Greek yogurt, protein shake, protein bar, cottage cheese | 2705424, 2710745, 2708124, 2705747                   |
| Milk, soy milk, cheese slice, edamame                    | 2705385, 2705404, 2705764, 2707436                   |
| White, brown, fried, and kimchi fried rice               | 2708408, 2708414, 2708952, 2708951                   |
| Oatmeal, toast, white bread, bagel, croissant            | 2708380, 2707710, 2707598, 2707684, 2707678          |
| Tomato pasta, bolognese, ramen, instant noodles, udon    | 2708826, 2708837, 2709153, 2708354, 2708352          |
| Beef noodle soup, dumplings, xiaolongbao                 | 2707124, 2708708, 2708708                            |
| Pancakes, scallion pancake, waffle, granola, cereal      | 2708304, 2708304, 2708325, 2708461, 2708445          |
| Potato, sweet potato, fries, corn, quinoa                | 2709524, 2709699, 2709461, 2709783, 2708400          |
| Wrap, cheeseburger, double burger, pizza, hot dog        | 2707017, 2706888, 2706940, 2708636, 2707056          |
| Chicken and tuna sandwich, burrito, tacos                | 2707000, 2707034, 2708534, 2708514                   |
| Sushi roll, kimbap, sashimi, poke bowl                   | 2708959, 2708959, 2706284, 2708963                   |
| Bibimbap, bulgogi bowl, tteokbokki, samgyeopsal          | 2708950, 2706497, 2708957, 2705901                   |
| Kimchi stew, soybean paste stew, miso soup, chicken soup | 2706519, 2707455, 2707455, 2707134                   |
| Braised pork rice, chicken rice, chicken leg bento       | 2706515, 2706537, 2706537                            |
| Pork buns, congee, oyster omelette, stinky tofu          | 2706975, 2708984, 2706354, 2707448                   |
| Bubble tea, latte, black coffee, green tea, smoothie     | 2710506, 2710386, 2710375, 2710490, 2705513          |
| Chicken, Caesar, and garden salad, curry rice            | 2709832, 2709591, 2709830, 2706438                   |
| Apple, banana, orange, grapes, strawberries, blueberries | 2709215, 2709224, 2709171, 2709237, 2709283, 2709275 |
| Avocado, broccoli, mixed nuts, almonds, peanut butter    | 2709223, 2710792, 2707504, 2707485, 2707537          |
| Hummus, dark chocolate, chips, ice cream, cookie, donut  | 2707402, 2710336, 2709422, 2705630, 2707909, 2708062 |
| Cheesecake, orange juice, beer, red wine, soju, kimchi   | 2707861, 2709186, 2710616, 2710688, 2710704, 2710077 |

A partial match takes the shortest name, so `rice` is white rice and `蛋` is an egg, while the user's own meals, newest first, always come before common foods.

- [ ] **Step 1: Write the failing tests**

```ts
// source/tests/foods.test.ts
import test from "ava";
import { commonFoods, foodsOf, matchFood } from "../foods.js";

// Alcohol brings 7 kcal per gram, which the 4-4-9 rule leaves out.
const alcoholic = new Set(["Beer", "Red wine", "Soju"]);

test("gives every food 3 names, a serving in 3 languages, and its macros", (t) => {
	t.is(commonFoods.length, 112);

	for (const food of commonFoods) {
		t.true(
			[...Object.values(food.names), ...Object.values(food.serving)].every(
				Boolean,
			),
			`${food.names.en} has every name and serving`,
		);
		t.true(
			[food.calories, food.protein, food.carbs, food.fat].every(
				(value) => Number.isFinite(value) && value >= 0,
			),
			`${food.names.en} has its kcal and macros`,
		);
	}
});

test("keeps every food's kcal within 20% of its protein, carbs, and fat", (t) => {
	for (const food of commonFoods.filter(
		({ names }) => !alcoholic.has(names.en),
	)) {
		const fromMacros = 4 * food.protein + 4 * food.carbs + 9 * food.fat;
		// 5 kcal of slack for drinks with almost none, like black coffee.
		t.true(
			Math.abs(food.calories - fromMacros) <= Math.max(food.calories * 0.2, 5),
			`${food.names.en}: ${food.calories} kcal against ${fromMacros}`,
		);
	}
});

test("never gives 2 foods the same name in any language", (t) => {
	const names = commonFoods.flatMap((food) =>
		Object.values(food.names).map((name) => name.toLowerCase()),
	);

	t.deepEqual(
		names.filter((name, index) => names.indexOf(name) !== index),
		[],
	);
});

test("reads a table line by line", (t) => {
	t.deepEqual(foodsOf("Egg|雞蛋|계란|72|6|0|5|1 egg|1 顆|1개\n"), [
		{
			names: { en: "Egg", "zh-TW": "雞蛋", ko: "계란" },
			calories: 72,
			protein: 6,
			carbs: 0,
			fat: 5,
			serving: { en: "1 egg", "zh-TW": "1 顆", ko: "1개" },
		},
	]);
});

test("matches the food a name means, yours first", (t) => {
	const at = "2026-10-03T08:00:00.000Z";
	const pho = {
		at,
		food: "Chicken pho",
		calories: 900,
		protein: 60,
		servings: 2,
	};

	t.like(matchFood("eggs", "en", []), {
		label: "Egg",
		calories: 72,
		serving: "1 large egg",
		isYours: false,
	});
	t.like(matchFood("雞蛋", "ko", []), { label: "계란" });
	t.like(matchFood("rice", "en", []), { label: "White rice" });
	t.like(matchFood("蛋", "zh-TW", []), { label: "雞蛋" });
	t.like(matchFood("볶음밥", "en", []), { label: "Fried rice" });
	t.like(matchFood("toast", "en", []), { label: "Whole wheat toast" });
	t.like(matchFood("chicken pho", "en", [pho]), {
		label: "Chicken pho",
		calories: 450,
		protein: 30,
		isYours: true,
	});
	t.like(matchFood("chicken breast", "en", [pho]), { isYours: false });
	t.like(matchFood("chicken", "en", [pho]), { label: "Chicken pho" });
	t.is(matchFood("zzz", "en", []), undefined);
	t.is(matchFood("  ", "en", []), undefined);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run build`
Expected: FAIL — `tsc` reports that `commonFoods`, `foodsOf`, and `matchFood` are not exported from `../foods.js`.

- [ ] **Step 3: Replace the food table**

Replace `source/foods.ts` with:

```ts
import type { Language } from "./i18n.js";
import type { Meal } from "./progress.js";

export type Food = Readonly<{
	names: Readonly<Record<Language, string>>;
	calories: number;
	protein: number;
	carbs: number;
	fat: number;
	serving: Readonly<Record<Language, string>>;
}>;

// Reads foods written 1 per line: the name in English, Traditional Chinese,
// and Korean; kcal, then grams of protein, carbs, and fat for 1 serving; and
// the serving in each language, all separated by "|".
export const foodsOf = (table: string): Food[] =>
	table
		.trim()
		.split("\n")
		.map((line) => {
			const [en = "", chinese = "", korean = "", ...rest] = line.split("|");
			const [calories, protein, carbs, fat] = rest.slice(0, 4).map(Number);
			const [servingEn = "", servingChinese = "", servingKorean = ""] =
				rest.slice(4);

			return {
				names: { en, "zh-TW": chinese, ko: korean },
				calories: calories ?? Number.NaN,
				protein: protein ?? Number.NaN,
				carbs: carbs ?? Number.NaN,
				fat: fat ?? Number.NaN,
				serving: { en: servingEn, "zh-TW": servingChinese, ko: servingKorean },
			};
		});

// Approximate, like a nutrition label. Carbs and fat follow the closest food
// in USDA FNDDS 2021-2023 (CC0), scaled to the serving's kcal; see
// DATA-LICENSES.md.
export const commonFoods: readonly Food[] = foodsOf(`
Chicken breast|雞胸肉|닭가슴살|248|46|0|5|1 breast|1 塊|1조각
Chicken thigh|雞腿肉|닭다리살|315|37|0|20|1 thigh|1 支|1조각
Fried chicken|炸雞|프라이드치킨|490|34|12|28|2 pieces|2 塊|2조각
Grilled salmon|烤鮭魚|연어구이|310|34|0|21|1 fillet|1 片|1토막
Canned tuna|鮪魚罐頭|참치캔|130|29|0|1|1 can|1 罐|1캔
Beef steak|牛排|소고기 스테이크|500|50|0|28|1 steak|1 塊|1인분
Ground beef|牛絞肉|다진 소고기|250|26|0|16|100 g|100 克|100g
Pork chop|豬排|돼지 등심 구이|330|38|0|16|1 chop|1 塊|1조각
Bacon|培根|베이컨|130|9|0|10|3 slices|3 片|3줄
Ham|火腿|햄|90|10|0|5|2 slices|2 片|2장
Sausage|香腸|소시지|300|12|1|25|1 sausage|1 根|1개
Shrimp|蝦仁|새우|150|30|2|2|10 shrimp|10 隻|10마리
Tofu|豆腐|두부|120|13|2|7|1/2 block|半盒|반 모
Egg|雞蛋|계란|72|6|0|5|1 large egg|1 顆|1개
Boiled eggs|水煮蛋|삶은 계란|155|13|1|11|2 eggs|2 顆|2개
Scrambled eggs|炒蛋|스크램블드에그|200|14|1|16|2 eggs|2 顆蛋|달걀 2개
Omelette|歐姆蛋|오믈렛|250|17|1|21|1 omelette|1 份|1개
Greek yogurt|希臘優格|그릭요거트|100|17|6|1|1 cup|1 杯|1컵
Protein shake|高蛋白飲|단백질 쉐이크|160|30|3|1|1 scoop|1 匙|1스쿱
Protein bar|蛋白棒|단백질 바|210|20|20|8|1 bar|1 條|1개
Cottage cheese|茅屋起司|코티지 치즈|220|25|12|6|1 cup|1 杯|1컵
Milk|牛奶|우유|150|8|11|8|1 cup|1 杯|1잔
Soy milk|豆漿|두유|110|8|11|4|1 cup|1 杯|1잔
Cheese slice|起司片|슬라이스 치즈|70|4|1|6|1 slice|1 片|1장
Edamame|毛豆|에다마메|190|17|12|10|1 cup|1 碗|1컵
White rice|白飯|흰쌀밥|280|5|61|1|1 bowl|1 碗|1공기
Brown rice|糙米飯|현미밥|250|5|52|2|1 bowl|1 碗|1공기
Fried rice|炒飯|볶음밥|520|14|97|10|1 plate|1 盤|1인분
Oatmeal|燕麥粥|오트밀|300|10|44|10|1 bowl|1 碗|1그릇
Whole wheat toast|全麥吐司|통밀 토스트|160|8|27|2|2 slices|2 片|2장
White bread|白吐司|식빵|150|5|28|2|2 slices|2 片|2장
Bagel|貝果|베이글|280|11|56|1|1 bagel|1 個|1개
Croissant|可頌|크루아상|230|5|26|12|1 croissant|1 個|1개
Tomato pasta|番茄義大利麵|토마토 파스타|550|18|69|22|1 plate|1 盤|1인분
Spaghetti bolognese|波隆那肉醬麵|볼로네제 스파게티|650|30|65|34|1 plate|1 盤|1인분
Ramen|拉麵|라멘|500|20|55|18|1 bowl|1 碗|1그릇
Instant noodles|泡麵|라면|500|10|50|30|1 pack|1 包|1봉지
Udon|烏龍麵|우동|400|12|73|6|1 bowl|1 碗|1그릇
Beef noodle soup|牛肉麵|우육면|600|32|44|26|1 bowl|1 碗|1그릇
Dumplings|水餃|물만두|450|18|44|18|10 dumplings|10 顆|10개
Pancakes|鬆餅|팬케이크|350|9|44|15|2 pancakes|2 片|2장
Waffle|格子鬆餅|와플|300|7|33|15|1 waffle|1 片|1개
Granola|燕麥脆片|그래놀라|500|13|80|15|1 cup|1 杯|1컵
Cereal with milk|牛奶麥片|우유 시리얼|250|9|51|3|1 bowl|1 碗|1그릇
Baked potato|烤馬鈴薯|구운 감자|160|4|36|0|1 potato|1 顆|1개
Sweet potato|地瓜|고구마|115|2|25|1|1 sweet potato|1 條|1개
French fries|薯條|감자튀김|365|4|48|17|1 medium serving|1 中份|미디엄 1개
Corn|玉米|옥수수|90|3|20|1|1 ear|1 根|1개
Quinoa|藜麥|퀴노아|220|8|39|4|1 cup|1 碗|1컵
Chicken wrap|雞肉捲餅|치킨 랩|450|25|31|19|1 wrap|1 份|1개
Cheeseburger|起司漢堡|치즈버거|300|15|19|16|1 burger|1 個|1개
Double burger|雙層漢堡|더블 버거|550|30|20|34|1 burger|1 個|1개
Pepperoni pizza|臘腸披薩|페퍼로니 피자|600|26|61|29|2 slices|2 片|2조각
Hot dog|熱狗|핫도그|290|10|23|17|1 hot dog|1 個|1개
Chicken sandwich|雞肉三明治|치킨 샌드위치|450|28|44|22|1 sandwich|1 個|1개
Tuna sandwich|鮪魚三明治|참치 샌드위치|400|22|34|22|1 sandwich|1 個|1개
Burrito|墨西哥捲|부리토|700|30|76|27|1 burrito|1 個|1개
Tacos|塔可|타코|350|16|22|19|2 tacos|2 個|2개
Sushi roll|壽司捲|초밥 롤|350|12|69|2|1 roll, 8 pieces|1 條，8 塊|1줄, 8조각
Salmon sashimi|鮭魚生魚片|연어회|230|25|0|14|1 plate|1 盤|1접시
Bibimbap|韓式拌飯|비빔밥|560|20|60|18|1 bowl|1 碗|1그릇
Kimchi fried rice|泡菜炒飯|김치볶음밥|520|12|97|10|1 plate|1 盤|1인분
Bulgogi rice bowl|韓式烤牛肉飯|불고기 덮밥|650|32|29|38|1 bowl|1 碗|1그릇
Kimbap|韓式飯捲|김밥|480|14|94|3|1 roll|1 條|1줄
Tteokbokki|辣炒年糕|떡볶이|450|8|67|14|1 serving|1 份|1인분
Samgyeopsal|烤五花肉|삼겹살|750|25|0|60|1 serving|1 份|1인분
Kimchi stew|泡菜鍋|김치찌개|300|18|17|15|1 bowl|1 碗|1그릇
Soybean paste stew|大醬湯|된장찌개|200|14|19|7|1 bowl|1 碗|1그릇
Braised pork rice|滷肉飯|루러우판|550|18|65|19|1 bowl|1 碗|1그릇
Hainanese chicken rice|海南雞飯|하이난 치킨라이스|600|30|68|24|1 plate|1 盤|1인분
Chicken leg bento|雞腿便當|닭다리 도시락|800|40|91|31|1 box|1 個|1개
Scallion pancake|蔥油餅|파전|400|7|50|17|1 pancake|1 片|1장
Xiaolongbao|小籠包|샤오룽바오|400|18|39|16|8 dumplings|8 顆|8개
Steamed pork buns|肉包|고기 찐빵|500|18|51|18|2 buns|2 個|2개
Century egg congee|皮蛋瘦肉粥|피단 죽|300|15|35|10|1 bowl|1 碗|1그릇
Oyster omelette|蚵仔煎|굴전|500|18|34|33|1 plate|1 盤|1접시
Stinky tofu|臭豆腐|취두부|400|18|13|30|1 serving|1 份|1인분
Bubble tea|珍珠奶茶|버블티|450|4|79|9|1 large cup|1 大杯|큰 컵 1잔
Chicken salad|雞肉沙拉|닭가슴살 샐러드|350|30|10|16|1 bowl|1 碗|1그릇
Caesar salad|凱薩沙拉|시저 샐러드|450|10|44|20|1 bowl|1 碗|1그릇
Garden salad|田園沙拉|그린 샐러드|150|4|14|7|1 bowl|1 碗|1그릇
Poke bowl|夏威夷生魚飯|포케|600|30|89|7|1 bowl|1 碗|1그릇
Curry rice|咖哩飯|카레라이스|700|20|91|24|1 plate|1 盤|1인분
Chicken soup|雞湯|닭고기 수프|250|20|25|7|1 bowl|1 碗|1그릇
Miso soup|味噌湯|미소 된장국|40|3|4|1|1 bowl|1 碗|1그릇
Apple|蘋果|사과|95|0|23|0|1 apple|1 顆|1개
Banana|香蕉|바나나|105|1|25|0|1 banana|1 根|1개
Orange|柳橙|오렌지|62|1|15|0|1 orange|1 顆|1개
Grapes|葡萄|포도|105|1|25|0|1 cup|1 碗|1컵
Strawberries|草莓|딸기|50|1|11|0|1 cup|1 碗|1컵
Blueberries|藍莓|블루베리|85|1|19|0|1 cup|1 碗|1컵
Avocado|酪梨|아보카도|160|2|9|15|1/2 avocado|半顆|반 개
Broccoli|花椰菜|브로콜리|55|4|9|0|1 cup|1 碗|1컵
Mixed nuts|綜合堅果|견과류|175|5|6|15|1 handful|1 把|한 줌
Almonds|杏仁|아몬드|165|6|6|14|1 handful|1 把|한 줌
Peanut butter|花生醬|땅콩버터|190|7|7|16|2 tbsp|2 大匙|2큰술
Hummus|鷹嘴豆泥|후무스|100|5|6|7|3 tbsp|3 大匙|3큰술
Dark chocolate|黑巧克力|다크 초콜릿|170|2|19|10|30 g|30 克|30g
Potato chips|洋芋片|감자칩|150|2|15|10|1 small bag|1 小包|작은 봉지 1개
Ice cream|冰淇淋|아이스크림|270|5|31|14|1 cup|1 杯|1컵
Cookie|餅乾|쿠키|150|2|20|8|2 cookies|2 片|2개
Donut|甜甜圈|도넛|260|3|30|14|1 donut|1 個|1개
Cheesecake|起司蛋糕|치즈케이크|400|7|35|27|1 slice|1 片|1조각
Smoothie|果昔|스무디|250|5|45|4|1 cup|1 杯|1잔
Orange juice|柳橙汁|오렌지 주스|110|2|24|1|1 cup|1 杯|1잔
Latte|拿鐵|라테|190|12|19|7|1 large cup|1 大杯|큰 컵 1잔
Black coffee|黑咖啡|블랙커피|5|0|0|0|1 cup|1 杯|1잔
Green tea|綠茶|녹차|0|0|0|0|1 cup|1 杯|1잔
Beer|啤酒|맥주|150|2|12|0|1 can|1 罐|1캔
Red wine|紅酒|레드 와인|125|0|4|0|1 glass|1 杯|1잔
Soju|燒酒|소주|400|0|0|0|1 bottle|1 瓶|1병
Kimchi|泡菜|김치|20|1|3|1|1 side dish|1 小碟|1접시
`);

export const commonFoodCount = commonFoods.length;

export type Suggestion = Readonly<{
	label: string;
	calories?: number;
	protein?: number;
	carbs?: number;
	fat?: number;
	serving?: string;
	isYours: boolean;
}>;

// A past meal per serving, since its amounts are totals for all its servings.
const yoursOf = (meal: Meal): Suggestion => {
	const per = (value: number | undefined) =>
		value === undefined ? undefined : value / (meal.servings ?? 1);

	return {
		label: meal.food,
		calories: per(meal.calories),
		protein: per(meal.protein),
		carbs: per(meal.carbs),
		fat: per(meal.fat),
		isYours: true,
	};
};

const commonOf = (food: Food, language: Language): Suggestion => ({
	label: food.names[language],
	calories: food.calories,
	protein: food.protein,
	carbs: food.carbs,
	fat: food.fat,
	serving: food.serving[language],
	isYours: false,
});

// The user's own meals come first, newest first, then common foods; both
// match anywhere in the name, in any language, ignoring case.
export function foodSuggestions(
	text: string,
	language: Language,
	meals: readonly Meal[],
	limit = 5,
): Suggestion[] {
	const query = text.trim().toLowerCase();
	const matches = (names: readonly string[]) =>
		names.some((name) => name.toLowerCase().includes(query));
	const seen = new Set<string>();
	const results: Suggestion[] = [];
	const add = (suggestion: Suggestion) => {
		const key = suggestion.label.toLowerCase();

		if (!seen.has(key) && results.length < limit) {
			seen.add(key);
			results.push(suggestion);
		}
	};

	for (const meal of meals.toReversed()) {
		if (matches([meal.food])) {
			add(yoursOf(meal));
		}
	}

	if (!query) {
		return results;
	}

	for (const food of commonFoods) {
		if (matches(Object.values(food.names))) {
			add(commonOf(food, language));
		}
	}

	return results;
}

// The 1 food a typed name means: an exact name before a partial one, and the
// user's own meals before common foods. A partial match takes the shortest
// name, so "rice" is white rice and "蛋" is an egg.
export function matchFood(
	text: string,
	language: Language,
	meals: readonly Meal[],
): Suggestion | undefined {
	const query = text.trim().toLowerCase();

	if (!query) {
		return undefined;
	}

	// A plural may name a singular food, and the other way around.
	// ponytail: only a final "s" or "es" comes off, so irregular plurals such
	// as "berries" fall through to the partial match; add a stemmer if needed.
	const forms = new Set([
		query,
		query.replace(/s$/v, ""),
		query.replace(/es$/v, ""),
		`${query}s`,
	]);
	const isExact = (name: string) => forms.has(name.toLowerCase());
	const isPartial = (name: string) => name.toLowerCase().includes(query);
	const yours = meals.toReversed();
	const shortest = (isMatch: (name: string) => boolean) =>
		commonFoods
			.map((food) => ({
				food,
				length: Math.min(
					...Object.values(food.names)
						.filter((name) => isMatch(name))
						.map((name) => name.length),
				),
			}))
			.filter(({ length }) => Number.isFinite(length))
			.toSorted((left, right) => left.length - right.length)[0]?.food;
	const exactMeal = yours.find((meal) => isExact(meal.food));

	if (exactMeal) {
		return yoursOf(exactMeal);
	}

	const exactFood = shortest(isExact);

	if (exactFood) {
		return commonOf(exactFood, language);
	}

	const partialMeal = yours.find((meal) => isPartial(meal.food));

	if (partialMeal) {
		return yoursOf(partialMeal);
	}

	const partialFood = shortest(isPartial);
	return partialFood ? commonOf(partialFood, language) : undefined;
}
```

- [ ] **Step 4: Credit the data and ship the credits**

Create `DATA-LICENSES.md`:

```markdown
# Data Licenses

Terminal-Sigma bundles nutrition and exercise data from public sources whose terms allow redistribution inside an MIT package. Each source below names where its data lives and what its license asks for:

| Source                                                                                | License                                                                     | Used In                                                       |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [2024 Adult Compendium of Physical Activities](https://pacompendium.com/)             | Free to use with the citation below, values unchanged                       | The MET values in `source/exercises.ts`                       |
| [USDA FoodData Central, FNDDS 2021-2023](https://fdc.nal.usda.gov/download-datasets/) | [CC0 1.0](https://catalog.data.gov/dataset/fooddata-central), public domain | The carbs and fat of the first 112 foods in `source/foods.ts` |

## Citations

Each source asks for this credit wherever its values appear:

- **2024 Adult Compendium of Physical Activities**: Herrmann SD, Willis EA, Ainsworth BE, et al. 2024 Adult Compendium of Physical Activities: A third update of the energy costs of human activities. _Journal of Sport and Health Science_ 2024;13(1):6-12

The Taiwan FDA food composition set (Open Government Data License 1.0, attribution required) and the Korea MFDS everyday foods (no restriction) may also ship; add them to the table above, with the attribution Taiwan's license asks for, in the commit that first uses them.
```

In `package.json`, add `"DATA-LICENSES.md"` after `"!build/tests/"` in `files`, so NPM ships it beside `LICENSE.md`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run build && npx ava build/tests/foods.test.js build/tests/data.test.js`
Expected: PASS, including the existing food suggestion and autocomplete tests, which still see Chicken breast at 248 kcal and 46 g.

- [ ] **Step 6: Run the gate and commit**

Run: `npm test`
Expected: everything passes.

```bash
git add source/foods.ts source/tests/foods.test.ts DATA-LICENSES.md package.json
git commit -m "feat: add carbs, fat, and servings to the common foods"
```

---

### Task 5: Parse Meals and the Time of a Line

**Files:**

- Create: `source/quick-log.ts`
- Modify: `source/i18n.ts` (a new `log` section in all 3 languages)
- Test: `source/tests/quick-log.test.ts`

**Interfaces:**

- Consumes: `matchFood` from Task 4; `type EntryOf`, `type Goals`, `type Progress` from Task 2
- Produces:
  - `type ParseContext = Readonly<{ progress: Progress; now: number; language: Language }>`
  - `type MealDraft = Readonly<{ kind: "meal"; at: string; food: string; servings: number; calories?; protein?; carbs?; fat?; isKnown: boolean }>`, `type GoalDraft = Readonly<{ kind: "goal"; at: string; goal: keyof Goals; value: number }>`
  - `type Draft`: `MealDraft`, `GoalDraft`, or `{ kind } & EntryOf[kind]` for `workout`, `water`, `sleep`, `body`, `mood`, `habit`, `steps`, and `note`
  - `parseErrors`, `type ParseError` (codes, never text), `type ParseResult = { ok: true; drafts: Draft[] } | { ok: false; error: ParseError }`
  - `parseQuickLog(text: string, context: ParseContext): ParseResult`
  - `messages.log.quickAdd`

The line is normalized to NFKC first, so full-width letters, digits, spaces, and the comma `，` from a Chinese or Korean input method read as ASCII, and `½` becomes `1⁄2`. A time prefix comes first: `@y`, `@-2d`, `@7:30`, `@y21:00`, or `@y 21:00`, in local time; a clock time later than now with no day means yesterday. A line with no prefix is a meal, its items split on `,`, `+`, and `、`. An item's quantity leads (`2 eggs`, `½ avocado`, `2個雞蛋`) or trails with a counter word (`계란 2개`, `ramen x2`). Typed amounts (`450kcal`, `30p`, `20c`, `10f`) are totals and win outright, keeping the name as typed; otherwise a known food gives its serving × the quantity, and an unknown one is logged without amounts but marked `isKnown: false`. The prefixes of the other kinds join the `parsers` record in Tasks 6 to 8.

- [ ] **Step 1: Write the failing tests**

```ts
// source/tests/quick-log.test.ts
import test from "ava";
import type { Language } from "../i18n.js";
import { type Progress, progressSchema } from "../progress.js";
import { type Draft, type ParseError, parseQuickLog } from "../quick-log.js";

// Noon on 3 October 2026, local time, so the cases hold in any time zone.
const local = (hour: number, minute = 0, day = 3) =>
	new Date(2026, 9, day, hour, minute).toISOString();
const now = Date.parse(local(12));
const empty = progressSchema.parse({ language: "en" });

const parse = (
	line: string,
	{
		progress = empty,
		language = "en",
		at = now,
	}: { progress?: Progress; language?: Language; at?: number } = {},
): Draft[] | ParseError => {
	const result = parseQuickLog(line, { progress, now: at, language });
	return result.ok ? result.drafts : result.error;
};

type Case = readonly [line: string, expected: Draft[] | ParseError];

const check = (
	t: {
		deepEqual: (actual: unknown, expected: unknown, message: string) => void;
	},
	cases: readonly Case[],
	options?: Parameters<typeof parse>[1],
) => {
	for (const [line, expected] of cases) {
		t.deepEqual(parse(line, options), expected, line);
	}
};

const meal = (fields: Partial<Extract<Draft, { kind: "meal" }>>) => ({
	kind: "meal" as const,
	at: local(12),
	servings: 1,
	isKnown: true,
	food: "",
	...fields,
});
test("parses meals: quantities, known foods, and typed amounts", (t) => {
	check(t, [
		[
			"2 eggs, toast, coffee",
			[
				meal({
					food: "Egg",
					servings: 2,
					calories: 144,
					protein: 12,
					carbs: 0,
					fat: 10,
				}),
				meal({
					food: "Whole wheat toast",
					calories: 160,
					protein: 8,
					carbs: 27,
					fat: 2,
				}),
				meal({
					food: "Black coffee",
					calories: 5,
					protein: 0,
					carbs: 0,
					fat: 0,
				}),
			],
		],
		["450kcal 30p", [meal({ food: "Quick add", calories: 450, protein: 30 })]],
		[
			"ramen 500kcal 20c 10f",
			[meal({ food: "ramen", calories: 500, carbs: 20, fat: 10 })],
		],
		["mystery stew", [meal({ food: "mystery stew", isKnown: false })]],
		[
			"1/2 avocado",
			[
				meal({
					food: "Avocado",
					servings: 0.5,
					calories: 80,
					protein: 1,
					carbs: 4.5,
					fat: 7.5,
				}),
			],
		],
		[
			"½ avocado",
			[
				meal({
					food: "Avocado",
					servings: 0.5,
					calories: 80,
					protein: 1,
					carbs: 4.5,
					fat: 7.5,
				}),
			],
		],
		[
			"ramen x2 + 2 cookies",
			[
				meal({
					food: "Ramen",
					servings: 2,
					calories: 1000,
					protein: 40,
					carbs: 110,
					fat: 36,
				}),
				meal({
					food: "Cookie",
					servings: 2,
					calories: 300,
					protein: 4,
					carbs: 40,
					fat: 16,
				}),
			],
		],
		["0 eggs", "badNumber"],
		["   ", "empty"],
	]);
});

test("parses meals in Chinese and Korean, even in full width", (t) => {
	check(
		t,
		[
			[
				"２個雞蛋，吐司",
				[
					meal({
						food: "雞蛋",
						servings: 2,
						calories: 144,
						protein: 12,
						carbs: 0,
						fat: 10,
					}),
					meal({
						food: "白吐司",
						calories: 150,
						protein: 5,
						carbs: 28,
						fat: 2,
					}),
				],
			],
			[
				"牛肉麵、珍珠奶茶",
				[
					meal({
						food: "牛肉麵",
						calories: 600,
						protein: 32,
						carbs: 44,
						fat: 26,
					}),
					meal({
						food: "珍珠奶茶",
						calories: 450,
						protein: 4,
						carbs: 79,
						fat: 9,
					}),
				],
			],
		],
		{ language: "zh-TW" },
	);
	check(
		t,
		[
			[
				"계란 2개 + 김치",
				[
					meal({
						food: "계란",
						servings: 2,
						calories: 144,
						protein: 12,
						carbs: 0,
						fat: 10,
					}),
					meal({ food: "김치", calories: 20, protein: 1, carbs: 3, fat: 1 }),
				],
			],
			[
				"떡볶이 1인분",
				[
					meal({
						food: "떡볶이",
						calories: 450,
						protein: 8,
						carbs: 67,
						fat: 14,
					}),
				],
			],
			["450kcal", [meal({ food: "빠른 기록", calories: 450 })]],
		],
		{ language: "ko" },
	);
});

test("puts an entry at the time it names, in local time", (t) => {
	const quick = (at: string) => [
		meal({ at, food: "Quick add", calories: 450 }),
	];

	check(t, [
		["@y 21:00 450kcal", quick(local(21, 0, 2))],
		["@y21:00 450kcal", quick(local(21, 0, 2))],
		["@-2d 7:30 450kcal", quick(local(7, 30, 1))],
		["@7:30 450kcal", quick(local(7, 30))],
		["@y 450kcal", quick(local(12, 0, 2))],
		["@23:00 450kcal", quick(local(23, 0, 2))],
		["@25:00 450kcal", "badTime"],
		["@yesterday 450kcal", "badTime"],
		["@ 450kcal", "badTime"],
		["@y", "empty"],
	]);
});

test("puts a time typed after midnight on yesterday", (t) => {
	t.deepEqual(parse("@23:00 450kcal", { at: Date.parse(local(0, 20, 4)) }), [
		meal({ at: local(23, 0, 3), food: "Quick add", calories: 450 }),
	]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run build`
Expected: FAIL — `tsc` reports `Cannot find module '../quick-log.js'`.

- [ ] **Step 3: Name a quick add in all 3 languages**

In `source/i18n.ts`, add a `log` section right above `logs`: `log: { quickAdd: "Quick add" },` in `en`, `log: { quickAdd: "快速記錄" },` in `traditionalChinese`, and `log: { quickAdd: "빠른 기록" },` in `korean`. The Log view's strings join this section in later tasks.

- [ ] **Step 4: Write the parser**

```ts
// source/quick-log.ts
import { matchFood } from "./foods.js";
import { type Language, messagesOf } from "./i18n.js";
import type { EntryOf, Goals, Progress } from "./progress.js";
export type ParseContext = Readonly<{
	progress: Progress;
	now: number;
	language: Language;
}>;

type Flat<Kind extends keyof EntryOf> = Readonly<
	{ kind: Kind } & EntryOf[Kind]
>;

// Amounts are totals for all the servings, like the meal they become.
export type MealDraft = Readonly<{
	kind: "meal";
	at: string;
	food: string;
	servings: number;
	calories?: number;
	protein?: number;
	carbs?: number;
	fat?: number;
	// False for a food nobody knows and no kcal were typed for.
	isKnown: boolean;
}>;

export type GoalDraft = Readonly<{
	kind: "goal";
	at: string;
	goal: keyof Goals;
	value: number;
}>;

export type Draft =
	| MealDraft
	| Flat<"workout">
	| Flat<"water">
	| Flat<"sleep">
	| Flat<"body">
	| Flat<"mood">
	| Flat<"habit">
	| Flat<"steps">
	| Flat<"note">
	| GoalDraft;

// Codes, never text: the view says each one in the language on now.
export const parseErrors = [
	"empty",
	"badTime",
	"badNumber",
	"outOfRange",
	"badSleep",
	"badMood",
	"badGoal",
	"noMinutes",
	"noPreviousSets",
	"nothingToRepeat",
	"nothingToCopy",
	"tooLong",
] as const;
export type ParseError = (typeof parseErrors)[number];

export type ParseResult =
	| Readonly<{ ok: true; drafts: Draft[] }>
	| Readonly<{ ok: false; error: ParseError }>;

const failed = (error: ParseError): ParseResult => ({ ok: false, error });
const parsed = (...drafts: Draft[]): ParseResult => ({ ok: true, drafts });

// "72.4", "1/2", and "½", which NFKC turns into "1⁄2".
function amountOf(text: string): number | undefined {
	const fraction = /^(?<top>\d+)[\/⁄](?<bottom>\d+)$/v.exec(text);

	if (fraction?.groups) {
		return Number(fraction.groups.top) / Number(fraction.groups.bottom);
	}

	return /^\d+(?:\.\d+)?$/v.test(text) ? Number(text) : undefined;
}

// "@y", "@-2d", "@7:30", "@y21:00", or "@y 21:00", in local time; a clock
// time later than now with no day means yesterday, like a sleep past midnight.
function timeOf(
	line: string,
	now: number,
): { at: number; rest: string } | undefined {
	if (!line.startsWith("@")) {
		return { at: now, rest: line };
	}

	const match =
		/^@(?<day>y|-\d+d)? ?(?:(?<hour>\d{1,2}):(?<minute>\d{2}))?(?: |$)/v.exec(
			line,
		);
	const { day, hour, minute } = match?.groups ?? {};

	if (
		!match ||
		(!day && hour === undefined) ||
		Number(hour ?? 0) > 23 ||
		Number(minute ?? 0) > 59
	) {
		return undefined;
	}

	const date = new Date(now);
	date.setDate(
		date.getDate() - (day === "y" ? 1 : Number(day?.slice(1, -1) ?? 0)),
	);

	if (hour !== undefined) {
		date.setHours(Number(hour), Number(minute), 0, 0);

		if (!day && date.getTime() > now) {
			date.setDate(date.getDate() - 1);
		}
	}

	return { at: date.getTime(), rest: line.slice(match[0].length).trim() };
}

// The text after the prefix, when it was logged, the context, and the prefix.
type Parser = (
	text: string,
	at: number,
	context: ParseContext,
	prefix: string,
) => ParseResult;

// 1 line of the Log view into drafts. ASCII prefixes choose the kind, so they
// still work through a Chinese or Korean input method; no prefix is a meal.
export function parseQuickLog(
	text: string,
	context: ParseContext,
): ParseResult {
	// Full-width letters, digits, spaces, and commas from an input method.
	const line = text.normalize("NFKC").replaceAll(/\s+/gv, " ").trim();

	if (!line) {
		return failed("empty");
	}

	const timed = timeOf(line, context.now);

	if (!timed) {
		return failed("badTime");
	}

	if (!timed.rest) {
		return failed("empty");
	}

	const [word = "", ...words] = timed.rest.split(" ");
	const parser = parsers[word.toLowerCase()];

	return parser
		? parser(words.join(" "), timed.at, context, word.toLowerCase())
		: mealsOf(timed.rest, timed.at, context);
}

const iso = (at: number) => new Date(at).toISOString();

// Words that may follow a quantity, as in "2個", "1 碗", "2개", or "1 공기".
const counter = String.raw`공기|그릇|인분|조각|마리|[個颗顆杯碗片份塊條根盤隻개잔장병캔]`;
const quantity = String.raw`\d+[\/⁄]\d+|\d+(?:\.\d+)?`;
const leadingQuantity = new RegExp(
	String.raw`^(?<amount>${quantity}) ?(?:${counter}|[x×](?= ))? ?(?<food>.+)$`,
	"v",
);
const trailingQuantity = new RegExp(
	String.raw`^(?<food>.+?) ?(?:(?<amount>${quantity}) ?(?:${counter})|[x×](?<times>\d+))$`,
	"v",
);
const macroPattern =
	/(?<value>\d+(?:\.\d+)?) ?(?<unit>kcal|cal|大卡|p|c|f)(?![\p{L}\p{N}])/giv;
const macroOf: Partial<
	Record<string, "calories" | "protein" | "carbs" | "fat">
> = {
	kcal: "calories",
	cal: "calories",
	大卡: "calories",
	p: "protein",
	c: "carbs",
	f: "fat",
};

const kilocalories = (value: number) => Math.round(value);
const grams = (value: number) => Math.round(value * 10) / 10;

// 1 item of a meal: "2 eggs", "雞蛋2顆", "ramen 500kcal", or "450kcal 30p".
// Typed amounts are totals and win outright; otherwise a known food gives its
// serving × the quantity, and an unknown one logs with no amounts at all.
function mealOf(
	item: string,
	at: number,
	{ progress, language }: ParseContext,
): MealDraft | undefined {
	const typed: Partial<
		Record<"calories" | "protein" | "carbs" | "fat", number>
	> = {};

	for (const { groups } of item.matchAll(macroPattern)) {
		const field = macroOf[groups?.unit?.toLowerCase() ?? ""];

		if (field) {
			typed[field] = Number(groups?.value);
		}
	}

	const rest = item.replaceAll(macroPattern, "").replaceAll(/ +/gv, " ").trim();
	const {
		amount,
		times,
		food = rest,
	} = (leadingQuantity.exec(rest) ?? trailingQuantity.exec(rest))?.groups ?? {};
	const servings = amountOf(amount ?? times ?? "1");
	const hasTyped = Object.keys(typed).length > 0;

	if (servings === undefined || servings <= 0 || (!food && !hasTyped)) {
		return undefined;
	}

	const base = { kind: "meal", at: iso(at), servings } as const;

	if (hasTyped) {
		return {
			...base,
			food: food || messagesOf(language).log.quickAdd,
			...typed,
			isKnown: true,
		};
	}

	const match = matchFood(food, language, progress.meals);

	if (!match) {
		return { ...base, food, isKnown: false };
	}

	const scaled = (
		value: number | undefined,
		round: (value: number) => number,
	) => (value === undefined ? undefined : round(value * servings));

	return {
		...base,
		food: match.label,
		calories: scaled(match.calories, kilocalories),
		protein: scaled(match.protein, grams),
		carbs: scaled(match.carbs, grams),
		fat: scaled(match.fat, grams),
		isKnown: true,
	};
}

// Items split on "," "+" "、", and "，", which NFKC already made ",".
function mealsOf(text: string, at: number, context: ParseContext): ParseResult {
	const drafts = text
		.split(/[,+、]/v)
		.map((item) => item.trim())
		.filter(Boolean)
		.map((item) => mealOf(item, at, context));

	return drafts.every((draft): draft is MealDraft => draft !== undefined)
		? parsed(...drafts)
		: failed("badNumber");
}
// The prefix of a line picks its parser; a line without 1 is a meal.
const parsers: Partial<Record<string, Parser>> = {};
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run build && npx ava build/tests/quick-log.test.js`
Expected: PASS, 4 tests.

- [ ] **Step 6: Run the gate and commit**

Run: `npm test`
Expected: everything passes.

```bash
git add source/quick-log.ts source/i18n.ts source/tests/quick-log.test.ts
git commit -m "feat: parse meals and their time from 1 line"
```

---

### Task 6: Parse Water, Body, Sleep, Mood, Habits, Steps, Notes, and Goals

**Files:**

- Modify: `source/quick-log.ts` (insert above the `parsers` record at the end, and replace the record)
- Test: `source/tests/quick-log.test.ts`

**Interfaces:**

- Consumes: Task 5
- Produces: the prefixes `w`, `wt`, `waist`, `bf`, `sl`, `m`, `h`, `st`, `n`, and `goal`; internal helpers `minutesOf`, `millilitersOf`, and `wholeOf`, which Task 7 reuses

The grammar: `w` is a 250 ml glass, `w 500` and `w 500ml` milliliters, `w 0.5l` liters, and `w 2 glasses` (or `杯`, `잔`, `cups`) glasses of 250 ml; `wt 72.4`, `waist 82`, and `bf 18` combine on 1 line; `sl 23:30-7:10 q4` stamps the wake time and counts across midnight, while `sl 7.5h q3`, `sl 7h30m`, or `sl 7시간` woke up now; `m 4 e3 s2 #work` is the mood, energy, stress, and tags; `h read`, `h read 30`, and `h read s` (skipped) reuse the spelling a habit was first logged with; `st 8400` or `st 8,400`; `n` and any text up to 2,000 characters; `goal water 2.5l`, `goal sleep 8h`, `goal steps 9000`, and `goal focus 6`, each within the schema's range.

- [ ] **Step 1: Write the failing tests**

Append to `source/tests/quick-log.test.ts`:

```ts
test("parses water, body, sleep, mood, habits, steps, notes, and goals", (t) => {
	const at = local(12);

	check(t, [
		["w", [{ kind: "water", at, milliliters: 250 }]],
		["w 500", [{ kind: "water", at, milliliters: 500 }]],
		["W 500ml", [{ kind: "water", at, milliliters: 500 }]],
		["w 0.5l", [{ kind: "water", at, milliliters: 500 }]],
		["w 2 glasses", [{ kind: "water", at, milliliters: 500 }]],
		["w 2杯", [{ kind: "water", at, milliliters: 500 }]],
		["ｗ　５００", [{ kind: "water", at, milliliters: 500 }]],
		["w lots", "badNumber"],
		["w 6000", "outOfRange"],
		["wt 72.4", [{ kind: "body", at, weight: 72.4 }]],
		["waist 82", [{ kind: "body", at, waist: 82 }]],
		["bf 18", [{ kind: "body", at, bodyFat: 18 }]],
		["wt 72.4kg bf 18%", [{ kind: "body", at, weight: 72.4, bodyFat: 18 }]],
		["wt 500", "outOfRange"],
		["wt 72 bf", "badNumber"],
		[
			"sl 23:30-7:10 q4",
			[{ kind: "sleep", at: local(7, 10), minutes: 460, quality: 4 }],
		],
		["sl 7.5h q3", [{ kind: "sleep", at, minutes: 450, quality: 3 }]],
		["sl 7h30m", [{ kind: "sleep", at, minutes: 450 }]],
		["sl 7시간", [{ kind: "sleep", at, minutes: 420 }]],
		["sl 7.5h q9", "badSleep"],
		["sl 25:00-7:00", "badSleep"],
		["sl", "badSleep"],
		[
			"m 4 e3 s2 #work #friends",
			[
				{
					kind: "mood",
					at,
					score: 4,
					energy: 3,
					stress: 2,
					tags: ["work", "friends"],
				},
			],
		],
		["m 2", [{ kind: "mood", at, score: 2 }]],
		["m 6", "badMood"],
		["m 4 great", "badMood"],
		["h read", [{ kind: "habit", at, name: "read" }]],
		["h read 30", [{ kind: "habit", at, name: "read", amount: 30 }]],
		["h read s", [{ kind: "habit", at, name: "read", skipped: true }]],
		["h no sugar", [{ kind: "habit", at, name: "no sugar" }]],
		["h", "empty"],
		["st 8400", [{ kind: "steps", at, count: 8400 }]],
		["st 8,400", [{ kind: "steps", at, count: 8400 }]],
		["st 0", "outOfRange"],
		["st many", "badNumber"],
		[
			"n grateful for the sun",
			[{ kind: "note", at, text: "grateful for the sun" }],
		],
		["n", "empty"],
		[`n ${"a".repeat(2001)}`, "tooLong"],
		["goal water 2.5l", [{ kind: "goal", at, goal: "water", value: 2500 }]],
		["goal sleep 8h", [{ kind: "goal", at, goal: "sleep", value: 480 }]],
		["goal steps 9000", [{ kind: "goal", at, goal: "steps", value: 9000 }]],
		["goal focus 6", [{ kind: "goal", at, goal: "focusSessions", value: 6 }]],
		["goal water 20l", "outOfRange"],
		["goal mood 5", "badGoal"],
		["goal steps lots", "badNumber"],
	]);
});

test("puts a sleep logged after midnight on the morning it ended", (t) => {
	t.deepEqual(parse("sl 23:30-7:10", { at: Date.parse(local(0, 20, 4)) }), [
		{ kind: "sleep", at: local(7, 10, 3), minutes: 460 },
	]);
});

test("reuses the spelling of a habit logged before", (t) => {
	const progress = progressSchema.parse({
		habits: [{ at: local(8, 0, 2), name: "Read" }],
	});

	t.deepEqual(parse("h read", { progress }), [
		{ kind: "habit", at: local(12), name: "Read" },
	]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run build && npx ava build/tests/quick-log.test.js`
Expected: FAIL — `w 500` parses as an unknown meal named "w 500".

- [ ] **Step 3: Write the prefix parsers**

In `source/quick-log.ts`, insert above the `parsers` record at the end:

```ts
const isWithin = (value: number, minimum: number, maximum: number) =>
	value >= minimum && value <= maximum;

// "7.5h", "7h30m", "450m", "30min", "30분", "7小時", or a bare "450".
function minutesOf(text: string): number | undefined {
	if (/^\d+(?:\.\d+)?$/v.test(text)) {
		return Number(text);
	}

	const { hours, minutes } =
		/^(?:(?<hours>\d+(?:\.\d+)?)(?:h|시간|小時))?(?:(?<minutes>\d+(?:\.\d+)?)(?:m(?:in)?|분|分鐘?))?$/iv.exec(
			text,
		)?.groups ?? {};

	return hours === undefined && minutes === undefined
		? undefined
		: Number(hours ?? 0) * 60 + Number(minutes ?? 0);
}

// "500", "500ml", "0.5l", or "2 glasses", where a glass, cup, 杯, or 잔 is 250 ml.
function millilitersOf(text: string): number | undefined {
	const { value = "", unit = "ml" } =
		/^(?<value>[\d.\/⁄]+) ?(?<unit>ml|l|glass(?:es)?|cups?|杯|잔)?$/iv.exec(
			text,
		)?.groups ?? {};
	const amount = amountOf(value);
	const glass = /^(?:ml|l)$/iv.test(unit) ? undefined : 250;

	if (amount === undefined) {
		return undefined;
	}

	return Math.round(
		amount * (glass ?? (unit.toLowerCase() === "l" ? 1000 : 1)),
	);
}

const wholeOf = (text: string) =>
	/^\d+$/v.test(text.replaceAll(",", ""))
		? Number(text.replaceAll(",", ""))
		: undefined;

const water: Parser = (text, at) => {
	const milliliters = text ? millilitersOf(text) : 250;

	if (milliliters === undefined) {
		return failed("badNumber");
	}

	return isWithin(milliliters, 1, 5000)
		? parsed({ kind: "water", at: iso(at), milliliters })
		: failed("outOfRange");
};

const bodyFields: Partial<
	Record<string, readonly ["weight" | "waist" | "bodyFat", number, number]>
> = {
	wt: ["weight", 30, 300],
	waist: ["waist", 40, 250],
	bf: ["bodyFat", 3, 60],
};

// "wt 72.4", "waist 82", "bf 18", or several at once: "wt 72.4 bf 18".
const body: Parser = (text, at, _context, prefix) => {
	const tokens = [prefix, ...text.split(" ")];
	const entry: Partial<Record<"weight" | "waist" | "bodyFat", number>> = {};

	for (let index = 0; index < tokens.length; index += 2) {
		const field = bodyFields[tokens[index]?.toLowerCase() ?? ""];
		const value = amountOf(
			(tokens[index + 1] ?? "").replace(/(?:kg|cm|%)$/iv, ""),
		);

		if (!field || value === undefined) {
			return failed("badNumber");
		}

		const [key, minimum, maximum] = field;

		if (!isWithin(value, minimum, maximum)) {
			return failed("outOfRange");
		}

		entry[key] = value;
	}

	return parsed({ kind: "body", at: iso(at), ...entry });
};

const clockPattern =
	/^(?<fromHour>\d{1,2}):(?<fromMinute>\d{2})-(?<toHour>\d{1,2}):(?<toMinute>\d{2})$/v;

// "23:30-7:10" in minutes, across midnight, and its wake time on the day of
// `at`, or the day before when that is still to come.
function spanOf(
	text: string,
	at: number,
	now: number,
): { minutes: number; wakeAt: number } | undefined {
	const clock = clockPattern.exec(text)?.groups;

	if (!clock) {
		return undefined;
	}

	const [fromHour = 0, fromMinute = 0, toHour = 0, toMinute = 0] = [
		clock.fromHour,
		clock.fromMinute,
		clock.toHour,
		clock.toMinute,
	].map(Number);

	if (Math.max(fromHour, toHour) > 23 || Math.max(fromMinute, toMinute) > 59) {
		return undefined;
	}

	const wake = new Date(at);
	wake.setHours(toHour, toMinute, 0, 0);

	if (wake.getTime() > now) {
		wake.setDate(wake.getDate() - 1);
	}

	return {
		minutes:
			(toHour * 60 + toMinute - fromHour * 60 - fromMinute + 1440) % 1440,
		wakeAt: wake.getTime(),
	};
}

// "sl 23:30-7:10 q4" stamps the wake time; "sl 7.5h q3" woke up just now.
const sleep: Parser = (text, at, { now }) => {
	const [span = "", ...rest] = text.split(" ");
	const scores = rest.map(
		(token) => /^q(?<score>[1-5])$/iv.exec(token)?.groups?.score,
	);
	const { minutes, wakeAt } = spanOf(span, at, now) ?? {
		minutes: minutesOf(span),
		wakeAt: at,
	};

	if (
		minutes === undefined ||
		!isWithin(minutes, 1, 1440) ||
		scores.includes(undefined)
	) {
		return failed("badSleep");
	}

	const quality = scores.at(-1);

	return parsed({
		kind: "sleep",
		at: iso(wakeAt),
		minutes: Math.round(minutes),
		...(quality === undefined ? {} : { quality: Number(quality) }),
	});
};

// "m 4 e3 s2 #work #friends": the mood, then energy, stress, and tags.
const mood: Parser = (text, at) => {
	const [score = "", ...rest] = text.split(" ");
	const tags: string[] = [];
	const ratings: Partial<Record<"energy" | "stress", number>> = {};

	if (!/^[1-5]$/v.test(score)) {
		return failed("badMood");
	}

	for (const token of rest) {
		const rating = /^(?<scale>[es])(?<value>[1-5])$/iv.exec(token)?.groups;

		if (token.length > 1 && token.startsWith("#")) {
			tags.push(token.slice(1));
		} else if (rating) {
			ratings[rating.scale?.toLowerCase() === "e" ? "energy" : "stress"] =
				Number(rating.value);
		} else {
			return failed("badMood");
		}
	}

	return parsed({
		kind: "mood",
		at: iso(at),
		score: Number(score),
		...ratings,
		...(tags.length > 0 ? { tags } : {}),
	});
};

// "h read", "h read 30" for an amount, and "h read s" to skip it today.
const habit: Parser = (text, at, { progress }) => {
	const words = text.split(" ").filter(Boolean);
	const skipped = words.length > 1 && words.at(-1)?.toLowerCase() === "s";

	if (skipped) {
		words.pop();
	}

	const amount = words.length > 1 ? amountOf(words.at(-1) ?? "") : undefined;

	if (amount !== undefined) {
		words.pop();
	}

	const typed = words.join(" ");

	if (!typed) {
		return failed("empty");
	}

	if (amount === 0) {
		return failed("outOfRange");
	}

	// The spelling logged before, so "Read" and "read" stay 1 habit.
	const name =
		progress.habits.findLast(
			(logged) => logged.name.toLowerCase() === typed.toLowerCase(),
		)?.name ?? typed;

	return parsed({
		kind: "habit",
		at: iso(at),
		name,
		...(amount === undefined ? {} : { amount }),
		...(skipped ? { skipped } : {}),
	});
};

const steps: Parser = (text, at) => {
	const count = wholeOf(text);

	if (count === undefined) {
		return failed("badNumber");
	}

	return isWithin(count, 1, 100_000)
		? parsed({ kind: "steps", at: iso(at), count })
		: failed("outOfRange");
};

const note: Parser = (text, at) => {
	if (!text) {
		return failed("empty");
	}

	return text.length > 2000
		? failed("tooLong")
		: parsed({ kind: "note", at: iso(at), text });
};

const goalRules: Partial<
	Record<
		string,
		readonly [keyof Goals, (text: string) => number | undefined, number, number]
	>
> = {
	water: ["water", millilitersOf, 250, 10_000],
	sleep: ["sleep", minutesOf, 240, 720],
	steps: ["steps", wholeOf, 1000, 50_000],
	focus: ["focusSessions", wholeOf, 1, 16],
};

// "goal water 2.5l", "goal sleep 8h", "goal steps 9000", or "goal focus 6".
const goal: Parser = (text, at) => {
	const [name = "", ...rest] = text.split(" ");
	const rule = goalRules[name.toLowerCase()];

	if (!rule) {
		return failed("badGoal");
	}

	const [key, read, minimum, maximum] = rule;
	const value = read(rest.join(" "));

	if (value === undefined) {
		return failed("badNumber");
	}

	return isWithin(value, minimum, maximum)
		? parsed({ kind: "goal", at: iso(at), goal: key, value: Math.round(value) })
		: failed("outOfRange");
};
```

Replace the `parsers` record:

```ts
// The prefix of a line picks its parser; a line without 1 is a meal.
const parsers: Partial<Record<string, Parser>> = {
	w: water,
	wt: body,
	waist: body,
	bf: body,
	sl: sleep,
	m: mood,
	h: habit,
	st: steps,
	n: note,
	goal,
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run build && npx ava build/tests/quick-log.test.js`
Expected: PASS, 7 tests.

- [ ] **Step 5: Run the gate and commit**

Run: `npm test`
Expected: everything passes.

```bash
git add source/quick-log.ts source/tests/quick-log.test.ts
git commit -m "feat: parse water, body, sleep, mood, habits, steps, notes, and goals"
```

---

### Task 7: Parse Workouts

**Files:**

- Modify: `source/quick-log.ts` (the imports; insert above the `parsers` record, and replace the record)
- Test: `source/tests/quick-log.test.ts`

**Interfaces:**

- Consumes: `caloriesOf`, `intensityOf`, `leadingActivity`, `leadingExercise` from Task 1; `profileNow` from Task 2; `minutesOf` from Task 6
- Produces: the prefix `wo`

`wo` takes an activity in any language (`run`, `跑步`, `달리기`, …), a known exercise (`bench`, `臥推`, …), or new words up to the first number or intensity. After the name come minutes (`30m`, `1h`, `30분`, a bare `30`), an intensity in any language (`easy`, `hard`, `中度`, `격렬하게`), a distance (`5k`, `5km`), and sets: `60x5` is 1 set of 5 at 60 kg and `60x5x3` 3 of them. New words with sets become an exercise and the activity `strength`; without sets, the activity itself. A known exercise without sets repeats the sets of its last session, as Hevy prefills them. Strength without minutes takes 3 per set; cardio without minutes is refused. With a profile, calories are MET × the latest weight × hours.

- [ ] **Step 1: Write the failing tests**

Append to `source/tests/quick-log.test.ts`:

```ts
test("parses workouts in every language, with their calories", (t) => {
	const at = local(12);
	const profile = {
		name: "Ken",
		age: 30,
		height: 175,
		weight: 70,
		gender: "male",
		workStyle: "desk",
		goal: "maintain",
	} as const;
	const bench = (weight: number, reps: number) => ({
		exercise: "bench",
		reps,
		weight,
	});
	const run = { kind: "workout", at, activity: "running" } as const;

	check(t, [
		["wo run 30m hard", [{ ...run, minutes: 30, intensity: "vigorous" }]],
		[
			"wo jog 5k 30 easy",
			[{ ...run, minutes: 30, intensity: "light", distance: 5 }],
		],
		[
			"wo bench 60x5x3",
			[
				{
					kind: "workout",
					at,
					activity: "strength",
					minutes: 9,
					intensity: "moderate",
					sets: [bench(60, 5), bench(60, 5), bench(60, 5)],
				},
			],
		],
		[
			"wo farmer carry 40x20x2 10m",
			[
				{
					kind: "workout",
					at,
					activity: "strength",
					minutes: 10,
					intensity: "moderate",
					sets: [
						{ exercise: "farmer carry", reps: 20, weight: 40 },
						{ exercise: "farmer carry", reps: 20, weight: 40 },
					],
				},
			],
		],
		[
			"wo frisbee 45m",
			[
				{
					kind: "workout",
					at,
					activity: "frisbee",
					minutes: 45,
					intensity: "moderate",
				},
			],
		],
		["wo run", "noMinutes"],
		["wo run fast", "badNumber"],
		["wo bench", "noPreviousSets"],
		["wo bench 60x0", "outOfRange"],
		["wo run 900m", "outOfRange"],
		["wo", "empty"],
	]);
	check(
		t,
		[["wo 跑步 30m 高強度", [{ ...run, minutes: 30, intensity: "vigorous" }]]],
		{
			language: "zh-TW",
		},
	);
	check(
		t,
		[
			[
				"wo 달리기 30분 격렬하게",
				[{ ...run, minutes: 30, intensity: "vigorous" }],
			],
		],
		{ language: "ko" },
	);
	check(
		t,
		[
			[
				"wo run 30m hard",
				// 11.8 METs × 70 kg × 0.5 h.
				[{ ...run, minutes: 30, intensity: "vigorous", calories: 413 }],
			],
		],
		{ progress: progressSchema.parse({ profile }) },
	);
});

test("repeats the sets of the last session of an exercise", (t) => {
	const progress = progressSchema.parse({
		workouts: [
			{
				at: local(18, 0, 1),
				activity: "strength",
				minutes: 30,
				sets: [
					{ exercise: "bench", reps: 5, weight: 60 },
					{ exercise: "squat", reps: 5, weight: 80 },
					{ exercise: "bench", reps: 3, weight: 65 },
				],
			},
		],
	});

	t.deepEqual(parse("wo bench 20m", { progress }), [
		{
			kind: "workout",
			at: local(12),
			activity: "strength",
			minutes: 20,
			intensity: "moderate",
			sets: [
				{ exercise: "bench", reps: 5, weight: 60 },
				{ exercise: "bench", reps: 3, weight: 65 },
			],
		},
	]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run build && npx ava build/tests/quick-log.test.js`
Expected: FAIL — `wo run 30m hard` parses as an unknown meal.

- [ ] **Step 3: Write the workout parser**

Replace the imports at the top of `source/quick-log.ts`:

```ts
import {
	caloriesOf,
	intensityOf,
	leadingActivity,
	leadingExercise,
} from "./exercises.js";
import { matchFood } from "./foods.js";
import {
	type Intensity,
	type Language,
	messagesOf,
	type WorkoutActivity,
	workoutActivities,
} from "./i18n.js";
import {
	type EntryOf,
	type Goals,
	type Progress,
	profileNow,
} from "./progress.js";
```

Insert above the `parsers` record:

```ts
const setPattern =
	/^(?<weight>\d+(?:\.\d+)?)[x×*](?<reps>\d+)(?:[x×*](?<count>\d+))?$/iv;

type WorkoutParts = {
	sets: Array<Readonly<{ reps: number; weight: number }>>;
	minutes?: number;
	distance?: number;
	intensity: Intensity;
};

// The sets, minutes, distance, and intensity after a workout's name.
function workoutPartsOf(tokens: readonly string[]): WorkoutParts | ParseError {
	const parts: WorkoutParts = { sets: [], intensity: "moderate" };

	for (const token of tokens) {
		const set = setPattern.exec(token)?.groups;
		const kilometers = /^(?<value>\d+(?:\.\d+)?)km?$/iv.exec(token)?.groups;
		const intensity = intensityOf(token);
		const minutes = minutesOf(token);

		if (set) {
			const reps = Number(set.reps);
			const count = Number(set.count ?? 1);

			if (reps < 1 || count < 1) {
				return "outOfRange";
			}

			parts.sets.push(
				...Array.from({ length: count }, () => ({
					reps,
					weight: Number(set.weight),
				})),
			);
		} else if (kilometers) {
			parts.distance = Number(kilometers.value);
		} else if (intensity) {
			parts.intensity = intensity;
		} else if (minutes === undefined) {
			return "badNumber";
		} else {
			parts.minutes = minutes;
		}
	}

	return parts;
}

type Subject = Readonly<{
	activity?: WorkoutActivity;
	exercise?: string;
	name?: string;
	rest: string;
}>;

// What a workout line names: a known activity, a known exercise, or new words
// that run until the first number or intensity.
function subjectOf(text: string): Subject {
	const activity = leadingActivity(text);

	if (activity) {
		return { activity: activity.value, rest: activity.rest };
	}

	const exercise = leadingExercise(text);

	if (exercise) {
		return { exercise: exercise.value, rest: exercise.rest };
	}

	const words = text.split(" ");
	const end = words.findIndex(
		(word) => /^\d/v.test(word) || intensityOf(word) !== undefined,
	);
	const cut = end === -1 ? words.length : end;

	return {
		name: words.slice(0, cut).join(" "),
		rest: words.slice(cut).join(" "),
	};
}

// The typed sets of an exercise, or else the sets of its last session, the
// way Hevy prefills them.
function setsOf(subject: Subject, parts: WorkoutParts, progress: Progress) {
	const exercise =
		subject.exercise ??
		(parts.sets.length > 0 ? subject.name?.toLowerCase() : undefined);

	if (exercise === undefined) {
		return [];
	}

	return parts.sets.length > 0 || !subject.exercise
		? parts.sets.map((set) => ({ exercise, ...set }))
		: (progress.workouts
				.findLast((logged) =>
					logged.sets?.some((set) => set.exercise === exercise),
				)
				?.sets?.filter((set) => set.exercise === exercise) ?? []);
}

// "wo run 30m hard 5k" for cardio; "wo bench 60x5x3" for 3 sets of 5 at 60
// kg; "wo bench" alone repeats the sets of the last bench session.
const workout: Parser = (text, at, { progress }) => {
	const subject = subjectOf(text);
	const parts = workoutPartsOf(subject.rest.split(" ").filter(Boolean));

	if (typeof parts === "string") {
		return failed(parts);
	}

	const sets = setsOf(subject, parts, progress);
	// A new name with sets is an exercise; without them, an activity.
	const activity =
		subject.activity ?? (sets.length > 0 ? "strength" : subject.name);

	if (subject.exercise && sets.length === 0) {
		return failed("noPreviousSets");
	}

	if (!activity) {
		return failed("empty");
	}

	// Lifting and resting take about 3 minutes a set when no time is typed.
	// ponytail: a fixed pace; time the session with a typed "40m" for more.
	const minutes =
		parts.minutes ?? (sets.length > 0 ? sets.length * 3 : undefined);

	if (minutes === undefined) {
		return failed("noMinutes");
	}

	if (!isWithin(minutes, 1, 600)) {
		return failed("outOfRange");
	}

	const weight = profileNow(progress)?.weight;
	const met =
		workoutActivities.find((option) => option === activity) ?? "other";

	return parsed({
		kind: "workout",
		at: iso(at),
		activity,
		minutes,
		intensity: parts.intensity,
		...(weight === undefined
			? {}
			: { calories: caloriesOf(met, parts.intensity, minutes, weight) }),
		...(parts.distance === undefined ? {} : { distance: parts.distance }),
		...(sets.length > 0 ? { sets } : {}),
	});
};
```

Replace the `parsers` record:

```ts
// The prefix of a line picks its parser; a line without 1 is a meal.
const parsers: Partial<Record<string, Parser>> = {
	w: water,
	wt: body,
	waist: body,
	bf: body,
	sl: sleep,
	m: mood,
	h: habit,
	st: steps,
	n: note,
	goal,
	wo: workout,
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run build && npx ava build/tests/quick-log.test.js`
Expected: PASS, 9 tests.

- [ ] **Step 5: Run the gate and commit**

Run: `npm test`
Expected: everything passes.

```bash
git add source/quick-log.ts source/tests/quick-log.test.ts
git commit -m "feat: parse workouts with sets, distance, and calories"
```

---

### Task 8: Repeat, Copy, Apply, Undo, and Write an Entry Back as a Line

**Files:**

- Modify: `source/quick-log.ts` (the imports; insert above the `parsers` record, and replace the record)
- Modify: `source/content.ts` (add `goalText` above `dietFieldsOf`)
- Modify: `source/i18n.ts` (the `log` section in all 3 languages)
- Test: `source/tests/quick-log.test.ts`

**Interfaces:**

- Consumes: `describeLog` from Task 2, `exerciseName` and `setGroupsOf` from Tasks 1 and 2, `fieldOf`, `logKinds`, `logsOf` from Task 2
- Produces:
  - The prefixes `.` (the last line again, every item of it, stamped now) and `copy y` (yesterday's meals today, each at the same time)
  - `draftOf(log: Logged): Draft | undefined` (`undefined` for `focus` and `event`)
  - `type Added = Readonly<{ kind: LogKind; index: number }>`
  - `applyDrafts(progress: Progress, drafts: readonly Draft[]): { next: Progress; added: Added[] }`, which sets a goal instead of appending it
  - `undoAdded(progress: Progress, added: readonly Added[]): Progress`, which also deletes any entry by kind and index
  - `restoreLog(progress: Progress, log: Logged): Progress`, which puts a deleted entry back at its index
  - `lineOf(log: Logged, language: Language): string`, the canonical line without its time, with activities, intensities, and exercises in the given language; `""` for `focus` and `event`
  - `describeDraft(draft: Draft, messages: Messages, language: Language): string` and `summaryOf(drafts: readonly Draft[], messages: Messages): string`
  - `goalText(goal: keyof Goals, value: number, messages: Messages): string` in `source/content.ts`
  - `messages.log.unknownFood(food)`, `goals: Record<keyof Goals, string>`, `goalSet(goal, value)`, `milliliters(amount)`

`lineOf` leaves out the time on purpose: editing an entry parses its line with `now` set to the entry's own time, so an edit keeps its day. Its test parses every kind's line back in all 3 languages and expects the same draft.

- [ ] **Step 1: Write the failing tests**

Replace the imports at the top of `source/tests/quick-log.test.ts`:

```ts
import test from "ava";
import { type Language, messagesOf } from "../i18n.js";
import { logsOf, type Progress, progressSchema } from "../progress.js";
import {
	applyDrafts,
	describeDraft,
	type Draft,
	draftOf,
	lineOf,
	type ParseError,
	parseQuickLog,
	restoreLog,
	summaryOf,
	undoAdded,
} from "../quick-log.js";
```

Append:

```ts
test("repeats the last line with a dot, and copies yesterday's meals", (t) => {
	const progress = progressSchema.parse({
		meals: [
			{ at: local(8, 0, 1), food: "Bagel", calories: 280 },
			{ at: local(8, 0, 2), food: "Egg", servings: 2, calories: 144 },
			{ at: local(8, 0, 2), food: "Toast", calories: 160 },
			{ at: local(13, 0, 2), food: "Ramen", calories: 500 },
		],
		events: [{ at: local(11), action: "appOpened" }],
	});
	const ramen = {
		kind: "meal",
		food: "Ramen",
		servings: 1,
		calories: 500,
		isKnown: true,
	};
	const egg = {
		kind: "meal",
		food: "Egg",
		servings: 2,
		calories: 144,
		isKnown: true,
	};
	const toast = {
		kind: "meal",
		food: "Toast",
		servings: 1,
		calories: 160,
		isKnown: true,
	};

	t.deepEqual(parse(".", { progress }), [{ ...ramen, at: local(12) }]);
	t.deepEqual(parse("copy y", { progress }), [
		{ ...egg, at: local(8) },
		{ ...toast, at: local(8) },
		{ ...ramen, at: local(13) },
	]);
	t.is(parse(".", { progress: empty }), "nothingToRepeat");
	t.is(parse("copy y", { progress: empty }), "nothingToCopy");
	t.is(parse("copy x", { progress }), "badTime");
});

test("applies drafts, undoes exactly them, and restores a deleted entry", (t) => {
	const before = progressSchema.parse({
		meals: [{ at: local(7), food: "Bagel", calories: 280 }],
		water: [{ at: local(9), milliliters: 250 }],
	});
	const result = parseQuickLog("2 eggs, mystery stew", {
		progress: before,
		now,
		language: "en",
	});
	const goal = parseQuickLog("goal water 2.5l", {
		progress: before,
		now,
		language: "en",
	});
	const drafts = [
		...(result.ok ? result.drafts : []),
		...(goal.ok ? goal.drafts : []),
	];
	const { next, added } = applyDrafts(before, drafts);

	t.deepEqual(added, [
		{ kind: "meal", index: 1 },
		{ kind: "meal", index: 2 },
	]);
	t.deepEqual(next.meals.slice(1), [
		{
			at: local(12),
			food: "Egg",
			servings: 2,
			calories: 144,
			protein: 12,
			carbs: 0,
			fat: 10,
		},
		{ at: local(12), food: "mystery stew" },
	]);
	t.deepEqual(next.goals, { water: 2500 });
	t.deepEqual(undoAdded(next, added).meals, before.meals);
	t.deepEqual(undoAdded(next, added).water, before.water);

	const [toast] = logsOf(
		progressSchema.parse({ meals: [{ at: local(8), food: "Toast" }] }),
	);
	const deleted = { ...toast!, index: 0 };
	t.deepEqual(restoreLog(before, deleted).meals, [
		{ at: local(8), food: "Toast" },
		{ at: local(7), food: "Bagel", calories: 280 },
	]);
});

test("writes every kind back as a line that parses to the same entry", (t) => {
	const at = local(18, 30, 1);
	const progress = progressSchema.parse({
		meals: [
			{
				at,
				food: "Egg",
				servings: 2,
				calories: 144,
				protein: 12,
				carbs: 0,
				fat: 10,
			},
			{ at, food: "Quick add", calories: 450, protein: 30 },
		],
		workouts: [
			{
				at,
				activity: "running",
				minutes: 30,
				intensity: "vigorous",
				distance: 5,
			},
			{
				at,
				activity: "strength",
				minutes: 12,
				intensity: "moderate",
				sets: [
					{ exercise: "bench", reps: 5, weight: 60 },
					{ exercise: "bench", reps: 5, weight: 60 },
					{ exercise: "bench", reps: 3, weight: 65 },
				],
			},
		],
		water: [{ at, milliliters: 500 }],
		sleep: [{ at, minutes: 460, quality: 4 }],
		body: [{ at, weight: 72.4, bodyFat: 18 }],
		moods: [{ at, score: 4, energy: 3, stress: 2, tags: ["work"] }],
		habits: [
			{ at, name: "no sugar", amount: 2 },
			{ at, name: "read", skipped: true },
		],
		steps: [{ at, count: 8400 }],
		notes: [{ at, text: "grateful for the sun" }],
	});

	for (const language of ["en", "zh-TW", "ko"] as const) {
		for (const log of logsOf(progress)) {
			const line = lineOf(log, language);
			t.deepEqual(
				parse(line, { progress, language, at: Date.parse(log.at) }),
				[draftOf(log)],
				`${language}: ${line}`,
			);
		}
	}

	t.is(
		lineOf(
			logsOf(progress).find((log) => log.kind === "workout" && log.entry.sets)!,
			"zh-TW",
		),
		"wo 臥推 60x5x2 65x3 12m 中度",
	);
});

test("describes drafts for the preview and names them for the footer", (t) => {
	const english = messagesOf("en");
	const result = parseQuickLog("2 eggs, mystery stew", {
		progress: empty,
		now,
		language: "en",
	});
	const drafts = result.ok ? result.drafts : [];
	const [eggs, stew] = drafts;

	t.is(
		describeDraft(eggs!, english, "en"),
		"2 × Egg · 144 kcal · 12 g protein",
	);
	t.is(
		describeDraft(stew!, english, "en"),
		"mystery stew: not a food I know yet; add its kcal, e.g. mystery stew 500kcal",
	);
	t.is(
		describeDraft(
			{ kind: "goal", at: local(12), goal: "sleep", value: 480 },
			english,
			"en",
		),
		"Sleep goal: 8h",
	);
	t.is(summaryOf(drafts, english), "2 Egg, mystery stew");
	t.is(
		summaryOf(
			[{ kind: "water", at: local(12), milliliters: 250 }],
			messagesOf("ko"),
		),
		"물",
	);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run build`
Expected: FAIL — `tsc` reports that `applyDrafts`, `draftOf`, `lineOf`, `describeDraft`, `restoreLog`, `summaryOf`, and `undoAdded` are not exported.

- [ ] **Step 3: Say a goal and an unknown food in all 3 languages**

In `source/i18n.ts`, import `type Goals` beside `type LogKind` from `./progress.js`, and add after `quickAdd` in the `log` section of `en`:

```ts
		unknownFood: (food: string) =>
			`${food}: not a food I know yet; add its kcal, e.g. ${food} 500kcal`,
		goals: {
			water: "Water goal",
			sleep: "Sleep goal",
			steps: "Steps goal",
			focusSessions: "Focus goal",
		} satisfies Record<keyof Goals, string>,
		goalSet: (goal: string, value: string) => `${goal}: ${value}`,
		milliliters: (amount: number) => `${amount} ml`,
```

Of `traditionalChinese`:

```ts
		unknownFood: (food) =>
			`${food}：還不認識這個食物，請加上熱量，例如 ${food} 500kcal`,
		goals: {
			water: "喝水目標",
			sleep: "睡眠目標",
			steps: "步數目標",
			focusSessions: "專注目標",
		},
		goalSet: (goal, value) => `${goal}：${value}`,
		milliliters: (amount) => `${amount} 毫升`,
```

Of `korean`:

```ts
		unknownFood: (food) =>
			`${food}: 아직 모르는 음식입니다. 열량을 함께 입력하세요. 예: ${food} 500kcal`,
		goals: {
			water: "물 목표",
			sleep: "수면 목표",
			steps: "걸음 목표",
			focusSessions: "집중 목표",
		},
		goalSet: (goal, value) => `${goal}: ${value}`,
		milliliters: (amount) => `${amount}ml`,
```

In `source/content.ts`, import `type Goals` from `./progress.js` and add above `dietFieldsOf`:

```ts
// "Water goal: 2500 ml": a goal and its value, in the language on now.
export function goalText(goal: keyof Goals, value: number, messages: Messages) {
	const { log } = messages;
	const shown: Record<keyof Goals, string> = {
		water: log.milliliters(value),
		sleep: durationOf(value, messages),
		steps: String(value),
		focusSessions: String(value),
	};

	return log.goalSet(log.goals[goal], shown[goal]);
}
```

- [ ] **Step 4: Repeat, copy, apply, undo, and write back**

Replace the imports at the top of `source/quick-log.ts`:

```ts
import { describeLog, goalText } from "./content.js";
import {
	caloriesOf,
	exerciseName,
	intensityOf,
	leadingActivity,
	leadingExercise,
	setGroupsOf,
} from "./exercises.js";
import { matchFood } from "./foods.js";
import {
	type Intensity,
	type Language,
	type Messages,
	messagesOf,
	type WorkoutActivity,
	workoutActivities,
} from "./i18n.js";
import {
	type EntryOf,
	fieldOf,
	type Goals,
	type Logged,
	type LogKind,
	logKinds,
	logsOf,
	type Progress,
	profileNow,
} from "./progress.js";
```

Insert above the `parsers` record:

```ts
// An entry as the draft that would log it again.
export function draftOf(log: Logged): Draft | undefined {
	switch (log.kind) {
		case "meal": {
			return {
				...log.entry,
				kind: "meal",
				servings: log.entry.servings ?? 1,
				isKnown: true,
			};
		}

		case "workout": {
			return { ...log.entry, kind: "workout" };
		}

		case "water": {
			return { ...log.entry, kind: "water" };
		}

		case "sleep": {
			return { ...log.entry, kind: "sleep" };
		}

		case "body": {
			return { ...log.entry, kind: "body" };
		}

		case "mood": {
			return { ...log.entry, kind: "mood" };
		}

		case "habit": {
			return { ...log.entry, kind: "habit" };
		}

		case "steps": {
			return { ...log.entry, kind: "steps" };
		}

		case "note": {
			return { ...log.entry, kind: "note" };
		}

		case "focus":
		case "event": {
			return undefined;
		}
	}
}

// "." logs the last line again, every item of it, stamped now.
const repeat: Parser = (_text, at, { progress }) => {
	const logs = logsOf(progress).filter(
		(log) => log.kind !== "event" && log.kind !== "focus",
	);
	const last = logs[0]?.at;
	const drafts = logs
		.filter((log) => log.at === last)
		.flatMap((log) => draftOf(log) ?? [])
		.map((draft) => ({ ...draft, at: iso(at) }));

	return drafts.length > 0 ? parsed(...drafts) : failed("nothingToRepeat");
};

// "copy y" logs yesterday's meals again today, each at the same time.
const copy: Parser = (text, _at, { progress, now }) => {
	const yesterday = new Date(now);
	yesterday.setDate(yesterday.getDate() - 1);
	const drafts = progress.meals
		.filter(
			(meal) => new Date(meal.at).toDateString() === yesterday.toDateString(),
		)
		.toSorted((left, right) => Date.parse(left.at) - Date.parse(right.at))
		.map((meal): Draft => {
			const today = new Date(meal.at);
			today.setDate(today.getDate() + 1);
			return {
				...meal,
				kind: "meal",
				at: today.toISOString(),
				servings: meal.servings ?? 1,
				isKnown: true,
			};
		});

	if (text.toLowerCase() !== "y") {
		return failed("badTime");
	}

	return drafts.length > 0 ? parsed(...drafts) : failed("nothingToCopy");
};

export type Added = Readonly<{ kind: LogKind; index: number }>;

// The entry a draft saves: a meal drops its flag, and 1 serving goes unsaid.
function entryOf(draft: Exclude<Draft, GoalDraft>): Logged {
	const index = -1;

	switch (draft.kind) {
		case "meal": {
			const { kind, isKnown, servings, ...meal } = draft;
			return {
				kind,
				at: draft.at,
				index,
				entry: { ...meal, ...(servings === 1 ? {} : { servings }) },
			};
		}

		case "workout": {
			const { kind, ...entry } = draft;
			return { kind, at: draft.at, index, entry };
		}

		case "water": {
			const { kind, ...entry } = draft;
			return { kind, at: draft.at, index, entry };
		}

		case "sleep": {
			const { kind, ...entry } = draft;
			return { kind, at: draft.at, index, entry };
		}

		case "body": {
			const { kind, ...entry } = draft;
			return { kind, at: draft.at, index, entry };
		}

		case "mood": {
			const { kind, ...entry } = draft;
			return { kind, at: draft.at, index, entry };
		}

		case "habit": {
			const { kind, ...entry } = draft;
			return { kind, at: draft.at, index, entry };
		}

		case "steps": {
			const { kind, ...entry } = draft;
			return { kind, at: draft.at, index, entry };
		}

		case "note": {
			const { kind, ...entry } = draft;
			return { kind, at: draft.at, index, entry };
		}
	}
}

// Appends every draft and says where each entry landed, so undo can find it;
// a goal changes the goals instead.
export function applyDrafts(
	progress: Progress,
	drafts: readonly Draft[],
): { next: Progress; added: Added[] } {
	let next = progress;
	const added: Added[] = [];

	for (const draft of drafts) {
		if (draft.kind === "goal") {
			next = { ...next, goals: { ...next.goals, [draft.goal]: draft.value } };
			continue;
		}

		const { kind, entry } = entryOf(draft);
		const field = fieldOf[kind];
		added.push({ kind, index: next[field].length });
		next = { ...next, [field]: [...next[field], entry] };
	}

	return { next, added };
}

// Removes the entries a line added, or any others by kind and index.
export function undoAdded(
	progress: Progress,
	added: readonly Added[],
): Progress {
	let next = progress;

	for (const kind of logKinds) {
		const indexes = new Set(
			added.filter((item) => item.kind === kind).map((item) => item.index),
		);
		const field = fieldOf[kind];

		if (indexes.size > 0) {
			next = {
				...next,
				[field]: next[field].filter((_, index) => !indexes.has(index)),
			};
		}
	}

	return next;
}

// Puts a deleted entry back where it was.
export function restoreLog(progress: Progress, log: Logged): Progress {
	const field = fieldOf[log.kind];
	const entries = progress[field];

	return {
		...progress,
		[field]: [
			...entries.slice(0, log.index),
			log.entry,
			...entries.slice(log.index),
		],
	};
}

const plain = (value: number) => String(Math.round(value * 10) / 10);

const isActivity = (activity: string): activity is WorkoutActivity =>
	(workoutActivities as readonly string[]).includes(activity);

// An entry as the line that logs it, in the given language, without its time:
// editing parses it again at the entry's own time.
export function lineOf(log: Logged, language: Language): string {
	const messages = messagesOf(language);
	const words = (...parts: Array<string | false | undefined>) =>
		parts.filter(Boolean).join(" ");
	const optional = <Value>(
		value: Value | undefined,
		text: (value: Value) => string,
	) => value !== undefined && text(value);

	switch (log.kind) {
		case "meal": {
			const { food, servings, calories, protein, carbs, fat } = log.entry;
			return words(
				optional(servings, plain),
				food,
				optional(calories, (value) => `${plain(value)}kcal`),
				optional(protein, (value) => `${plain(value)}p`),
				optional(carbs, (value) => `${plain(value)}c`),
				optional(fat, (value) => `${plain(value)}f`),
			);
		}

		case "workout": {
			const { activity, minutes, intensity, distance, sets } = log.entry;
			const groups = setGroupsOf(sets);
			const name = groups[0]
				? exerciseName(groups[0].exercise, language)
				: isActivity(activity)
					? messages.workoutActivity[activity]
					: activity;
			return words(
				"wo",
				name,
				...groups.map(
					(group) =>
						`${plain(group.weight)}x${group.reps}${group.count > 1 ? `x${group.count}` : ""}`,
				),
				`${plain(minutes)}m`,
				optional(intensity, (value) => messages.intensity[value]),
				optional(distance, (value) => `${plain(value)}km`),
			);
		}

		case "water": {
			return `w ${plain(log.entry.milliliters)}`;
		}

		case "sleep": {
			return words(
				"sl",
				`${log.entry.minutes}m`,
				optional(log.entry.quality, (value) => `q${value}`),
			);
		}

		case "body": {
			const { weight, waist, bodyFat } = log.entry;
			return words(
				optional(weight, (value) => `wt ${plain(value)}`),
				optional(waist, (value) => `waist ${plain(value)}`),
				optional(bodyFat, (value) => `bf ${plain(value)}`),
			);
		}

		case "mood": {
			const { score, energy, stress, tags = [] } = log.entry;
			return words(
				"m",
				String(score),
				optional(energy, (value) => `e${value}`),
				optional(stress, (value) => `s${value}`),
				...tags.map((tag) => `#${tag}`),
			);
		}

		case "habit": {
			const { name, amount, skipped } = log.entry;
			return words("h", name, optional(amount, plain), skipped && "s");
		}

		case "steps": {
			return `st ${log.entry.count}`;
		}

		case "note": {
			return `n ${log.entry.text}`;
		}

		case "focus":
		case "event": {
			return "";
		}
	}
}

// What a draft will log, for the live preview: a meal nobody knows says how
// to give it kcal.
export function describeDraft(
	draft: Draft,
	messages: Messages,
	language: Language,
): string {
	if (draft.kind === "goal") {
		return goalText(draft.goal, draft.value, messages);
	}

	return draft.kind === "meal" && !draft.isKnown
		? messages.log.unknownFood(draft.food)
		: describeLog(entryOf(draft), language, messages);
}

function nameOf(draft: Draft, messages: Messages) {
	if (draft.kind === "meal") {
		return draft.servings === 1
			? draft.food
			: `${plain(draft.servings)} ${draft.food}`;
	}

	return draft.kind === "goal"
		? messages.log.goals[draft.goal]
		: messages.logs.kinds[draft.kind];
}

// The short names of what a line logged, for the footer.
export const summaryOf = (drafts: readonly Draft[], messages: Messages) =>
	drafts.map((draft) => nameOf(draft, messages)).join(", ");
```

Replace the `parsers` record. xo's naming rule cannot tell a typed prefix from an identifier, so the `.` key carries a disable comment:

```ts
// The prefix of a line picks its parser; a line without 1 is a meal.
const parsers: Partial<Record<string, Parser>> = {
	w: water,
	wt: body,
	waist: body,
	bf: body,
	sl: sleep,
	m: mood,
	h: habit,
	st: steps,
	n: note,
	goal,
	wo: workout,
	// Prefixes are what people type, not identifiers.
	// eslint-disable-next-line @typescript-eslint/naming-convention
	".": repeat,
	copy,
};
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run build && npx ava build/tests/quick-log.test.js`
Expected: PASS, 13 tests.

- [ ] **Step 6: Run the gate and commit**

Run: `npm test`
Expected: everything passes.

```bash
git add source/quick-log.ts source/content.ts source/i18n.ts source/tests/quick-log.test.ts
git commit -m "feat: repeat, copy, undo, and rewrite logged lines"
```

---

### Task 9: Suggest What to Log Now

**Files:**

- Modify: `source/quick-log.ts` (the imports; insert above the `parsers` record)
- Modify: `source/i18n.ts` (`log.reasons` in all 3 languages)
- Test: `source/tests/quick-log.test.ts`

**Interfaces:**

- Consumes: `lineOf` from Task 8, `targetsOf` from Task 3, `profileNow` and `todayOf` from Task 2
- Produces:
  - `type Suggestion = Readonly<{ line: string; label: string }>`, where `line` is exactly what Enter logs and `label` says why, in `progress.language`
  - `suggestionsOf(progress: Progress, now: number, limit = 5): Suggestion[]`
  - `messages.log.reasons` with `usual`, `water`, `workout`, and `habit(days)`

With the input empty, the Log view offers up to 5 lines, in this order: the 2 foods most often eaten within 90 minutes of this time of day on any day, ties to the most recent ([MacroFactor's "hourly go-to"](https://macrofactor.com/new-food-logger/)), skipping foods already logged today; `w` when today's water is behind a straight pace from 7:00 to 22:00 (target × hours since 7:00 ÷ 15); the workout of this weekday last week, unless there is a workout today; every habit done on at least 3 of the last 7 days and not yet checked or skipped today; then the rest of the usual foods.

- [ ] **Step 1: Write the failing test**

In `source/tests/quick-log.test.ts`, import `suggestionsOf` beside `summaryOf`, and append:

```ts
test("suggests the usual foods of this hour, water, last week's workout, and habits", (t) => {
	const nine = Date.parse(local(9));
	const progress = progressSchema.parse({
		language: "en",
		meals: [
			{ at: local(8, 0, 1), food: "Oatmeal", calories: 300 },
			{ at: local(8, 15, 2), food: "Oatmeal", calories: 300 },
			{ at: local(8, 30, 2), food: "Banana", servings: 2, calories: 210 },
			{ at: local(19, 0, 2), food: "Ramen", calories: 500 },
			{ at: local(8, 10), food: "Egg", calories: 72 },
			{ at: local(9, 30, 1), food: "Egg", calories: 72 },
		],
		workouts: [
			{
				at: new Date(2026, 8, 26, 7).toISOString(),
				activity: "running",
				minutes: 30,
				intensity: "moderate",
			},
		],
		habits: [
			{ at: new Date(2026, 8, 30, 21).toISOString(), name: "read" },
			{ at: local(21, 0, 1), name: "read" },
			{ at: local(21, 0, 2), name: "read" },
			{ at: local(22, 0, 1), name: "stretch" },
			{ at: local(22, 0, 2), name: "stretch" },
		],
	});

	t.deepEqual(suggestionsOf(progress, nine), [
		{ line: "Oatmeal", label: "usual around now" },
		{ line: "2 Banana", label: "usual around now" },
		{ line: "w", label: "behind on water today" },
		{ line: "wo Running 30m Moderate", label: "same day last week" },
		{ line: "h read", label: "3 of the last 7 days" },
	]);
	t.is(suggestionsOf(progress, nine, 2).length, 2);
	t.false(
		suggestionsOf(
			{ ...progress, water: [{ at: local(8), milliliters: 1000 }] },
			nine,
		).some(({ line }) => line === "w"),
		"ahead of the water pace",
	);
	t.deepEqual(
		suggestionsOf(progressSchema.parse({}), Date.parse(local(6))),
		[],
	);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run build`
Expected: FAIL — `tsc` reports that `suggestionsOf` is not exported from `../quick-log.js`.

- [ ] **Step 3: Say why in all 3 languages**

In `source/i18n.ts`, add after `milliliters` in the `log` section of `en`:

```ts
		reasons: {
			usual: "usual around now",
			water: "behind on water today",
			workout: "same day last week",
			habit: (days: number) => `${days} of the last 7 days`,
		},
```

Of `traditionalChinese`:

```ts
		reasons: {
			usual: "這個時段常吃",
			water: "今天喝水進度落後",
			workout: "上週的今天",
			habit: (days) => `過去 7 天有 ${days} 天`,
		},
```

Of `korean`:

```ts
		reasons: {
			usual: "이 시간에 자주 먹음",
			water: "오늘 물이 부족함",
			workout: "지난주 오늘",
			habit: (days) => `지난 7일 중 ${days}일`,
		},
```

- [ ] **Step 4: Write the suggestions**

Replace the imports at the top of `source/quick-log.ts`:

```ts
import { describeLog, goalText } from "./content.js";
import {
	caloriesOf,
	exerciseName,
	intensityOf,
	leadingActivity,
	leadingExercise,
	setGroupsOf,
} from "./exercises.js";
import { matchFood } from "./foods.js";
import { targetsOf } from "./health.js";
import {
	type Intensity,
	type Language,
	type Messages,
	messagesOf,
	type WorkoutActivity,
	workoutActivities,
} from "./i18n.js";
import {
	type EntryOf,
	fieldOf,
	type Goals,
	type Logged,
	type LogKind,
	logKinds,
	logsOf,
	type Progress,
	profileNow,
	todayOf,
} from "./progress.js";
```

Insert above the `parsers` record:

```ts
export type Suggestion = Readonly<{ line: string; label: string }>;

const minuteOfDay = (at: number) => {
	const date = new Date(at);
	return date.getHours() * 60 + date.getMinutes();
};

// Within 90 minutes of now on the clock, on any day, across midnight too.
const isNearNow = (at: string, now: number) => {
	const gap = Math.abs(minuteOfDay(Date.parse(at)) - minuteOfDay(now));
	return Math.min(gap, 1440 - gap) <= 90;
};

const daysBefore = (now: number, days: number) => {
	const date = new Date(now);
	date.setDate(date.getDate() - days);
	return date.toDateString();
};

// The foods eaten around this time of day, most often first, then most
// recent: MacroFactor's "hourly go-to". Today's foods are already logged.
function usualFoodsOf(progress: Progress, now: number): string[] {
	const today = new Date(now).toDateString();
	const eatenToday = new Set(
		progress.meals
			.filter((meal) => new Date(meal.at).toDateString() === today)
			.map((meal) => meal.food.toLowerCase()),
	);
	const usual = new Map<
		string,
		{ line: string; count: number; last: number }
	>();

	for (const meal of progress.meals) {
		const key = meal.food.toLowerCase();
		const at = Date.parse(meal.at);
		const seen = usual.get(key);

		if (!eatenToday.has(key) && isNearNow(meal.at, now)) {
			usual.set(key, {
				line:
					seen && seen.last > at
						? seen.line
						: [
								meal.servings === undefined ? "" : plain(meal.servings),
								meal.food,
							]
								.filter(Boolean)
								.join(" "),
				count: (seen?.count ?? 0) + 1,
				last: Math.max(seen?.last ?? 0, at),
			});
		}
	}

	return [...usual.values()]
		.toSorted(
			(left, right) => right.count - left.count || right.last - left.last,
		)
		.map(({ line }) => line);
}

// Lines worth logging now, each logged as is with Enter: the usual foods of
// this hour, water when behind its pace from 7:00 to 22:00, the workout of
// this weekday last week, and habits done on 3 of the last 7 days.
export function suggestionsOf(
	progress: Progress,
	now: number,
	limit = 5,
): Suggestion[] {
	const language = progress.language ?? "en";
	const { log } = messagesOf(language);
	const today = todayOf(progress, now);
	const isOn = (at: string, day: string) => new Date(at).toDateString() === day;
	const foods = usualFoodsOf(progress, now).map((line) => ({
		line,
		label: log.reasons.usual,
	}));
	const { water } = targetsOf(profileNow(progress), progress.goals);
	const pace =
		water * Math.min(Math.max((minuteOfDay(now) - 7 * 60) / (15 * 60), 0), 1);
	const lastWeek = progress.workouts.findLast((workout) =>
		isOn(workout.at, daysBefore(now, 7)),
	);
	const workedOut = progress.workouts.some((workout) =>
		isOn(workout.at, daysBefore(now, 0)),
	);
	const habits = Map.groupBy(
		progress.habits.filter(
			(habit) =>
				!habit.skipped &&
				[1, 2, 3, 4, 5, 6, 7].some((days) =>
					isOn(habit.at, daysBefore(now, days)),
				),
		),
		(habit) => habit.name,
	);
	const habitsToday = new Set(
		progress.habits
			.filter((habit) => isOn(habit.at, daysBefore(now, 0)))
			.map((habit) => habit.name.toLowerCase()),
	);
	const usualHabits = [...habits].flatMap(([name, done]) => {
		const days = new Set(done.map((habit) => new Date(habit.at).toDateString()))
			.size;
		return days >= 3 && !habitsToday.has(name.toLowerCase())
			? [{ line: `h ${name}`, label: log.reasons.habit(days) }]
			: [];
	});

	return [
		...foods.slice(0, 2),
		...(today.water < pace ? [{ line: "w", label: log.reasons.water }] : []),
		...(lastWeek && !workedOut
			? [
					{
						line: lineOf(
							{ kind: "workout", at: lastWeek.at, index: 0, entry: lastWeek },
							language,
						),
						label: log.reasons.workout,
					},
				]
			: []),
		...usualHabits,
		...foods.slice(2),
	].slice(0, limit);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run build && npx ava build/tests/quick-log.test.js`
Expected: PASS, 14 tests.

- [ ] **Step 6: Run the gate and commit**

Run: `npm test`
Expected: everything passes.

```bash
git add source/quick-log.ts source/i18n.ts source/tests/quick-log.test.ts
git commit -m "feat: suggest the usual foods, water, workouts, and habits for now"
```

---

### Task 10: The Log View in Place of the Meal and Workout Forms

**Files:**

- Create: `source/components/log-view.tsx`
- Modify: `source/quick-log.ts` (add `completionOf` above the `parsers` record)
- Modify: `source/progress.ts` (`eventActions`, `goalKeys`)
- Modify: `source/content.ts:48-57` (layout rows), `:241-268` (menu), `:277-345` (`menuEntriesOf`), `:511` (`activityOfKind` and `describeEvent`), `:664-776` (remove the meal and workout fields)
- Modify: `source/i18n.ts` (groups, menu, describe, signal, hints, form, log, and events in all 3 languages)
- Modify: `source/app.tsx` (imports, state, `record`, the handlers, the activity, the hint, the panels, and the menu box)
- Modify: `.claude/rules/terminal-layout.md` (menu rows and the Log view)
- Test: `source/tests/dashboard.test.tsx`, `source/tests/content.test.ts`, `source/tests/data.test.ts`, `source/tests/quick-log.test.ts`

**Interfaces:**

- Consumes: everything from Tasks 2 to 9
- Produces:
  - Menu keys `log`, `timer`, `logs`, `quotes`, `profile`, `theme`, `language`, `environment`, `update`, under the groups `today`, `journal`, `settings`, and `system`; `diet` and `workout` are gone, with `dietFieldsOf`, `workoutFieldsOf`, and `workoutCombinationsOf`
  - Event actions `goalChanged` (`goal:value`), `logDeleted` and `logEdited` (the entry's kind); `goalKeys` in `source/progress.ts`
  - `activityOfKind(kind: LogKind): Activity` in `source/content.ts`
  - `completionOf(text: string): { head: string; query: string } | undefined` in `source/quick-log.ts`
  - Default export `LogView` with props `progress`, `language`, `messages`, `now`, `initialLine?`, `onLog(line: string, drafts: Draft[]): void`, and `onUndo(): void`
  - `record` in `App` now returns whether it saved

The view only parses and shows; `App` applies the drafts, appends `goalChanged` for a goal, saves through `record` (which handles the level-up and flashes the character, with `activityOfKind` or the workout's own animation), and keeps a stack of what each line added. The whole line `u` undoes the newest one and appends `logDeleted`; the stack empties whenever the view closes, so `u` never reaches past what was logged in this visit, and a food such as `udon` is never mistaken for it. `usePaste` makes a paste arrive whole: its lines become items, and it waits for Enter. While the Log view or History is open, the menu box hides so the view gets the width, and Recent stays under the Log view to show what was just logged.

The menu after this task, with the groups the roadmap fixes from Plan C on:

| Key | Group    | Item            |
| --- | -------- | --------------- |
| `1` | Today    | Log             |
| `2` | Today    | Tomato Timer    |
| `3` | Journal  | History         |
| `4` | Settings | Everyday Quotes |
| `5` | Settings | Profile         |
| `6` | Settings | Theme           |
| `7` | Settings | Language        |
| `8` | Settings | Environment     |
| `9` | System   | Software Update |

- [ ] **Step 1: Write the failing tests**

In `source/tests/dashboard.test.tsx`, change the menu order test's labels to:

```tsx
		"1. Log",
		"2. Tomato Timer",
		"3. History",
		"4. Everyday Quotes",
		"5. Profile",
		"6. Theme",
		"7. Language",
		"8. Environment",
		"9. Software Update",
```

Then change the keys that moved: the tomato test opens the timer with `"2"` instead of `"1"`, the logs test opens History with `"3"` instead of `"9"`, and the update test focuses Software Update with `"9"` instead of `"0"`. At the end of "saves a profile and turns it into targets", focus the Log item, whose preview shows the advice:

```tsx
await type(stdin, ["1"]);
t.true((lastFrame() ?? "").includes("140 g of protein to go today"));
```

Replace the 4 form tests, from "logs a typed meal, rejecting a bad number" through "repeats a past workout in 1 step", with:

```tsx
test("logs a line, saying what it cannot read", async (t) => {
	const { file, stdin, lastFrame, unmount } = start();

	await type(stdin, ["1", "\r", "w lots"]);
	t.true((lastFrame() ?? "").includes("A number is missing or unreadable."));

	await type(stdin, ["\r"]);
	t.deepEqual(loadProgress(file).water, []);

	await type(stdin, [backspace.repeat(6), "2 eggs, toast"]);
	t.true((lastFrame() ?? "").includes("2 × Egg · 144 kcal · 12 g protein"));

	await type(stdin, ["\r"]);
	t.like(loadProgress(file).meals, [
		{ food: "Egg", servings: 2, calories: 144 },
		{ food: "Whole wheat toast", calories: 160 },
	]);
	t.true((lastFrame() ?? "").includes("Logged 2 Egg, Whole wheat toast"));

	unmount();
});

test("completes a food name and logs the pick", async (t) => {
	const { file, stdin, lastFrame, unmount } = start();

	await type(stdin, ["1", "\r", "2 chick"]);
	t.true((lastFrame() ?? "").includes("Chicken breast"));

	await type(stdin, [down, "\r"]);
	t.like(loadProgress(file).meals[0], {
		food: "Chicken breast",
		servings: 2,
		calories: 496,
		protein: 92,
	});

	unmount();
});

test("logs a workout and scales its experience", async (t) => {
	const { file, stdin, lastFrame, unmount } = start();

	await type(stdin, ["1", "\r", "wo run 30m hard", "\r"]);
	t.like(loadProgress(file).workouts[0], {
		activity: "running",
		minutes: 30,
		intensity: "vigorous",
	});
	t.true((lastFrame() ?? "").includes("+60 XP"));

	unmount();
});

test("repeats the last line with a dot", async (t) => {
	const { file, stdin, unmount } = start({
		...empty,
		workouts: [
			{
				at: "2026-10-02T07:00:00.000Z",
				activity: "cycling",
				minutes: 45,
				intensity: "moderate",
			},
		],
	});

	await type(stdin, ["1", "\r", ".", "\r"]);
	t.like(loadProgress(file).workouts[1], {
		activity: "cycling",
		minutes: 45,
		intensity: "moderate",
	});

	unmount();
});

test("logs a suggestion for this hour with Enter", async (t) => {
	const yesterday = new Date(Date.now() - 86_400_000).toISOString();
	const { file, stdin, lastFrame, unmount } = start({
		...empty,
		meals: [{ at: yesterday, food: "Oatmeal", calories: 300, protein: 10 }],
	});

	await type(stdin, ["1", "\r"]);
	t.true((lastFrame() ?? "").includes("usual around now"));

	await type(stdin, [down, "\r"]);
	t.like(loadProgress(file).meals[1], { food: "Oatmeal", calories: 300 });

	unmount();
});

test("undoes only the line u, and only while the Log view is open", async (t) => {
	const { file, stdin, lastFrame, unmount } = start();

	await type(stdin, ["1", "\r", "udon", "\r"]);
	t.is(loadProgress(file).meals[0]?.food, "Udon", "udon is a food");

	await type(stdin, ["u", "\r"]);
	t.deepEqual(loadProgress(file).meals, []);
	t.true(actionsIn(file).includes("logDeleted"));

	await type(stdin, ["u", "\r"]);
	t.true((lastFrame() ?? "").includes("Nothing to undo."));

	// Leaving the view forgets what it could undo.
	await type(stdin, ["w 500", "\r", escape, "\r", "u", "\r"]);
	t.is(loadProgress(file).water.length, 1);

	unmount();
});

test("keeps a pasted line whole until Enter", async (t) => {
	const { file, stdin, lastFrame, unmount } = start();

	await type(stdin, ["1", "\r", "\u001B[200~2 eggs\ntoast\n\u001B[201~"]);
	t.true((lastFrame() ?? "").includes("2 eggs, toast"));
	t.deepEqual(loadProgress(file).meals, []);

	await type(stdin, ["\r"]);
	t.is(loadProgress(file).meals.length, 2);

	unmount();
});

test("sets a goal and logs the change", async (t) => {
	const { file, stdin, unmount } = start();

	await type(stdin, ["1", "\r", "goal water 2.5l", "\r"]);
	t.deepEqual(loadProgress(file).goals, { water: 2500 });
	t.like(loadProgress(file).events.at(-1), {
		action: "goalChanged",
		detail: "water:2500",
	});

	unmount();
});
```

In `source/tests/content.test.ts`, the menu is back to 9 items, so headings show from 27 rows again:

```ts
t.like(layoutOf(100, 27), { isMenuGrouped: true, showRecent: true });
t.like(layoutOf(100, 26), { isMenuGrouped: false });
```

In `source/tests/data.test.ts`, delete the test "offers past workouts as 1-step combinations" and its `workoutCombinationsOf` import. In `source/tests/quick-log.test.ts`, import `completionOf` and append:

```ts
test("finds the food name being typed, to complete it", (t) => {
	t.deepEqual(completionOf("2 eggs, chi"), { head: "2 eggs, ", query: "chi" });
	t.deepEqual(completionOf("@y 21:00 2 chi"), {
		head: "@y 21:00 2 ",
		query: "chi",
	});
	t.deepEqual(completionOf("계란 2개 + 김"), {
		head: "계란 2개 + ",
		query: "김",
	});
	t.deepEqual(completionOf("2個雞"), { head: "2個", query: "雞" });
	t.deepEqual(completionOf("udon"), { head: "", query: "udon" });
	t.is(completionOf("w 500"), undefined);
	t.is(completionOf("wo bench"), undefined);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run build`
Expected: FAIL — `tsc` reports that `completionOf` is not exported from `../quick-log.js`.

- [ ] **Step 3: Find the food name being typed**

In `source/quick-log.ts`, insert above the `parsers` record:

```ts
const leadingCount = new RegExp(
	String.raw`^ *(?:(?:${quantity}) ?(?:${counter}|[x×](?= ))? ?)?`,
	"v",
);

// The food name being typed at the end of a meal line, and everything before
// it, so a picked name can replace just that; nothing on a prefixed line.
export function completionOf(
	text: string,
): Readonly<{ head: string; query: string }> | undefined {
	const time = /^@\S+(?: \d{1,2}:\d{2})?(?: |$)/v.exec(text)?.[0] ?? "";
	const word = text.slice(time.length).split(" ")[0]?.toLowerCase() ?? "";

	if (parsers[word]) {
		return undefined;
	}

	const start = Math.max(
		time.length,
		...[",", "+", "、", "，"].map((mark) => text.lastIndexOf(mark) + 1),
	);
	const item = text.slice(start);
	const count = leadingCount.exec(item)?.[0] ?? "";

	return {
		head: text.slice(0, start + count.length),
		query: item.slice(count.length),
	};
}
```

- [ ] **Step 4: Add the events and the goal keys**

In `source/progress.ts`, append `"goalChanged"`, `"logDeleted"`, and `"logEdited"` to `eventActions`, and add under `export type Progress`:

```ts
export const goalKeys = goalsSchema.keyof().options;
```

- [ ] **Step 5: Change the strings in all 3 languages**

In `source/i18n.ts`, import `type ParseError` from `./quick-log.js` (type-only, so no cycle at run time). In each language:

1. Replace `groups`, dropping `actions` and `health`.
2. Replace `menu`, dropping `diet` and `workout`, adding `log`, and relabeling `logs`.
3. In `describe`, delete `diet` and `workout`, and add `log`.
4. In `signal`, delete `proteinLeft`, `minutesLeft`, and `onTrack`, and add `loggedToday`.
5. In `hints`, add `log`.
6. In `form`, delete `dietTitle`, `workoutTitle`, `food`, `foodExample`, `calories`, `protein`, `activity`, `minutes`, `intensity`, `mealLogged`, and `workoutLogged`; `yours` and `nutrition` stay for the food matches.
7. At the top of the `log` section, above `quickAdd`, add the view's strings.
8. At the end of `events`, add the 3 new actions.

For `en`:

```ts
	groups: {
		today: "Today",
		journal: "Journal",
		settings: "Settings",
		system: "System",
	},
	menu: {
		log: "Log",
		quotes: "Everyday Quotes",
		timer: "Tomato Timer",
		logs: "History",
		profile: "Profile",
		theme: "Theme",
		language: "Language",
		update: "Software Update",
		environment: "Environment",
	},
```

```ts
	// describe
		log: "Log anything in 1 line, e.g. 2 eggs, toast · w 500 · wo run 30m · sl 23:30-7:10. While the line is empty, it suggests what you usually log now.",
	// signal
		loggedToday: (count: number) => `${count} logged today`,
	// hints
		log: "↑↓ pick · tab complete · enter log · esc back",
	// log, above quickAdd
		title: "Log",
		editTitle: "Edit a log",
		placeholder: "2 eggs, toast · w 500 · wo run 30m",
		prefixes:
			"w water · wt weight · waist · bf body fat · sl sleep · m mood · h habit · st steps · n note",
		shortcuts:
			"wo workout · goal · @y yesterday · @7:30 a time · . repeat · copy y · u undo",
		more: (count: number) => `+${count} more`,
		undoHint: "Enter undoes the last line logged here.",
		logged: (summary: string, xp: number) =>
			`Logged ${summary}${xp > 0 ? ` · +${xp} XP` : ""} · u to undo`,
		edited: (summary: string) => `Updated ${summary}.`,
		undone: "Undid the last line.",
		nothingToUndo: "Nothing to undo.",
		errors: {
			empty: "Type what to log, e.g. 2 eggs, toast.",
			badTime: "A time looks like @y, @-2d, @7:30, or @y 21:00.",
			badNumber: "A number is missing or unreadable.",
			outOfRange: "That number is out of range.",
			badSleep: "Sleep looks like sl 23:30-7:10 q4 or sl 7.5h.",
			badMood: "A mood looks like m 4 e3 s2 #work.",
			badGoal: "Goals are water, sleep, steps, or focus, e.g. goal water 2.5l.",
			noMinutes: "Add the minutes, e.g. wo run 30m.",
			noPreviousSets:
				"No earlier sets to repeat; add them, e.g. wo bench 60x5x3.",
			nothingToRepeat: "Nothing logged yet to repeat.",
			nothingToCopy: "Nothing was eaten yesterday to copy.",
			tooLong: "A note holds up to 2,000 characters.",
		} satisfies Record<ParseError, string>,
	// events
		goalChanged: (setting: string) => `Changed a goal · ${setting}`,
		logDeleted: (kind: string) => `Deleted a log · ${kind}`,
		logEdited: (kind: string) => `Edited a log · ${kind}`,
```

For `traditionalChinese`:

```ts
	groups: {
		today: "今日",
		journal: "日誌",
		settings: "設定",
		system: "系統",
	},
	menu: {
		log: "記錄",
		quotes: "每日語錄",
		timer: "番茄鐘",
		logs: "歷史紀錄",
		profile: "個人資料",
		theme: "主題",
		language: "語言",
		update: "軟體更新",
		environment: "環境變數",
	},
```

```ts
	// describe
		log: "用一行記錄任何事，例如：2 顆蛋, 吐司 · w 500 · wo 跑步 30m · sl 23:30-7:10。輸入列空白時，會建議你這個時段常記錄的內容。",
	// signal
		loggedToday: (count) => `今天記錄 ${count} 筆`,
	// hints
		log: "↑↓ 挑選 · tab 補全 · enter 記錄 · esc 返回",
	// log, above quickAdd
		title: "記錄",
		editTitle: "編輯紀錄",
		placeholder: "2 顆蛋, 吐司 · w 500 · wo 跑步 30m",
		prefixes:
			"w 喝水 · wt 體重 · waist 腰圍 · bf 體脂 · sl 睡眠 · m 心情 · h 習慣 · st 步數 · n 筆記",
		shortcuts:
			"wo 運動 · goal 目標 · @y 昨天 · @7:30 時間 · . 重複 · copy y 複製昨天 · u 復原",
		more: (count) => `還有 ${count} 項`,
		undoHint: "按 Enter 復原剛才在這裡記錄的上一行。",
		logged: (summary, xp) =>
			`已記錄 ${summary}${xp > 0 ? ` · +${xp} XP` : ""} · 輸入 u 復原`,
		edited: (summary) => `已更新 ${summary}。`,
		undone: "已復原上一行。",
		nothingToUndo: "沒有可復原的紀錄。",
		errors: {
			empty: "輸入要記錄的內容，例如：2 顆蛋, 吐司。",
			badTime: "時間的寫法是 @y、@-2d、@7:30 或 @y 21:00。",
			badNumber: "缺少數字，或數字無法辨識。",
			outOfRange: "這個數字超出範圍。",
			badSleep: "睡眠的寫法是 sl 23:30-7:10 q4 或 sl 7.5h。",
			badMood: "心情的寫法是 m 4 e3 s2 #工作。",
			badGoal:
				"目標可以是 water、sleep、steps 或 focus，例如 goal water 2.5l。",
			noMinutes: "請加上分鐘數，例如 wo 跑步 30m。",
			noPreviousSets: "沒有可以重複的組數，請輸入，例如 wo 臥推 60x5x3。",
			nothingToRepeat: "還沒有可以重複的紀錄。",
			nothingToCopy: "昨天沒有可以複製的餐點。",
			tooLong: "筆記最多 2,000 個字。",
		},
	// events
		goalChanged: (setting) => `變更目標 · ${setting}`,
		logDeleted: (kind) => `刪除紀錄 · ${kind}`,
		logEdited: (kind) => `編輯紀錄 · ${kind}`,
```

For `korean`:

```ts
	groups: {
		today: "오늘",
		journal: "일지",
		settings: "설정",
		system: "시스템",
	},
	menu: {
		log: "기록하기",
		quotes: "오늘의 명언",
		timer: "토마토 타이머",
		logs: "지난 기록",
		profile: "프로필",
		theme: "테마",
		language: "언어",
		update: "앱 업데이트",
		environment: "환경 변수",
	},
```

```ts
	// describe
		log: "한 줄로 무엇이든 기록합니다. 예: 계란 2개, 토스트 · w 500 · wo 달리기 30m · sl 23:30-7:10. 줄이 비어 있으면 지금 자주 기록하는 항목을 제안합니다.",
	// signal
		loggedToday: (count) => `오늘 ${count}개 기록`,
	// hints
		log: "↑↓ 고르기 · tab 완성 · enter 기록 · esc 뒤로",
	// log, above quickAdd
		title: "기록하기",
		editTitle: "기록 수정",
		placeholder: "계란 2개, 토스트 · w 500 · wo 달리기 30m",
		prefixes:
			"w 물 · wt 체중 · waist 허리 · bf 체지방 · sl 수면 · m 기분 · h 습관 · st 걸음 · n 메모",
		shortcuts:
			"wo 운동 · goal 목표 · @y 어제 · @7:30 시각 · . 반복 · copy y 어제 복사 · u 되돌리기",
		more: (count) => `외 ${count}개`,
		undoHint: "Enter를 누르면 여기서 방금 기록한 줄을 되돌립니다.",
		logged: (summary, xp) =>
			`${summary} 기록함${xp > 0 ? ` · +${xp} XP` : ""} · u로 되돌리기`,
		edited: (summary) => `${summary} 수정함.`,
		undone: "마지막 줄을 되돌렸습니다.",
		nothingToUndo: "되돌릴 기록이 없습니다.",
		errors: {
			empty: "기록할 내용을 입력하세요. 예: 계란 2개, 토스트",
			badTime: "시각은 @y, @-2d, @7:30, @y 21:00처럼 씁니다.",
			badNumber: "숫자가 없거나 읽을 수 없습니다.",
			outOfRange: "숫자가 허용 범위를 벗어났습니다.",
			badSleep: "수면은 sl 23:30-7:10 q4 또는 sl 7.5h처럼 씁니다.",
			badMood: "기분은 m 4 e3 s2 #일처럼 씁니다.",
			badGoal:
				"목표는 water, sleep, steps, focus 중 하나입니다. 예: goal water 2.5l",
			noMinutes: "시간을 함께 입력하세요. 예: wo 달리기 30m",
			noPreviousSets: "반복할 이전 세트가 없습니다. 예: wo 벤치프레스 60x5x3",
			nothingToRepeat: "반복할 기록이 아직 없습니다.",
			nothingToCopy: "어제 먹은 기록이 없어 복사할 수 없습니다.",
			tooLong: "메모는 2,000자까지 쓸 수 있습니다.",
		},
	// events
		goalChanged: (setting) => `목표 변경 · ${setting}`,
		logDeleted: (kind) => `기록 삭제 · ${kind}`,
		logEdited: (kind) => `기록 수정 · ${kind}`,
```

- [ ] **Step 6: Rebuild the menu, the statuses, and the event text**

In `source/content.ts`, the menu shrinks back to 9 items:

```ts
// Header and footer take 5 rows. The character's panel is 25 rows tall,
// Today 19 with its spacing or 16 compact, the menu 15 with its 4 headings
// and 9 items, and Recent 7.
```

```ts
const menuRows = 15;
const compactMenuRows = 11;
```

Replace `menuOrder` and `menuGroups`:

```ts
export const menuOrder = [
	"log",
	"timer",
	"logs",
	"quotes",
	"profile",
	"theme",
	"language",
	"environment",
	"update",
] as const;
export type MenuKey = (typeof menuOrder)[number];

// The headings the menu is grouped under; they only label, never open.
export const menuGroups = {
	log: "today",
	timer: "today",
	logs: "journal",
	quotes: "settings",
	profile: "settings",
	theme: "settings",
	language: "settings",
	environment: "settings",
	update: "system",
} as const satisfies Record<MenuKey, string>;
```

Replace `menuEntriesOf`, which counts what was logged today for the Log item and no longer needs the targets:

```ts
export function menuEntriesOf(
	messages: Messages,
	state: Readonly<{
		timerSignal: string;
		progress: Progress;
		quotes: QuoteSettings;
		now: number;
		logs: number;
		theme: ThemeName;
		focus: number;
		rest: number;
		version: string;
		newest?: string;
		savedVariables: number;
	}>,
): MenuEntry[] {
	const { profile } = state.progress;
	const day = new Date(state.now).toDateString();
	const loggedToday = logsOf(state.progress).filter(
		(log) =>
			log.kind !== "event" &&
			log.kind !== "focus" &&
			new Date(log.at).toDateString() === day,
	).length;

	const statuses: Record<MenuKey, string> = {
		quotes: state.quotes.autoRefresh
			? messages.signal.quotesAuto(
					messages.quotes.intervals(state.quotes.interval),
				)
			: messages.signal.quotesManual,
		log: messages.signal.loggedToday(loggedToday),
		timer: state.timerSignal,
		logs: messages.signal.entries(state.logs),
		profile: profile?.name ?? messages.signal.setUp,
		theme: messages.themes.names[state.theme],
		language: messages.languageName,
		environment: messages.signal.saved(state.savedVariables),
		update:
			state.newest && isNewer(state.newest, state.version)
				? messages.signal.updateAvailable(state.newest)
				: messages.signal.version(state.version),
	};
	const descriptions: Record<MenuKey, string> = {
		quotes: messages.describe.quotes,
		timer: messages.describe.timer(state.focus, state.rest),
		log: messages.describe.log,
		logs: messages.describe.logs,
		profile: messages.describe.profile,
		theme: messages.describe.theme,
		language: messages.describe.language,
		environment: messages.describe.environment,
		update: messages.describe.update,
	};

	return menuOrder.map((key) => ({
		key,
		group: messages.groups[menuGroups[key]],
		label: messages.menu[key],
		status: statuses[key],
		description: descriptions[key],
	}));
}
```

Add above `describeEvent`:

```ts
// What the character does when a kind is logged.
const activityByKind: Record<LogKind, Activity> = {
	focus: "focus",
	meal: "eat",
	workout: "run",
	water: "eat",
	sleep: "break",
	body: "stretch",
	mood: "break",
	habit: "focus",
	steps: "run",
	note: "focus",
	event: "idle",
};

export const activityOfKind = (kind: LogKind): Activity => activityByKind[kind];
```

In `describeEvent`, add before the final `return`:

```ts
if (event.action === "goalChanged") {
	const [goal = "", value = ""] = detail.split(":");
	const key = goalKeys.find((option) => option === goal);
	return events.goalChanged(
		key ? goalText(key, Number(value), messages) : detail,
	);
}

if (event.action === "logDeleted" || event.action === "logEdited") {
	const kind = logKinds.find((option) => option === detail);
	return events[event.action](kind ? messages.logs.kinds[kind] : detail);
}
```

Delete `dietFieldsOf`, `workoutCombinationsOf`, and `workoutFieldsOf`, everything from `export const dietFieldsOf` up to the comment above `profileFieldsOf`. Fix the imports: drop `foodSuggestions`, the `Combination` type, `intensities`, and `type Meal`; add `goalKeys`, `type LogKind`, `logKinds`, and `logsOf` from `./progress.js`, and `import type { Activity } from "./pixel-art.js";` above the `theme.js` import.

- [ ] **Step 7: Write the view**

```tsx
// source/components/log-view.tsx
import React from "react";
import { Box, Text, useInput, usePaste } from "ink";
import { foodSuggestions } from "../foods.js";
import { formatNumber, type Language, type Messages } from "../i18n.js";
import type { Progress } from "../progress.js";
import {
	completionOf,
	describeDraft,
	type Draft,
	type ParseContext,
	parseQuickLog,
	suggestionsOf,
} from "../quick-log.js";
import { usePalette } from "../theme.js";

type LogViewProps = Readonly<{
	progress: Progress;
	language: Language;
	messages: Messages;
	// The time a line is logged at: now, or an edited entry's own time.
	now: number;
	// The line of an entry being edited, logged again in its place on Enter.
	initialLine?: string;
	onLog: (line: string, drafts: Draft[]) => void;
	onUndo: () => void;
}>;

type Option = Readonly<{ label: string; line: string; detail: string }>;

// With the line empty, the suggestions for now; while a food name is typed,
// the foods it matches, each completing the line.
function optionsOf(
	text: string,
	{ progress, now, language }: ParseContext,
	messages: Messages,
): Option[] {
	if (!text) {
		return suggestionsOf(progress, now).map((suggestion) => ({
			label: suggestion.line,
			line: suggestion.line,
			detail: suggestion.label,
		}));
	}

	const completion = completionOf(text);
	const format = (value: number | undefined) =>
		formatNumber(language, Math.round(value ?? 0));

	if (!completion?.query.trim()) {
		return [];
	}

	return foodSuggestions(completion.query, language, progress.meals).map(
		(food) => ({
			label: food.label,
			line: `${completion.head}${food.label}`,
			detail: [
				food.isYours ? messages.form.yours : food.serving,
				messages.form.nutrition(format(food.calories), format(food.protein)),
			]
				.filter(Boolean)
				.join(" · "),
		}),
	);
}

// Drafts shown under the line before the rest are counted.
const previewCount = 4;

// The Log command line: a live preview of what the line will log, and below
// it the suggestions for now or the foods matching the name being typed.
// Logging, undo, and saving happen in App, through the callbacks.
export default function LogView({
	progress,
	language,
	messages,
	now,
	initialLine,
	onLog,
	onUndo,
}: LogViewProps) {
	const palette = usePalette();
	const [text, setText] = React.useState(initialLine ?? "");
	const [picked, setPicked] = React.useState(-1);
	const { log } = messages;
	const isEditing = initialLine !== undefined;
	const isUndo = !isEditing && text.trim() === "u";
	const context = { progress, now, language };
	const options = isUndo ? [] : optionsOf(text, context, messages);
	const highlighted = options[picked];
	const line = highlighted?.line ?? text;
	const result = line.trim() ? parseQuickLog(line, context) : undefined;
	const type = (typed: string) => {
		setText((current) => current + typed);
		setPicked(-1);
	};

	useInput((input, key) => {
		if (key.return) {
			if (isUndo) {
				onUndo();
				setText("");
			} else if (result?.ok) {
				onLog(line, result.drafts);
				setText("");
				setPicked(-1);
			}
		} else if (key.upArrow) {
			setPicked((current) => Math.max(current - 1, -1));
		} else if (key.downArrow) {
			setPicked((current) => Math.min(current + 1, options.length - 1));
		} else if (key.tab) {
			const choice = highlighted ?? options[0];

			if (choice) {
				setText(choice.line);
				setPicked(-1);
			}
		} else if (key.backspace || key.delete) {
			setText((current) => [...current].slice(0, -1).join(""));
			setPicked(-1);
		} else if (input && !key.ctrl && !key.meta && !key.escape) {
			type(input);
		}
	});

	// A paste arrives whole and waits for Enter like anything typed; its lines
	// become the items of 1 line.
	usePaste((pasted) => {
		type(
			pasted
				.split(/\r\n|\r|\n/v)
				.map((part) => part.trim())
				.filter(Boolean)
				.join(", "),
		);
	});

	let preview: React.ReactNode = null;

	if (isUndo) {
		preview = <Text dimColor>{log.undoHint}</Text>;
	} else if (result && !result.ok) {
		preview = <Text color={palette.error}>{log.errors[result.error]}</Text>;
	} else if (result?.ok) {
		const { drafts } = result;
		// The items of 1 line may read the same, so each keeps its position.
		const rows = drafts.slice(0, previewCount).map((draft, position) => ({
			position,
			text: describeDraft(draft, messages, language),
			isKnown: draft.kind !== "meal" || draft.isKnown,
		}));
		preview = (
			<>
				{rows.map((row) => (
					<Text key={row.position} wrap="truncate-end">
						<Text color={row.isKnown ? palette.success : palette.error}>
							{"⏺ "}
						</Text>
						<Text>{row.text}</Text>
					</Text>
				))}
				{drafts.length > previewCount ? (
					<Text dimColor>{log.more(drafts.length - previewCount)}</Text>
				) : null}
			</>
		);
	}

	return (
		<Box flexDirection="column">
			<Text bold color={palette.accent}>
				{isEditing ? log.editTitle : log.title}
			</Text>
			<Box gap={1}>
				<Box flexShrink={0}>
					<Text color={palette.accent}>❯</Text>
				</Box>
				<Text wrap="truncate-start">
					{text ? (
						<Text color={palette.accent}>{text}</Text>
					) : (
						<Text dimColor>{log.placeholder}</Text>
					)}
					<Text inverse> </Text>
				</Text>
			</Box>
			<Box flexDirection="column" paddingLeft={2}>
				{preview}
			</Box>
			{options.length > 0 ? (
				<Box flexDirection="column" marginTop={1}>
					{options.map((option, index) => {
						const isPicked = index === picked;

						return (
							<Box key={option.line} gap={1}>
								<Box flexShrink={0}>
									<Text color={palette.accent}>{isPicked ? "❯" : " "}</Text>
								</Box>
								<Text wrap="truncate-end">
									<Text
										bold={isPicked}
										color={isPicked ? palette.accent : undefined}
									>
										{option.label}
									</Text>
									<Text dimColor>{` ${option.detail}`}</Text>
								</Text>
							</Box>
						);
					})}
				</Box>
			) : null}
			<Box flexDirection="column" marginTop={1}>
				<Text dimColor wrap="truncate-end">
					{log.prefixes}
				</Text>
				<Text dimColor wrap="truncate-end">
					{log.shortcuts}
				</Text>
			</Box>
		</Box>
	);
}
```

- [ ] **Step 8: Log, undo, and show the view from `App`**

In `source/app.tsx`:

1. Import `LogView` from `./components/log-view.js`, `activityOfKind` from `./content.js`, and `type Added, applyDrafts, type Draft, summaryOf, undoAdded` from `./quick-log.js`. Drop `dietFieldsOf`, `workoutFieldsOf`, `intensities`, `workoutActivities`, `experiencePerMeal`, and `workoutExperience`.
2. Replace `const [draftActivity, setDraftActivity] = React.useState<string>();` with:

```tsx
// What each line logged in the open Log view added, newest last, for undo.
const [undoStack, setUndoStack] = React.useState<Added[][]>([]);
```

3. In `backToMenu`, replace `setDraftActivity(undefined);` with `setUndoStack([]);`.
4. In the dashboard's `useInput`, the only form left is the profile: replace the 2 lines that build `isForm` with `backToMenu(view === "profile" ? messages.form.cancelled : undefined);`.
5. Let `record` report whether it saved: replace its body from `const { form } = …` to the end of the callback with:

```tsx
const { form } = messagesOf(next.language ?? "en");
const isSaved = commit(
	next,
	leveledUp ? `${text} ${form.levelUp(after)}` : text,
	"success",
);

if (isSaved) {
	setFlash({
		activity: leveledUp ? "levelUp" : activity,
		until: Date.now() + flashMilliseconds,
	});
}

return isSaved;
```

6. Replace `submitMeal` and `submitWorkout` with:

```tsx
// Saves what 1 line logged, says what and how much XP it earned, and keeps
// it for undo; a goal is logged as an event instead.
const logLine = (_line: string, drafts: Draft[]) => {
	const { next, added } = applyDrafts(progress, drafts);
	let withGoals = next;

	for (const draft of drafts) {
		if (draft.kind === "goal") {
			withGoals = withEvent(
				withGoals,
				"goalChanged",
				`${draft.goal}:${draft.value}`,
			);
		}
	}

	const [first] = drafts;
	let activity: Activity = "idle";

	if (first?.kind === "workout") {
		activity = workoutAnimation(first.activity);
	} else if (first && first.kind !== "goal") {
		activity = activityOfKind(first.kind);
	}

	const isSaved = record(
		() => withGoals,
		messages.log.logged(
			summaryOf(drafts, messages),
			experienceOf(next) - experienceOf(progress),
		),
		activity,
	);

	if (isSaved && added.length > 0) {
		setUndoStack((stack) => [...stack, added]);
	}
};

// Takes back the newest line logged since the Log view opened.
const undoLine = () => {
	const added = undoStack.at(-1);

	if (!added) {
		say(messages.log.nothingToUndo);
		return;
	}

	const next = withEvent(
		undoAdded(progress, added),
		"logDeleted",
		added[0]?.kind,
	);

	if (commit(next, messages.log.undone, "success")) {
		setUndoStack((stack) => stack.slice(0, -1));
	}
};
```

7. The character no longer acts out an open form: replace the `activity` expression with:

```tsx
const activity: Activity =
	flash && flash.until > now
		? flash.activity
		: isRunning
			? ({ focus: "focus", break: "break" } as const)[timer.phase]
			: "idle";
```

8. Replace `isTyping` and the `hint` selection that follows it (the `let hint` and its `if` chain, or the `switch` it became) with a lookup:

```tsx
// The keys of the open view; any view not named here picks from a list.
const hints: Partial<Record<View, string>> = {
	menu: messages.hints.menu,
	log: messages.hints.log,
	logs: messages.hints.logs,
	profile: messages.hints.form,
	environment: variableEditor
		? messages.hints.edit
		: messages.hints.environment,
	quotes:
		quoteEditor === "author" || quoteEditor === "work"
			? messages.hints.suggest
			: undefined,
};
const hint = hints[view] ?? messages.hints.select;
```

9. In `panels`, replace the `diet` and `workout` entries with:

```tsx
		log: (
			<LogView
				key="log"
				language={language}
				messages={messages}
				now={now}
				progress={progress}
				onLog={logLine}
				onUndo={undoLine}
			/>
		),
```

10. In `preview`, show the targets under the Log item: `{focusedEntry.key === "log" ? (`.
11. Hide the menu box for both the Log and History views:

```tsx
							// The Log and History views need the width more than the menu.
							display={view === "log" || view === "logs" ? "none" : "flex"}
```

- [ ] **Step 9: Update the layout rule**

In `.claude/rules/terminal-layout.md`, change the Menu row to "the 9 numbered items under 4 headings: Today, Journal, Settings, and System", change "The Menu shows its group headings from 28 rows" to "from 27 rows", and change the sentence "The Logs view takes the place of the Menu, the Description, and Recent while it is open." to "History takes the place of the Menu, the Description, and Recent while it is open, and the Log view the place of the Menu and the Description, with Recent under it."

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npm run build && npx ava build/tests/dashboard.test.js build/tests/content.test.js build/tests/quick-log.test.js build/tests/data.test.js`
Expected: PASS.

- [ ] **Step 11: Try it, run the gate, and commit**

Run `TERMINAL_SIGMA_HOME="$(mktemp -d)" npm start`, press `1` and Enter, and log `2 eggs, toast`, `w`, `wo run 30m hard`, and `u`; then switch to 繁體中文 and log `２個雞蛋，吐司` through the input method. Then run `npm test`.

```bash
git add source/components/log-view.tsx source/quick-log.ts source/progress.ts source/content.ts source/i18n.ts source/app.tsx .claude/rules/terminal-layout.md source/tests/dashboard.test.tsx source/tests/content.test.ts source/tests/data.test.ts source/tests/quick-log.test.ts
git commit -m "feat: log everything from 1 command line"
```

---

### Task 11: History: Filter, Edit, Delete, Repeat, and Undo

**Files:**

- Create: `source/components/history-view.tsx`
- Delete: `source/components/logs-view.tsx`
- Modify: `source/app.tsx` (imports, state, `backToMenu`, Esc, the handlers, and the `logs` and `log` panels)
- Modify: `source/i18n.ts` (`logs`, `hints.logs`, `describe.logs` in all 3 languages)
- Test: `source/tests/dashboard.test.tsx`

**Interfaces:**

- Consumes: `draftOf`, `lineOf`, `restoreLog`, `undoAdded`, `applyDrafts`, `summaryOf` from Task 8; `LogView` with `initialLine` from Task 10
- Produces:
  - Default export `HistoryView` with props `logs`, `language`, `messages`, `height`, `onEdit(log)`, `onDelete(log)`, `onRepeat(log)`, and `onUndo()`; it still exports `LogRow` and re-exports `describeLog` for Recent
  - `messages.logs.deleted`, `restored`, `cannotEdit`; `logs.title` becomes History

History filters by every kind, cycling with ←→ through All, Focus, Diet, Workout, Water, Sleep, Body, Mood, Habit, Steps, Note, and Action, and shows the current filter as `‹ Diet ›`, because 12 tabs do not fit a 60-column panel. A cursor marks 1 row: `e` opens the Log view with the row's `lineOf` and parses it at the row's own time, so an edit keeps its day; Enter replaces exactly that entry by kind and index, even when other items of its line share its timestamp, and appends `logEdited`. `d` deletes it and appends `logDeleted`; `u` puts the newest deleted entry back at its index and appends `logEdited`; `r` logs it again now, through the same path as a typed line. Focus sessions come from the timer and actions are the record of what was done, so none of the 3 changes them. Esc from an edit returns to History.

- [ ] **Step 1: Write the failing tests**

Append to `source/tests/dashboard.test.tsx`:

```tsx
const right = "\u001B[C";

test("edits an older log in place, keeping its day and its neighbor", async (t) => {
	const at = new Date(Date.now() - 3 * 86_400_000).toISOString();
	const { file, stdin, lastFrame, unmount } = start({
		...empty,
		meals: [
			{ at, food: "Egg", servings: 2, calories: 144 },
			{ at, food: "Toast", calories: 160 },
		],
	});

	// History, the Diet filter, then the second item of that line.
	await type(stdin, ["3", "\r", right, right, down, "e"]);
	t.true((lastFrame() ?? "").includes("Toast 160kcal"));

	await type(stdin, [backspace.repeat(13), "Bagel 280kcal", "\r"]);
	t.deepEqual(loadProgress(file).meals, [
		{ at, food: "Egg", servings: 2, calories: 144 },
		{ at, food: "Bagel", calories: 280 },
	]);
	t.like(loadProgress(file).events.at(-1), {
		action: "logEdited",
		detail: "meal",
	});
	t.true((lastFrame() ?? "").includes("History"), "back in History");

	unmount();
});

test("deletes a log, puts it back, and logs it again now", async (t) => {
	const at = new Date(Date.now() - 86_400_000).toISOString();
	const { file, stdin, lastFrame, unmount } = start({
		...empty,
		water: [{ at, milliliters: 500 }],
	});

	// History, then the Water filter: All, Focus, Diet, Workout, Water.
	await type(stdin, ["3", "\r", right, right, right, right, "d"]);
	t.deepEqual(loadProgress(file).water, []);
	t.true(actionsIn(file).includes("logDeleted"));

	await type(stdin, ["u"]);
	t.deepEqual(loadProgress(file).water, [{ at, milliliters: 500 }]);

	await type(stdin, ["r"]);
	t.is(loadProgress(file).water.length, 2);
	t.true((lastFrame() ?? "").includes("Logged Water"));

	// The Actions filter is the last of 12, 7 after Water.
	await type(stdin, [...Array.from({ length: 7 }, () => right), "e"]);
	t.true((lastFrame() ?? "").includes("cannot change"));

	unmount();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run build && npx ava build/tests/dashboard.test.js --match "*log*"`
Expected: FAIL — History has no cursor, and `e` and `d` do nothing.

- [ ] **Step 3: Write the view**

Delete `source/components/logs-view.tsx` and create:

```tsx
// source/components/history-view.tsx
import React from "react";
import { Box, Text, useInput } from "ink";
import { describeLog } from "../content.js";
import type { Language, Messages } from "../i18n.js";
import { type Log, logKinds } from "../progress.js";
import { usePalette } from "../theme.js";

export { describeLog } from "../content.js";

const filters = ["all", ...logKinds] as const;
type Filter = (typeof filters)[number];

type LogRowProps = Readonly<{
	log: Log;
	language: Language;
	messages: Messages;
}>;

export function LogRow({ log, language, messages }: LogRowProps) {
	const palette = usePalette();
	const kindColor: Record<Log["kind"], string> = {
		focus: palette.metrics.focus,
		meal: palette.metrics.protein,
		workout: palette.metrics.workout,
		water: palette.soft,
		sleep: palette.deep,
		body: palette.metrics.character,
		mood: palette.accent,
		habit: palette.metrics.calories,
		steps: palette.metrics.workout,
		note: palette.soft,
		event: palette.soft,
	};
	const formatDate = new Intl.DateTimeFormat(language, {
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});

	return (
		<Box gap={1}>
			<Box flexShrink={0} width={12}>
				<Text dimColor>{formatDate.format(new Date(log.at))}</Text>
			</Box>
			<Box flexShrink={0} width={8}>
				<Text color={kindColor[log.kind]} wrap="truncate-end">
					{messages.logs.kinds[log.kind]}
				</Text>
			</Box>
			<Box flexGrow={1}>
				<Text wrap="truncate-end">{describeLog(log, language, messages)}</Text>
			</Box>
			<Box flexShrink={0} justifyContent="flex-end" width={8}>
				<Text color={palette.accent}>
					{log.experience > 0 ? `+${log.experience} XP` : ""}
				</Text>
			</Box>
		</Box>
	);
}

type HistoryViewProps = Readonly<{
	logs: readonly Log[];
	language: Language;
	messages: Messages;
	height: number;
	onEdit: (log: Log) => void;
	onDelete: (log: Log) => void;
	onRepeat: (log: Log) => void;
	onUndo: () => void;
}>;

// Every log, newest first, filtered by kind, with a cursor: e edits the log
// under it, d deletes it, r logs it again now, and u puts back the last
// deleted one. App does the saving through the callbacks.
export default function HistoryView({
	logs,
	language,
	messages,
	height,
	onEdit,
	onDelete,
	onRepeat,
	onUndo,
}: HistoryViewProps) {
	const palette = usePalette();
	const [filter, setFilter] = React.useState<Filter>("all");
	const [cursor, setCursor] = React.useState(0);
	const [offset, setOffset] = React.useState(0);
	const shown = logs.filter((log) => filter === "all" || log.kind === filter);
	// Title, summary, and their spacing take 3 rows.
	const pageSize = Math.max(height - 3, 3);
	const at = Math.min(cursor, Math.max(shown.length - 1, 0));
	const top = Math.min(offset, at);
	const label = (option: Filter) =>
		option === "all" ? messages.logs.all : messages.logs.kinds[option];

	useInput((input, key) => {
		const picked = shown[at];
		const moveFilter = (step: number) => {
			const next =
				filters[
					(filters.indexOf(filter) + step + filters.length) % filters.length
				];

			if (next) {
				setFilter(next);
				setCursor(0);
				setOffset(0);
			}
		};

		const moveCursor = (step: number) => {
			const next = Math.min(Math.max(at + step, 0), shown.length - 1);
			setCursor(next);
			setOffset(Math.min(Math.max(top, next - pageSize + 1), next));
		};

		if (key.leftArrow || input === "h") {
			moveFilter(-1);
		} else if (key.rightArrow || input === "l" || key.tab) {
			moveFilter(1);
		} else if (key.upArrow || input === "k") {
			moveCursor(-1);
		} else if (key.downArrow || input === "j") {
			moveCursor(1);
		} else if (key.pageUp) {
			moveCursor(-pageSize);
		} else if (key.pageDown) {
			moveCursor(pageSize);
		} else if (input === "u") {
			onUndo();
		} else if (picked && input === "e") {
			onEdit(picked);
		} else if (picked && input === "d") {
			onDelete(picked);
		} else if (picked && input === "r") {
			onRepeat(picked);
		}
	});

	return (
		<Box flexDirection="column" flexGrow={1}>
			<Box gap={2}>
				<Text bold color={palette.accent}>
					{messages.logs.title}
				</Text>
				<Text>
					<Text dimColor>{"‹ "}</Text>
					<Text bold color={palette.accent}>
						{label(filter)}
					</Text>
					<Text dimColor>{" ›"}</Text>
				</Text>
				<Text dimColor wrap="truncate-end">
					{messages.logs.summary(
						shown.length,
						shown.reduce((total, log) => total + log.experience, 0),
					)}
				</Text>
			</Box>
			<Box flexDirection="column" marginTop={1}>
				{shown.length === 0 ? (
					<Text dimColor>{messages.logs.empty}</Text>
				) : null}
				{shown.slice(top, top + pageSize).map((log, row) => (
					<Box key={`${log.kind}-${log.index}`} gap={1}>
						<Box flexShrink={0}>
							<Text color={palette.accent}>{top + row === at ? "❯" : " "}</Text>
						</Box>
						<Box flexGrow={1}>
							<LogRow language={language} log={log} messages={messages} />
						</Box>
					</Box>
				))}
			</Box>
		</Box>
	);
}
```

- [ ] **Step 4: Name what History does in all 3 languages**

In `source/i18n.ts`, set `logs.title` and add the 3 messages above `all` in `logs`, replace `hints.logs`, and replace `describe.logs`. For `en`:

```ts
	// logs
		title: "History",
		deleted: "Deleted the log. Press u to put it back.",
		restored: "Put the log back.",
		cannotEdit: "Focus and actions cannot change.",
	// hints
		logs: "←→ filter · e edit · d delete · r repeat · u undo · esc back",
	// describe
		logs: "Browse every log and action, filtered by kind; edit, delete, or repeat a log, and undo a delete.",
```

For `traditionalChinese`:

```ts
	// logs
		title: "歷史紀錄",
		deleted: "已刪除這筆紀錄，按 u 還原。",
		restored: "已還原這筆紀錄。",
		cannotEdit: "專注與操作紀錄不能更改。",
	// hints
		logs: "←→ 篩選 · e 編輯 · d 刪除 · r 重複 · u 復原 · esc 返回",
	// describe
		logs: "依類型瀏覽每一筆紀錄與操作；可以編輯、刪除或重複一筆紀錄，也能復原刪除。",
```

For `korean`:

```ts
	// logs
		title: "지난 기록",
		deleted: "기록을 삭제했습니다. u를 누르면 되돌립니다.",
		restored: "기록을 되돌렸습니다.",
		cannotEdit: "집중과 활동 기록은 바꿀 수 없습니다.",
	// hints
		logs: "←→ 필터 · e 수정 · d 삭제 · r 반복 · u 되돌리기 · esc 뒤로",
	// describe
		logs: "모든 기록과 활동을 종류별로 봅니다. 기록을 수정, 삭제, 반복하고 삭제를 되돌릴 수 있습니다.",
```

The hint drops "↑↓ move" so the footer keeps room for what just happened.

- [ ] **Step 5: Edit, delete, repeat, and undo from `App`**

In `source/app.tsx`:

1. Import `HistoryView, { LogRow }` from `./components/history-view.js` in place of the `logs-view.js` import, `draftOf, lineOf, restoreLog` beside `applyDrafts`, and `type Log` from `./progress.js`.
2. Add state under `undoStack`:

```tsx
// The log being edited in the Log view, and what History deleted, newest
// last, for its undo.
const [editing, setEditing] = React.useState<Log>();
const [deleted, setDeleted] = React.useState<Log[]>([]);
```

3. In `backToMenu`, add `setEditing(undefined);` and `setDeleted([]);` after `setUndoStack([]);`.
4. In the dashboard's `useInput`, add before the generic Esc branch:

```tsx
			} else if (view === "log" && editing && key.escape) {
				setEditing(undefined);
				setView("logs");
```

5. Add above `submitProfile`:

```tsx
// Focus sessions come from the timer and actions are the record of what
// was done, so History changes neither.
const isFixed = (log: Log) => log.kind === "focus" || log.kind === "event";

const startEdit = (log: Log) => {
	if (isFixed(log)) {
		say(messages.logs.cannotEdit);
		return;
	}

	setEditing(log);
	setView("log");
};

// Swaps the edited log for what its line now says, at its own time.
const replaceLog = (_line: string, drafts: Draft[]) => {
	if (!editing) {
		return;
	}

	const { next } = applyDrafts(undoAdded(progress, [editing]), drafts);

	if (
		commit(
			withEvent(next, "logEdited", editing.kind),
			messages.log.edited(summaryOf(drafts, messages)),
			"success",
		)
	) {
		setEditing(undefined);
		setDeleted([]);
		setView("logs");
	}
};

const deleteLog = (log: Log) => {
	if (isFixed(log)) {
		say(messages.logs.cannotEdit);
		return;
	}

	if (
		commit(
			withEvent(undoAdded(progress, [log]), "logDeleted", log.kind),
			messages.logs.deleted,
			"success",
		)
	) {
		setDeleted((stack) => [...stack, log]);
	}
};

const restoreDeleted = () => {
	const log = deleted.at(-1);

	if (!log) {
		say(messages.log.nothingToUndo);
		return;
	}

	if (
		commit(
			withEvent(restoreLog(progress, log), "logEdited", log.kind),
			messages.logs.restored,
			"success",
		)
	) {
		setDeleted((stack) => stack.slice(0, -1));
	}
};

const repeatLog = (log: Log) => {
	const draft = draftOf(log);

	if (draft) {
		logLine("", [{ ...draft, at: new Date().toISOString() }]);
	} else {
		say(messages.logs.cannotEdit);
	}
};
```

6. Replace the `logs` panel:

```tsx
		logs: (
			<HistoryView
				height={Math.max(rows - 9, 6)}
				language={language}
				logs={logs}
				messages={messages}
				onDelete={deleteLog}
				onEdit={startEdit}
				onRepeat={repeatLog}
				onUndo={restoreDeleted}
			/>
		),
```

7. Replace the `log` panel, so it edits when `editing` is set:

```tsx
		log: (
			<LogView
				key={editing ? `edit-${editing.kind}-${editing.index}` : "log"}
				initialLine={editing ? lineOf(editing, language) : undefined}
				language={language}
				messages={messages}
				now={editing ? Date.parse(editing.at) : now}
				progress={progress}
				onLog={editing ? replaceLog : logLine}
				onUndo={undoLine}
			/>
		),
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run build && npx ava build/tests/dashboard.test.js`
Expected: PASS.

- [ ] **Step 7: Run the gate and commit**

Run: `npm test`
Expected: everything passes.

```bash
git add source/components/history-view.tsx source/components/logs-view.tsx source/app.tsx source/i18n.ts source/tests/dashboard.test.tsx
git commit -m "feat: edit, delete, and repeat logs from History"
```

---

### Task 12: Insights and the Week Tab

**Files:**

- Create: `source/insights.ts`
- Modify: `source/components/history-view.tsx` (the Week filter and `WeekView`)
- Modify: `source/app.tsx` (pass `progress` and `now` to `HistoryView`)
- Modify: `source/i18n.ts` (`logs.week` and a new `week` section in all 3 languages)
- Test: `source/tests/insights.test.ts`, `source/tests/dashboard.test.tsx`

**Interfaces:**

- Consumes: `logsOf`, `profileNow`, `todayOf`, `type Today` from Task 2; `targetsOf`, `type Targets` from Task 3; `exerciseName` from Task 1; `durationOf` from Task 2
- Produces:
  - `activeDaysOf(progress: Progress): ReadonlySet<string>` (local `toDateString()` keys of days with any log but an action)
  - `streakOf(progress: Progress, now: number): number`
  - `weightTrendOf(progress: Progress, now: number, days: number): number[]` (oldest first; `[]` with no weigh-in)
  - `habitStrengthsOf(progress: Progress, now: number): Array<{ name: string; strength: number }>` (percent)
  - `type Factor = Readonly<{ kind: "tag" | "workout" | "habit"; name: string }>`, `type Correlation = Readonly<{ factor: Factor; difference: number; withDays: number; withoutDays: number }>`, `correlationsOf(progress: Progress, now: number): Correlation[]`
  - `liftsOf(progress: Progress, now: number): Array<{ exercise: string; best: number; before?: number }>`
  - `type Week`, `weekOf(progress: Progress, now: number): Week`
  - `sparklineOf(values: readonly number[], target?: number): string`
  - `HistoryView` props gain `progress: Progress` and `now: number`; its filters end with `"week"`

The rules, with their sources: a streak counts days in a row with any log, and today counts as kept until it is over; every 7 days in a row bank 1 grace day, at most 2, which a missed day spends instead of breaking the streak, as [Duolingo's streak freeze](https://blog.duolingo.com/duolingo-streak-research/) does. The weight trend is [the Hacker's Diet](https://fourmilab.ch/hackdiet/www/subsubsection1_4_1_0_8_3.html) moving average, each day moving 10% of the way to that day's weight and carrying the last weight over days without one. A habit's strength is [Loop Habit Tracker's](https://github.com/iSoron/uhabits/discussions/689) score for a daily habit over 90 days: each day multiplies it by 0.5^(1/13) and adds the rest when the habit was done, and a skipped day leaves it alone, so a month of daily checks reaches 80%. A correlation compares the average mood on days with a tag, a workout, or a habit against days without it over 30 days, shown only with at least 3 days of each and a difference of 0.5 or more, as [Bearable](https://bearable.app/support/tips/what-are-factors/) requires. A lift's best is its Epley estimate, weight × (1 + reps ÷ 30).

- [ ] **Step 1: Write the failing tests**

```ts
// source/tests/insights.test.ts
import test from "ava";
import {
	activeDaysOf,
	correlationsOf,
	habitStrengthsOf,
	liftsOf,
	sparklineOf,
	streakOf,
	weekOf,
	weightTrendOf,
} from "../insights.js";
import { progressSchema } from "../progress.js";

// 15:00 local time on 7 October 2026, so day boundaries hold in any time zone.
const now = new Date(2026, 9, 7, 15).getTime();
const daysAgo = (days: number, hour = 9) => {
	const date = new Date(now);
	date.setDate(date.getDate() - days);
	date.setHours(hour, 0, 0, 0);
	return date.toISOString();
};

const notesOn = (...days: number[]) =>
	progressSchema.parse({
		notes: days.map((days) => ({ at: daysAgo(days), text: "x" })),
	});

test("counts a streak of days with any log, spending banked grace days", (t) => {
	t.is(streakOf(notesOn(), now), 0);
	t.is(streakOf(notesOn(0, 1, 2), now), 3);
	t.is(streakOf(notesOn(1, 2), now), 2, "today is not over yet");
	t.is(streakOf(notesOn(0, 2, 3), now), 1, "a miss before 7 days breaks it");
	t.is(
		streakOf(notesOn(0, 2, 3, 4, 5, 6, 7, 8), now),
		8,
		"7 days in a row bank a grace day, which covers 1 miss",
	);
	t.is(
		streakOf(notesOn(0, 3, 4, 5, 6, 7, 8, 9), now),
		1,
		"2 misses need 2 grace days",
	);
	t.is(
		streakOf(
			progressSchema.parse({
				events: [{ at: daysAgo(0), action: "appOpened" }],
			}),
			now,
		),
		0,
		"opening the app is not a log",
	);
	t.deepEqual(
		[...activeDaysOf(notesOn(0, 0, 1))],
		[new Date(daysAgo(0)).toDateString(), new Date(daysAgo(1)).toDateString()],
	);
});

test("never loops on an entry dated in the future", (t) => {
	const future = new Date(now + 3 * 86_400_000).toISOString();

	t.is(
		streakOf(progressSchema.parse({ notes: [{ at: future, text: "x" }] }), now),
		0,
	);
});

test("smooths the weight into a trend, carrying it over missing days", (t) => {
	const progress = progressSchema.parse({
		body: [
			{ at: daysAgo(6), weight: 80 },
			{ at: daysAgo(0), weight: 79 },
			{ at: daysAgo(3), waist: 82 },
		],
	});

	t.deepEqual(weightTrendOf(progress, now, 7), [80, 80, 80, 80, 80, 80, 79.9]);
	t.deepEqual(weightTrendOf(progress, now, 2), [80, 79.9]);
	t.deepEqual(weightTrendOf(progressSchema.parse({}), now, 7), []);
});

test("scores a habit's strength the way Loop does, skips leaving it alone", (t) => {
	const days = (count: number, from = 0) =>
		Array.from({ length: count }, (_, index) => ({
			at: daysAgo(from + index),
			name: "read",
		}));

	t.deepEqual(
		habitStrengthsOf(progressSchema.parse({ habits: days(30) }), now),
		[{ name: "read", strength: 80 }],
	);

	const skipped = habitStrengthsOf(
		progressSchema.parse({
			habits: [...days(29, 1), { at: daysAgo(0), name: "Read", skipped: true }],
		}),
		now,
	);
	const missed = habitStrengthsOf(
		progressSchema.parse({ habits: days(29, 1) }),
		now,
	);
	t.deepEqual(skipped, [{ name: "Read", strength: 79 }], "the latest spelling");
	t.deepEqual(missed, [{ name: "read", strength: 75 }]);
});

test("finds what goes with a better mood, only with enough days of each", (t) => {
	const moods = [0, 1, 2, 3, 4, 5].map((days) => ({
		at: daysAgo(days, 21),
		score: days < 3 ? 5 : 3,
	}));
	const run = (days: number) => ({
		at: daysAgo(days, 7),
		activity: "running",
		minutes: 30,
		intensity: "moderate" as const,
	});

	t.deepEqual(
		correlationsOf(
			progressSchema.parse({ moods, workouts: [run(0), run(1), run(2)] }),
			now,
		),
		[
			{
				factor: { kind: "workout", name: "running" },
				difference: 2,
				withDays: 3,
				withoutDays: 3,
			},
		],
	);
	t.deepEqual(
		correlationsOf(
			progressSchema.parse({ moods, workouts: [run(0), run(1)] }),
			now,
		),
		[],
		"2 days are not enough",
	);
});

test("estimates each lift's best this week against before", (t) => {
	const bench = (days: number, weight: number) => ({
		at: daysAgo(days),
		activity: "strength",
		minutes: 20,
		sets: [{ exercise: "bench", weight, reps: 5 }],
	});

	t.deepEqual(
		liftsOf(
			progressSchema.parse({ workouts: [bench(9, 60), bench(2, 62.5)] }),
			now,
		),
		[{ exercise: "bench", best: 72.9, before: 70 }],
	);
	t.deepEqual(
		liftsOf(progressSchema.parse({ workouts: [bench(9, 60)] }), now),
		[],
	);
});

test("draws a sparkline against the target, and sums up the week", (t) => {
	t.is(sparklineOf([0, 50, 100], 100), " ▄█");
	t.is(sparklineOf([1, 2], 0), "▄█");
	t.is(sparklineOf([0, 0]), "  ");

	const week = weekOf(notesOn(0, 1), now);
	t.is(week.days.length, 7);
	t.is(
		new Date(week.days[6]?.time ?? 0).toDateString(),
		new Date(now).toDateString(),
	);
	t.is(week.streak, 2);
	t.is(week.targets.water, 2600);
});
```

Append to `source/tests/dashboard.test.tsx`:

```tsx
const left = "\u001B[D";

test("shows the week's trends, streak, and habits", async (t) => {
	const day = 86_400_000;
	const at = (back: number) => new Date(Date.now() - back * day).toISOString();
	const { stdin, lastFrame, unmount } = start({
		...empty,
		water: [0, 1, 2].map((back) => ({ at: at(back), milliliters: 2000 })),
		habits: [0, 1, 2].map((back) => ({ at: at(back), name: "read" })),
	});

	// History, then left from All to Week, the last filter.
	await type(stdin, ["3", "\r", left]);
	const frame = lastFrame() ?? "";
	t.true(frame.includes("‹ Week ›"));
	t.true(frame.includes("avg 857 of 2,600 ml"));
	t.true(frame.includes("Streak: 3 days"));
	t.true(frame.includes("read 15%"));

	unmount();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run build`
Expected: FAIL — `tsc` reports `Cannot find module '../insights.js'`.

- [ ] **Step 3: Write the insights**

```ts
// source/insights.ts
import { type Targets, targetsOf } from "./health.js";
import {
	logsOf,
	profileNow,
	type Progress,
	type Today,
	todayOf,
} from "./progress.js";

const dayOf = (time: number) => new Date(time).toDateString();

// The same time of day, `days` later or earlier, across clock changes.
const shifted = (time: number, days: number) => {
	const date = new Date(time);
	date.setDate(date.getDate() + days);
	return date.getTime();
};

const byTime = (left: { at: string }, right: { at: string }) =>
	Date.parse(left.at) - Date.parse(right.at);

// Local days with at least 1 log; actions are not logs.
export const activeDaysOf = (progress: Progress): ReadonlySet<string> =>
	new Set(
		logsOf(progress)
			.filter((log) => log.kind !== "event")
			.map((log) => dayOf(Date.parse(log.at))),
	);

// Every 7 days in a row bank 1 grace day, up to 2, which a missed day spends
// instead of breaking the streak, like Duolingo's streak freeze.
const graceEvery = 7;
const graceMost = 2;

// Days in a row with any log, ending today; today counts as kept until it
// is over, so the streak shows before the first log of the day.
export function streakOf(progress: Progress, now: number): number {
	const days = activeDaysOf(progress);
	const oldest = logsOf(progress)
		.filter((log) => log.kind !== "event")
		.at(-1)?.at;

	if (!oldest) {
		return 0;
	}

	const today = dayOf(now);
	const day = new Date(oldest);
	day.setHours(12, 0, 0, 0);
	let streak = 0;
	let grace = 0;

	// A hand-edited entry dated in the future must not loop forever.
	while (day.toDateString() !== today && day.getTime() < now) {
		if (days.has(day.toDateString())) {
			streak += 1;

			if (streak % graceEvery === 0) {
				grace = Math.min(grace + 1, graceMost);
			}
		} else if (grace > 0 && streak > 0) {
			grace -= 1;
		} else {
			streak = 0;
			grace = 0;
		}

		day.setDate(day.getDate() + 1);
	}

	return days.has(today) ? streak + 1 : streak;
}

// The Hacker's Diet trend: each day moves 10% of the way to that day's
// weight, carrying the last weight over days without a weigh-in.
export function weightTrendOf(
	progress: Progress,
	now: number,
	days: number,
): number[] {
	const weighIns = progress.body
		.filter((body) => body.weight !== undefined)
		.toSorted(byTime);
	const [first] = weighIns;

	if (first?.weight === undefined) {
		return [];
	}

	// The last weigh-in of each day counts.
	const weightOn = new Map(
		weighIns.map((body) => [dayOf(Date.parse(body.at)), body.weight ?? 0]),
	);
	const today = dayOf(now);
	const day = new Date(first.at);
	day.setHours(12, 0, 0, 0);
	let weight = first.weight;
	let trend = first.weight;
	const trends: number[] = [];

	for (;;) {
		weight = weightOn.get(day.toDateString()) ?? weight;
		trend += 0.1 * (weight - trend);
		trends.push(Math.round(trend * 10) / 10);

		if (day.toDateString() === today || day.getTime() > now) {
			break;
		}

		day.setDate(day.getDate() + 1);
	}

	return trends.slice(-days);
}

// Loop Habit Tracker's multiplier for a daily habit: 0.5^(√1 / 13).
const habitMultiplier = 0.5 ** (1 / 13);

// Each habit's strength over the last 90 days, strongest first, named by
// its latest spelling.
export function habitStrengthsOf(
	progress: Progress,
	now: number,
): Array<Readonly<{ name: string; strength: number }>> {
	const names = new Map(
		progress.habits
			.toSorted(byTime)
			.map((habit) => [habit.name.toLowerCase(), habit.name]),
	);

	return [...names]
		.map(([key, name]) => {
			let score = 0;

			for (let back = 89; back >= 0; back--) {
				const day = dayOf(shifted(now, -back));
				const that = progress.habits.filter(
					(habit) =>
						habit.name.toLowerCase() === key &&
						dayOf(Date.parse(habit.at)) === day,
				);
				const isDone = that.some((habit) => !habit.skipped);

				// A skipped day leaves the score as it was.
				if (isDone || that.length === 0) {
					score = score * habitMultiplier + (isDone ? 1 - habitMultiplier : 0);
				}
			}

			return { name, strength: Math.round(score * 100) };
		})
		.toSorted((left, right) => right.strength - left.strength);
}

export type Factor = Readonly<{
	kind: "tag" | "workout" | "habit";
	name: string;
}>;

export type Correlation = Readonly<{
	factor: Factor;
	difference: number;
	withDays: number;
	withoutDays: number;
}>;

const average = (values: readonly number[]) =>
	values.reduce((total, value) => total + value, 0) / values.length;

// How much higher or lower the mood runs on days with a tag, a workout, or a
// habit than on days without it, over the last 30 days. Like Bearable, a
// factor needs 3 days with it and 3 without, and a difference of 0.5.
export function correlationsOf(progress: Progress, now: number): Correlation[] {
	const window = new Set(
		Array.from({ length: 30 }, (_, back) => dayOf(shifted(now, -back))),
	);
	const moodOn = new Map<string, number>();

	for (const day of window) {
		const scores = progress.moods
			.filter((mood) => dayOf(Date.parse(mood.at)) === day)
			.map((mood) => mood.score);

		if (scores.length > 0) {
			moodOn.set(day, average(scores));
		}
	}

	const daysWith = new Map<string, { factor: Factor; days: Set<string> }>();
	const add = (factor: Factor, at: string) => {
		const day = dayOf(Date.parse(at));
		const key = `${factor.kind}:${factor.name}`;

		if (moodOn.has(day)) {
			const known = daysWith.get(key) ?? { factor, days: new Set<string>() };
			known.days.add(day);
			daysWith.set(key, known);
		}
	};

	for (const mood of progress.moods) {
		for (const tag of mood.tags ?? []) {
			add({ kind: "tag", name: tag }, mood.at);
		}
	}

	for (const workout of progress.workouts) {
		add({ kind: "workout", name: workout.activity }, workout.at);
	}

	for (const habit of progress.habits.filter((habit) => !habit.skipped)) {
		add({ kind: "habit", name: habit.name.toLowerCase() }, habit.at);
	}

	return [...daysWith.values()]
		.flatMap(({ factor, days }) => {
			const scores = [...moodOn];
			const withScores = scores.filter(([day]) => days.has(day));
			const withoutScores = scores.filter(([day]) => !days.has(day));

			if (withScores.length < 3 || withoutScores.length < 3) {
				return [];
			}

			const difference =
				Math.round(
					(average(withScores.map(([, score]) => score)) -
						average(withoutScores.map(([, score]) => score))) *
						10,
				) / 10;

			return Math.abs(difference) >= 0.5
				? [
						{
							factor,
							difference,
							withDays: withScores.length,
							withoutDays: withoutScores.length,
						},
					]
				: [];
		})
		.toSorted(
			(left, right) => Math.abs(right.difference) - Math.abs(left.difference),
		);
}

// Each exercise's best estimated 1-rep max this week, by Epley, against its
// best before this week; only exercises done this week.
export function liftsOf(
	progress: Progress,
	now: number,
): Array<Readonly<{ exercise: string; best: number; before?: number }>> {
	const weekStart = shifted(now, -7);
	const best = new Map<string, { week: number; before: number }>();

	for (const workout of progress.workouts) {
		const isThisWeek = Date.parse(workout.at) > weekStart;

		for (const set of workout.sets ?? []) {
			const estimate = (set.weight ?? 0) * (1 + set.reps / 30);
			const known = best.get(set.exercise) ?? { week: 0, before: 0 };
			best.set(
				set.exercise,
				isThisWeek
					? { ...known, week: Math.max(known.week, estimate) }
					: { ...known, before: Math.max(known.before, estimate) },
			);
		}
	}

	const tenths = (value: number) => Math.round(value * 10) / 10;

	return [...best]
		.filter(([, { week }]) => week > 0)
		.map(([exercise, { week, before }]) => ({
			exercise,
			best: tenths(week),
			...(before > 0 ? { before: tenths(before) } : {}),
		}));
}

export type Week = Readonly<{
	// The last 7 days, oldest first, today last.
	days: ReadonlyArray<Readonly<{ time: number; today: Today }>>;
	targets: Targets;
	streak: number;
	trend: readonly number[];
	habits: ReturnType<typeof habitStrengthsOf>;
	correlations: readonly Correlation[];
	lifts: ReturnType<typeof liftsOf>;
}>;

export function weekOf(progress: Progress, now: number): Week {
	return {
		days: Array.from({ length: 7 }, (_, index) => {
			const time = shifted(now, index - 6);
			return { time, today: todayOf(progress, time) };
		}),
		targets: targetsOf(profileNow(progress), progress.goals),
		streak: streakOf(progress, now),
		trend: weightTrendOf(progress, now, 7),
		habits: habitStrengthsOf(progress, now),
		correlations: correlationsOf(progress, now),
		lifts: liftsOf(progress, now),
	};
}

const bars = " ▁▂▃▄▅▆▇█";

// 1 character a day, the full block at the target or the highest day,
// whichever is more; a day with nothing is blank.
export function sparklineOf(values: readonly number[], target = 0): string {
	const top = Math.max(target, ...values);

	return values
		.map((value) =>
			top <= 0 || value <= 0
				? " "
				: (bars[Math.max(1, Math.round((value / top) * 8))] ?? "█"),
		)
		.join("");
}
```

- [ ] **Step 4: Name the Week tab in all 3 languages**

In `source/i18n.ts`, add `week: "Week",` to `logs` in `en`, `week: "本週",` in `traditionalChinese`, and `week: "이번 주",` in `korean`. Add a new top-level section to `en`:

```ts
	week: {
		subtitle: "The last 7 days, today on the right",
		calories: "Calories",
		protein: "Protein",
		exercise: "Exercise",
		water: "Water",
		sleep: "Sleep",
		steps: "Steps",
		average: (average: string, target: string, unit: string) =>
			`avg ${average} of ${target}${unit ? ` ${unit}` : ""}`,
		streak: (days: number) => `Streak: ${days} ${days === 1 ? "day" : "days"}`,
		trend: (from: string, to: string) => `Weight trend: ${from} → ${to} kg`,
		habits: (list: string) => `Habits: ${list}`,
		correlation: (difference: string, factor: string, withDays: number, withoutDays: number) =>
			`Mood ${difference} on days with ${factor} (${withDays} vs ${withoutDays} days)`,
		lift: (exercise: string, best: string, change: string) =>
			`${exercise}: best ${best} kg${change ? ` (${change})` : ""}`,
	},
```

To `traditionalChinese`:

```ts
	week: {
		subtitle: "最近 7 天，最右邊是今天",
		calories: "熱量",
		protein: "蛋白質",
		exercise: "運動",
		water: "喝水",
		sleep: "睡眠",
		steps: "步數",
		average: (average, target, unit) =>
			`平均 ${average} / ${target}${unit ? ` ${unit}` : ""}`,
		streak: (days) => `連續記錄：${days} 天`,
		trend: (from, to) => `體重趨勢：${from} → ${to} 公斤`,
		habits: (list) => `習慣：${list}`,
		correlation: (difference, factor, withDays, withoutDays) =>
			`有「${factor}」的日子，心情 ${difference}（${withDays} 天對 ${withoutDays} 天）`,
		lift: (exercise, best, change) =>
			`${exercise}：最佳 ${best} 公斤${change ? `（${change}）` : ""}`,
	},
```

To `korean`:

```ts
	week: {
		subtitle: "최근 7일, 오른쪽 끝이 오늘",
		calories: "칼로리",
		protein: "단백질",
		exercise: "운동",
		water: "물",
		sleep: "수면",
		steps: "걸음",
		average: (average, target, unit) =>
			`평균 ${average} / ${target}${unit ? ` ${unit}` : ""}`,
		streak: (days) => `연속 기록: ${days}일`,
		trend: (from, to) => `체중 추세: ${from} → ${to}kg`,
		habits: (list) => `습관: ${list}`,
		correlation: (difference, factor, withDays, withoutDays) =>
			`${factor} 한 날의 기분 ${difference} (${withDays}일 대 ${withoutDays}일)`,
		lift: (exercise, best, change) =>
			`${exercise}: 최고 ${best}kg${change ? ` (${change})` : ""}`,
	},
```

- [ ] **Step 5: Draw the Week tab**

In `source/components/history-view.tsx`, import `formatNumber`, `durationOf`, and `workoutActivities` from `../i18n.js`, `exerciseName` from `../exercises.js`, `type Correlation`, `sparklineOf`, `type Week`, and `weekOf` from `../insights.js`, and `type Progress` and `type Today` from `../progress.js`. Make the filters end with the week:

```tsx
const filters = ["all", ...logKinds, "week"] as const;
```

and its label `option === "week" ? messages.logs.week : …` in `label`. Add `progress: Progress;` and `now: number;` to `HistoryViewProps` and destructure them. Add above `HistoryView`:

```tsx
type WeekViewProps = Readonly<{
	week: Week;
	language: Language;
	messages: Messages;
}>;

// 1 sparkline row per target, then the streak, the weight trend, the habits,
// what goes with a better mood, and this week's best lifts.
function WeekView({ week, language, messages }: WeekViewProps) {
	const palette = usePalette();
	const words = messages.week;
	const format = (value: number) => formatNumber(language, Math.round(value));
	const tenths = (value: number) =>
		formatNumber(language, Math.round(value * 10) / 10);
	const averageOf = (pick: (today: Today) => number) =>
		week.days.reduce((total, day) => total + pick(day.today), 0) /
		week.days.length;
	const rows: Array<
		Readonly<{
			label: string;
			pick: (today: Today) => number;
			target: number;
			show: (value: number) => string;
			unit: string;
		}>
	> = [
		{
			label: words.calories,
			pick: (today) => today.calories,
			target: week.targets.calories,
			show: format,
			unit: "kcal",
		},
		{
			label: words.protein,
			pick: (today) => today.protein,
			target: week.targets.protein,
			show: format,
			unit: "g",
		},
		{
			label: words.exercise,
			pick: (today) => today.workoutMinutes,
			target: week.targets.workoutMinutes,
			show: (value) => durationOf(value, messages),
			unit: "",
		},
		{
			label: words.water,
			pick: (today) => today.water,
			target: week.targets.water,
			show: format,
			unit: "ml",
		},
		{
			label: words.sleep,
			pick: (today) => today.sleepMinutes,
			target: week.targets.sleep,
			show: (value) => durationOf(value, messages),
			unit: "",
		},
		{
			label: words.steps,
			pick: (today) => today.steps,
			target: week.targets.steps,
			show: format,
			unit: "",
		},
	];
	const factorName = ({ factor }: Correlation) => {
		const activity = workoutActivities.find((option) => option === factor.name);

		if (factor.kind === "tag") {
			return `#${factor.name}`;
		}

		return activity ? messages.workoutActivity[activity] : factor.name;
	};
	const [firstTrend] = week.trend;
	const lastTrend = week.trend.at(-1);

	return (
		<Box flexDirection="column">
			<Text dimColor>{words.subtitle}</Text>
			{rows.map((row) => (
				<Box key={row.label} gap={1}>
					<Box flexShrink={0} width={10}>
						<Text wrap="truncate-end">{row.label}</Text>
					</Box>
					<Box flexShrink={0}>
						<Text color={palette.accent}>
							{sparklineOf(
								week.days.map((day) => row.pick(day.today)),
								row.target,
							)}
						</Text>
					</Box>
					<Text dimColor wrap="truncate-end">
						{words.average(
							row.show(averageOf(row.pick)),
							row.show(row.target),
							row.unit,
						)}
					</Text>
				</Box>
			))}
			<Box flexDirection="column" marginTop={1}>
				<Text>{words.streak(week.streak)}</Text>
				{firstTrend !== undefined &&
				lastTrend !== undefined &&
				week.trend.length > 1 ? (
					<Text>{words.trend(tenths(firstTrend), tenths(lastTrend))}</Text>
				) : null}
				{week.habits.length > 0 ? (
					<Text wrap="truncate-end">
						{words.habits(
							week.habits
								.slice(0, 3)
								.map((habit) => `${habit.name} ${habit.strength}%`)
								.join(" · "),
						)}
					</Text>
				) : null}
				{week.correlations.slice(0, 2).map((correlation) => (
					<Text
						key={`${correlation.factor.kind}-${correlation.factor.name}`}
						wrap="truncate-end"
					>
						{words.correlation(
							`${correlation.difference > 0 ? "+" : ""}${tenths(correlation.difference)}`,
							factorName(correlation),
							correlation.withDays,
							correlation.withoutDays,
						)}
					</Text>
				))}
				{week.lifts.slice(0, 3).map((lift) => (
					<Text key={lift.exercise} wrap="truncate-end">
						{words.lift(
							exerciseName(lift.exercise, language),
							tenths(lift.best),
							lift.before === undefined
								? ""
								: `${lift.best >= lift.before ? "+" : ""}${tenths(lift.best - lift.before)}`,
						)}
					</Text>
				))}
			</Box>
		</Box>
	);
}
```

In `HistoryView`, only the log filters list rows; the week shows `WeekView`, worked out only while it is open. Replace the `<Box flexDirection="column" marginTop={1}>` that lists rows with:

```tsx
<Box flexDirection="column" marginTop={1}>
	{filter === "week" ? (
		<WeekView
			language={language}
			messages={messages}
			week={weekOf(progress, now)}
		/>
	) : (
		<>
			{shown.length === 0 ? <Text dimColor>{messages.logs.empty}</Text> : null}
			{shown.slice(top, top + pageSize).map((log, row) => (
				<Box key={`${log.kind}-${log.index}`} gap={1}>
					<Box flexShrink={0}>
						<Text color={palette.accent}>{top + row === at ? "❯" : " "}</Text>
					</Box>
					<Box flexGrow={1}>
						<LogRow language={language} log={log} messages={messages} />
					</Box>
				</Box>
			))}
		</>
	)}
</Box>
```

`shown` already filters by `log.kind === filter`, which no log matches on the week, so `e`, `d`, and `r` find nothing to act on there; `u` still puts back a deleted log. In `source/app.tsx`, pass `now={now}` and `progress={progress}` to `HistoryView`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npm run build && npx ava build/tests/insights.test.js build/tests/dashboard.test.js`
Expected: PASS. The habit in the dashboard test was done on 3 of the last 90 days, so its strength is 1 − 0.5^(3/13) ≈ 15%.

- [ ] **Step 7: Run the gate and commit**

Run: `npx prettier --write source/insights.ts source/components/history-view.tsx source/tests/insights.test.ts && npm test`
Expected: everything passes.

```bash
git add source/insights.ts source/components/history-view.tsx source/app.tsx source/i18n.ts source/tests/insights.test.ts source/tests/dashboard.test.tsx
git commit -m "feat: show the week's trends, streak, habits, and correlations"
```

---

### Task 13: Water and Sleep on Today

**Files:**

- Modify: `source/theme.ts` (`water` and `sleep` metric colors in every theme)
- Modify: `source/content.ts` (`sectionsOf`, and the Today rows in `layoutOf`'s constants)
- Modify: `source/i18n.ts` (`today` in all 3 languages)
- Modify: `.claude/rules/terminal-layout.md`
- Test: `source/tests/data.test.ts`, `source/tests/content.test.ts`

**Interfaces:**

- Consumes: `todayOf(...).water` and `.sleepMinutes` from Task 2, `targetsOf(...).water` and `.sleep` from Task 3, `durationOf` from Task 2
- Produces: `Palette["metrics"]` gains `water` and `sleep`; `messages.today.water`, `waterDetail(milliliters, target)`, `sleep`, `sleepDetail(slept, target)`

The Health group of Today gains 2 bars under Workout: today's water against its target, and last night's sleep against its target. Each bar takes 2 rows, so Today grows from 19 rows to 23, and from 16 to 20 when compact.

- [ ] **Step 1: Write the failing tests**

Append to `source/tests/data.test.ts`, importing `sectionsOf` from `../content.js` and `themes` from `../theme.js`:

```ts
test("shows water and last night's sleep against their targets in Today", (t) => {
	const progress = progressSchema.parse({
		language: "en",
		water: [{ at, milliliters: 750 }],
		sleep: [{ at, minutes: 400 }],
	});
	const [, health] = sectionsOf("en", themes.ember, progress, Date.parse(at));

	t.like(
		health?.metrics.find((metric) => metric.label === "Water"),
		{ detail: "750 of 2,600 ml", color: themes.ember.metrics.water },
	);
	t.like(
		health?.metrics.find((metric) => metric.label === "Sleep"),
		{
			detail: "6h 40m of 7h",
		},
	);
});
```

In `source/tests/content.test.ts`, Today is 4 rows taller, so it shows and stops being compact 4 rows later:

```ts
t.like(layoutOf(160, 27), { isTodayCompact: true });
t.like(layoutOf(160, 28), { isTodayCompact: false });
```

Change `t.like(layoutOf(100, 48), { showToday: true, todayBeside: false });` to `t.like(layoutOf(100, 50), { showToday: true, todayBeside: false });` and add `t.like(layoutOf(100, 49), { showToday: false });`. Change the stacked case `layoutOf(64, 70)` to `layoutOf(64, 72)`, since Today below the stacked panels now needs 72 rows.

- [ ] **Step 2: Run them to verify they fail**

Run: `npm run build`
Expected: FAIL — `tsc` reports that `water` does not exist on the palette's `metrics`.

- [ ] **Step 3: Give every theme a water and a sleep color**

In `source/theme.ts`, add `water: string;` and `sleep: string;` to `metrics` in `Palette`, then to each theme's `metrics`, staying in its hue family:

| Theme   | `water`   | `sleep`   |
| ------- | --------- | --------- |
| `dusk`  | `#E5DAF5` | `#7559A8` |
| `ember` | `#F5D5B8` | `#A65A41` |
| `frost` | `#D6E6F7` | `#4F75A6` |
| `mono`  | `#F5F5F5` | `#8A8A8A` |
| `moss`  | `#D9E8C4` | `#5E7F4A` |

- [ ] **Step 4: Add the bars and their rows**

In `source/content.ts`, append to the Health section's `metrics` in `sectionsOf`, after the workout metric:

```ts
				{
					label: messages.today.water,
					detail: messages.today.waterDetail(
						format(today.water),
						format(targets.water),
					),
					value: percentOf(today.water, targets.water),
					color: palette.metrics.water,
				},
				{
					label: messages.today.sleep,
					detail: messages.today.sleepDetail(
						durationOf(today.sleepMinutes, messages),
						durationOf(targets.sleep, messages),
					),
					value: percentOf(today.sleepMinutes, targets.sleep),
					color: palette.metrics.sleep,
				},
```

Then grow Today's rows and say why:

```ts
// Header and footer take 5 rows. The character's panel is 25 rows tall,
// Today 23 with its spacing or 20 compact, the menu 15 with its 4 headings
// and 9 items, and Recent 7.
```

```ts
const todayRows = 23;
const compactTodayRows = 20;
```

In `source/i18n.ts`, add to `today` in `en`:

```ts
		water: "Water",
		waterDetail: (milliliters: string, target: string) =>
			`${milliliters} of ${target} ml`,
		sleep: "Sleep",
		sleepDetail: (slept: string, target: string) => `${slept} of ${target}`,
```

In `traditionalChinese`:

```ts
		water: "喝水",
		waterDetail: (milliliters, target) => `${milliliters} / ${target} 毫升`,
		sleep: "睡眠",
		sleepDetail: (slept, target) => `${slept} / ${target}`,
```

In `korean`:

```ts
		water: "물",
		waterDetail: (milliliters, target) => `${milliliters} / ${target}ml`,
		sleep: "수면",
		sleepDetail: (slept, target) => `${slept} / ${target}`,
```

- [ ] **Step 5: Update the layout rule**

In `.claude/rules/terminal-layout.md`, change the Today row of the regions table to "Character and Focus bars, then the Health group: protein, calories, workout, water, and last night's sleep, with the most urgent advice", and the responsive table's rows to "Character, Today, and the Menu over Recent, side by side; Today is compact below 28 rows" and "Character beside the Menu over Recent, with Today below from 50 rows, compact below 53".

- [ ] **Step 6: Run the tests, look at it, and commit**

Run: `npm run build && npx ava build/tests/data.test.js build/tests/content.test.js && npm test`
Expected: PASS. Then run `TERMINAL_SIGMA_HOME="$(mktemp -d)" npm start` in a 138 × 36 terminal, log `w 750` and `sl 23:30-6:10`, and check that Today shows both bars without pushing the advice out of its box, in each theme.

```bash
git add source/theme.ts source/content.ts source/i18n.ts .claude/rules/terminal-layout.md source/tests/data.test.ts source/tests/content.test.ts
git commit -m "feat: show water and sleep on Today"
```

---

### Task 14: 42 More Foods

**Files:**

- Modify: `source/foods.ts` (the end of the `commonFoods` table)
- Test: `source/tests/foods.test.ts`

**Interfaces:**

- Consumes: `foodsOf` and the table format from Task 4
- Produces: `commonFoods` with 154 foods

More foods the line knows means fewer typed kcal. These 42 cover drinks, fruit, and vegetables people log daily, and Taiwanese and Korean meals the list lacked. Their values are for 1 typical serving, approximate like the rest, and every one passes Task 4's check that its kcal are within 20% of 4 × protein + 4 × carbs + 9 × fat, except makgeolli, whose alcohol brings 7 kcal a gram. No new name collides with an existing one in any language, and none shortens a partial match the tests rely on: `rice` is still white rice, `蛋` an egg, and `toast` whole wheat toast.

- [ ] **Step 1: Write the failing test**

In `source/tests/foods.test.ts`, change `t.is(commonFoods.length, 112);` to `t.is(commonFoods.length, 154);`, add `"Makgeolli"` to `alcoholic`, and append:

```ts
test("knows everyday Taiwanese and Korean dishes in their own language", (t) => {
	t.like(matchFood("刈包", "zh-TW", []), { label: "刈包", calories: 350 });
	t.like(matchFood("짜장면", "ko", []), { label: "짜장면", calories: 800 });
	t.like(matchFood("americano", "en", []), {
		label: "Americano",
		calories: 10,
	});
	t.like(matchFood("rice", "en", []), { label: "White rice" });
	t.like(matchFood("蛋", "zh-TW", []), { label: "雞蛋" });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run build && npx ava build/tests/foods.test.js`
Expected: FAIL — 112 foods, not 154, and no 刈包.

- [ ] **Step 3: Append the foods**

In `source/foods.ts`, add these lines to the end of the `commonFoods` table, right before its closing `` ` ``:

```text
Turkey sandwich|火雞三明治|칠면조 샌드위치|420|28|40|15|1 sandwich|1 個|1개
Peanut butter sandwich|花生醬三明治|땅콩버터 샌드위치|380|14|40|18|1 sandwich|1 個|1개
Grilled cheese|烤起司三明治|그릴드 치즈 샌드위치|400|15|33|23|1 sandwich|1 個|1개
Fish and chips|炸魚薯條|피시 앤드 칩스|840|32|80|43|1 plate|1 盤|1접시
Mac and cheese|起司通心粉|맥앤치즈|500|20|50|24|1 bowl|1 碗|1그릇
Lasagna|千層麵|라자냐|450|25|36|23|1 piece|1 塊|1조각
Fried egg|荷包蛋|계란 프라이|90|6|0|7|1 egg|1 顆|1개
Plain yogurt|原味優格|플레인 요거트|150|9|17|5|1 cup|1 杯|1컵
Chocolate milk|巧克力牛奶|초코우유|210|8|30|6|1 cup|1 杯|1잔
Cappuccino|卡布奇諾|카푸치노|130|7|11|6|1 cup|1 杯|1잔
Americano|美式咖啡|아메리카노|10|1|2|0|1 cup|1 杯|1잔
Cola|可樂|콜라|140|0|39|0|1 can|1 罐|1캔
Pear|梨子|배|100|1|27|0|1 pear|1 顆|1개
Watermelon|西瓜|수박|85|2|21|0|2 cups|2 碗|2컵
Mango|芒果|망고|200|3|50|1|1 mango|1 顆|1개
Kiwi|奇異果|키위|42|1|10|0|1 kiwi|1 顆|1개
Guava|芭樂|구아바|70|3|14|1|1 guava|1 顆|1개
Cherry tomatoes|小番茄|방울토마토|30|1|6|0|1 cup|1 碗|1컵
Spinach|菠菜|시금치|41|5|7|0|1 cup, cooked|1 碗，煮熟|익힌 것 1컵
Cucumber|小黃瓜|오이|16|1|4|0|1 cucumber|1 條|1개
Gua bao|刈包|꽈바오|350|13|35|17|1 bun|1 個|1개
Taiwanese sausage|台式香腸|대만 소시지|250|10|10|19|1 sausage|1 條|1개
Lu wei|滷味|루웨이|400|25|30|19|1 bowl|1 碗|1그릇
Fried rice noodles|炒米粉|볶음 쌀국수|450|10|65|16|1 plate|1 盤|1접시
Pork chop rice|排骨飯|돼지갈비 덮밥|750|32|85|30|1 box|1 個|1개
Egg crepe|蛋餅|단빙|300|10|30|15|1 crepe|1 份|1개
Taiwanese rice roll|飯糰|대만식 주먹밥|500|14|70|18|1 roll|1 個|1개
Sesame noodles|麻醬麵|마장면|500|15|65|20|1 bowl|1 碗|1그릇
Wonton soup|餛飩湯|완탕|250|14|25|10|1 bowl|1 碗|1그릇
Shaved ice|剉冰|빙수|300|4|65|3|1 bowl|1 碗|1그릇
Tea egg|茶葉蛋|차예단|75|6|1|5|1 egg|1 顆|1개
Japchae|韓式雜菜|잡채|300|6|45|11|1 plate|1 盤|1접시
Galbi|韓式烤牛小排|갈비|600|36|10|46|1 serving|1 份|1인분
Naengmyeon|韓式冷麵|냉면|500|18|90|6|1 bowl|1 碗|1그릇
Sundubu jjigae|嫩豆腐鍋|순두부찌개|300|20|12|19|1 bowl|1 碗|1그릇
Samgyetang|蔘雞湯|삼계탕|900|80|40|45|1 bowl|1 碗|1그릇
Jjajangmyeon|炸醬麵|짜장면|800|20|120|26|1 bowl|1 碗|1그릇
Jjamppong|炒碼麵|짬뽕|700|30|90|22|1 bowl|1 碗|1그릇
Dakgalbi|春川辣炒雞|닭갈비|500|40|25|26|1 serving|1 份|1인분
Triangle kimbap|三角飯糰|삼각김밥|200|5|40|2|1 piece|1 個|1개
Hotteok|韓式糖餅|호떡|230|4|38|7|1 piece|1 個|1개
Makgeolli|韓國米酒|막걸리|185|2|18|0|1 bowl|1 碗|1사발
```

Above the table, extend its comment: "The last 42, added with the Log line, are typical servings from common nutrition labels, each within 20% of 4-4-9."

- [ ] **Step 4: Run the tests, and commit**

Run: `npm run build && npx ava build/tests/foods.test.js build/tests/data.test.js build/tests/quick-log.test.js && npm test`
Expected: PASS, including every earlier match: chicken still suggests Chicken breast first, since new foods sit at the end of the table.

```bash
git add source/foods.ts source/tests/foods.test.ts
git commit -m "feat: know 42 more foods, from americano to jjajangmyeon"
```

---

### Task 15: Document the Log, History, and the New Targets

**Files:**

- Modify: `README.md` (components, menu, the Log and History sections, keys, health targets, Progress File, experience)
- Modify: `CLAUDE.md` (Repository Layout)

- [ ] **Step 1: Update the components and the menu in `README.md`**

In the components table, replace the Health and Logs rows:

```markdown
| History | Every log and action, newest first, filtered by kind, where you edit, delete, or repeat a log, plus a Week tab of trends, streaks, habits, and what goes with a better mood |
| Log | 1 line that logs meals, workouts, water, sleep, weight, mood, habits, steps, and notes, suggesting what you usually log at this hour |
```

Replace the menu table with the 9 rows of Task 10 (keys `1` to `9`), describing Log as "The Log line; while focused, today's targets and advice show on the right" and History as "Every log and action, with the Week tab". Replace the paragraph that starts "A meal asks for the food" with the new sections below, and remove "The headings give way to Recent on a terminal shorter than 28 rows." only if Task 10 has not already changed it to 27.

```markdown
### Log

**Log** takes 1 line. Without a prefix, a line is a meal: its items split on `,`, `+`, or `、`, each with an optional quantity, matched against your own past meals first and then 154 common foods in any of the 3 languages. Typed amounts win: `ramen 500kcal 20p` logs exactly that. Every other kind starts with a short prefix, in ASCII so it works through a Chinese or Korean input method:

| Prefix  | Logs                                                     | Examples                                                |
| ------- | -------------------------------------------------------- | ------------------------------------------------------- |
| None    | A meal                                                   | `2 eggs, toast` · `牛肉麵` · `계란 2개` · `450kcal 30p` |
| `bf`    | Body fat, in %                                           | `bf 18`                                                 |
| `goal`  | Your own target for water, sleep, steps, or focus        | `goal water 2.5l` · `goal sleep 8h` · `goal focus 6`    |
| `h`     | A habit done, with an optional amount, or `s` to skip it | `h read` · `h read 30` · `h read s`                     |
| `m`     | Your mood, 1 to 5, with energy, stress, and tags         | `m 4 e3 s2 #work`                                       |
| `n`     | A note                                                   | `n grateful for the sun`                                |
| `sl`    | Last night's sleep, with its quality from 1 to 5         | `sl 23:30-7:10 q4` · `sl 7.5h`                          |
| `st`    | Today's steps so far                                     | `st 8400`                                               |
| `w`     | Water: 1 glass of 250 ml, or an amount                   | `w` · `w 500` · `w 0.5l` · `w 2 glasses`                |
| `waist` | Your waist, in cm                                        | `waist 82`                                              |
| `wo`    | A workout: minutes, intensity, distance, or sets         | `wo run 30m hard 5k` · `wo bench 60x5x3` · `wo bench`   |
| `wt`    | Your weight, in kg                                       | `wt 72.4`                                               |

Start any line with a time to log it then: `@y` for yesterday, `@-2d` for 2 days ago, `@7:30`, or `@y 21:00`; a time later than now means yesterday. `.` logs your last line again, `copy y` copies yesterday's meals to today, and `u` alone undoes the last line you logged since opening Log. While the line is empty, Log suggests the foods you usually eat around now, water when you are behind, last week's workout for today, and your regular habits; ↑↓ and Enter log one. While you type a food, ↑↓ picks a match and Tab completes it. A workout of known lifts without sets, such as `wo bench`, repeats the sets of your last session, and with a profile every workout counts its calories from the 2024 Compendium of Physical Activities.

### History

**History** lists every log and action, newest first. ←→ cycles the filter through every kind, and ↑↓ moves the cursor: `e` edits the log under it, keeping its day and time, `d` deletes it, `u` puts the last deleted log back, and `r` logs it again now. Focus sessions and actions cannot change. The last filter, **Week**, draws the last 7 days as sparklines against your targets for calories, protein, exercise, water, sleep, and steps, then your streak, your weight trend, your habits' strength, what goes with a better mood, and your best lifts.

Your streak counts days in a row with any log, and today counts until it is over. Every 7 days in a row bank a grace day, at most 2, that covers a missed day. The weight trend moves 10% of the way to each day's weight, as the Hacker's Diet does, so 1 heavy morning barely moves it. A habit's strength follows Loop Habit Tracker: a month of daily checks reaches about 80%, and a skipped day leaves it alone. A mood difference shows only after at least 3 days with and 3 without.
```

- [ ] **Step 2: Update the keys, the targets, the Progress File, and the experience**

In the Keys table, add these rows in alphabetical order:

```markdown
| `.` | In Log: log your last line again |
| `e` `d` `r` `u` | In History: edit, delete, repeat, or put back a log |
| `u` | In Log, as the whole line: undo the last line logged |
```

and change the Tab row to "Copy the picked suggestion into the field, or complete the food name in Log". In Health Targets, add these rows in alphabetical order, then a sentence after the table:

```markdown
| Focus | 4 Tomato Timer sessions |
| Sleep | 7 hours, as the American Academy of Sleep Medicine recommends for adults |
| Steps | 8,000 under 60 and 7,000 from 60, where studies find mortality stops falling |
| Water | 3,000 ml for men, 2,200 ml for women, and 2,600 ml otherwise: the drinks share of the National Academies' adequate intake |
```

```markdown
Calories and protein follow your latest weigh-in. `goal water 2.5l`, `goal sleep 8h`, `goal steps 9000`, or `goal focus 6` in Log replaces a default with your own.
```

In the Progress File example, add 1 entry each to `water`, `sleep`, `body`, `moods`, `habits`, `steps`, and `notes`, and a `goals` object, shaped as in Task 2. In its values table, add rows in alphabetical order for `body` (`weight` 30-300 kg, `waist` 40-250 cm, `bodyFat` 3-60 %, at least 1), `goals.focusSessions` (1-16), `goals.sleep` (240-720 minutes), `goals.steps` (1,000-50,000), `goals.water` (250-10,000 ml), `habits.skipped` (`true` or left out), `meals.servings`, `moods.score`, `moods.energy`, `moods.stress` (whole numbers 1-5), `sleep.minutes` (1-1,440; `at` is the wake time), `sleep.quality` (1-5), `steps.count` (1-100,000, the day's count so far), and `water.milliliters` (1-5,000), and add `goalChanged`, `logDeleted`, and `logEdited` to `events.action`. Replace the experience table:

```markdown
| Entry          | Experience                                                            | Daily Cap |
| -------------- | --------------------------------------------------------------------- | --------- |
| Action         | None                                                                  |           |
| Body           | 5 XP                                                                  | 5 XP      |
| Finished focus | 1 XP per minute                                                       |           |
| Habit          | 5 XP, none when skipped                                               | 25 XP     |
| Meal           | 5 XP                                                                  |           |
| Mood           | 3 XP                                                                  | 6 XP      |
| Note           | 3 XP                                                                  | 3 XP      |
| Sleep          | 10 XP                                                                 | 10 XP     |
| Steps          | 1 XP per 1,000, counting only what a later count adds                 | 20 XP     |
| Water          | 1 XP                                                                  | 8 XP      |
| Workout        | Per minute: 1 XP when light, 1.5 XP when moderate, 2 XP when vigorous |           |
```

Then a sentence: "Caps reset at your local midnight, and entries earn in the order they happened." Link `DATA-LICENSES.md` from the License section: "Bundled nutrition and exercise data keep their own licenses, listed in [`DATA-LICENSES.md`](./DATA-LICENSES.md)."

- [ ] **Step 3: Update `CLAUDE.md`**

Add Repository Layout rows in alphabetical order:

```markdown
| [`source/exercises.ts`](./source/exercises.ts) | Workout activities, intensities, and lifts in all 3 languages, and their Compendium METs |
| [`source/insights.ts`](./source/insights.ts) | The Week tab: streaks, the weight trend, habit strength, mood correlations, and best lifts |
| [`source/quick-log.ts`](./source/quick-log.ts) | The Log line: parsing, applying and undoing drafts, writing an entry back as a line, and suggestions |
```

Change the `foods.ts` row to "The common foods with servings, carbs, and fat in all 3 languages, and matching a typed name", and the `content.ts` row to "The layout rules, the menu, the Today sections, the mood, the profile form, the update view, and how a log reads".

- [ ] **Step 4: Check and commit**

Run: `npx prettier --check README.md CLAUDE.md`
Expected: both pass; if Prettier only realigns the tables, run `npx prettier --write README.md CLAUDE.md`.

```bash
git add README.md CLAUDE.md
git commit -m "docs: describe the Log line, History, and the new targets"
```
