import type { Language } from "./i18n.js";
import type { Meal } from "./progress.js";

// Common foods for autocomplete: names in every language, then kcal and grams
// of protein for 1 typical serving. Approximate, like a nutrition label.
const commonFoods: ReadonlyArray<
	readonly [string, string, string, number, number]
> = [
	["Chicken breast", "雞胸肉", "닭가슴살", 248, 46],
	["Chicken thigh", "雞腿肉", "닭다리살", 315, 37],
	["Fried chicken", "炸雞", "프라이드치킨", 490, 34],
	["Grilled salmon", "烤鮭魚", "연어구이", 310, 34],
	["Canned tuna", "鮪魚罐頭", "참치캔", 130, 29],
	["Beef steak", "牛排", "소고기 스테이크", 500, 50],
	["Ground beef", "牛絞肉", "다진 소고기", 250, 26],
	["Pork chop", "豬排", "돼지 등심 구이", 330, 38],
	["Bacon", "培根", "베이컨", 130, 9],
	["Ham", "火腿", "햄", 90, 10],
	["Sausage", "香腸", "소시지", 300, 12],
	["Shrimp", "蝦仁", "새우", 150, 30],
	["Tofu", "豆腐", "두부", 120, 13],
	["Egg", "雞蛋", "계란", 72, 6],
	["Boiled eggs", "水煮蛋", "삶은 계란", 155, 13],
	["Scrambled eggs", "炒蛋", "스크램블드에그", 200, 14],
	["Omelette", "歐姆蛋", "오믈렛", 250, 17],
	["Greek yogurt", "希臘優格", "그릭요거트", 100, 17],
	["Protein shake", "高蛋白飲", "단백질 쉐이크", 160, 30],
	["Protein bar", "蛋白棒", "단백질 바", 210, 20],
	["Cottage cheese", "茅屋起司", "코티지 치즈", 220, 25],
	["Milk", "牛奶", "우유", 150, 8],
	["Soy milk", "豆漿", "두유", 110, 8],
	["Cheese slice", "起司片", "슬라이스 치즈", 70, 4],
	["Edamame", "毛豆", "에다마메", 190, 17],
	["White rice", "白飯", "흰쌀밥", 280, 5],
	["Brown rice", "糙米飯", "현미밥", 250, 5],
	["Fried rice", "炒飯", "볶음밥", 520, 14],
	["Oatmeal", "燕麥粥", "오트밀", 300, 10],
	["Whole wheat toast", "全麥吐司", "통밀 토스트", 160, 8],
	["White bread", "白吐司", "식빵", 150, 5],
	["Bagel", "貝果", "베이글", 280, 11],
	["Croissant", "可頌", "크루아상", 230, 5],
	["Tomato pasta", "番茄義大利麵", "토마토 파스타", 550, 18],
	["Spaghetti bolognese", "波隆那肉醬麵", "볼로네제 스파게티", 650, 30],
	["Ramen", "拉麵", "라멘", 500, 20],
	["Instant noodles", "泡麵", "라면", 500, 10],
	["Udon", "烏龍麵", "우동", 400, 12],
	["Beef noodle soup", "牛肉麵", "우육면", 600, 32],
	["Dumplings", "水餃", "물만두", 450, 18],
	["Pancakes", "鬆餅", "팬케이크", 350, 9],
	["Waffle", "格子鬆餅", "와플", 300, 7],
	["Granola", "燕麥脆片", "그래놀라", 500, 13],
	["Cereal with milk", "牛奶麥片", "우유 시리얼", 250, 9],
	["Baked potato", "烤馬鈴薯", "구운 감자", 160, 4],
	["Sweet potato", "地瓜", "고구마", 115, 2],
	["French fries", "薯條", "감자튀김", 365, 4],
	["Corn", "玉米", "옥수수", 90, 3],
	["Quinoa", "藜麥", "퀴노아", 220, 8],
	["Chicken wrap", "雞肉捲餅", "치킨 랩", 450, 25],
	["Cheeseburger", "起司漢堡", "치즈버거", 300, 15],
	["Double burger", "雙層漢堡", "더블 버거", 550, 30],
	["Pepperoni pizza", "臘腸披薩", "페퍼로니 피자", 600, 26],
	["Hot dog", "熱狗", "핫도그", 290, 10],
	["Chicken sandwich", "雞肉三明治", "치킨 샌드위치", 450, 28],
	["Tuna sandwich", "鮪魚三明治", "참치 샌드위치", 400, 22],
	["Burrito", "墨西哥捲", "부리토", 700, 30],
	["Tacos", "塔可", "타코", 350, 16],
	["Sushi roll", "壽司捲", "초밥 롤", 350, 12],
	["Salmon sashimi", "鮭魚生魚片", "연어회", 230, 25],
	["Bibimbap", "韓式拌飯", "비빔밥", 560, 20],
	["Kimchi fried rice", "泡菜炒飯", "김치볶음밥", 520, 12],
	["Bulgogi rice bowl", "韓式烤牛肉飯", "불고기 덮밥", 650, 32],
	["Kimbap", "韓式飯捲", "김밥", 480, 14],
	["Tteokbokki", "辣炒年糕", "떡볶이", 450, 8],
	["Samgyeopsal", "烤五花肉", "삼겹살", 750, 25],
	["Kimchi stew", "泡菜鍋", "김치찌개", 300, 18],
	["Soybean paste stew", "大醬湯", "된장찌개", 200, 14],
	["Braised pork rice", "滷肉飯", "루러우판", 550, 18],
	["Hainanese chicken rice", "海南雞飯", "하이난 치킨라이스", 600, 30],
	["Chicken leg bento", "雞腿便當", "닭다리 도시락", 800, 40],
	["Scallion pancake", "蔥油餅", "파전", 400, 7],
	["Xiaolongbao", "小籠包", "샤오룽바오", 400, 18],
	["Steamed pork buns", "肉包", "고기 찐빵", 500, 18],
	["Century egg congee", "皮蛋瘦肉粥", "피단 죽", 300, 15],
	["Oyster omelette", "蚵仔煎", "굴전", 500, 18],
	["Stinky tofu", "臭豆腐", "취두부", 400, 18],
	["Bubble tea", "珍珠奶茶", "버블티", 450, 4],
	["Chicken salad", "雞肉沙拉", "닭가슴살 샐러드", 350, 30],
	["Caesar salad", "凱薩沙拉", "시저 샐러드", 450, 10],
	["Garden salad", "田園沙拉", "그린 샐러드", 150, 4],
	["Poke bowl", "夏威夷生魚飯", "포케", 600, 30],
	["Curry rice", "咖哩飯", "카레라이스", 700, 20],
	["Chicken soup", "雞湯", "닭고기 수프", 250, 20],
	["Miso soup", "味噌湯", "미소 된장국", 40, 3],
	["Apple", "蘋果", "사과", 95, 0],
	["Banana", "香蕉", "바나나", 105, 1],
	["Orange", "柳橙", "오렌지", 62, 1],
	["Grapes", "葡萄", "포도", 105, 1],
	["Strawberries", "草莓", "딸기", 50, 1],
	["Blueberries", "藍莓", "블루베리", 85, 1],
	["Avocado", "酪梨", "아보카도", 160, 2],
	["Broccoli", "花椰菜", "브로콜리", 55, 4],
	["Mixed nuts", "綜合堅果", "견과류", 175, 5],
	["Almonds", "杏仁", "아몬드", 165, 6],
	["Peanut butter", "花生醬", "땅콩버터", 190, 7],
	["Hummus", "鷹嘴豆泥", "후무스", 100, 5],
	["Dark chocolate", "黑巧克力", "다크 초콜릿", 170, 2],
	["Potato chips", "洋芋片", "감자칩", 150, 2],
	["Ice cream", "冰淇淋", "아이스크림", 270, 5],
	["Cookie", "餅乾", "쿠키", 150, 2],
	["Donut", "甜甜圈", "도넛", 260, 3],
	["Cheesecake", "起司蛋糕", "치즈케이크", 400, 7],
	["Smoothie", "果昔", "스무디", 250, 5],
	["Orange juice", "柳橙汁", "오렌지 주스", 110, 2],
	["Latte", "拿鐵", "라테", 190, 12],
	["Black coffee", "黑咖啡", "블랙커피", 5, 0],
	["Green tea", "綠茶", "녹차", 0, 0],
	["Beer", "啤酒", "맥주", 150, 2],
	["Red wine", "紅酒", "레드 와인", 125, 0],
	["Soju", "燒酒", "소주", 400, 0],
	["Kimchi", "泡菜", "김치", 20, 1],
];

export const commonFoodCount = commonFoods.length;

const nameIndex: Record<Language, 0 | 1 | 2> = { en: 0, "zh-TW": 1, ko: 2 };

export type Suggestion = Readonly<{
	label: string;
	calories?: number;
	protein?: number;
	isYours: boolean;
}>;

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
			add({
				label: meal.food,
				calories: meal.calories,
				protein: meal.protein,
				isYours: true,
			});
		}
	}

	if (!query) {
		return results;
	}

	for (const [english, chinese, korean, calories, protein] of commonFoods) {
		const names = [english, chinese, korean] as const;

		if (matches(names)) {
			add({
				label: names[nameIndex[language]],
				calories,
				protein,
				isYours: false,
			});
		}
	}

	return results;
}
