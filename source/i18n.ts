import type { ThemeName } from "./theme.js";

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

const en = {
	languageName: "English",
	languageChanged: "Language set to English.",
	chooseLanguage: "Choose your language · 選擇語言 · 언어 선택",
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
		health: "Health",
		logs: "Logs",
		quotes: "Everyday Quotes",
		profile: "Profile",
		theme: "Theme",
		language: "Language",
	},
	describe: {
		timer: (focus: number, rest: number) =>
			`Enter starts a ${focus}-minute focus, and pauses, resumes, or stops a running one. A finished focus earns ${focus} XP, then a ${rest}-minute break begins.`,
		health:
			"Your diet and workouts against targets from your profile, with advice for the rest of today.",
		logs: "Browse every focus, meal, and workout you have logged.",
		quotes: (minutes: number) =>
			`Draw a new quote. Quotes also refresh every ${minutes} minutes.`,
		profile:
			"Your name, body, work style, and health goal, which set your daily targets.",
		theme: "Pick the color tone of the dashboard and your character.",
		language: "Switch between English, Traditional Chinese, and Korean.",
	},
	signal: {
		ready: "Ready",
		paused: "Paused",
		entries: (count: number) => `${count} ${count === 1 ? "log" : "logs"}`,
		newQuote: "New",
		setUp: "Set up",
		proteinLeft: (grams: number) => `${grams} g protein`,
		onTrack: "On track",
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
	},
	activity: {
		idle: "Standing watch",
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
		profileTitle: "Profile",
		food: "Food",
		foodExample: "e.g. Chicken salad",
		calories: "Calories (kcal)",
		protein: "Protein (g)",
		activity: "Activity",
		minutes: "Minutes",
		intensity: "Intensity",
		name: "Name",
		age: "Age",
		height: "Height (cm)",
		weight: "Weight (kg)",
		gender: "Gender",
		workStyle: "Work style",
		goal: "Health goal",
		required: "Required.",
		wholeNumber: (minimum: number, maximum: number) =>
			`Enter a whole number from ${minimum} to ${maximum}.`,
		cancelled: "Nothing changed.",
		mealLogged: (food: string, xp: number) => `Logged ${food}, +${xp} XP.`,
		workoutLogged: (activity: string, minutes: number, xp: number) =>
			`Logged ${activity} for ${minutes} minutes, +${xp} XP.`,
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
		logMeal: "Log a meal",
		logWorkout: "Log a workout",
		setUp: "Set up my profile",
		back: "Back",
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
		suggestion: {
			loseFat: "a brisk walk or an easy run",
			maintain: "a walk or a bike ride",
			buildMuscle: "a strength session",
			endurance: "a run, a ride, or a swim",
		} satisfies Record<HealthGoal, string>,
		tip: {
			loseFat:
				"Protein and fiber keep you full; a steady deficit beats a crash diet.",
			maintain: "Move a little every day, and eat protein at every meal.",
			buildMuscle:
				"Train each muscle twice a week, and spread protein across meals.",
			endurance:
				"Build volume slowly, and refuel with carbohydrates after long sessions.",
		} satisfies Record<HealthGoal, string>,
	},
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
	logs: {
		title: "Logs",
		all: "All",
		focus: "Focus",
		diet: "Diet",
		workout: "Workout",
		empty: "Nothing logged yet.",
		summary: (count: number, xp: number) =>
			`${count} ${count === 1 ? "log" : "logs"} · ${xp} XP`,
		focusEntry: (minutes: number) => `${minutes}-minute focus`,
		mealEntry: (food: string, calories: string, protein: string) =>
			`${food} · ${calories} kcal · ${protein} g protein`,
		workoutEntry: (activity: string, minutes: number, intensity: string) =>
			`${activity} · ${minutes} min · ${intensity}`,
	},
	recent: {
		title: "Recent",
		empty: "Nothing yet. Start a tomato or log a meal.",
	},
	quoteDrawn: "New quote drawn.",
};

export type Messages = typeof en;

