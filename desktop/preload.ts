import { contextBridge, ipcRenderer } from "electron";

type Size = Readonly<{ columns: number; rows: number }>;

// The only bridge between the sandboxed window and the dashboard in the main process.
const bridge = {
	ready(size: Size) {
		ipcRenderer.send("ready", size);
	},
	input(data: string) {
		ipcRenderer.send("input", data);
	},
	resize(size: Size) {
		ipcRenderer.send("resize", size);
	},
	bell() {
		ipcRenderer.send("bell");
	},
	onOutput(listener: (data: string) => void) {
		ipcRenderer.on("output", (_event, data: string) => {
			listener(data);
		});
	},
};

export type Bridge = typeof bridge;

contextBridge.exposeInMainWorld("terminal", bridge);
