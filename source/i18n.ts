export const languages = ["en", "zh-TW"] as const;
export type Language = (typeof languages)[number];

export const workoutActivities = [
	"running",
	"walking",
	"cycling",
	"swimming",
	"strength",
	"yoga",
	"other",
] as const;
export type WorkoutActivity = (typeof workoutActivities)[number];

export const intensities = ["light", "moderate", "vigorous"] as const;
export type Intensity = (typeof intensities)[number];

const en = {
	languageName: "English",
	languageChanged: "Language set to English.",
	welcome: "Welcome to Terminal Sigma",
	chooseLanguage: "Choose your language · 選擇語言",
	level: (level: number) => `Lv ${level}`,
	savedTo: (file: string) => `Progress is saved to ${file}`,
	notSaved: (error: string) => `Not saved: ${error}`,
	hints: {
		menu: "↑↓←→ move · enter select · q quit",
		select: "↑↓ move · enter select · esc back",
		form: "enter next · esc cancel",
		logs: "←→ filter · ↑↓ scroll · esc back",
	},
	menu: {
		timer: "Tomato Timer",
		diet: "Diet Tracker",
		workout: "Workout Tracker",
		logs: "Logs",
		quotes: "Everyday Quotes",
		language: "Language",
	},
	describe: {
		timer: (focus: number, rest: number) =>
			`Enter starts a ${focus}-minute focus, and pauses, resumes, or stops a running one. A finished focus earns ${focus} XP, then a ${rest}-minute break begins.`,
		diet: "Log a meal step by step: food, calories, and protein. Each meal earns 5 XP.",
		workout:
			"Log a workout step by step: activity, minutes, and intensity. Earns 1 to 2 XP per minute, by intensity.",
		logs: "Browse every focus, meal, and workout you have logged.",
		quotes: (minutes: number) =>
			`Draw a new quote. Quotes also refresh every ${minutes} minutes.`,
		language: "Switch between English and Traditional Chinese.",
	},
	signal: {
		ready: "Ready",
		paused: "Paused",
		meals: (count: number) => `${count} ${count === 1 ? "meal" : "meals"}`,
		minutes: (count: number) => `${count} min`,
		entries: (count: number) => `${count} ${count === 1 ? "log" : "logs"}`,
		newQuote: "New",
	},
	today: {
		title: "Today",
		character: "Character",
		characterDetail: (next: number, missing: number) =>
			`${missing} XP to Lv ${next}`,
		focus: "Focus",
		focusDetail: (count: number, goal: number) =>
			`${count} of ${goal} sessions`,
		diet: "Diet",
		dietDetail: (
			count: number,
			goal: number,
			calories: string,
			protein: string,
		) => `${count} of ${goal} meals · ${calories} kcal · ${protein} g protein`,
		workout: "Workout",
		workoutDetail: (minutes: number, goal: number) =>
			`${minutes} of ${goal} minutes`,
	},
	activity: {
		idle: "Standing by",
		focus: "Focusing…",
		break: "On a break…",
		eat: "Eating…",
		run: "Running…",
		lift: "Lifting…",
		stretch: "Stretching…",
		levelUp: "Level up!",
	},
	timer: {
		focus: "Focus",
		break: "Break",
		left: (phase: string, clock: string) => `${phase} · ${clock} left`,
		pausedAt: (phase: string, clock: string) => `${phase} paused at ${clock}`,
		pause: "Pause",
		resume: "Resume",
		stop: "Stop this tomato",
		back: "Back",
		started: "Focus started.",
		paused: "Timer paused.",
		resumed: "Timer resumed.",
		stopped: "Tomato stopped. An unfinished focus earns no XP.",
		focusComplete: (xp: number, rest: number) =>
			`Focus complete, +${xp} XP. ${rest}-minute break started.`,
		breakOver: "Break over. Select Tomato Timer to focus again.",
	},
	form: {
		dietTitle: "Log a meal",
		workoutTitle: "Log a workout",
		food: "Food",
		foodExample: "e.g. Chicken salad",
		calories: "Calories (kcal)",
		protein: "Protein (g)",
		activity: "Activity",
		minutes: "Minutes",
		intensity: "Intensity",
		required: "Required.",
		wholeNumber: (minimum: number, maximum: number) =>
			`Enter a whole number from ${minimum} to ${maximum}.`,
		cancelled: "Nothing logged.",
		mealLogged: (food: string, xp: number) => `Logged ${food}, +${xp} XP.`,
		workoutLogged: (activity: string, minutes: number, xp: number) =>
			`Logged ${activity} for ${minutes} minutes, +${xp} XP.`,
		levelUp: (level: number) => ` Level up! Lv ${level}.`,
	},
	workoutActivity: {
		running: "Running",
		walking: "Walking",
		cycling: "Cycling",
		swimming: "Swimming",
		strength: "Strength",
		yoga: "Yoga",
		other: "Other",
	} satisfies Record<WorkoutActivity, string>,
	intensity: {
		light: "Light",
		moderate: "Moderate",
		vigorous: "Vigorous",
	} satisfies Record<Intensity, string>,
	logs: {
		title: "Logs",
		all: "All",
		focus: "Focus",
		diet: "Diet",
		workout: "Workout",
		empty: "Nothing logged yet.",
		summary: (count: number, xp: number) => `${count} logs · ${xp} XP`,
		focusEntry: (minutes: number) => `${minutes}-minute focus`,
		mealEntry: (food: string, calories: string, protein: string) =>
			`${food} · ${calories} kcal · ${protein} g protein`,
		workoutEntry: (activity: string, minutes: number, intensity: string) =>
			`${activity} · ${minutes} min · ${intensity}`,
	},
	quoteDrawn: "New quote drawn.",
};

