import process from "node:process";
import zod from "zod";
import type { Language } from "./i18n.js";

type Text = Readonly<{ quote: string; author: string }>;

// API Ninjas only speaks English, so only the bundled quotes carry translations.
export type Quote = Text &
	Readonly<{ translations?: Partial<Record<Language, Text>> }>;

export const bundledQuotes: readonly Quote[] = [
	{
		quote: "A healthy mind in a healthy body.",
		author: "Juvenal",
		translations: {
			"zh-TW": { quote: "健全的精神寓於健全的身體。", author: "尤維納利斯" },
			ko: {
				quote: "건강한 신체에 건강한 정신이 깃든다.",
				author: "유베날리스",
			},
		},
	},
	{
		quote: "Do what you can, with what you have, where you are.",
		author: "Theodore Roosevelt",
		translations: {
			"zh-TW": {
				quote: "在你所在之處，用你所擁有的，做你能做的。",
				author: "西奧多·羅斯福",
			},
			ko: {
				quote: "지금 있는 곳에서, 가진 것으로, 할 수 있는 일을 하라.",
				author: "시어도어 루스벨트",
			},
		},
	},
	{
		quote: "Energy and persistence conquer all things.",
		author: "Benjamin Franklin",
		translations: {
			"zh-TW": { quote: "精力與毅力能征服一切。", author: "班傑明·富蘭克林" },
			ko: {
				quote: "열정과 끈기는 모든 것을 이긴다.",
				author: "벤저민 프랭클린",
			},
		},
	},
	{
		quote: "Fall seven times, stand up eight.",
		author: "Japanese Proverb",
		translations: {
			"zh-TW": { quote: "七轉八起。", author: "日本諺語" },
			ko: { quote: "일곱 번 넘어져도 여덟 번 일어난다.", author: "일본 속담" },
		},
	},
	{
		quote:
			"First say to yourself what you would be; and then do what you have to do.",
		author: "Epictetus",
		translations: {
			"zh-TW": {
				quote: "先告訴自己你想成為什麼樣的人，然後去做你該做的事。",
				author: "愛比克泰德",
			},
			ko: {
				quote:
					"먼저 어떤 사람이 될지 스스로에게 말하라. 그리고 해야 할 일을 하라.",
				author: "에픽테토스",
			},
		},
	},
	{
		quote:
			"Habit is a cable; we weave a thread of it each day, and at last we cannot break it.",
		author: "Horace Mann",
		translations: {
			"zh-TW": {
				quote: "習慣如纜繩，我們每天編進一縷，最終再也無法扯斷。",
				author: "賀拉斯·曼",
			},
			ko: {
				quote:
					"습관은 밧줄과 같다. 매일 한 가닥씩 엮다 보면 결국 끊을 수 없게 된다.",
				author: "호러스 만",
			},
		},
	},
	{
		quote: "He who has a why to live can bear almost any how.",
		author: "Friedrich Nietzsche",
		translations: {
			"zh-TW": {
				quote: "知道為何而活的人，幾乎能忍受任何生活。",
				author: "尼采",
			},
			ko: {
				quote: "살아야 할 이유를 아는 사람은 거의 어떤 상황도 견딜 수 있다.",
				author: "니체",
			},
		},
	},
	{
		quote: "It does not matter how slowly you go as long as you do not stop.",
		author: "Confucius",
		translations: {
			"zh-TW": { quote: "只要不停下腳步，走得多慢都無妨。", author: "孔子" },
			ko: {
				quote: "멈추지만 않는다면 얼마나 천천히 가는지는 중요하지 않다.",
				author: "공자",
			},
		},
	},
	{
		quote:
			"It is not that we have a short time to live, but that we waste a lot of it.",
		author: "Seneca",
		translations: {
			"zh-TW": {
				quote: "不是我們的生命短暫，而是我們浪費了太多。",
				author: "塞內卡",
			},
			ko: {
				quote: "인생이 짧은 것이 아니라, 우리가 많은 시간을 낭비하는 것이다.",
				author: "세네카",
			},
		},
	},
	{
		quote: "Knowing is not enough; we must apply.",
		author: "Johann Wolfgang von Goethe",
		translations: {
			"zh-TW": { quote: "知道是不夠的，我們必須應用。", author: "歌德" },
			ko: { quote: "아는 것만으로는 부족하다. 적용해야 한다.", author: "괴테" },
		},
	},
	{
		quote: "Lost time is never found again.",
		author: "Benjamin Franklin",
		translations: {
			"zh-TW": { quote: "失去的時間永遠找不回來。", author: "班傑明·富蘭克林" },
			ko: {
				quote: "잃어버린 시간은 다시 찾을 수 없다.",
				author: "벤저민 프랭클린",
			},
		},
	},
	{
		quote: "No man is free who is not master of himself.",
		author: "Epictetus",
		translations: {
			"zh-TW": {
				quote: "不能主宰自己的人，就不是自由的人。",
				author: "愛比克泰德",
			},
			ko: {
				quote: "자신을 다스리지 못하는 사람은 자유롭지 않다.",
				author: "에픽테토스",
			},
		},
	},
	{
		quote: "Patience is bitter, but its fruit is sweet.",
		author: "Jean-Jacques Rousseau",
		translations: {
			"zh-TW": { quote: "忍耐是苦澀的，但它的果實是甜美的。", author: "盧梭" },
			ko: { quote: "인내는 쓰지만 그 열매는 달다.", author: "장 자크 루소" },
		},
	},
	{
		quote: "The journey of a thousand miles begins with one step.",
		author: "Lao Tzu",
		translations: {
			"zh-TW": { quote: "千里之行，始於足下。", author: "老子" },
			ko: { quote: "천 리 길도 한 걸음부터.", author: "노자" },
		},
	},
	{
		quote:
			"Waste no more time arguing about what a good man should be. Be one.",
		author: "Marcus Aurelius",
		translations: {
			"zh-TW": {
				quote: "別再浪費時間爭論好人該是什麼樣子，去成為一個好人。",
				author: "馬可·奧理略",
			},
			ko: {
				quote:
					"좋은 사람이 무엇인지 논쟁하며 더는 시간을 낭비하지 말고, 좋은 사람이 되어라.",
				author: "마르쿠스 아우렐리우스",
			},
		},
	},
	{
		quote: "We suffer more often in imagination than in reality.",
		author: "Seneca",
		translations: {
			"zh-TW": {
				quote: "我們在想像中受的苦，往往多於現實。",
				author: "塞內卡",
			},
			ko: {
				quote: "우리는 현실보다 상상 속에서 더 자주 고통받는다.",
				author: "세네카",
			},
		},
	},
	{
		quote: "Well begun is half done.",
		author: "Aristotle",
		translations: {
			"zh-TW": { quote: "好的開始是成功的一半。", author: "亞里斯多德" },
			ko: { quote: "시작이 반이다.", author: "아리스토텔레스" },
		},
	},
	{
		quote: "Well done is better than well said.",
		author: "Benjamin Franklin",
		translations: {
			"zh-TW": { quote: "做得好勝過說得好。", author: "班傑明·富蘭克林" },
			ko: {
				quote: "말을 잘하는 것보다 잘 해내는 것이 낫다.",
				author: "벤저민 프랭클린",
			},
		},
	},
];

export const quoteRefreshMinutes = 30;

export const hasQuoteApi = () => Boolean(process.env.API_NINJAS_KEY);

export const randomBundledQuote = (): Quote =>
	bundledQuotes[Math.floor(Math.random() * bundledQuotes.length)] ?? {
		quote: "Well begun is half done.",
		author: "Aristotle",
	};

export const localizedQuote = (quote: Quote, language: Language): Text =>
	quote.translations?.[language] ?? quote;

const apiResponse = zod
	.array(zod.object({ quote: zod.string().min(1), author: zod.string() }))
	.min(1);

// API Ninjas only when the user brings a key; any failure falls back to the bundled list.
export async function fetchQuote(
	apiKey = process.env.API_NINJAS_KEY,
): Promise<Quote> {
	if (!apiKey) {
		return randomBundledQuote();
	}

	try {
		const response = await fetch("https://api.api-ninjas.com/v2/quotes", {
			headers: { "X-Api-Key": apiKey },
			signal: AbortSignal.timeout(5000),
		});
		const [first] = apiResponse.parse(await response.json());
		return first ?? randomBundledQuote();
	} catch {
		return randomBundledQuote();
	}
}
