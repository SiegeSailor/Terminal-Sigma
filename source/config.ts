import {
	chmodSync,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import process from "node:process";
import zod from "zod";
import { parseWholeNumber } from "./progress.js";

export const variableGroups = [
	"data",
	"timer",
	"display",
	"quotes",
	"ai",
	"tracing",
] as const;
export type VariableGroup = (typeof variableGroups)[number];

export const providers = [
	"openai",
	"anthropic",
	"google",
	"xai",
	"compatible",
] as const;
export type Provider = (typeof providers)[number];

// 1 API key for 1 provider, tried in the order the user set.
export const accountSchema = zod.object({
	id: zod.string().min(1),
	provider: zod.enum(providers),
	label: zod.string().min(1),
	apiKey: zod.string().min(1).optional(),
	model: zod.string().min(1),
	baseUrl: zod.url().optional(),
});
export type Account = zod.infer<typeof accountSchema>;

export type Variable = Readonly<{
	name: string;
	group: VariableGroup;
	isSecret: boolean;
	// Read once on start, so a change shows only after a restart.
	needsRestart: boolean;
	// The value to store, or undefined when the text is not allowed.
	parse: (text: string) => string | undefined;
}>;

export type Environment = Record<string, string | undefined>;

const textFrom = (text: string) => text.trim() || undefined;

const minutesFrom = (text: string) => {
	const value = parseWholeNumber(text, 1, 180);
	return value === undefined ? undefined : String(value);
};

const folderFrom = (text: string) => {
	const folder = text.trim().replace(/^~(?=$|\/|\\)/v, homedir());
	return folder && path.isAbsolute(folder) ? folder : undefined;
};

const urlFrom = (text: string) => {
	try {
		const url = new URL(text.trim());

		return url.protocol === "http:" || url.protocol === "https:"
			? url.toString().replace(/\/$/v, "")
			: undefined;
	} catch {
		return undefined;
	}
};

export const variables = [
	{
		name: "TERMINAL_SIGMA_HOME",
		group: "data",
		isSecret: false,
		needsRestart: true,
		parse: folderFrom,
	},
	{
		name: "TERMINAL_SIGMA_FOCUS",
		group: "timer",
		isSecret: false,
		needsRestart: true,
		parse: minutesFrom,
	},
	{
		name: "TERMINAL_SIGMA_BREAK",
		group: "timer",
		isSecret: false,
		needsRestart: true,
		parse: minutesFrom,
	},
	{
		name: "TERMINAL_SIGMA_MOTION",
		group: "display",
		isSecret: false,
		needsRestart: false,
		parse: (text: string) =>
			["full", "reduced"].find((value) => value === text.trim()),
	},
	{
		name: "API_NINJAS_KEY",
		group: "quotes",
		isSecret: true,
		needsRestart: false,
		parse: textFrom,
	},
	{
		name: "OPENAI_API_KEY",
		group: "ai",
		isSecret: true,
		needsRestart: false,
		parse: textFrom,
	},
	{
		name: "ANTHROPIC_API_KEY",
		group: "ai",
		isSecret: true,
		needsRestart: false,
		parse: textFrom,
	},
	{
		name: "GOOGLE_GENERATIVE_AI_API_KEY",
		group: "ai",
		isSecret: true,
		needsRestart: false,
		parse: textFrom,
	},
	{
		name: "XAI_API_KEY",
		group: "ai",
		isSecret: true,
		needsRestart: false,
		parse: textFrom,
	},
	{
		name: "LANGFUSE_PUBLIC_KEY",
		group: "tracing",
		isSecret: true,
		needsRestart: true,
		parse: textFrom,
	},
	{
		name: "LANGFUSE_SECRET_KEY",
		group: "tracing",
		isSecret: true,
		needsRestart: true,
		parse: textFrom,
	},
	{
		name: "LANGFUSE_BASE_URL",
		group: "tracing",
		isSecret: false,
		needsRestart: true,
		parse: urlFrom,
	},
] as const satisfies readonly Variable[];

export type VariableName = (typeof variables)[number]["name"];

export const variableOf = (name: string) =>
	variables.find((variable) => variable.name === name);

export const configSchema = zod.looseObject({
	env: zod.record(zod.string(), zod.string()).default({}),
	accounts: zod.array(accountSchema).default([]),
});

export type Config = zod.infer<typeof configSchema>;

// Fixed, whatever TERMINAL_SIGMA_HOME says, so keys stay out of any synced data folder.
export const configFile = () =>
	path.join(homedir(), ".terminal-sigma", "config.json");

export function loadConfig(file: string): Config {
	if (!existsSync(file)) {
		return configSchema.parse({});
	}

	try {
		return configSchema.parse(JSON.parse(readFileSync(file, "utf8")));
	} catch (error) {
		throw new Error(
			`${file} is unreadable, so Terminal-Sigma will not touch it. Fix or move it, then restart.\n${String(error)}`,
			{ cause: error },
		);
	}
}

export function saveConfig(file: string, config: Config) {
	mkdirSync(path.dirname(file), { recursive: true });
	const valid = configSchema.parse(config);
	const temporary = `${file}.tmp`;
	// Keys live here, so only the owner may read it.
	writeFileSync(temporary, `${JSON.stringify(valid, null, "\t")}\n`, {
		mode: 0o600,
	});
	chmodSync(temporary, 0o600);
	renameSync(temporary, file);
}

// A saved value fills in only what the shell left unset, so the shell wins.
export function applyConfig(config: Config, env: Environment = process.env) {
	for (const { name, parse } of variables) {
		const saved = config.env[name];
		const value = saved === undefined ? undefined : parse(saved);

		if (value !== undefined && !env[name]) {
			env[name] = value;
		}
	}
}

export type Source = "shell" | "saved" | "default";

export function sourceOf(
	name: VariableName,
	config: Config,
	env: Environment,
): Source {
	const value = env[name];

	if (!value) {
		return "default";
	}

	return value === config.env[name] ? "saved" : "shell";
}

export function withVariable(
	config: Config,
	name: VariableName,
	value: string | undefined,
): Config {
	const rest = Object.fromEntries(
		Object.entries(config.env).filter(([key]) => key !== name),
	);
	return {
		...config,
		env: value === undefined ? rest : { ...rest, [name]: value },
	};
}

// Sets or deletes 1 live variable. It lives outside every component, because
// xo's react-hooks/immutability rejects assigning to a prop inside one.
export function writeVariable(
	env: Environment,
	name: VariableName,
	value: string | undefined,
) {
	if (value === undefined) {
		Reflect.deleteProperty(env, name);
	} else {
		env[name] = value;
	}
}

export const maskSecret = (value: string) =>
	value.length >= 12 ? `••••${value.slice(-4)}` : "••••";

export const isReducedMotion = (env: Environment = process.env) =>
	env.TERMINAL_SIGMA_MOTION === "reduced";

// The timer's minutes from the environment; the CLI's flags override them.
export const timerOptionsOf = (env: Environment = process.env) => ({
	...(env.TERMINAL_SIGMA_FOCUS
		? { focus: Number(env.TERMINAL_SIGMA_FOCUS) }
		: {}),
	...(env.TERMINAL_SIGMA_BREAK
		? { break: Number(env.TERMINAL_SIGMA_BREAK) }
		: {}),
});
