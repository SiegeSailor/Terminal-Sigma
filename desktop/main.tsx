import path from "node:path";
import { PassThrough, Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, Notification } from "electron";
import { render } from "ink";
import React from "react";
import App, { optionsSchema } from "../source/app.js";
import {
	applyConfig,
	type Config,
	configFile,
	loadConfig,
	timerOptionsOf,
} from "../source/config.js";
import {
	loadProgress,
	type Progress,
	progressFile,
} from "../source/progress.js";
import { stopTracing } from "../source/tracing.js";
import { desktopUpdater } from "./update.js";

type Size = Readonly<{ columns: number; rows: number }>;

const directory = path.dirname(fileURLToPath(import.meta.url));

// Ink renders into these instead of a real TTY; the window's xterm.js is the screen.
function terminalStreams(send: (data: string) => void, size: Size) {
	const stdout = Object.assign(
		new Writable({
			write(chunk: Uint8Array | string, _encoding, callback) {
				send(String(chunk));
				callback();
			},
		}),
		{ isTTY: true, ...size },
	);
	const stdin = Object.assign(new PassThrough({ encoding: "utf8" }), {
		isTTY: true,
		setRawMode: () => stdin,
		ref: () => stdin,
		unref: () => stdin,
	});

	return { stdout, stdin };
}

// The window must not be awaited at the top level: Electron emits "ready" only
// after this ESM entry finishes evaluating, so a top-level await deadlocks.
async function start() {
	const settingsFile = configFile();
	let initialConfig: Config;
	let initialProgress: Progress;

	try {
		initialConfig = loadConfig(settingsFile);
		applyConfig(initialConfig);
		initialProgress = loadProgress(progressFile());
	} catch (error) {
		dialog.showErrorBox(
			"Terminal Sigma",
			error instanceof Error ? error.message : String(error),
		);
		app.exit(1);
		return;
	}

	const file = progressFile();
	const options =
		optionsSchema.safeParse(timerOptionsOf()).data ?? optionsSchema.parse({});

	const window = new BrowserWindow({
		width: 1280,
		height: 820,
		minWidth: 640,
		minHeight: 480,
		title: "Terminal Sigma",
		backgroundColor: "#1e1e1e",
		autoHideMenuBar: true,
		webPreferences: {
			preload: path.join(directory, "preload.cjs"),
			contextIsolation: true,
			sandbox: true,
		},
	});

	const send = (data: string) => {
		if (!window.isDestroyed()) {
			window.webContents.send("output", data);
		}
	};

	ipcMain.once("ready", (_event, size: Size) => {
		const { stdout, stdin } = terminalStreams(send, size);

		ipcMain.on("input", (_inputEvent, data: string) => {
			stdin.write(data);
		});
		ipcMain.on("resize", (_resizeEvent, next: Size) => {
			Object.assign(stdout, next);
			stdout.emit("resize");
		});

		const instance = render(
			<App
				configFile={settingsFile}
				file={file}
				initialConfig={initialConfig}
				initialProgress={initialProgress}
				options={options}
				updater={desktopUpdater()}
			/>,
			{
				stdout: stdout as unknown as NodeJS.WriteStream,
				stdin: stdin as unknown as NodeJS.ReadStream,
				alternateScreen: true,
				incrementalRendering: true,
				interactive: true,
				patchConsole: false,
			},
		);

		void instance
			.waitUntilExit()
			.then(async () => stopTracing())
			.finally(() => {
				app.quit();
			});
	});

	// The dashboard rings the bell when a focus or break ends.
	ipcMain.on("bell", () => {
		if (Notification.isSupported()) {
			new Notification({ title: "Terminal Sigma", body: "🍅" }).show();
		}
	});

	window.on("closed", () => {
		void stopTracing().finally(() => {
			app.quit();
		});
	});

	await window.loadFile(path.join(directory, "..", "index.html"));
}

void app.whenReady().then(start);
