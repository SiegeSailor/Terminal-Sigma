import process from "node:process";
import zod from "zod";

export type Quote = Readonly<{ quote: string; author: string }>;

export const bundledQuotes: readonly Quote[] = [
	{ quote: "A healthy mind in a healthy body.", author: "Juvenal" },
	{
		quote: "Do what you can, with what you have, where you are.",
		author: "Theodore Roosevelt",
	},
	{
		quote: "Energy and persistence conquer all things.",
		author: "Benjamin Franklin",
	},
	{ quote: "Fall seven times, stand up eight.", author: "Japanese Proverb" },
	{
		quote:
			"First say to yourself what you would be; and then do what you have to do.",
		author: "Epictetus",
	},
	{
		quote:
			"Habit is a cable; we weave a thread of it each day, and at last we cannot break it.",
		author: "Horace Mann",
	},
	{
		quote: "He who has a why to live can bear almost any how.",
		author: "Friedrich Nietzsche",
	},
	{
		quote: "It does not matter how slowly you go as long as you do not stop.",
		author: "Confucius",
	},
	{
		quote:
			"It is not that we have a short time to live, but that we waste a lot of it.",
		author: "Seneca",
	},
	{
		quote: "Knowing is not enough; we must apply.",
		author: "Johann Wolfgang von Goethe",
	},
	{ quote: "Lost time is never found again.", author: "Benjamin Franklin" },
	{
		quote: "No man is free who is not master of himself.",
		author: "Epictetus",
	},
	{
		quote: "Patience is bitter, but its fruit is sweet.",
		author: "Jean-Jacques Rousseau",
	},
	{
		quote: "The journey of a thousand miles begins with one step.",
		author: "Lao Tzu",
	},
	{
		quote:
			"Waste no more time arguing about what a good man should be. Be one.",
		author: "Marcus Aurelius",
	},
	{
		quote: "We suffer more often in imagination than in reality.",
		author: "Seneca",
	},
	{ quote: "Well begun is half done.", author: "Aristotle" },
	{ quote: "Well done is better than well said.", author: "Benjamin Franklin" },
];

export const quoteRefreshMinutes = 30;

export const randomBundledQuote = (): Quote =>
	bundledQuotes[Math.floor(Math.random() * bundledQuotes.length)] ?? {
		quote: "Well begun is half done.",
		author: "Aristotle",
	};

const apiResponse = zod
	.array(zod.object({ quote: zod.string().min(1), author: zod.string() }))
	.min(1);

// API Ninjas only when the user brings a key; any failure falls back to the bundled list.
export async function fetchQuote(apiKey = process.env.API_NINJAS_KEY) {
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
