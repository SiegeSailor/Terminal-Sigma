import test from "ava";
import { windowOf } from "../components/choice.js";
import {
	accountFieldsOf,
	accountOf,
	coachOptionsOf,
	describeEvent,
	layoutOf,
	movedAccounts,
} from "../content.js";
import { messagesOf } from "../i18n.js";

test("keeps the menu and adds panels as the terminal grows", (t) => {
	t.like(layoutOf(160, 22), {
		showCharacter: true,
		showToday: true,
		todayBeside: true,
		isMenuSplit: true,
		isTodayCompact: true,
	});
	t.like(layoutOf(160, 27), { isTodayCompact: true });
	t.like(layoutOf(160, 28), { isTodayCompact: false });
	t.like(layoutOf(160, 40), { isTodayCompact: false, showRecent: true });
	// The group headings give way to Recent on a short terminal.
	t.like(layoutOf(100, 28), { isMenuGrouped: true, showRecent: true });
	t.like(layoutOf(100, 27), { isMenuGrouped: false });
	t.like(layoutOf(100, 24), { isMenuGrouped: false, showRecent: true });
	t.like(layoutOf(120, 32), { todayBeside: true, isMenuSplit: false });
	t.like(layoutOf(138, 32), { todayBeside: true, isMenuSplit: true });
	t.like(layoutOf(100, 24), {
		showCharacter: true,
		showToday: false,
		isMenuSplit: true,
		panelWidth: 64,
	});
	t.like(layoutOf(100, 50), { showToday: true, todayBeside: false });
	t.like(layoutOf(100, 49), { showToday: false });
	t.like(layoutOf(84, 24), { isMenuSplit: false });
	t.like(layoutOf(56, 24), {
		showCharacter: false,
		stacked: true,
		isMenuSplit: false,
	});
	t.like(layoutOf(64, 73), {
		isMenuSplit: true,
		showCharacter: true,
		showToday: true,
	});
});

test("shows a window of a long list around the cursor", (t) => {
	t.deepEqual(windowOf(0, 20), { start: 0, end: 20 });
	t.deepEqual(windowOf(0, 20, 5), { start: 0, end: 5 });
	t.deepEqual(windowOf(10, 20, 5), { start: 8, end: 13 });
	t.deepEqual(windowOf(19, 20, 5), { start: 15, end: 20 });
	t.deepEqual(windowOf(2, 3, 5), { start: 0, end: 3 });
});

test("offers only what the Coach can do right now", (t) => {
	const english = messagesOf("en");
	const values = (state: Parameters<typeof coachOptionsOf>[1]) =>
		coachOptionsOf(english, state).map((option) => option.value);

	t.deepEqual(
		values({ isSetUp: false, hasPlan: false, hasTurns: false, accounts: 0 }),
		["accounts", "back"],
	);
	t.deepEqual(
		values({ isSetUp: true, hasPlan: true, hasTurns: true, accounts: 2 }),
		[
			"ask",
			"today",
			"week",
			"plan",
			"savePlan",
			"read",
			"fresh",
			"accounts",
			"back",
		],
	);
});

test("builds, validates, and reorders accounts", (t) => {
	const values = {
		provider: "compatible",
		label: "Ollama",
		model: "llama3.2",
		apiKey: "",
		baseUrl: "http://localhost:11434/v1",
	};

	t.like(accountOf(values, "a1"), {
		id: "a1",
		provider: "compatible",
		baseUrl: "http://localhost:11434/v1",
	});
	t.false(
		"apiKey" in (accountOf(values, "a1") ?? {}),
		"an empty key is no key",
	);
	t.is(
		accountOf({ ...values, provider: "openai" }, "a1"),
		undefined,
		"only a local server may go without a key",
	);
	t.is(accountOf({ ...values, baseUrl: "not a url" }, "a1"), undefined);
	t.is(accountOf({ ...values, provider: "skynet" }, "a1"), undefined);

	const accounts = ["a", "b", "c"].map((id) => ({
		...values,
		id,
		provider: "openai" as const,
		apiKey: undefined,
	}));
	t.deepEqual(
		movedAccounts(accounts, "c", -1).map((account) => account.id),
		["a", "c", "b"],
	);
	t.deepEqual(
		movedAccounts(accounts, "a", -1).map((account) => account.id),
		["a", "b", "c"],
	);
	t.is(
		accountFieldsOf(messagesOf("en"), "anthropic").find(
			(field) => field.key === "model",
		)?.defaultValue,
		"claude-haiku-4-5",
	);
});

test("names a provider and a request in the reader's language", (t) => {
	const at = new Date().toISOString();

	t.is(
		describeEvent(messagesOf("en"), {
			at,
			action: "accountAdded",
			detail: "openai",
		}),
		"Added an account · OpenAI",
	);
	t.is(
		describeEvent(messagesOf("zh-TW"), {
			at,
			action: "coachAsked",
			detail: "week",
		}),
		"向教練要求本週檢視",
	);
});
