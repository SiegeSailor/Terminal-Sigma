/* eslint-disable @typescript-eslint/naming-convention -- third-party names */
import type { LanguageModel } from "ai";
import type zod from "zod";
import type { Account, Config, Environment, Provider } from "./config.js";
import { tracerOf } from "./tracing.js";

// A starting model for each provider, which the user can change per account.
// Checked against each provider's model list on 2026-10-07.
export const defaultModels: Record<Provider, string> = {
	openai: "gpt-5.5",
	anthropic: "claude-haiku-4-5",
	google: "gemini-3.5-flash",
	xai: "grok-4.5",
	compatible: "llama3.2",
};

// The shell variable each provider's package reads its key from.
const shellKeys = [
	["openai", "OPENAI_API_KEY"],
	["anthropic", "ANTHROPIC_API_KEY"],
	["google", "GOOGLE_GENERATIVE_AI_API_KEY"],
	["xai", "XAI_API_KEY"],
] as const;

// Saved accounts in the user's order, then 1 for each key the shell sets.
export function accountsOf(config: Config, env: Environment): Account[] {
	const fromShell = shellKeys.flatMap(([provider, name]) => {
		const apiKey = env[name];

		return apiKey
			? [
					{
						id: `env:${provider}`,
						provider,
						label: name,
						apiKey,
						model: defaultModels[provider],
					},
				]
			: [];
	});

	// A keyless saved account would send the shell's key to its own baseUrl.
	const saved = config.accounts.filter(
		(account) => Boolean(account.apiKey) || account.provider === "compatible",
	);

	return [...saved, ...fromShell];
}

export type FailureKind =
	| "rateLimited"
	| "quota"
	| "auth"
	| "unavailable"
	| "badRequest"
	| "network"
	| "aborted";

export type Failure = Readonly<{
	kind: FailureKind;
	message: string;
	retryAfter?: number;
}>;

type CallError = Readonly<{
	statusCode?: number;
	responseHeaders?: Record<string, string>;
	responseBody?: string;
}>;

// The AI SDK's errors, recognized by shape so this module never loads the SDK.
const isCallError = (error: unknown): error is Error & CallError =>
	error instanceof Error && "statusCode" in error;

const lastErrorOf = (error: unknown): unknown =>
	error instanceof Error && "lastError" in error ? error.lastError : error;

// Reads the provider's retry hint.
// ponytail: reads only `retry-after` in seconds; parse the providers' own reset
// headers if a 60-second guess proves too coarse.
const retryAfterOf = (
	headers: Record<string, string> | undefined,
	hint?: string,
) => {
	const seconds = Number(headers?.["retry-after"] ?? hint);
	return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : undefined;
};

export function failureOf(thrown: unknown): Failure {
	const error = lastErrorOf(thrown);
	const message = error instanceof Error ? error.message : String(error);

	if (error instanceof Error && error.name === "AbortError") {
		return { kind: "aborted", message };
	}

	if (!isCallError(error) || error.statusCode === undefined) {
		return { kind: "network", message };
	}

	const status = error.statusCode;
	const body = (error.responseBody ?? "").toLowerCase();

	// Google's per-minute 429 also says "quota", but it clears within a minute.
	const perMinute = body.includes("perminute");

	if (
		status === 402 ||
		(status === 400 && body.includes("credit balance")) ||
		(status === 429 && !perMinute && /quota|credit|billing/v.test(body))
	) {
		return { kind: "quota", message };
	}

	if (status === 429) {
		return {
			kind: "rateLimited",
			message,
			retryAfter: retryAfterOf(
				error.responseHeaders,
				/"retrydelay":\s*"(\d+(?:\.\d+)?)s"/v.exec(body)?.[1],
			),
		};
	}

	if (status === 401 || status === 403) {
		return { kind: "auth", message };
	}

	if (status === 408 || status === 409 || status >= 500) {
		return { kind: "unavailable", message };
	}

	return { kind: "badRequest", message };
}

const second = 1000;
const hour = 3_600_000;

export function cooldownOf(failure: Failure): number {
	switch (failure.kind) {
		case "rateLimited": {
			return failure.retryAfter ?? 60 * second;
		}

		case "quota":
		case "badRequest": {
			return hour;
		}

		case "auth": {
			return 24 * hour;
		}

		case "unavailable":
		case "network": {
			return 30 * second;
		}

		case "aborted": {
			return 0;
		}
	}
}

export type Attempt = Readonly<{ account: Account; failure?: Failure }>;

export type Fallback<Result> =
	| Readonly<{
			ok: true;
			result: Result;
			account: Account;
			attempts: readonly Attempt[];
	  }>
	| Readonly<{ ok: false; attempts: readonly Attempt[] }>;

// Cooldowns last for this run only; a restart tries every account again.
const runCooldowns = new Map<string, number>();

// Lets an edited account be tried again before its cooldown ends.
export const clearCooldown = (id: string): void => {
	runCooldowns.delete(id);
};

