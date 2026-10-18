#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import process from "node:process";
import React from "react";
import { render } from "ink";
import meow from "meow";
import zod from "zod";
import App, { optionsSchema } from "./app.js";
import {
	applyConfig,
	configFile,
	loadConfig,
	timerOptionsOf,
} from "./config.js";
import { loadProgress, progressFile } from "./progress.js";
import { stopTracing } from "./tracing.js";
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

// Load before entering the alternate screen, which would swallow the error.
// The config applies first: it may move the data folder and set the timer.
const settingsFile = configFile();
let initialConfig;
let initialProgress;

try {
	initialConfig = loadConfig(settingsFile);
	applyConfig(initialConfig);
	initialProgress = loadProgress(progressFile());
} catch (error) {
	console.error(error instanceof Error ? error.message : error);
	process.exit(1);
}

// Flags win over the environment, which wins over the defaults.
const flags = Object.fromEntries(
	Object.entries(cli.flags).filter(([, value]) => value !== undefined),
);
const options = optionsSchema.safeParse({ ...timerOptionsOf(), ...flags });

if (!options.success) {
	console.error(zod.prettifyError(options.error));
	process.exit(2);
}

const file = progressFile();

let isRestarting = false;
const updater = npmUpdater(() => {
	isRestarting = true;
});

const instance = render(
	<App
		configFile={settingsFile}
		file={file}
		initialConfig={initialConfig}
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
// Langfuse batches its traces; send the last ones before leaving.
const isTracingStuck = await stopTracing();

// After an update or a reload, the same command starts the dashboard again.
if (isRestarting) {
	const { status } = spawnSync(process.execPath, process.argv.slice(1), {
		stdio: "inherit",
	});
	process.exit(status ?? 0);
}

if (isTracingStuck) {
	// The exporter's pending request would keep the process alive.
	process.exit(process.exitCode ?? 0);
}
