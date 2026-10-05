import { execFile, spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { chmod, mkdtemp, rename } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import { app } from "electron";
import { newestOnNpm, type Updater } from "../source/update.js";

const run = promisify(execFile);
const releases = "https://github.com/SiegeSailor/Terminal-Sigma/releases";

// The name each platform's build is attached to a release under.
function assetOf(version: string) {
	if (process.platform === "darwin") {
		return `Terminal-Sigma-${version}-mac-${process.arch}.dmg`;
	}

	if (process.platform === "win32") {
		return `Terminal-Sigma-${version}-win-x64.exe`;
	}

	return `Terminal-Sigma-${version}-linux-x86_64.AppImage`;
}

const urlOf = (version: string) =>
	`${releases}/download/v${version}/${assetOf(version)}`;

async function download(version: string, file: string) {
	const response = await fetch(urlOf(version));

	if (!response.ok || !response.body) {
		throw new Error(
			`GitHub answered ${response.status} for ${assetOf(version)}`,
		);
	}

	await pipeline(
		Readable.fromWeb(response.body as import("node:stream/web").ReadableStream),
		createWriteStream(file),
	);
}

// The .app bundle around the running executable.
const bundle = () => path.resolve(app.getPath("exe"), "..", "..", "..");

// The release reaches NPM minutes before CI attaches the desktop builds, so
// a version counts only once this platform's build is there to download.
async function newest(current: string) {
	const version = await newestOnNpm();
	const response = await fetch(urlOf(version), {
		method: "HEAD",
		signal: AbortSignal.timeout(10_000),
	});

	return response.ok ? version : current;
}

export function desktopUpdater(): Updater {
	const current = app.getVersion();
	let installer: string | undefined;

	return {
		source: "desktop",
		current,
		newest: async () => newest(current),
		async install(version) {
			if (!app.isPackaged) {
				throw new Error(`Only an installed build can update; see ${releases}`);
			}

			const folder = await mkdtemp(path.join(os.tmpdir(), "terminal-sigma-"));
			const file = path.join(folder, assetOf(version));
			await download(version, file);

			if (process.platform === "darwin") {
				// Copy the new app next to this one; the swap waits for the quit.
				const mount = path.join(folder, "volume");
				await run("hdiutil", [
					"attach",
					"-nobrowse",
					"-readonly",
					"-mountpoint",
					mount,
					file,
				]);

				try {
					// Node's rm trips over a bundle's symlinks with ENOTEMPTY.
					await run("rm", ["-rf", `${bundle()}.update`]);
					await run("ditto", [
						path.join(mount, "Terminal Sigma.app"),
						`${bundle()}.update`,
					]);
				} finally {
					await run("hdiutil", ["detach", "-quiet", mount]);
				}
			} else if (process.platform === "win32") {
				installer = file;
			} else {
				// An AppImage can be replaced while it runs.
				const target = process.env.APPIMAGE;

				if (!target) {
					throw new Error(`Only the AppImage can update; see ${releases}`);
				}

				await chmod(file, 0o755);
				await rename(file, target);
			}
		},
		restart() {
			if (process.platform === "darwin") {
				const script = [
					`while kill -0 ${process.pid} 2>/dev/null; do sleep 0.2; done`,
					'rm -rf "$1" && mv "$1.update" "$1"',
					'open "$1"',
				].join("; ");
				spawn("/bin/sh", ["-c", script, "sh", bundle()], {
					detached: true,
					stdio: "ignore",
				}).unref();
			} else if (process.platform === "win32" && installer) {
				// The NSIS installer runs silently, then starts the new version.
				spawn(installer, ["/S", "--force-run"], {
					detached: true,
					stdio: "ignore",
				}).unref();
			} else {
				app.relaunch({ execPath: process.env.APPIMAGE });
			}
		},
	};
}
