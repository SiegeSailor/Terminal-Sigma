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