export type Messages = typeof en;

const traditionalChinese: Messages = {
	languageName: "繁體中文",
	languageChanged: "語言已設為繁體中文。",
	welcome: "歡迎使用 Terminal Sigma",
	chooseLanguage: "Choose your language · 選擇語言",
	level: (level) => `Lv ${level}`,
	savedTo: (file) => `進度儲存於 ${file}`,
	notSaved: (error) => `未儲存：${error}`,
	hints: {
		menu: "↑↓←→ 移動 · enter 選擇 · q 離開",
		select: "↑↓ 移動 · enter 選擇 · esc 返回",
		form: "enter 下一步 · esc 取消",
		logs: "←→ 篩選 · ↑↓ 捲動 · esc 返回",
	},
	menu: {
		timer: "番茄鐘",
		diet: "飲食紀錄",
		workout: "運動紀錄",
		logs: "所有紀錄",
		quotes: "每日語錄",
		language: "語言",
	},
	describe: {
		timer: (focus, rest) =>
			`按 Enter 開始 ${focus} 分鐘專注；計時中再按 Enter 可暫停、繼續或停止。完成專注獲得 ${focus} XP，接著休息 ${rest} 分鐘。`,
		diet: "逐步記錄一餐：食物、熱量與蛋白質。每餐獲得 5 XP。",
		workout: "逐步記錄運動：項目、分鐘數與強度。依強度每分鐘獲得 1 至 2 XP。",
		logs: "瀏覽所有專注、飲食與運動紀錄。",
		quotes: (minutes) => `換一則語錄。語錄也會每 ${minutes} 分鐘自動更新。`,
		language: "切換英文與繁體中文。",
	},
	signal: {
		ready: "就緒",
		paused: "已暫停",
		meals: (count) => `${count} 餐`,
		minutes: (count) => `${count} 分鐘`,
		entries: (count) => `${count} 筆`,
		newQuote: "換一則",
	},
	today: {
		title: "今日",
		character: "角色",
		characterDetail: (next, missing) => `距 Lv ${next} 還差 ${missing} XP`,
		focus: "專注",
		focusDetail: (count, goal) => `${count} / ${goal} 次`,
		diet: "飲食",
		dietDetail: (count, goal, calories, protein) =>
			`${count} / ${goal} 餐 · ${calories} 大卡 · 蛋白質 ${protein} 克`,
		workout: "運動",
		workoutDetail: (minutes, goal) => `${minutes} / ${goal} 分鐘`,
	},
	activity: {
		idle: "待命中",
		focus: "專注中…",
		break: "休息中…",
		eat: "用餐中…",
		run: "跑步中…",
		lift: "重訓中…",
		stretch: "伸展中…",
		levelUp: "升級了！",
	},
	timer: {
		focus: "專注",
		break: "休息",
		left: (phase, clock) => `${phase} · 剩 ${clock}`,
		pausedAt: (phase, clock) => `${phase}已暫停於 ${clock}`,
		pause: "暫停",
		resume: "繼續",
		stop: "結束這顆番茄",
		back: "返回",
		started: "開始專注。",
		paused: "計時已暫停。",
		resumed: "計時繼續。",
		stopped: "已結束這顆番茄。未完成的專注不計 XP。",
		focusComplete: (xp, rest) => `專注完成，+${xp} XP。開始休息 ${rest} 分鐘。`,
		breakOver: "休息結束。選擇番茄鐘開始下一次專注。",
	},
	form: {
		dietTitle: "記錄一餐",
		workoutTitle: "記錄運動",
		food: "食物",
		foodExample: "例如：雞肉沙拉",
		calories: "熱量（大卡）",
		protein: "蛋白質（克）",
		activity: "運動項目",
		minutes: "分鐘數",
		intensity: "強度",
		required: "必填。",
		wholeNumber: (minimum, maximum) =>
			`請輸入 ${minimum} 到 ${maximum} 的整數。`,
		cancelled: "未記錄任何內容。",
		mealLogged: (food, xp) => `已記錄 ${food}，+${xp} XP。`,
		workoutLogged: (activity, minutes, xp) =>
			`已記錄${activity} ${minutes} 分鐘，+${xp} XP。`,
		levelUp: (level) => `升級了！Lv ${level}。`,
	},
	workoutActivity: {
		running: "跑步",
		walking: "健走",
		cycling: "騎單車",
		swimming: "游泳",
		strength: "重量訓練",
		yoga: "瑜伽",
		other: "其他",
	},
	intensity: {
		light: "輕度",
		moderate: "中度",
		vigorous: "高強度",
	},
	logs: {
		title: "所有紀錄",
		all: "全部",
		focus: "專注",
		diet: "飲食",
		workout: "運動",
		empty: "尚無紀錄。",
		summary: (count, xp) => `共 ${count} 筆 · ${xp} XP`,
		focusEntry: (minutes) => `專注 ${minutes} 分鐘`,
		mealEntry: (food, calories, protein) =>
			`${food} · ${calories} 大卡 · 蛋白質 ${protein} 克`,
		workoutEntry: (activity, minutes, intensity) =>
			`${activity} · ${minutes} 分鐘 · ${intensity}`,
	},
	quoteDrawn: "已換一則語錄。",
};

export const messagesOf = (language: Language): Messages =>
	language === "zh-TW" ? traditionalChinese : en;

export const formatNumber = (language: Language, value: number) =>
	value.toLocaleString(language);
