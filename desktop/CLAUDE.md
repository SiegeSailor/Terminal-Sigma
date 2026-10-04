# Desktop

The desktop app is an Electron wrapper: its main process renders the same `App` from [`source/app.tsx`](../source/app.tsx) with Ink, into streams that a window running xterm.js displays. It is its own NPM package with its own lockfile, and its commits take the `desktop` scope.

| File                                     | Role                                                                       |
| ---------------------------------------- | -------------------------------------------------------------------------- |
| [`build.mjs`](./build.mjs)               | esbuild: the main process, the preload, the renderer, and the xterm.js CSS |
| [`devtools-stub.ts`](./devtools-stub.ts) | Stands in for `react-devtools-core`, which Ink imports but never needs     |
| [`index.html`](./index.html)             | The window: a full-size `#terminal` element                                |
| [`main.tsx`](./main.tsx)                 | The main process: the window, the IPC, and Ink's fake TTY streams          |
| [`preload.ts`](./preload.ts)             | The only bridge between the sandboxed window and the main process          |
| [`renderer.ts`](./renderer.ts)           | xterm.js: output in, keystrokes and size out                               |

## Constraints That Must Never Break

Each of these cost a broken build or a blank window once:

- **Keep `convertEol: true` in the Renderer**: No TTY sits between Ink and xterm.js to turn `\n` into `\r\n`, so every row would start where the last ended
- **Keep the CommonJS `require` Banner in `build.mjs`**: Bundled CommonJS dependencies such as `signal-exit` call `require` inside an ESM bundle
- **Keep `FORCE_COLOR` in the Banner**: Electron's main process has no TTY, so chalk would drop every color
- **Never Await at the Top Level of `main.tsx`**: Electron emits `ready` only after the ESM entry finishes evaluating, so `await app.whenReady()` there deadlocks with no error
- **Unset `ELECTRON_RUN_AS_NODE` to Launch from an Editor**: VS Code exports it to child processes, which makes `electron` a plain Node.js process that cannot import `BrowserWindow`

## Commands

Install the root first; the bundle compiles `source/` from the root's `node_modules`:

| Command                           | Does                                                            |
| --------------------------------- | --------------------------------------------------------------- |
| `npm ci --prefix desktop`         | Install the desktop tooling from its own lockfile               |
| `npm run bundle --prefix desktop` | Type-check with `tsc`, then bundle into `desktop/dist/`         |
| `npm run dist --prefix desktop`   | Bundle, then package for the current OS into `desktop/release/` |
| `npm start --prefix desktop`      | Bundle, download Electron once, and open the app                |
