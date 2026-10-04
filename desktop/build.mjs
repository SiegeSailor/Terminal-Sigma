import { build } from "esbuild";

const common = { bundle: true, logLevel: "warning" };

await Promise.all([
	// The dashboard runs here, in Electron's main process.
	build({
		...common,
		entryPoints: ["main.tsx"],
		platform: "node",
		format: "esm",
		target: "node22",
		outfile: "dist/main.js",
		external: ["electron"],
		alias: { "react-devtools-core": "./devtools-stub.ts" },
		banner: {
			js: [
				// Bundled CommonJS dependencies still call require().
				'import { createRequire } from "node:module";',
				"const require = createRequire(import.meta.url);",
				// No TTY here, so chalk would otherwise drop every color.
				'process.env.FORCE_COLOR ??= "3";',
			].join("\n"),
		},
	}),
	build({
		...common,
		entryPoints: ["preload.ts"],
		platform: "node",
		format: "cjs",
		outfile: "dist/preload.cjs",
		external: ["electron"],
	}),
	build({
		...common,
		entryPoints: ["renderer.ts"],
		platform: "browser",
		format: "iife",
		outfile: "dist/renderer.js",
	}),
	build({
		...common,
		entryPoints: ["node_modules/@xterm/xterm/css/xterm.css"],
		outfile: "dist/renderer.css",
	}),
]);
