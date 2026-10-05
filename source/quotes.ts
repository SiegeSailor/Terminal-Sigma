import process from "node:process";
import zod from "zod";
import type { Language } from "./i18n.js";

// The categories API Ninjas accepts, which the bundled quotes use too.
export const quoteCategories = [
	"art",
	"courage",
	"death",
	"faith",
	"fear",
	"freedom",
	"happiness",
	"humor",
	"inspirational",
	"leadership",
	"life",
	"love",
	"nature",
	"philosophy",
	"relationships",
	"success",
	"time",
	"truth",
	"wisdom",
	"writing",
] as const;
export type QuoteCategory = (typeof quoteCategories)[number];

// Seconds between automatic refreshes.
export const quoteIntervals = [15, 60, 300, 900, 1500, 3600] as const;
export type QuoteInterval = (typeof quoteIntervals)[number];

export const quoteModes = ["random", "daily"] as const;
export type QuoteMode = (typeof quoteModes)[number];

export type QuoteSettings = Readonly<{
	autoRefresh: boolean;
	interval: QuoteInterval;
	mode: QuoteMode;
	categories: QuoteCategory[];
	excluded: QuoteCategory[];
	author: string;
	work: string;
}>;

export const defaultQuoteSettings: QuoteSettings = {
	autoRefresh: true,
	interval: 1500,
	mode: "random",
	categories: [],
	excluded: [],
	author: "",
	work: "",
};

type Text = Readonly<{ quote: string; author: string }>;

// API Ninjas only speaks English, so only the bundled quotes carry translations.
export type Quote = Text &
	Readonly<{
		work?: string;
		categories?: readonly QuoteCategory[];
		translations?: Partial<Record<Language, Text>>;
	}>;

type Bundled = readonly [
	english: Text,
	chinese: Text,
	korean: Text,
	categories: readonly QuoteCategory[],
	work?: string,
];

