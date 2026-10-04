import process from "node:process";
import zod from "zod";
import type { Language } from "./i18n.js";

type Text = Readonly<{ quote: string; author: string }>;

// API Ninjas only speaks English, so only the bundled quotes carry `zh`.
export type Quote = Text & Readonly<{ zh?: Text }>;

export const bundledQuotes: readonly Quote[] = [
	{
		quote: "A healthy mind in a healthy body.",
		author: "Juvenal",
		zh: { quote: "健全的精神寓於健全的身體。", author: "尤維納利斯" },
	},
	{
		quote: "Do what you can, with what you have, where you are.",
		author: "Theodore Roosevelt",
		zh: {
			quote: "在你所在之處，用你所擁有的，做你能做的。",
			author: "西奧多·羅斯福",
		},
	},
	{
		quote: "Energy and persistence conquer all things.",
		author: "Benjamin Franklin",
		zh: { quote: "精力與毅力能征服一切。", author: "班傑明·富蘭克林" },
	},
	{
		quote: "Fall seven times, stand up eight.",
		author: "Japanese Proverb",
		zh: { quote: "七轉八起。", author: "日本諺語" },
	},
	{
		quote:
			"First say to yourself what you would be; and then do what you have to do.",
		author: "Epictetus",
		zh: {
			quote: "先告訴自己你想成為什麼樣的人，然後去做你該做的事。",
			author: "愛比克泰德",
		},
	},
	{
		quote:
			"Habit is a cable; we weave a thread of it each day, and at last we cannot break it.",
		author: "Horace Mann",
		zh: {
			quote: "習慣如纜繩，我們每天編進一縷，最終再也無法扯斷。",
			author: "賀拉斯·曼",
		},
	},
	{
		quote: "He who has a why to live can bear almost any how.",
		author: "Friedrich Nietzsche",
		zh: { quote: "知道為何而活的人，幾乎能忍受任何生活。", author: "尼采" },
	},
	{
		quote: "It does not matter how slowly you go as long as you do not stop.",
		author: "Confucius",
		zh: { quote: "只要不停下腳步，走得多慢都無妨。", author: "孔子" },
	},
	{
		quote:
			"It is not that we have a short time to live, but that we waste a lot of it.",
		author: "Seneca",
		zh: { quote: "不是我們的生命短暫，而是我們浪費了太多。", author: "塞內卡" },
	},
	{
		quote: "Knowing is not enough; we must apply.",
		author: "Johann Wolfgang von Goethe",
		zh: { quote: "知道是不夠的，我們必須應用。", author: "歌德" },
	},
	{
		quote: "Lost time is never found again.",
		author: "Benjamin Franklin",
		zh: { quote: "失去的時間永遠找不回來。", author: "班傑明·富蘭克林" },
	},
	{
		quote: "No man is free who is not master of himself.",
		author: "Epictetus",
		zh: { quote: "不能主宰自己的人，就不是自由的人。", author: "愛比克泰德" },
	},
	{
		quote: "Patience is bitter, but its fruit is sweet.",
		author: "Jean-Jacques Rousseau",
		zh: { quote: "忍耐是苦澀的，但它的果實是甜美的。", author: "盧梭" },
	},
	{
		quote: "The journey of a thousand miles begins with one step.",
		author: "Lao Tzu",
		zh: { quote: "千里之行，始於足下。", author: "老子" },
	},
	{
		quote:
			"Waste no more time arguing about what a good man should be. Be one.",
		author: "Marcus Aurelius",
		zh: {
			quote: "別再浪費時間爭論好人該是什麼樣子，去成為一個好人。",
			author: "馬可·奧理略",
		},
	},
	{
		quote: "We suffer more often in imagination than in reality.",
		author: "Seneca",
		zh: { quote: "我們在想像中受的苦，往往多於現實。", author: "塞內卡" },
	},
	{
		quote: "Well begun is half done.",
		author: "Aristotle",
		zh: { quote: "好的開始是成功的一半。", author: "亞里斯多德" },
	},
	{
		quote: "Well done is better than well said.",
		author: "Benjamin Franklin",
		zh: { quote: "做得好勝過說得好。", author: "班傑明·富蘭克林" },
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
	language === "zh-TW" && quote.zh ? quote.zh : quote;

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
