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