const bundled: readonly Bundled[] = [
	[
		{ quote: "A healthy mind in a healthy body.", author: "Juvenal" },
		{ quote: "健全的精神寓於健全的身體。", author: "尤維納利斯" },
		{ quote: "건강한 신체에 건강한 정신이 깃든다.", author: "유베날리스" },
		["life", "wisdom"],
		"Satires",
	],
	[
		{
			quote: "Do what you can, with what you have, where you are.",
			author: "Theodore Roosevelt",
		},
		{
			quote: "在你所在之處，用你所擁有的，做你能做的。",
			author: "西奧多·羅斯福",
		},
		{
			quote: "지금 있는 곳에서, 가진 것으로, 할 수 있는 일을 하라.",
			author: "시어도어 루스벨트",
		},
		["inspirational", "success"],
	],
	[
		{
			quote: "Energy and persistence conquer all things.",
			author: "Benjamin Franklin",
		},
		{ quote: "精力與毅力能征服一切。", author: "班傑明·富蘭克林" },
		{ quote: "열정과 끈기는 모든 것을 이긴다.", author: "벤저민 프랭클린" },
		["success", "inspirational"],
	],
	[
		{ quote: "Fall seven times, stand up eight.", author: "Japanese Proverb" },
		{ quote: "七轉八起。", author: "日本諺語" },
		{ quote: "일곱 번 넘어져도 여덟 번 일어난다.", author: "일본 속담" },
		["courage", "inspirational"],
	],
	[
		{
			quote:
				"First say to yourself what you would be; and then do what you have to do.",
			author: "Epictetus",
		},
		{
			quote: "先告訴自己你想成為什麼樣的人，然後去做你該做的事。",
			author: "愛比克泰德",
		},
		{
			quote:
				"먼저 어떤 사람이 될지 스스로에게 말하라. 그리고 해야 할 일을 하라.",
			author: "에픽테토스",
		},
		["philosophy", "wisdom"],
		"Discourses",
	],
	[
		{
			quote:
				"Habit is a cable; we weave a thread of it each day, and at last we cannot break it.",
			author: "Horace Mann",
		},
		{
			quote: "習慣如纜繩，我們每天編進一縷，最終再也無法扯斷。",
			author: "賀拉斯·曼",
		},
		{
			quote:
				"습관은 밧줄과 같다. 매일 한 가닥씩 엮다 보면 결국 끊을 수 없게 된다.",
			author: "호러스 만",
		},
		["life", "wisdom"],
	],
	[
		{
			quote: "He who has a why to live can bear almost any how.",
			author: "Friedrich Nietzsche",
		},
		{ quote: "知道為何而活的人，幾乎能忍受任何生活。", author: "尼采" },
		{
			quote: "살아야 할 이유를 아는 사람은 거의 어떤 상황도 견딜 수 있다.",
			author: "니체",
		},
		["philosophy", "life"],
		"Twilight of the Idols",
	],
	[
		{
			quote: "It does not matter how slowly you go as long as you do not stop.",
			author: "Confucius",
		},
		{ quote: "只要不停下腳步，走得多慢都無妨。", author: "孔子" },
		{
			quote: "멈추지만 않는다면 얼마나 천천히 가는지는 중요하지 않다.",
			author: "공자",
		},
		["wisdom", "inspirational"],
	],
	[
		{
			quote:
				"It is not that we have a short time to live, but that we waste a lot of it.",
			author: "Seneca",
		},
		{ quote: "不是我們的生命短暫，而是我們浪費了太多。", author: "塞內卡" },
		{
			quote: "인생이 짧은 것이 아니라, 우리가 많은 시간을 낭비하는 것이다.",
			author: "세네카",
		},
		["time", "philosophy"],
		"On the Shortness of Life",
	],
	[
		{
			quote: "Knowing is not enough; we must apply.",
			author: "Johann Wolfgang von Goethe",
		},
		{ quote: "知道是不夠的，我們必須應用。", author: "歌德" },
		{ quote: "아는 것만으로는 부족하다. 적용해야 한다.", author: "괴테" },
		["wisdom", "success"],
		"Wilhelm Meister's Journeyman Years",
	],
	[
		{ quote: "Lost time is never found again.", author: "Benjamin Franklin" },
		{ quote: "失去的時間永遠找不回來。", author: "班傑明·富蘭克林" },
		{ quote: "잃어버린 시간은 다시 찾을 수 없다.", author: "벤저민 프랭클린" },
		["time", "wisdom"],
		"Poor Richard's Almanack",
	],
	[
		{
			quote: "No man is free who is not master of himself.",
			author: "Epictetus",
		},
		{ quote: "不能主宰自己的人，就不是自由的人。", author: "愛比克泰德" },
		{
			quote: "자신을 다스리지 못하는 사람은 자유롭지 않다.",
			author: "에픽테토스",
		},
		["freedom", "philosophy"],
		"Discourses",
	],
	[
		{
			quote: "Patience is bitter, but its fruit is sweet.",
			author: "Jean-Jacques Rousseau",
		},
		{ quote: "忍耐是苦澀的，但它的果實是甜美的。", author: "盧梭" },
		{ quote: "인내는 쓰지만 그 열매는 달다.", author: "장 자크 루소" },
		["wisdom", "life"],
	],
	[
		{
			quote: "The journey of a thousand miles begins with one step.",
			author: "Lao Tzu",
		},
		{ quote: "千里之行，始於足下。", author: "老子" },
		{ quote: "천 리 길도 한 걸음부터.", author: "노자" },
		["inspirational", "wisdom"],
		"Tao Te Ching",
	],
	[
		{
			quote:
				"Waste no more time arguing about what a good man should be. Be one.",
			author: "Marcus Aurelius",
		},
		{
			quote: "別再浪費時間爭論好人該是什麼樣子，去成為一個好人。",
			author: "馬可·奧理略",
		},
		{
			quote:
				"좋은 사람이 무엇인지 논쟁하며 더는 시간을 낭비하지 말고, 좋은 사람이 되어라.",
			author: "마르쿠스 아우렐리우스",
		},
		["philosophy", "truth"],
		"Meditations",
	],
	[
		{
			quote: "We suffer more often in imagination than in reality.",
			author: "Seneca",
		},
		{ quote: "我們在想像中受的苦，往往多於現實。", author: "塞內卡" },
		{
			quote: "우리는 현실보다 상상 속에서 더 자주 고통받는다.",
			author: "세네카",
		},
		["fear", "philosophy"],
		"Letters to Lucilius",
	],
	[
		{ quote: "Well begun is half done.", author: "Aristotle" },
		{ quote: "好的開始是成功的一半。", author: "亞里斯多德" },
		{ quote: "시작이 반이다.", author: "아리스토텔레스" },
		["success", "wisdom"],
	],
	[
		{
			quote: "Well done is better than well said.",
			author: "Benjamin Franklin",
		},
		{ quote: "做得好勝過說得好。", author: "班傑明·富蘭克林" },
		{
			quote: "말을 잘하는 것보다 잘 해내는 것이 낫다.",
			author: "벤저민 프랭클린",
		},
		["truth", "success"],
		"Poor Richard's Almanack",
	],
	[
		{ quote: "Happiness depends upon ourselves.", author: "Aristotle" },
		{ quote: "幸福取決於我們自己。", author: "亞里斯多德" },
		{ quote: "행복은 우리 자신에게 달려 있다.", author: "아리스토텔레스" },
		["happiness", "philosophy"],
		"Nicomachean Ethics",
	],
	[
		{
			quote: "Love all, trust a few, do wrong to none.",
			author: "William Shakespeare",
		},
		{ quote: "愛所有人，信任少數人，不負任何人。", author: "莎士比亞" },
		{
			quote: "모두를 사랑하되, 소수만 믿고, 누구에게도 잘못하지 말라.",
			author: "윌리엄 셰익스피어",
		},
		["love", "relationships"],
		"All's Well That Ends Well",
	],
	[
		{
			quote: "In all things of nature there is something of the marvelous.",
			author: "Aristotle",
		},
		{ quote: "自然萬物之中，皆有令人驚奇之處。", author: "亞里斯多德" },
		{
			quote: "자연의 모든 것에는 경이로운 무언가가 있다.",
			author: "아리스토텔레스",
		},
		["nature", "wisdom"],
		"Parts of Animals",
	],
	[
		{
			quote: "A leader is best when people barely know he exists.",
			author: "Lao Tzu",
		},
		{ quote: "太上，下知有之。", author: "老子" },
		{
			quote: "가장 훌륭한 지도자는 백성이 그 존재만 겨우 아는 지도자이다.",
			author: "노자",
		},
		["leadership", "wisdom"],
		"Tao Te Ching",
	],
	[
		{ quote: "Art is long, life is short.", author: "Hippocrates" },
		{ quote: "藝術恆久，人生短暫。", author: "希波克拉底" },
		{ quote: "예술은 길고 인생은 짧다.", author: "히포크라테스" },
		["art", "time"],
		"Aphorisms",
	],
	[
		{
			quote:
				"Either write something worth reading or do something worth writing.",
			author: "Benjamin Franklin",
		},
		{
			quote: "要嘛寫出值得一讀的東西，要嘛做出值得一寫的事。",
			author: "班傑明·富蘭克林",
		},
		{
			quote: "읽을 가치가 있는 글을 쓰든가, 쓸 가치가 있는 일을 하라.",
			author: "벤저민 프랭클린",
		},
		["writing", "success"],
		"Poor Richard's Almanack",
	],
	[
		{ quote: "Fortune favors the bold.", author: "Virgil" },
		{ quote: "命運眷顧勇者。", author: "維吉爾" },
		{ quote: "행운은 용감한 자의 편이다.", author: "베르길리우스" },
		["courage", "success"],
		"Aeneid",
	],
	[
		{
			quote: "The fear of death follows from the fear of life.",
			author: "Mark Twain",
		},
		{ quote: "對死亡的恐懼，源自對生命的恐懼。", author: "馬克·吐溫" },
		{
			quote: "죽음에 대한 두려움은 삶에 대한 두려움에서 비롯된다.",
			author: "마크 트웨인",
		},
		["death", "fear"],
	],
	[
		{
			quote:
				"Faith is the bird that feels the light when the dawn is still dark.",
			author: "Rabindranath Tagore",
		},
		{ quote: "信念是一隻鳥，在黎明仍黑暗時便感受到光。", author: "泰戈爾" },
		{
			quote: "믿음은 새벽이 아직 어두울 때 빛을 느끼는 새이다.",
			author: "라빈드라나트 타고르",
		},
		["faith", "inspirational"],
		"Fireflies",
	],
	[
		{
			quote: "A day without laughter is a day wasted.",
			author: "Charlie Chaplin",
		},
		{ quote: "沒有笑聲的一天，就是虛度的一天。", author: "卓別林" },
		{ quote: "웃음 없는 하루는 낭비한 하루다.", author: "찰리 채플린" },
		["humor", "happiness"],
	],
];

