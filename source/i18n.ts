import type { Source, VariableGroup, VariableName } from "./config.js";
import type { EventAction, Goals, LogKind } from "./progress.js";
import type { ParseError } from "./quick-log.js";
import type { QuoteCategory, QuoteMode } from "./quotes.js";
import type { ThemeName } from "./theme.js";
import type { Updater } from "./update.js";

export const languages = ["en", "zh-TW", "ko"] as const;
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

export const genders = ["female", "male", "other"] as const;
export type Gender = (typeof genders)[number];

export const workStyles = ["desk", "standing", "active", "athlete"] as const;
export type WorkStyle = (typeof workStyles)[number];

export const healthGoals = [
	"loseFat",
	"maintain",
	"buildMuscle",
	"endurance",
] as const;
export type HealthGoal = (typeof healthGoals)[number];

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

export type Mood = "sleepy" | "content" | "happy";

// "15 seconds", "1 分鐘", "1시간": the quote intervals in words.
const durationIn = (locale: string) => (seconds: number) => {
	const [unit, divisor] =
		seconds < 60
			? (["second", 1] as const)
			: seconds < 3600
				? (["minute", 60] as const)
				: (["hour", 3600] as const);

	return new Intl.NumberFormat(locale, {
		style: "unit",
		unit,
		unitDisplay: "long",
	}).format(seconds / divisor);
};

