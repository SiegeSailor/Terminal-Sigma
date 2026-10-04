import { FitAddon } from "@xterm/addon-fit";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { WebglAddon } from "@xterm/addon-webgl";
import { Terminal } from "@xterm/xterm";
import type { Bridge } from "./preload.js";

declare global {
	// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
	interface Window {
		terminal: Bridge;
	}
}

const element = document.querySelector<HTMLElement>("#terminal");

if (!element) {
	throw new Error("The page has no #terminal element.");
}

const terminal = new Terminal({
	allowProposedApi: true,
	// No TTY line discipline sits between Ink and xterm.js to turn "\n" into "\r\n".
	convertEol: true,
	cursorBlink: false,
	fontFamily: 'Menlo, Consolas, "DejaVu Sans Mono", monospace',
	fontSize: 14,
	theme: { background: "#1e1e1e" },
});
const fit = new FitAddon();
terminal.loadAddon(fit);
// Ink measures CJK as 2 cells wide; Unicode 11 widths make xterm.js agree.
terminal.loadAddon(new Unicode11Addon());
terminal.unicode.activeVersion = "11";
terminal.open(element);

// WebGL draws "▀" and "▄" as exact rectangles, so the pixel art has no seams.
try {
	const webgl = new WebglAddon();
	webgl.onContextLoss(() => {
		webgl.dispose();
	});
	terminal.loadAddon(webgl);
} catch {
	// The DOM renderer still works, just with faint seams.
}

fit.fit();

window.terminal.onOutput((data) => {
	terminal.write(data);
});
terminal.onData((data) => {
	window.terminal.input(data);
});
terminal.onResize(({ cols, rows }) => {
	window.terminal.resize({ columns: cols, rows });
});
terminal.onBell(() => {
	window.terminal.bell();
});
new ResizeObserver(() => {
	fit.fit();
}).observe(element);

window.terminal.ready({ columns: terminal.cols, rows: terminal.rows });
terminal.focus();