export const bundledQuotes: readonly Quote[] = bundled.map(
	([english, chinese, korean, categories, work]) => ({
		...english,
		work,
		categories,
		translations: { "zh-TW": chinese, ko: korean },
	}),
);

export const hasQuoteApi = () => Boolean(process.env.API_NINJAS_KEY);

export const localizedQuote = (quote: Quote, language: Language): Text =>
	quote.translations?.[language] ?? quote;

const includes = (text: string | undefined, part: string) =>
	!part || (text ?? "").toLowerCase().includes(part.trim().toLowerCase());

// The bundled quotes that pass the filters, or all of them when none does.
export function bundledPool(settings: QuoteSettings): readonly Quote[] {
	const pool = bundledQuotes.filter(
		(quote) =>
			(settings.categories.length === 0 ||
				settings.categories.some((category) =>
					quote.categories?.includes(category),
				)) &&
			!settings.excluded.some((category) =>
				quote.categories?.includes(category),
			) &&
			[quote, ...Object.values(quote.translations ?? {})].some((text) =>
				includes(text.author, settings.author),
			) &&
			includes(quote.work, settings.work),
	);

	return pool.length > 0 ? pool : bundledQuotes;
}

const dayOf = (now: number) => Math.floor(now / 86_400_000);

export function pickBundled(
	settings: QuoteSettings,
	now: number,
	random = Math.random(),
): Quote {
	const pool = bundledPool(settings);
	const index =
		settings.mode === "daily"
			? dayOf(now) % pool.length
			: Math.floor(random * pool.length);

	return pool[index] ?? bundledQuotes[0] ?? { quote: "", author: "" };
}