// Tries each account in order with the same call until 1 answers. Accounts
// cooling down wait their turn, unless every account is, and Esc stops it all.
export async function withFallback<Result>(
	accounts: readonly Account[],
	call: (account: Account) => Promise<Result>,
	{
		cooldowns = runCooldowns,
		now = Date.now,
		signal,
		onAttempt,
	}: Readonly<{
		cooldowns?: Map<string, number>;
		now?: () => number;
		signal?: AbortSignal;
		onAttempt?: (account: Account) => void;
	}> = {},
): Promise<Fallback<Result>> {
	const readyAt = (account: Account) => cooldowns.get(account.id) ?? 0;
	const ready = accounts.filter((account) => readyAt(account) <= now());
	const order =
		ready.length > 0
			? ready
			: accounts.toSorted((left, right) => readyAt(left) - readyAt(right));
	const attempts: Attempt[] = [];

	for (const account of order) {
		if (signal?.aborted) {
			break;
		}

		onAttempt?.(account);

		try {
			// eslint-disable-next-line no-await-in-loop -- 1 account at a time, in order.
			const result = await call(account);

			// No late answer may reach the screen after Esc.
			if (signal?.aborted) {
				attempts.push({
					account,
					failure: { kind: "aborted", message: "Aborted" },
				});
				break;
			}

			cooldowns.delete(account.id);
			return {
				ok: true,
				result,
				account,
				attempts: [...attempts, { account }],
			};
		} catch (error) {
			const thrown = failureOf(error);
			const aborted = (signal?.aborted ?? false) || thrown.kind === "aborted";
			const failure: Failure = aborted
				? { kind: "aborted", message: thrown.message }
				: thrown;
			attempts.push({ account, failure });

			if (aborted) {
				break;
			}

			cooldowns.set(account.id, now() + cooldownOf(failure));
		}
	}

	return { ok: false, attempts };
}

// Each provider's package loads only when an account of it is used. Every
// saved account's key is passed explicitly, never left to the SDK's env fallback.
export async function modelOf(account: Account): Promise<LanguageModel> {
	const { apiKey, baseUrl: baseURL, model } = account;

	switch (account.provider) {
		case "openai": {
			const { createOpenAI } = await import("@ai-sdk/openai");
			return createOpenAI({ apiKey, baseURL })(model);
		}

		case "anthropic": {
			const { createAnthropic } = await import("@ai-sdk/anthropic");
			return createAnthropic({ apiKey, baseURL })(model);
		}

		case "google": {
			const { createGoogleGenerativeAI } = await import("@ai-sdk/google");
			return createGoogleGenerativeAI({ apiKey, baseURL })(model);
		}

		case "xai": {
			const { createXai } = await import("@ai-sdk/xai");
			return createXai({ apiKey, baseURL })(model);
		}

		case "compatible": {
			// Ollama's OpenAI-compatible endpoint, unless the account names another,
			// such as LM Studio, OpenRouter, or an OmniRoute gateway.
			const { createOpenAICompatible } =
				await import("@ai-sdk/openai-compatible");
			return createOpenAICompatible({
				name: "compatible",
				baseURL: baseURL ?? "http://localhost:11434/v1",
				apiKey,
			})(model);
		}
	}
}

export type Turn = Readonly<{ role: "user" | "assistant"; content: string }>;

export type AskRequest = Readonly<{
	accounts: readonly Account[];
	kind: string;
	instructions: string;
	turns: readonly Turn[];
	sessionId: string;
	schema?: zod.ZodType;
	env: Environment;
	signal?: AbortSignal;
	onAttempt?: (account: Account) => void;
}>;

// The text, or the object the schema describes; `undefined` when the model
// answered but its JSON did not fit the schema.
export type AskReply = Fallback<unknown>;
export type Asker = (request: AskRequest) => Promise<AskReply>;

// 1 request, traced as 1 trace, tried on each account until 1 answers. Never
// rejects: a failure to load or trace is every account failing.
export const aiAsker: Asker = async (request) => {
	try {
		const [{ generateText, Output }, tracer] = await Promise.all([
			import("ai"),
			tracerOf(request.env),
		]);
		const functionId = `coach-${request.kind}`;

		return await tracer.trace(
			functionId,
			{ sessionId: request.sessionId, tags: [request.kind] },
			async () =>
				withFallback(
					request.accounts,
					async (account) => {
						const common = {
							model: await modelOf(account),
							instructions: request.instructions,
							messages: request.turns.map((turn) => ({ ...turn })),
							maxRetries: 0,
							timeout: 60_000,
							abortSignal: request.signal,
							telemetry: {
								functionId,
								isEnabled: tracer.isOn,
								recordInputs: true,
								recordOutputs: true,
							},
						};

						if (request.schema) {
							try {
								const { output } = await generateText({
									...common,
									output: Output.object({ schema: request.schema }),
								});
								return output;
							} catch (error) {
								// Answered, but not in the shape asked: no cooldown, no fallback.
								if (
									error instanceof Error &&
									error.name === "AI_NoObjectGeneratedError"
								) {
									return undefined;
								}

								throw error;
							}
						}

						const { text } = await generateText(common);
						return text;
					},
					{ signal: request.signal, onAttempt: request.onAttempt },
				),
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);

		return {
			ok: false,
			attempts: request.accounts.map((account) => ({
				account,
				failure: { kind: "network", message },
			})),
		};
	}
};
