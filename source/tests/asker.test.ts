import test from "ava";
import { APICallError, RetryError } from "ai";
import {
	accountsOf,
	cooldownOf,
	defaultModels,
	failureOf,
	withFallback,
} from "../asker.js";
import type { Account } from "../config.js";

const account = (
	id: string,
	provider: Account["provider"] = "openai",
): Account => ({
	id,
	provider,
	label: id,
	apiKey: `key-${id}`,
	model: defaultModels[provider],
});

const callError = (statusCode: number, body = "{}", headers = {}) =>
	new APICallError({
		message: `HTTP ${statusCode}`,
		url: "https://api.example.com",
		requestBodyValues: {},
		statusCode,
		responseHeaders: headers,
		responseBody: body,
	});

test("turns every failure into a kind and a cooldown", (t) => {
	t.like(failureOf(callError(429, "{}", { "retry-after": "12" })), {
		kind: "rateLimited",
		retryAfter: 12_000,
	});
	t.is(
		cooldownOf(failureOf(callError(429, "{}", { "retry-after": "12" }))),
		12_000,
	);
	t.is(cooldownOf(failureOf(callError(429))), 60_000);
	t.is(
		failureOf(callError(429, '{"error":{"code":"insufficient_quota"}}')).kind,
		"quota",
	);
	t.is(
		failureOf(callError(429, "RESOURCE_EXHAUSTED: quota exceeded")).kind,
		"quota",
	);
	t.is(failureOf(callError(402)).kind, "quota");
	t.is(failureOf(callError(401)).kind, "auth");
	t.is(cooldownOf(failureOf(callError(401))), 24 * 3_600_000);
	t.is(failureOf(callError(404)).kind, "badRequest");
	t.is(failureOf(callError(529)).kind, "unavailable");
	t.is(failureOf(callError(503)).kind, "unavailable");
	t.is(failureOf(new TypeError("fetch failed")).kind, "network");
	t.is(failureOf(new DOMException("aborted", "AbortError")).kind, "aborted");
	t.is(
		failureOf(
			new RetryError({
				message: "gave up",
				reason: "maxRetriesExceeded",
				errors: [callError(401)],
			}),
		).kind,
		"auth",
		"a retry error is judged by its last error",
	);
});

test("falls back to the next account with the same request", async (t) => {
	const seen: string[] = [];
	const cooldowns = new Map<string, number>();
	const result = await withFallback(
		[account("first"), account("second", "anthropic")],
		async (next) => {
			seen.push(next.id);

			if (next.id === "first") {
				throw callError(429, "{}", { "retry-after": "30" });
			}

			return "answer";
		},
		{ cooldowns, now: () => 1000 },
	);

	t.like(result, { ok: true, result: "answer", account: { id: "second" } });
	t.deepEqual(seen, ["first", "second"]);
	t.is(cooldowns.get("first"), 31_000);
	t.false(cooldowns.has("second"));
});

test("skips accounts that are cooling down, but tries them when all are", async (t) => {
	const seen: string[] = [];
	const call = async (next: Account) => {
		seen.push(next.id);
		return next.id;
	};

	const cooldowns = new Map([["first", 5000]]);
	t.like(
		await withFallback([account("first"), account("second")], call, {
			cooldowns,
			now: () => 1000,
		}),
		{
			account: { id: "second" },
		},
	);

	seen.length = 0;
	const all = new Map([
		["first", 9000],
		["second", 5000],
	]);
	await withFallback([account("first"), account("second")], call, {
		cooldowns: all,
		now: () => 1000,
	});
	t.deepEqual(seen, ["second"], "the soonest ready goes first");
});

test("reports every attempt when all fail, and stops on Esc", async (t) => {
	const failed = await withFallback(
		[account("first"), account("second")],
		async () => {
			throw callError(503);
		},
		{ cooldowns: new Map(), now: () => 0 },
	);

	t.false(failed.ok);
	t.deepEqual(
		failed.attempts.map((attempt) => [
			attempt.account.id,
			attempt.failure?.kind,
		]),
		[
			["first", "unavailable"],
			["second", "unavailable"],
		],
	);

	const controller = new AbortController();
	const seen: string[] = [];
	const stopped = await withFallback(
		[account("first"), account("second")],
		async (next) => {
			seen.push(next.id);
			controller.abort();
			throw new DOMException("aborted", "AbortError");
		},
		{ cooldowns: new Map(), now: () => 0, signal: controller.signal },
	);

	t.false(stopped.ok);
	t.deepEqual(seen, ["first"]);
});

test("adds the shell's keys after the saved accounts", (t) => {
	const saved = account("mine", "google");
	const accounts = accountsOf(
		{ env: {}, accounts: [saved] },
		{
			// eslint-disable-next-line @typescript-eslint/naming-convention
			ANTHROPIC_API_KEY: "sk-ant-1",
			// eslint-disable-next-line @typescript-eslint/naming-convention
			OPENAI_API_KEY: "sk-1",
		},
	);

	t.deepEqual(
		accounts.map((next) => [next.id, next.provider]),
		[
			["mine", "google"],
			["env:openai", "openai"],
			["env:anthropic", "anthropic"],
		],
	);
	t.is(accounts[2]?.apiKey, "sk-ant-1");
	t.is(accounts[2]?.model, defaultModels.anthropic);
});