const apiResponse = zod
	.array(
		zod.object({
			quote: zod.string().min(1),
			author: zod.string(),
			work: zod.string().optional(),
		}),
	)
	.min(1);

export function quoteRequestOf(settings: QuoteSettings) {
	if (settings.mode === "daily") {
		return "https://api.api-ninjas.com/v2/quoteoftheday";
	}

	const query = new URLSearchParams();
	const parameters = [
		["categories", settings.categories.join(",")],
		["exclude_categories", settings.excluded.join(",")],
		["author", settings.author.trim()],
		["work", settings.work.trim()],
	] as const;

	for (const [name, value] of parameters) {
		if (value) {
			query.set(name, value);
		}
	}

	const search = query.toString();
	return `https://api.api-ninjas.com/v2/randomquotes${search ? `?${search}` : ""}`;
}

// API Ninjas only when the user brings a key; any failure falls back to the
// bundled quotes, filtered the same way.
export async function fetchQuote(
	settings: QuoteSettings,
	apiKey = process.env.API_NINJAS_KEY,
): Promise<Quote> {
	if (!apiKey) {
		return pickBundled(settings, Date.now());
	}

	try {
		const response = await fetch(quoteRequestOf(settings), {
			headers: { "X-Api-Key": apiKey },
			signal: AbortSignal.timeout(5000),
		});
		const [first] = apiResponse.parse(await response.json());
		return first ?? pickBundled(settings, Date.now());
	} catch {
		return pickBundled(settings, Date.now());
	}
}
