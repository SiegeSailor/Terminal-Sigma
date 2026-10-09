import type { Account, Config, Environment, Provider } from "./config.js";

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

	return [...config.accounts, ...fromShell];
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
const retryAfterOf = (headers: Record<string, string> | undefined) => {
	const seconds = Number(headers?.["retry-after"]);
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

	if (
		status === 402 ||
		(status === 429 && /quota|credit|billing/v.test(body))
	) {
		return { kind: "quota", message };
	}

	if (status === 429) {
		return {
			kind: "rateLimited",
			message,
			retryAfter: retryAfterOf(error.responseHeaders),
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
			cooldowns.delete(account.id);
			return {
				ok: true,
				result,
				account,
				attempts: [...attempts, { account }],
			};
		} catch (error) {
			const failure = failureOf(error);
			attempts.push({ account, failure });

			if (failure.kind === "aborted") {
				break;
			}

			cooldowns.set(account.id, now() + cooldownOf(failure));
		}
	}

	return { ok: false, attempts };
}