const traditionalChinese: Messages = {
	languageName: "繁體中文",
	languageChanged: "語言已設為繁體中文。",
	chooseLanguage: "Choose your language · 選擇語言 · 언어 선택",
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
		health: "健康",
		logs: "所有紀錄",
		quotes: "每日語錄",
		profile: "個人資料",
		theme: "主題",
		language: "語言",
	},
	describe: {
		timer: (focus, rest) =>
			`按 Enter 開始 ${focus} 分鐘專注；計時中再按 Enter 可暫停、繼續或停止。完成專注獲得 ${focus} XP，接著休息 ${rest} 分鐘。`,
		health: "依個人資料設定的目標檢視飲食與運動，並提供今天剩餘時間的建議。",
		logs: "瀏覽所有專注、飲食與運動紀錄。",
		quotes: (minutes) => `換一則語錄。語錄也會每 ${minutes} 分鐘自動更新。`,
		profile: "你的名字、身體數據、工作型態與健康目標，用來計算每日目標。",
		theme: "選擇儀表板與角色的色調。",
		language: "切換英文、繁體中文與韓文。",
	},
	signal: {
		ready: "就緒",
		paused: "已暫停",
		entries: (count) => `${count} 筆`,
		newQuote: "換一則",
		setUp: "設定",
		proteinLeft: (grams) => `蛋白質 ${grams} 克`,
		onTrack: "達標",
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
	},
	activity: {
		idle: "守望中",
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
		profileTitle: "個人資料",
		food: "食物",
		foodExample: "例如：雞肉沙拉",
		calories: "熱量（大卡）",
		protein: "蛋白質（克）",
		activity: "運動項目",
		minutes: "分鐘數",
		intensity: "強度",
		name: "名字",
		age: "年齡",
		height: "身高（公分）",
		weight: "體重（公斤）",
		gender: "性別",
		workStyle: "工作型態",
		goal: "健康目標",
		required: "必填。",
		wholeNumber: (minimum, maximum) =>
			`請輸入 ${minimum} 到 ${maximum} 的整數。`,
		cancelled: "沒有任何變更。",
		mealLogged: (food, xp) => `已記錄 ${food}，+${xp} XP。`,
		workoutLogged: (activity, minutes, xp) =>
			`已記錄${activity} ${minutes} 分鐘，+${xp} XP。`,
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
		logMeal: "記錄一餐",
		logWorkout: "記錄運動",
		setUp: "設定個人資料",
		back: "返回",
		proteinLeft: (grams) =>
			`今天還需要 ${grams} 克蛋白質，例如一塊雞胸肉約 30 克。`,
		proteinDone: "今天的蛋白質已達標。",
		caloriesLeft: (calories) => `今天的熱量預算還剩 ${calories} 大卡。`,
		caloriesOver: (calories) =>
			`今天已超出熱量預算 ${calories} 大卡，下一餐吃清淡些。`,
		workoutLeft: (minutes, suggestion) =>
			`今天還需運動 ${minutes} 分鐘：${suggestion}。`,
		workoutDone: "今天的運動已達標。",
		suggestion: {
			loseFat: "快走或輕鬆慢跑",
			maintain: "散步或騎單車",
			buildMuscle: "一次重量訓練",
			endurance: "跑步、騎車或游泳",
		},
		tip: {
			loseFat: "蛋白質與纖維讓人有飽足感；穩定的熱量赤字勝過激烈節食。",
			maintain: "每天都動一動，每餐都吃到蛋白質。",
			buildMuscle: "每個肌群一週訓練兩次，蛋白質分散在各餐攝取。",
			endurance: "循序漸進增加訓練量，長時間訓練後補充碳水化合物。",
		},
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
	recent: {
		title: "最近",
		empty: "還沒有紀錄。開始一顆番茄或記錄一餐吧。",
	},
	quoteDrawn: "已換一則語錄。",
};

