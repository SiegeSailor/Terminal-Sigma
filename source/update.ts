import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";
import zod from "zod";

export const packageName = "@siegesailor/terminal-sigma";

// What the Software Update view drives. The CLI updates itself through NPM,
// and the desktop app swaps itself for the newest release's build.
export type Updater = Readonly<{
	source: "npm" | "desktop";
	current: string;
	newest: () => Promise<string>;
	install: (version: string) => Promise<void>;
	// Prepares the relaunch; quitting the dashboard then starts the new one.
	restart: () => void;
}>;

// Compares major, minor, then patch: "1.10.0" is newer than "1.9.2".
export function isNewer(candidate: string, current: string): boolean {
	const partsOf = (version: string) =>
		version
			.split(/[.+\-]/v)
			.slice(0, 3)
			.map(Number);
	const [next, now] = [partsOf(candidate), partsOf(current)];

	for (let index = 0; index < 3; index++) {
		const difference = (next[index] ?? 0) - (now[index] ?? 0);

		if (difference !== 0) {
			return difference > 0;
		}
	}

	return false;
}

const latestSchema = zod.object({ version: zod.string() });

// Every release goes to NPM first, so its latest version is the newest.
export async function newestOnNpm(): Promise<string> {
	const response = await fetch(
		`https://registry.npmjs.org/${packageName}/latest`,
		{ signal: AbortSignal.timeout(10_000) },
	);

	if (!response.ok) {
		throw new Error(`NPM answered ${response.status}`);
	}

	return latestSchema.parse(await response.json()).version;
}

// The line of npm's error output that says what went wrong.
const reasonOf = (stderr: string) => {
	const lines = stderr
		.split("\n")
		.map((line) => line.replace(/^npm (?:error|ERR!)/v, "").trim())
		.filter(
			(line) =>
				line &&
				!line.startsWith("A complete log") &&
				!/^(?:code|errno|path|syscall)\b/v.test(line),
		);

	return lines.find((line) => line.includes("Error:")) ?? lines[0];
};

// `onRestart` runs before the dashboard quits; the bin then starts the new
// version in its place.
export function npmUpdater(onRestart: () => void): Updater {
	const { version } = latestSchema.parse(
		JSON.parse(
			readFileSync(new URL("../package.json", import.meta.url), "utf8"),
		),
	);

	return {
		source: "npm",
		current: version,
		newest: newestOnNpm,
		install: async (next) =>
			new Promise((resolve, reject) => {
				execFile(
					"npm",
					["install", "--global", `${packageName}@${next}`],
					{ shell: process.platform === "win32" },
					(error, _stdout, stderr) => {
						if (error) {
							reject(new Error(reasonOf(stderr) ?? error.message));
						} else {
							resolve();
						}
					},
				);
			}),
		restart: onRestart,
	};
}
