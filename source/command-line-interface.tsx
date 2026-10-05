#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import process from "node:process";
import React from "react";
import { render } from "ink";
import meow from "meow";
import zod from "zod";
import App, { optionsSchema } from "./app.js";
import { loadProgress, progressFile } from "./progress.js";
import { npmUpdater } from "./update.js";

const cli = meow(
	`
	Usage
	  $ siegesailor-terminal-sigma [options]

	Options
	  --name   Your character's name (default: your profile's name)
	  --focus  Minutes of each Tomato Timer focus (default: 25)
	  --break  Minutes of each Tomato Timer break (default: 5)
`,
	{
		importMeta: import.meta,
		allowUnknownFlags: false,
		flags: {
			name: { type: "string" },
			focus: { type: "number" },
			break: { type: "number" },
		},
	},
);

const options = optionsSchema.safeParse(cli.flags);

if (!options.success) {
	console.error(zod.prettifyError(options.error));
	process.exit(2);
}

// Load before entering the alternate screen, which would swallow the error.
const file = progressFile();
let initialProgress;

try {
	initialProgress = loadProgress(file);
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}

let isRestarting = false;
const updater = npmUpdater(() => {
	isRestarting = true;
});

const instance = render(
	<App
		file={file}
		initialProgress={initialProgress}
		options={options.data}
		updater={updater}
	/>,
	{
		alternateScreen: true,
		incrementalRendering: true,
	},
);

await instance.waitUntilExit();

// After an update, the same command starts the version just installed.
if (isRestarting) {
	const { status } = spawnSync(process.execPath, process.argv.slice(1), {
		stdio: "inherit",
	});
	process.exit(status ?? 0);
}