const en = {
	languageName: "English",
	languageChanged: "Language set to English.",
	chooseLanguage: "Choose your language · 選擇語言 · 언어 선택",
	level: (level: number) => `Lv ${level}`,
	streak: (days: number) => `${days}-day streak`,
	savedTo: (file: string) => `Progress is saved to ${file}`,
	notSaved: (error: string) => `Not saved: ${error}`,
	hints: {
		menu: "↑↓ move · enter open · q quit",
		select: "↑↓ move · enter select · esc back",
		form: "enter next · esc cancel",
		suggest: "↑↓ pick · tab fill · enter next · esc cancel",
		logs: "←→ filter · e edit · d delete · r repeat · u undo · esc back",
		environment: "↑↓ move · enter edit · esc back",
		edit: "enter save · empty enter clears · esc keep",
		log: "↑↓ pick · tab complete · enter log · esc back",
	},
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
	describe: {
		quotes:
			"Draw a new quote, or choose how often quotes refresh and which kinds you see.",
		timer: (focus: number, rest: number) =>
			`A ${focus}-minute focus earns ${focus} XP, then a ${rest}-minute break begins. Start, pause, resume, or stop it here.`,
		log: "Log anything in 1 line, e.g. 2 eggs, toast · w 500 · wo run 30m · sl 23:30-7:10. While the line is empty, it suggests what you usually log now.",
		logs: "Browse every log and action, filtered by kind; edit, delete, or repeat a log, and undo a delete.",
		profile:
			"Your name, body, work style, and health goal, which set your daily targets and shape your character.",
		theme: "Pick the color tone of the dashboard and your character.",
		language: "Switch between English, Traditional Chinese, and Korean.",
		update:
			"See the version you run and the newest release, and update in place: through NPM for the command line, or by swapping in the new build for the desktop app.",
		open: "Enter to open",
		environment:
			"See and change what environment variables control: the data folder, the timer, motion, and API keys. Your shell's variables always win.",
	},
	signal: {
		ready: "Ready",
		paused: "Paused",
		entries: (count: number) => `${count} ${count === 1 ? "log" : "logs"}`,
		quotesAuto: (interval: string) => `Auto · every ${interval}`,
		quotesManual: "Manual refresh",
		setUp: "Set up",
		loggedToday: (count: number) => `${count} logged today`,
		version: (version: string) => `v${version}`,
		updateAvailable: (version: string) => `v${version} available`,
		saved: (count: number) => `${count} saved`,
	},
	today: {
		title: "Today",
		character: "Character",
		characterDetail: (next: number, missing: number) =>
			`${missing} XP to Lv ${next}`,
		focus: "Focus",
		focusDetail: (count: number, goal: number) =>
			`${count} of ${goal} sessions`,
		health: "Health",
		protein: "Protein",
		proteinDetail: (grams: string, target: string) => `${grams} of ${target} g`,
		calories: "Calories",
		caloriesDetail: (calories: string, target: string, meals: number) =>
			`${calories} of ${target} kcal · ${meals} ${meals === 1 ? "meal" : "meals"}`,
		workout: "Workout",
		workoutDetail: (minutes: number, goal: number) =>
			`${minutes} of ${goal} minutes`,
		water: "Water",
		waterDetail: (milliliters: string, target: string) =>
			`${milliliters} of ${target} ml`,
		sleep: "Sleep",
		sleepDetail: (slept: string, target: string) => `${slept} of ${target}`,
	},
	activity: {
		idle: "Wandering…",
		focus: "Focusing…",
		break: "On a break…",
		eat: "Eating…",
		run: "Running…",
		lift: "Lifting…",
		stretch: "Stretching…",
		levelUp: "Level up!",
		drink: "Drinking water…",
		weigh: "Weighing in…",
		write: "Writing…",
	},
	mood: {
		sleepy: "Dozing… log something to wake me",
		content: "Wandering…",
		happy: "Bouncing, every target met!",
	} satisfies Record<Mood, string>,
	timer: {
		focus: "Focus",
		break: "Break",
		left: (phase: string, clock: string) => `${phase} · ${clock} left`,
		pausedAt: (phase: string, clock: string) => `${phase} paused at ${clock}`,
		start: "Start a focus",
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
	appearance: {
		title: "Appearance",
		skinTone: "Skin tone",
		hairStyle: "Hair style",
		hairColor: "Hair color",
		facialHair: "Facial hair",
		glasses: "Glasses",
		/* eslint-disable @typescript-eslint/naming-convention */
		skinTones: {
			"1": "Lightest",
			"2": "Light",
			"3": "Medium",
			"4": "Tan",
			"5": "Deep",
		} satisfies Record<SkinTone, string>,
		/* eslint-enable @typescript-eslint/naming-convention */
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
		needsProfile:
			"Fill in your body and goal first; your appearance is saved with them.",
	},
	profileSections: {
		body: "Body and goal",
		appearance: "Appearance",
		back: "Back",
	},
	form: {
		profileTitle: "Profile",
		yours: "yours",
		nutrition: (calories: string, protein: string) =>
			`${calories} kcal · ${protein} g protein`,
		name: "Name",
		age: "Age",
		height: "Height (cm)",
		weight: "Weight (kg)",
		bodyFat: "Body fat % (optional, Enter to skip)",
		gender: "Gender",
		workStyle: "Work style",
		goal: "Health goal",
		required: "Required.",
		wholeNumber: (minimum: number, maximum: number) =>
			`Enter a whole number from ${minimum} to ${maximum}.`,
		cancelled: "Nothing changed.",
		profileSaved: "Profile saved. Your daily targets are updated.",
		levelUp: (level: number) => `Level up! Lv ${level}.`,
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
	gender: {
		female: "Female",
		male: "Male",
		other: "Other, or prefer not to say",
	} satisfies Record<Gender, string>,
	workStyle: {
		desk: "Desk work, mostly sitting",
		standing: "On your feet, like retail or teaching",
		active: "Physical work, like nursing or a warehouse",
		athlete: "Training hard every day",
	} satisfies Record<WorkStyle, string>,
	goal: {
		loseFat: "Lose fat",
		maintain: "Stay healthy",
		buildMuscle: "Build muscle",
		endurance: "Build endurance",
	} satisfies Record<HealthGoal, string>,
	health: {
		title: (goal: string) => `Health · ${goal}`,
		noProfile:
			"Set up your profile to get targets for your body, work style, and goal.",
		targets: (calories: string, protein: number, minutes: number) =>
			`Daily targets: ${calories} kcal, ${protein} g protein, ${minutes} minutes of exercise.`,
		proteinLeft: (grams: number) =>
			`${grams} g of protein to go today, e.g. a chicken breast has about 30 g.`,
		proteinDone: "Protein target met for today.",
		caloriesLeft: (calories: string) =>
			`${calories} kcal left in today's budget.`,
		caloriesOver: (calories: string) =>
			`${calories} kcal over today's budget; keep the next meal light.`,
		workoutLeft: (minutes: number, suggestion: string) =>
			`${minutes} more minutes of exercise today: ${suggestion}.`,
		workoutDone: "Exercise target met for today.",
		waterLeft: (milliliters: string, glasses: number) =>
			`${milliliters} ml of water to go today, about ${glasses} ${glasses === 1 ? "glass" : "glasses"}.`,
		waterDone: "Water target met for today.",
		sleepUnknown: "Log last night's sleep, e.g. sl 23:30-7:10.",
		sleepShort: (slept: string, target: string) =>
			`You slept ${slept}; aim for ${target} tonight.`,
		sleepDone: "You slept enough last night.",
		suggestion: {
			loseFat: "a brisk walk or an easy run",
			maintain: "a walk or a bike ride",
			buildMuscle: "a strength session",
			endurance: "a run, a ride, or a swim",
		} satisfies Record<HealthGoal, string>,
	},
	update: {
		current: (version: string) => `Current version: v${version}`,
		checking: "Checking for the newest version…",
		newest: (version: string) => `Newest version: v${version}`,
		upToDate: (version: string) =>
			`Newest version: v${version}, so you are up to date`,
		checkFailed: (error: string) => `Could not check for updates: ${error}`,
		installing: (version: string) => `Installing v${version}…`,
		installed: (version: string) =>
			`Installed v${version}. Restart to start using it.`,
		installFailed: (error: string) => `Could not update: ${error}`,
		install: (version: string) => `Update to v${version}`,
		restart: "Restart now",
		check: "Check again",
		back: "Back",
		via: {
			npm: "Updates with npm install --global",
			desktop: "Downloads the new app from GitHub Releases",
		} satisfies Record<Updater["source"], string>,
	},
	quotes: {
		draw: "Draw a new quote",
		fresh: "New",
		autoRefresh: (isOn: boolean) => `Auto-refresh: ${isOn ? "On" : "Off"}`,
		interval: (label: string) => `Interval: ${label}`,
		mode: (label: string) => `Source: ${label}`,
		categories: (summary: string) => `Categories: ${summary}`,
		excluded: (summary: string) => `Exclude: ${summary}`,
		author: (value: string) => `Author: ${value}`,
		work: (value: string) => `Work: ${value}`,
		authorPrompt: "Author, or empty for any",
		workPrompt: "Book or work, or empty for any",
		any: "Any",
		all: "All",
		none: "None",
		done: "Done",
		back: "Back",
		changed: "Quote settings saved.",
		modes: {
			random: "Random quotes",
			daily: "Quote of the day",
		} satisfies Record<QuoteMode, string>,
		intervals: durationIn("en"),
		categoryNames: {
			art: "Art",
			courage: "Courage",
			death: "Death",
			faith: "Faith",
			fear: "Fear",
			freedom: "Freedom",
			happiness: "Happiness",
			humor: "Humor",
			inspirational: "Inspirational",
			leadership: "Leadership",
			life: "Life",
			love: "Love",
			nature: "Nature",
			philosophy: "Philosophy",
			relationships: "Relationships",
			success: "Success",
			time: "Time",
			truth: "Truth",
			wisdom: "Wisdom",
			writing: "Writing",
		} satisfies Record<QuoteCategory, string>,
	},
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
		correlation: (
			difference: string,
			factor: string,
			withDays: number,
			withoutDays: number,
		) =>
			`Mood ${difference} on days with ${factor} (${withDays} vs ${withoutDays} days)`,
		lift: (exercise: string, best: string, change: string) =>
			`${exercise}: best ${best} kg${change ? ` (${change})` : ""}`,
	},
	events: {
		appOpened: () => "Opened Terminal Sigma",
		timerStarted: (minutes: string) => `Started a ${minutes}-minute focus`,
		timerPaused: (clock: string) => `Paused the timer at ${clock}`,
		timerResumed: () => "Resumed the timer",
		timerStopped: (clock: string) => `Stopped a tomato at ${clock}`,
		breakOver: () => "Finished a break",
		levelUp: (level: string) => `Reached Lv ${level}`,
		languageChanged: (name: string) => `Switched the language to ${name}`,
		themeChanged: (name: string) => `Switched the theme to ${name}`,
		appearanceSaved: () => "Changed the appearance",
		profileSaved: () => "Updated the profile",
		quoteDrawn: () => "Drew a new quote",
		quoteSettingsChanged: (setting: string) => `Changed quotes: ${setting}`,
		updateInstalled: (version: string) => `Updated to v${version}`,
		variableSaved: (name: string) => `Saved ${name}`,
		variableCleared: (name: string) => `Cleared ${name}`,
		goalChanged: (setting: string) => `Changed a goal · ${setting}`,
		logDeleted: (kind: string) => `Deleted a log · ${kind}`,
		logEdited: (kind: string) => `Edited a log · ${kind}`,
	} satisfies Record<EventAction, (detail: string) => string>,
	themes: {
		changed: (name: string) => `Theme set to ${name}.`,
		names: {
			ember: "Ember",
			moss: "Moss",
			frost: "Frost",
			dusk: "Dusk",
			mono: "Mono",
		} satisfies Record<ThemeName, string>,
	},
	log: {
		title: "Log",
		editTitle: "Edit a log",
		placeholder: "2 eggs, toast · w 500 · wo run 30m",
		prefixes:
			"w water · wt weight · waist · bf body fat · sl sleep · m mood · h habit · st steps · n note",
		shortcuts:
			"wo workout · goal · @y yesterday · @7:30 a time · . repeat · copy y · u undo",
		more: (count: number) => `+${count} more`,
		undoHint: "Enter undoes the last line logged here.",
		// Only a line that added entries can be undone; a goal is typed back.
		logged: (summary: string, xp: number, canUndo: boolean) =>
			`Logged ${summary}${xp > 0 ? ` · +${xp} XP` : ""}${canUndo ? " · u to undo" : ""}`,
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
		quickAdd: "Quick add",
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
		reasons: {
			usual: "usual around now",
			water: "behind on water today",
			workout: "same day last week",
			habit: (days: number) => `${days} of the last 7 days`,
		},
	},
	logs: {
		title: "History",
		deleted: "Deleted the log. Press u to put it back.",
		restored: "Put the log back.",
		cannotEdit: "Focus and actions cannot change.",
		cannotEditLine:
			"This entry can't be written as 1 line; delete it and log it again.",
		mustKeepKind: "An edit keeps its kind; log anything else as a new line.",
		all: "All",
		week: "Week",
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
	recent: {
		title: "Recent",
		empty: "Nothing yet. Start a tomato or log a meal.",
	},
	quoteDrawn: "New quote drawn.",
	/* eslint-disable @typescript-eslint/naming-convention */
	environment: {
		groups: {
			data: "Data",
			timer: "Tomato Timer",
			display: "Display",
			quotes: "Everyday Quotes",
		} satisfies Record<VariableGroup, string>,
		names: {
			TERMINAL_SIGMA_HOME: "Data folder",
			TERMINAL_SIGMA_FOCUS: "Focus minutes",
			TERMINAL_SIGMA_BREAK: "Break minutes",
			TERMINAL_SIGMA_MOTION: "Motion",
			API_NINJAS_KEY: "API Ninjas key",
		} satisfies Record<VariableName, string>,
		describe: {
			TERMINAL_SIGMA_HOME:
				"The folder that holds progress.json, as an absolute path. Applies after a restart; progress.json is not moved, so copy it there first.",
			TERMINAL_SIGMA_FOCUS:
				"Minutes of each focus, from 1 to 180. Applies after a restart; --focus still wins.",
			TERMINAL_SIGMA_BREAK:
				"Minutes of each break, from 1 to 180. Applies after a restart; --break still wins.",
			TERMINAL_SIGMA_MOTION:
				"full, or reduced to show every change at once, without text effects.",
			API_NINJAS_KEY:
				"Your API Ninjas key, to fetch English quotes instead of the bundled ones.",
		} satisfies Record<VariableName, string>,
		sources: {
			shell: "shell",
			saved: "saved",
			default: "default",
		} satisfies Record<Source, string>,
		unset: "–",
		placeholder: (current: string) => `Now: ${current}`,
		invalid: "That value is not allowed; see the line above.",
		shellWins: "Your shell sets this variable, so it wins over a saved value.",
		saved: "Saved.",
		savedRestart: "Saved. Restart Terminal Sigma to apply it.",
		cleared: "Cleared.",
	},
	/* eslint-enable @typescript-eslint/naming-convention */
};

export type Messages = typeof en;

const traditionalChinese: Messages = {
	languageName: "繁體中文",
	languageChanged: "語言已設為繁體中文。",
	chooseLanguage: "Choose your language · 選擇語言 · 언어 선택",
	level: (level) => `Lv ${level}`,
	streak: (days) => `連續 ${days} 天`,
	savedTo: (file) => `進度儲存於 ${file}`,
	notSaved: (error) => `未儲存：${error}`,
	hints: {
		menu: "↑↓ 移動 · enter 開啟 · q 離開",
		select: "↑↓ 移動 · enter 選擇 · esc 返回",
		form: "enter 下一步 · esc 取消",
		suggest: "↑↓ 挑選 · tab 填入 · enter 下一步 · esc 取消",
		logs: "←→ 篩選 · e 編輯 · d 刪除 · r 重複 · u 復原 · esc 返回",
		environment: "↑↓ 移動 · enter 編輯 · esc 返回",
		edit: "enter 儲存 · 空白 enter 清除 · esc 保留",
		log: "↑↓ 挑選 · tab 補全 · enter 記錄 · esc 返回",
	},
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
	describe: {
		quotes: "換一則語錄，或設定語錄多久更新一次、要看哪些類型。",
		timer: (focus, rest) =>
			`完成 ${focus} 分鐘專注可獲得 ${focus} XP，接著休息 ${rest} 分鐘。在這裡開始、暫停、繼續或停止。`,
		log: "用一行記錄任何事，例如：2 顆蛋, 吐司 · w 500 · wo 跑步 30m · sl 23:30-7:10。輸入列空白時，會建議你這個時段常記錄的內容。",
		logs: "依類型瀏覽每一筆紀錄與操作；可以編輯、刪除或重複一筆紀錄，也能復原刪除。",
		profile:
			"你的名字、身體數據、工作型態與健康目標，用來計算每日目標並決定角色的樣子。",
		theme: "選擇儀表板與角色的色調。",
		language: "切換英文、繁體中文與韓文。",
		update:
			"查看目前版本與最新版本，並直接更新：命令列透過 NPM，桌面版則換上新的版本。",
		open: "按 Enter 開啟",
		environment:
			"查看並修改環境變數控制的設定：資料夾、番茄鐘、動態效果與 API 金鑰。終端機設定的變數永遠優先。",
	},
	signal: {
		ready: "就緒",
		paused: "已暫停",
		entries: (count) => `${count} 筆`,
		quotesAuto: (interval) => `自動 · 每 ${interval}`,
		quotesManual: "手動更新",
		setUp: "設定",
		loggedToday: (count) => `今天記錄 ${count} 筆`,
		version: (version) => `v${version}`,
		updateAvailable: (version) => `可更新至 v${version}`,
		saved: (count) => `已儲存 ${count} 項`,
	},
	today: {
		title: "今日",
		character: "角色",
		characterDetail: (next, missing) => `距 Lv ${next} 還差 ${missing} XP`,
		focus: "專注",
		focusDetail: (count, goal) => `${count} / ${goal} 次`,
		health: "健康",
		protein: "蛋白質",
		proteinDetail: (grams, target) => `${grams} / ${target} 克`,
		calories: "熱量",
		caloriesDetail: (calories, target, meals) =>
			`${calories} / ${target} 大卡 · ${meals} 餐`,
		workout: "運動",
		workoutDetail: (minutes, goal) => `${minutes} / ${goal} 分鐘`,
		water: "喝水",
		waterDetail: (milliliters, target) => `${milliliters} / ${target} 毫升`,
		sleep: "睡眠",
		sleepDetail: (slept, target) => `${slept} / ${target}`,
	},
	activity: {
		idle: "閒晃中…",
		focus: "專注中…",
		break: "休息中…",
		eat: "用餐中…",
		run: "跑步中…",
		lift: "重訓中…",
		stretch: "伸展中…",
		levelUp: "升級了！",
		drink: "喝水中…",
		weigh: "量體重中…",
		write: "寫字中…",
	},
	mood: {
		sleepy: "打瞌睡中…記錄點什麼來叫醒我",
		content: "閒晃中…",
		happy: "開心蹦跳，目標全數達成！",
	},
	timer: {
		focus: "專注",
		break: "休息",
		left: (phase, clock) => `${phase} · 剩 ${clock}`,
		pausedAt: (phase, clock) => `${phase}已暫停於 ${clock}`,
		start: "開始專注",
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
	profileSections: { body: "身體與目標", appearance: "外觀", back: "返回" },
	appearance: {
		title: "外觀",
		skinTone: "膚色",
		hairStyle: "髮型",
		hairColor: "髮色",
		facialHair: "鬍子",
		glasses: "眼鏡",
		/* eslint-disable @typescript-eslint/naming-convention */
		skinTones: {
			"1": "最淺",
			"2": "淺",
			"3": "中等",
			"4": "小麥色",
			"5": "深",
		},
		/* eslint-enable @typescript-eslint/naming-convention */
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
	form: {
		profileTitle: "個人資料",
		yours: "你的",
		nutrition: (calories, protein) => `${calories} 大卡 · 蛋白質 ${protein} 克`,
		name: "名字",
		age: "年齡",
		height: "身高（公分）",
		weight: "體重（公斤）",
		bodyFat: "體脂率 %（可略過，按 Enter）",
		gender: "性別",
		workStyle: "工作型態",
		goal: "健康目標",
		required: "必填。",
		wholeNumber: (minimum, maximum) =>
			`請輸入 ${minimum} 到 ${maximum} 的整數。`,
		cancelled: "沒有任何變更。",
		profileSaved: "個人資料已儲存，每日目標已更新。",
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
	gender: {
		female: "女性",
		male: "男性",
		other: "其他或不透露",
	},
	workStyle: {
		desk: "辦公桌工作，大多坐著",
		standing: "需要久站，例如零售或教學",
		active: "體力勞動，例如護理或倉儲",
		athlete: "每天高強度訓練",
	},
	goal: {
		loseFat: "減脂",
		maintain: "維持健康",
		buildMuscle: "增肌",
		endurance: "提升耐力",
	},
	health: {
		title: (goal) => `健康 · ${goal}`,
		noProfile: "設定個人資料，即可依身體、工作型態與目標取得專屬目標。",
		targets: (calories, protein, minutes) =>
			`每日目標：${calories} 大卡、蛋白質 ${protein} 克、運動 ${minutes} 分鐘。`,
		proteinLeft: (grams) =>
			`今天還需要 ${grams} 克蛋白質，例如一塊雞胸肉約 30 克。`,
		proteinDone: "今天的蛋白質已達標。",
		caloriesLeft: (calories) => `今天的熱量預算還剩 ${calories} 大卡。`,
		caloriesOver: (calories) =>
			`今天已超出熱量預算 ${calories} 大卡，下一餐吃清淡些。`,
		workoutLeft: (minutes, suggestion) =>
			`今天還需運動 ${minutes} 分鐘：${suggestion}。`,
		workoutDone: "今天的運動已達標。",
		waterLeft: (milliliters, glasses) =>
			`今天還要喝 ${milliliters} 毫升水，大約 ${glasses} 杯。`,
		waterDone: "今天的喝水目標已達成。",
		sleepUnknown: "記錄昨晚的睡眠，例如：sl 23:30-7:10。",
		sleepShort: (slept, target) =>
			`昨晚睡了 ${slept}，今晚試著睡滿 ${target}。`,
		sleepDone: "昨晚睡得很充足。",
		suggestion: {
			loseFat: "快走或輕鬆慢跑",
			maintain: "散步或騎單車",
			buildMuscle: "一次重量訓練",
			endurance: "跑步、騎車或游泳",
		},
	},
	update: {
		current: (version) => `目前版本：v${version}`,
		checking: "正在檢查最新版本…",
		newest: (version) => `最新版本：v${version}`,
		upToDate: (version) => `最新版本：v${version}，已是最新`,
		checkFailed: (error) => `無法檢查更新：${error}`,
		installing: (version) => `正在安裝 v${version}…`,
		installed: (version) => `已安裝 v${version}，重新啟動即可使用。`,
		installFailed: (error) => `無法更新：${error}`,
		install: (version) => `更新至 v${version}`,
		restart: "立即重新啟動",
		check: "再檢查一次",
		back: "返回",
		via: {
			npm: "透過 npm install --global 更新",
			desktop: "從 GitHub Releases 下載新版應用程式",
		},
	},
	quotes: {
		draw: "換一則語錄",
		fresh: "新",
		autoRefresh: (isOn) => `自動更新：${isOn ? "開" : "關"}`,
		interval: (label) => `間隔：${label}`,
		mode: (label) => `來源：${label}`,
		categories: (summary) => `類別：${summary}`,
		excluded: (summary) => `排除：${summary}`,
		author: (value) => `作者：${value}`,
		work: (value) => `作品：${value}`,
		authorPrompt: "作者，留空表示不限",
		workPrompt: "書名或作品，留空表示不限",
		any: "不限",
		all: "全部",
		none: "無",
		done: "完成",
		back: "返回",
		changed: "語錄設定已儲存。",
		modes: {
			random: "隨機語錄",
			daily: "每日一句",
		},
		intervals: durationIn("zh-TW"),
		categoryNames: {
			art: "藝術",
			courage: "勇氣",
			death: "死亡",
			faith: "信念",
			fear: "恐懼",
			freedom: "自由",
			happiness: "幸福",
			humor: "幽默",
			inspirational: "激勵",
			leadership: "領導",
			life: "人生",
			love: "愛",
			nature: "自然",
			philosophy: "哲學",
			relationships: "人際關係",
			success: "成功",
			time: "時間",
			truth: "真理",
			wisdom: "智慧",
			writing: "寫作",
		},
	},
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
	events: {
		appOpened: () => "開啟 Terminal Sigma",
		timerStarted: (minutes) => `開始 ${minutes} 分鐘專注`,
		timerPaused: (clock) => `於 ${clock} 暫停計時`,
		timerResumed: () => "繼續計時",
		timerStopped: (clock) => `於 ${clock} 結束番茄`,
		breakOver: () => "結束休息",
		levelUp: (level) => `升到 Lv ${level}`,
		languageChanged: (name) => `語言改為${name}`,
		themeChanged: (name) => `主題改為${name}`,
		appearanceSaved: () => "變更外觀",
		profileSaved: () => "更新個人資料",
		quoteDrawn: () => "換了一則語錄",
		quoteSettingsChanged: (setting) => `變更語錄設定：${setting}`,
		updateInstalled: (version) => `更新至 v${version}`,
		variableSaved: (name) => `儲存 ${name}`,
		variableCleared: (name) => `清除 ${name}`,
		goalChanged: (setting) => `變更目標 · ${setting}`,
		logDeleted: (kind) => `刪除紀錄 · ${kind}`,
		logEdited: (kind) => `編輯紀錄 · ${kind}`,
	},
	themes: {
		changed: (name) => `主題已設為${name}。`,
		names: {
			ember: "餘燼",
			moss: "苔蘚",
			frost: "霜雪",
			dusk: "暮色",
			mono: "單色",
		},
	},
	log: {
		title: "記錄",
		editTitle: "編輯紀錄",
		placeholder: "2 顆蛋, 吐司 · w 500 · wo 跑步 30m",
		prefixes:
			"w 喝水 · wt 體重 · waist 腰圍 · bf 體脂 · sl 睡眠 · m 心情 · h 習慣 · st 步數 · n 筆記",
		shortcuts:
			"wo 運動 · goal 目標 · @y 昨天 · @7:30 時間 · . 重複 · copy y 複製昨天 · u 復原",
		more: (count) => `還有 ${count} 項`,
		undoHint: "按 Enter 復原剛才在這裡記錄的上一行。",
		logged: (summary, xp, canUndo) =>
			`已記錄 ${summary}${xp > 0 ? ` · +${xp} XP` : ""}${canUndo ? " · 輸入 u 復原" : ""}`,
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
		quickAdd: "快速記錄",
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
		reasons: {
			usual: "這個時段常吃",
			water: "今天喝水進度落後",
			workout: "上週的今天",
			habit: (days) => `過去 7 天有 ${days} 天`,
		},
	},
	logs: {
		title: "歷史紀錄",
		deleted: "已刪除這筆紀錄，按 u 還原。",
		restored: "已還原這筆紀錄。",
		cannotEdit: "專注與操作紀錄不能更改。",
		cannotEditLine: "這筆紀錄無法寫成一行；請刪除後重新記錄。",
		mustKeepKind: "編輯時不能改變種類；其他內容請另起一行記錄。",
		all: "全部",
		week: "本週",
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
	recent: {
		title: "最近",
		empty: "還沒有紀錄。開始一顆番茄或記錄一餐吧。",
	},
	quoteDrawn: "已換一則語錄。",
	/* eslint-disable @typescript-eslint/naming-convention */
	environment: {
		groups: {
			data: "資料",
			timer: "番茄鐘",
			display: "顯示",
			quotes: "每日語錄",
		},
		names: {
			TERMINAL_SIGMA_HOME: "資料夾",
			TERMINAL_SIGMA_FOCUS: "專注分鐘數",
			TERMINAL_SIGMA_BREAK: "休息分鐘數",
			TERMINAL_SIGMA_MOTION: "動態效果",
			API_NINJAS_KEY: "API Ninjas 金鑰",
		},
		describe: {
			TERMINAL_SIGMA_HOME:
				"存放 progress.json 的資料夾，須為絕對路徑。重新啟動後生效；progress.json 不會自動搬移，請先複製過去。",
			TERMINAL_SIGMA_FOCUS:
				"每次專注的分鐘數，1 到 180。重新啟動後生效；--focus 仍優先。",
			TERMINAL_SIGMA_BREAK:
				"每次休息的分鐘數，1 到 180。重新啟動後生效；--break 仍優先。",
			TERMINAL_SIGMA_MOTION:
				"full，或 reduced 以立即顯示所有變化，不播放文字特效。",
			API_NINJAS_KEY: "你的 API Ninjas 金鑰，用來改抓英文語錄，而非內建語錄。",
		},
		sources: { shell: "終端機", saved: "已儲存", default: "預設" },
		unset: "–",
		placeholder: (current) => `目前：${current}`,
		invalid: "不接受這個值，請見上一行說明。",
		shellWins: "終端機已設定這個變數，因此優先於儲存的值。",
		saved: "已儲存。",
		savedRestart: "已儲存。重新啟動 Terminal Sigma 後生效。",
		cleared: "已清除。",
	},
	/* eslint-enable @typescript-eslint/naming-convention */
};

const korean: Messages = {
	languageName: "한국어",
	languageChanged: "언어가 한국어로 설정되었습니다.",
	chooseLanguage: "Choose your language · 選擇語言 · 언어 선택",
	level: (level) => `Lv ${level}`,
	streak: (days) => `${days}일 연속`,
	savedTo: (file) => `진행 상황 저장 위치: ${file}`,
	notSaved: (error) => `저장되지 않음: ${error}`,
	hints: {
		menu: "↑↓ 이동 · enter 열기 · q 종료",
		select: "↑↓ 이동 · enter 선택 · esc 뒤로",
		form: "enter 다음 · esc 취소",
		suggest: "↑↓ 고르기 · tab 채우기 · enter 다음 · esc 취소",
		logs: "←→ 필터 · e 수정 · d 삭제 · r 반복 · u 되돌리기 · esc 뒤로",
		environment: "↑↓ 이동 · enter 편집 · esc 뒤로",
		edit: "enter 저장 · 빈 enter 지우기 · esc 유지",
		log: "↑↓ 고르기 · tab 완성 · enter 기록 · esc 뒤로",
	},
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
	describe: {
		quotes:
			"새 명언을 뽑거나, 명언이 얼마나 자주 바뀌고 어떤 종류를 볼지 정합니다.",
		timer: (focus, rest) =>
			`${focus}분 집중을 마치면 ${focus} XP를 얻고 ${rest}분 휴식이 시작됩니다. 여기서 시작, 일시정지, 재개, 중지합니다.`,
		log: "한 줄로 무엇이든 기록합니다. 예: 계란 2개, 토스트 · w 500 · wo 달리기 30m · sl 23:30-7:10. 줄이 비어 있으면 지금 자주 기록하는 항목을 제안합니다.",
		logs: "모든 기록과 활동을 종류별로 봅니다. 기록을 수정, 삭제, 반복하고 삭제를 되돌릴 수 있습니다.",
		profile:
			"이름, 신체 정보, 업무 형태, 건강 목표로 하루 목표를 정하고 캐릭터의 모습을 바꿉니다.",
		theme: "대시보드와 캐릭터의 색조를 고릅니다.",
		language: "영어, 번체 중국어, 한국어 중에서 전환합니다.",
		update:
			"지금 쓰는 버전과 최신 버전을 보고 바로 업데이트합니다. 명령줄은 NPM으로, 데스크톱 앱은 새 빌드로 바꿉니다.",
		open: "Enter로 열기",
		environment:
			"데이터 폴더, 타이머, 움직임, API 키처럼 환경 변수가 정하는 설정을 보고 바꿉니다. 셸에서 설정한 변수가 항상 우선합니다.",
	},
	signal: {
		ready: "준비",
		paused: "일시정지",
		entries: (count) => `${count}개`,
		quotesAuto: (interval) => `자동 · ${interval}마다`,
		quotesManual: "수동 새로고침",
		setUp: "설정",
		loggedToday: (count) => `오늘 ${count}개 기록`,
		version: (version) => `v${version}`,
		updateAvailable: (version) => `v${version} 업데이트 가능`,
		saved: (count) => `${count}개 저장됨`,
	},
	today: {
		title: "오늘",
		character: "캐릭터",
		characterDetail: (next, missing) => `Lv ${next}까지 ${missing} XP`,
		focus: "집중",
		focusDetail: (count, goal) => `${count} / ${goal}회`,
		health: "건강",
		protein: "단백질",
		proteinDetail: (grams, target) => `${grams} / ${target}g`,
		calories: "칼로리",
		caloriesDetail: (calories, target, meals) =>
			`${calories} / ${target} kcal · ${meals}끼`,
		workout: "운동",
		workoutDetail: (minutes, goal) => `${minutes} / ${goal}분`,
		water: "물",
		waterDetail: (milliliters, target) => `${milliliters} / ${target}ml`,
		sleep: "수면",
		sleepDetail: (slept, target) => `${slept} / ${target}`,
	},
	activity: {
		idle: "돌아다니는 중…",
		focus: "집중 중…",
		break: "휴식 중…",
		eat: "식사 중…",
		run: "달리는 중…",
		lift: "웨이트 중…",
		stretch: "스트레칭 중…",
		levelUp: "레벨 업!",
		drink: "물 마시는 중…",
		weigh: "체중 재는 중…",
		write: "쓰는 중…",
	},
	mood: {
		sleepy: "꾸벅꾸벅… 뭐라도 기록해서 깨워 주세요",
		content: "돌아다니는 중…",
		happy: "목표 모두 달성, 신나게 통통!",
	},
	timer: {
		focus: "집중",
		break: "휴식",
		left: (phase, clock) => `${phase} · ${clock} 남음`,
		pausedAt: (phase, clock) => `${phase} ${clock}에서 일시정지`,
		start: "집중 시작",
		pause: "일시정지",
		resume: "재개",
		stop: "이번 토마토 중지",
		back: "뒤로",
		started: "집중을 시작했습니다.",
		paused: "타이머를 일시정지했습니다.",
		resumed: "타이머를 재개했습니다.",
		stopped: "토마토를 중지했습니다. 끝내지 못한 집중은 XP가 없습니다.",
		focusComplete: (xp, rest) =>
			`집중 완료, +${xp} XP. ${rest}분 휴식을 시작합니다.`,
		breakOver: "휴식이 끝났습니다. 토마토 타이머를 선택해 다시 집중하세요.",
	},
	profileSections: { body: "신체와 목표", appearance: "외모", back: "뒤로" },
	appearance: {
		title: "외모",
		skinTone: "피부 톤",
		hairStyle: "헤어스타일",
		hairColor: "머리 색",
		facialHair: "수염",
		glasses: "안경",
		/* eslint-disable @typescript-eslint/naming-convention */
		skinTones: {
			"1": "가장 밝음",
			"2": "밝음",
			"3": "중간",
			"4": "구릿빛",
			"5": "어두움",
		},
		/* eslint-enable @typescript-eslint/naming-convention */
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
		needsProfile:
			"먼저 신체와 목표를 입력하세요. 외모는 그것과 함께 저장됩니다.",
	},
	form: {
		profileTitle: "프로필",
		yours: "내 기록",
		nutrition: (calories, protein) => `${calories} kcal · 단백질 ${protein}g`,
		name: "이름",
		age: "나이",
		height: "키 (cm)",
		weight: "몸무게 (kg)",
		bodyFat: "체지방률 % (선택, Enter로 건너뛰기)",
		gender: "성별",
		workStyle: "업무 형태",
		goal: "건강 목표",
		required: "필수 항목입니다.",
		wholeNumber: (minimum, maximum) =>
			`${minimum}부터 ${maximum}까지의 정수를 입력하세요.`,
		cancelled: "바뀐 것이 없습니다.",
		profileSaved: "프로필을 저장했습니다. 하루 목표가 갱신되었습니다.",
		levelUp: (level) => `레벨 업! Lv ${level}.`,
	},
	workoutActivity: {
		running: "달리기",
		walking: "걷기",
		cycling: "자전거",
		swimming: "수영",
		strength: "근력 운동",
		yoga: "요가",
		other: "기타",
	},
	intensity: {
		light: "가볍게",
		moderate: "보통",
		vigorous: "격렬하게",
	},
	gender: {
		female: "여성",
		male: "남성",
		other: "기타 또는 밝히지 않음",
	},
	workStyle: {
		desk: "사무직, 주로 앉아서",
		standing: "서서 일함, 판매나 교육 등",
		active: "육체 노동, 간호나 물류 등",
		athlete: "매일 강도 높은 훈련",
	},
	goal: {
		loseFat: "체지방 감량",
		maintain: "건강 유지",
		buildMuscle: "근육 증가",
		endurance: "지구력 향상",
	},
	health: {
		title: (goal) => `건강 · ${goal}`,
		noProfile:
			"프로필을 설정하면 신체, 업무 형태, 목표에 맞는 목표를 받을 수 있습니다.",
		targets: (calories, protein, minutes) =>
			`하루 목표: ${calories} kcal, 단백질 ${protein}g, 운동 ${minutes}분.`,
		proteinLeft: (grams) =>
			`오늘 단백질이 ${grams}g 더 필요합니다. 닭가슴살 하나에 약 30g이 들어 있습니다.`,
		proteinDone: "오늘 단백질 목표를 달성했습니다.",
		caloriesLeft: (calories) =>
			`오늘 칼로리 예산이 ${calories} kcal 남았습니다.`,
		caloriesOver: (calories) =>
			`오늘 칼로리 예산을 ${calories} kcal 넘었습니다. 다음 식사는 가볍게 하세요.`,
		workoutLeft: (minutes, suggestion) =>
			`오늘 운동이 ${minutes}분 더 필요합니다: ${suggestion}.`,
		workoutDone: "오늘 운동 목표를 달성했습니다.",
		waterLeft: (milliliters, glasses) =>
			`오늘 물을 ${milliliters}ml 더 마셔야 합니다. 약 ${glasses}잔입니다.`,
		waterDone: "오늘 물 목표를 달성했습니다.",
		sleepUnknown: "지난밤 수면을 기록하세요. 예: sl 23:30-7:10",
		sleepShort: (slept, target) =>
			`지난밤 ${slept} 잤습니다. 오늘 밤은 ${target}을 목표로 하세요.`,
		sleepDone: "지난밤 충분히 잤습니다.",
		suggestion: {
			loseFat: "빠르게 걷기나 가벼운 달리기",
			maintain: "산책이나 자전거 타기",
			buildMuscle: "근력 운동 한 세션",
			endurance: "달리기, 자전거, 또는 수영",
		},
	},
	update: {
		current: (version) => `현재 버전: v${version}`,
		checking: "최신 버전을 확인하는 중…",
		newest: (version) => `최신 버전: v${version}`,
		upToDate: (version) => `최신 버전: v${version}, 이미 최신입니다`,
		checkFailed: (error) => `업데이트를 확인하지 못했습니다: ${error}`,
		installing: (version) => `v${version} 설치 중…`,
		installed: (version) =>
			`v${version}을(를) 설치했습니다. 다시 시작하면 적용됩니다.`,
		installFailed: (error) => `업데이트하지 못했습니다: ${error}`,
		install: (version) => `v${version}(으)로 업데이트`,
		restart: "지금 다시 시작",
		check: "다시 확인",
		back: "뒤로",
		via: {
			npm: "npm install --global로 업데이트합니다",
			desktop: "GitHub Releases에서 새 앱을 내려받습니다",
		},
	},
	quotes: {
		draw: "새 명언 뽑기",
		fresh: "새 명언",
		autoRefresh: (isOn) => `자동 새로고침: ${isOn ? "켬" : "끔"}`,
		interval: (label) => `간격: ${label}`,
		mode: (label) => `출처: ${label}`,
		categories: (summary) => `카테고리: ${summary}`,
		excluded: (summary) => `제외: ${summary}`,
		author: (value) => `작가: ${value}`,
		work: (value) => `작품: ${value}`,
		authorPrompt: "작가, 비우면 제한 없음",
		workPrompt: "책이나 작품, 비우면 제한 없음",
		any: "제한 없음",
		all: "전체",
		none: "없음",
		done: "완료",
		back: "뒤로",
		changed: "명언 설정을 저장했습니다.",
		modes: {
			random: "무작위 명언",
			daily: "오늘의 한마디",
		},
		intervals: durationIn("ko"),
		categoryNames: {
			art: "예술",
			courage: "용기",
			death: "죽음",
			faith: "믿음",
			fear: "두려움",
			freedom: "자유",
			happiness: "행복",
			humor: "유머",
			inspirational: "영감",
			leadership: "리더십",
			life: "인생",
			love: "사랑",
			nature: "자연",
			philosophy: "철학",
			relationships: "인간관계",
			success: "성공",
			time: "시간",
			truth: "진리",
			wisdom: "지혜",
			writing: "글쓰기",
		},
	},
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
	events: {
		appOpened: () => "Terminal Sigma 열기",
		timerStarted: (minutes) => `${minutes}분 집중 시작`,
		timerPaused: (clock) => `${clock}에서 타이머 일시정지`,
		timerResumed: () => "타이머 재개",
		timerStopped: (clock) => `${clock}에서 토마토 중지`,
		breakOver: () => "휴식 끝",
		levelUp: (level) => `Lv ${level} 달성`,
		languageChanged: (name) => `언어를 ${name}(으)로 변경`,
		themeChanged: (name) => `테마를 ${name}(으)로 변경`,
		appearanceSaved: () => "외모 변경",
		profileSaved: () => "프로필 갱신",
		quoteDrawn: () => "새 명언 뽑기",
		quoteSettingsChanged: (setting) => `명언 설정 변경: ${setting}`,
		updateInstalled: (version) => `v${version}(으)로 업데이트`,
		variableSaved: (name) => `${name} 저장`,
		variableCleared: (name) => `${name} 지움`,
		goalChanged: (setting) => `목표 변경 · ${setting}`,
		logDeleted: (kind) => `기록 삭제 · ${kind}`,
		logEdited: (kind) => `기록 수정 · ${kind}`,
	},
	themes: {
		changed: (name) => `테마를 ${name}(으)로 설정했습니다.`,
		names: {
			ember: "엠버",
			moss: "이끼",
			frost: "서리",
			dusk: "황혼",
			mono: "모노",
		},
	},
	log: {
		title: "기록하기",
		editTitle: "기록 수정",
		placeholder: "계란 2개, 토스트 · w 500 · wo 달리기 30m",
		prefixes:
			"w 물 · wt 체중 · waist 허리 · bf 체지방 · sl 수면 · m 기분 · h 습관 · st 걸음 · n 메모",
		shortcuts:
			"wo 운동 · goal 목표 · @y 어제 · @7:30 시각 · . 반복 · copy y 어제 복사 · u 되돌리기",
		more: (count) => `외 ${count}개`,
		undoHint: "Enter를 누르면 여기서 방금 기록한 줄을 되돌립니다.",
		logged: (summary, xp, canUndo) =>
			`${summary} 기록함${xp > 0 ? ` · +${xp} XP` : ""}${canUndo ? " · u로 되돌리기" : ""}`,
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
		quickAdd: "빠른 기록",
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
		reasons: {
			usual: "이 시간에 자주 먹음",
			water: "오늘 물이 부족함",
			workout: "지난주 오늘",
			habit: (days) => `지난 7일 중 ${days}일`,
		},
	},
	logs: {
		title: "지난 기록",
		deleted: "기록을 삭제했습니다. u를 누르면 되돌립니다.",
		restored: "기록을 되돌렸습니다.",
		cannotEdit: "집중과 활동 기록은 바꿀 수 없습니다.",
		cannotEditLine:
			"이 기록은 한 줄로 쓸 수 없습니다. 삭제하고 다시 기록하세요.",
		mustKeepKind:
			"수정할 때는 종류를 바꿀 수 없습니다. 다른 기록은 새 줄로 남기세요.",
		all: "전체",
		week: "이번 주",
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
	recent: {
		title: "최근",
		empty: "아직 없습니다. 토마토를 시작하거나 식사를 기록해 보세요.",
	},
	quoteDrawn: "새 명언을 뽑았습니다.",
	/* eslint-disable @typescript-eslint/naming-convention */
	environment: {
		groups: {
			data: "데이터",
			timer: "토마토 타이머",
			display: "화면",
			quotes: "오늘의 명언",
		},
		names: {
			TERMINAL_SIGMA_HOME: "데이터 폴더",
			TERMINAL_SIGMA_FOCUS: "집중 시간(분)",
			TERMINAL_SIGMA_BREAK: "휴식 시간(분)",
			TERMINAL_SIGMA_MOTION: "움직임",
			API_NINJAS_KEY: "API Ninjas 키",
		},
		describe: {
			TERMINAL_SIGMA_HOME:
				"progress.json을 보관하는 폴더의 절대 경로입니다. 다시 시작하면 적용되며, progress.json은 옮겨지지 않으니 먼저 복사해 두세요.",
			TERMINAL_SIGMA_FOCUS:
				"집중 1회의 시간(분), 1부터 180까지. 다시 시작하면 적용되며 --focus가 우선합니다.",
			TERMINAL_SIGMA_BREAK:
				"휴식 1회의 시간(분), 1부터 180까지. 다시 시작하면 적용되며 --break가 우선합니다.",
			TERMINAL_SIGMA_MOTION:
				"full, 또는 글자 효과 없이 모든 변화를 바로 보여 주는 reduced.",
			API_NINJAS_KEY: "번들 명언 대신 영어 명언을 가져올 API Ninjas 키입니다.",
		},
		sources: { shell: "셸", saved: "저장됨", default: "기본값" },
		unset: "–",
		placeholder: (current) => `현재: ${current}`,
		invalid: "허용되지 않는 값입니다. 위 설명을 확인하세요.",
		shellWins: "셸에서 이 변수를 설정했으므로 저장된 값보다 우선합니다.",
		saved: "저장했습니다.",
		savedRestart: "저장했습니다. 적용하려면 Terminal Sigma를 다시 시작하세요.",
		cleared: "지웠습니다.",
	},
	/* eslint-enable @typescript-eslint/naming-convention */
};

const messagesByLanguage: Record<Language, Messages> = {
	en,
	"zh-TW": traditionalChinese,
	ko: korean,
};

export const messagesOf = (language: Language): Messages =>
	messagesByLanguage[language];

export const formatNumber = (language: Language, value: number) =>
	value.toLocaleString(language);

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
