#!/usr/bin/env node
import process from "node:process";
import React from "react";
import { render } from "ink";
import meow from "meow";
import zod from "zod";
import App, { optionsSchema } from "./app.js";
import { loadProgress, progressFile } from "./progress.js";

const cli = meow(
	`
	Usage
	  $ siegesailor-terminal-sigma [options]

	Options
	  --name   Your character's name (default: Rook Sigma)
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

render(
	<App file={file} initialProgress={initialProgress} options={options.data} />,
	{
		alternateScreen: true,
		incrementalRendering: true,
	},
);