const korean: Messages = {
	languageName: "한국어",
	languageChanged: "언어가 한국어로 설정되었습니다.",
	chooseLanguage: "Choose your language · 選擇語言 · 언어 선택",
	level: (level) => `Lv ${level}`,
	savedTo: (file) => `진행 상황 저장 위치: ${file}`,
	notSaved: (error) => `저장되지 않음: ${error}`,
	hints: {
		menu: "↑↓←→ 이동 · enter 선택 · q 종료",
		select: "↑↓ 이동 · enter 선택 · esc 뒤로",
		form: "enter 다음 · esc 취소",
		logs: "←→ 필터 · ↑↓ 스크롤 · esc 뒤로",
	},
	menu: {
		timer: "토마토 타이머",
		health: "건강",
		logs: "전체 기록",
		quotes: "오늘의 명언",
		profile: "프로필",
		theme: "테마",
		language: "언어",
	},
	describe: {
		timer: (focus, rest) =>
			`Enter로 ${focus}분 집중을 시작하고, 진행 중에는 일시정지, 재개, 중지할 수 있습니다. 집중을 마치면 ${focus} XP를 얻고 ${rest}분 휴식이 시작됩니다.`,
		health:
			"프로필로 정한 목표에 맞춰 식단과 운동을 확인하고, 남은 하루에 대한 조언을 받습니다.",
		logs: "기록한 모든 집중, 식사, 운동을 봅니다.",
		quotes: (minutes) =>
			`새 명언을 뽑습니다. 명언은 ${minutes}분마다 자동으로 바뀝니다.`,
		profile: "이름, 신체 정보, 업무 형태, 건강 목표로 하루 목표를 정합니다.",
		theme: "대시보드와 캐릭터의 색조를 고릅니다.",
		language: "영어, 번체 중국어, 한국어 중에서 전환합니다.",
	},
	signal: {
		ready: "준비",
		paused: "일시정지",
		entries: (count) => `${count}개`,
		newQuote: "새로",
		setUp: "설정",
		proteinLeft: (grams) => `단백질 ${grams}g`,
		onTrack: "달성",
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
	},
	activity: {
		idle: "경계 중",
		focus: "집중 중…",
		break: "휴식 중…",
		eat: "식사 중…",
		run: "달리는 중…",
		lift: "웨이트 중…",
		stretch: "스트레칭 중…",
		levelUp: "레벨 업!",
	},
	timer: {
		focus: "집중",
		break: "휴식",
		left: (phase, clock) => `${phase} · ${clock} 남음`,
		pausedAt: (phase, clock) => `${phase} ${clock}에서 일시정지`,
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
	form: {
		dietTitle: "식사 기록",
		workoutTitle: "운동 기록",
		profileTitle: "프로필",
		food: "음식",
		foodExample: "예: 닭가슴살 샐러드",
		calories: "칼로리 (kcal)",
		protein: "단백질 (g)",
		activity: "운동 종류",
		minutes: "시간 (분)",
		intensity: "강도",
		name: "이름",
		age: "나이",
		height: "키 (cm)",
		weight: "몸무게 (kg)",
		gender: "성별",
		workStyle: "업무 형태",
		goal: "건강 목표",
		required: "필수 항목입니다.",
		wholeNumber: (minimum, maximum) =>
			`${minimum}부터 ${maximum}까지의 정수를 입력하세요.`,
		cancelled: "바뀐 것이 없습니다.",
		mealLogged: (food, xp) => `${food}을(를) 기록했습니다, +${xp} XP.`,
		workoutLogged: (activity, minutes, xp) =>
			`${activity} ${minutes}분을 기록했습니다, +${xp} XP.`,
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
		logMeal: "식사 기록",
		logWorkout: "운동 기록",
		setUp: "프로필 설정",
		back: "뒤로",
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
		suggestion: {
			loseFat: "빠르게 걷기나 가벼운 달리기",
			maintain: "산책이나 자전거 타기",
			buildMuscle: "근력 운동 한 세션",
			endurance: "달리기, 자전거, 또는 수영",
		},
		tip: {
			loseFat:
				"단백질과 식이섬유가 포만감을 줍니다. 꾸준한 적자가 급격한 다이어트보다 낫습니다.",
			maintain: "매일 조금씩 움직이고, 끼니마다 단백질을 드세요.",
			buildMuscle:
				"각 근육을 일주일에 두 번 훈련하고, 단백질을 여러 끼니에 나눠 드세요.",
			endurance:
				"훈련량은 천천히 늘리고, 긴 운동 후에는 탄수화물로 보충하세요.",
		},
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
	logs: {
		title: "전체 기록",
		all: "전체",
		focus: "집중",
		diet: "식단",
		workout: "운동",
		empty: "아직 기록이 없습니다.",
		summary: (count, xp) => `${count}개 · ${xp} XP`,
		focusEntry: (minutes) => `${minutes}분 집중`,
		mealEntry: (food, calories, protein) =>
			`${food} · ${calories} kcal · 단백질 ${protein}g`,
		workoutEntry: (activity, minutes, intensity) =>
			`${activity} · ${minutes}분 · ${intensity}`,
	},
	recent: {
		title: "최근",
		empty: "아직 없습니다. 토마토를 시작하거나 식사를 기록해 보세요.",
	},
	quoteDrawn: "새 명언을 뽑았습니다.",
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
