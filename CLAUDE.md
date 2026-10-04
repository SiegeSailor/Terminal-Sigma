# CLAUDE.md

Terminal-Sigma is a long-running terminal dashboard, published to NPM as `@siegesailor/terminal-sigma` and wrapped as a desktop app on every GitHub release. This file is the map; [`README.md`](./README.md) says what the project is and [`CONTRIBUTING.md`](./.github/CONTRIBUTING.md) how to work in it.

Path-scoped rules live in [`.claude/rules/`](./.claude/rules/); read the ones whose `paths:` match the files being edited.

## Repository Layout

TypeScript in `source/` compiles to `build/`, which the NPM package ships. The CLI entry renders [`App`](./source/app.tsx) with Ink into the terminal, and the desktop app renders the same `App` into a window:

| Path                                                                       | Contents                                                                                                |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [`desktop/`](./desktop/)                                                   | The Electron wrapper, its own NPM package; see [`desktop/CLAUDE.md`](./desktop/CLAUDE.md)               |
| [`source/app.tsx`](./source/app.tsx)                                       | The dashboard: views, state, the timer, and saving                                                      |
| [`source/command-line-interface.tsx`](./source/command-line-interface.tsx) | The `bin`: parses the flags, loads the progress, and renders in the alternate screen                    |
| [`source/components/`](./source/components/)                               | Presentational Ink components that take everything they show as props                                   |
| [`source/content.ts`](./source/content.ts)                                 | The layout rules, the menu, the Today sections, and the forms                                           |
| [`source/health.ts`](./source/health.ts)                                   | Daily targets and advice from the profile: calories, protein, and exercise                              |
| [`source/i18n.ts`](./source/i18n.ts)                                       | Every user-facing string, in English, Traditional Chinese, and Korean                                   |
| [`source/pixel-art.ts`](./source/pixel-art.ts)                             | The character rig: its body from the profile, its equipment from the level, and every scene it acts out |
| [`source/progress.ts`](./source/progress.ts)                               | The `progress.json` schema with its settings and profile, loading, saving, experience, and logs         |
| [`source/quotes.ts`](./source/quotes.ts)                                   | The bundled quotes in all 3 languages, and the optional API Ninjas fetch                                |
| [`source/tests/`](./source/tests/)                                         | AVA tests, compiled and run from `build/tests/`                                                         |
| [`source/theme.ts`](./source/theme.ts)                                     | The 5 tonal themes, the palette context, and Claude Code's spinner                                      |
| [`source/timer.ts`](./source/timer.ts)                                     | The Tomato Timer as pure functions of a timestamp                                                       |

Logic that branches lives in the plain `.ts` modules as pure functions, so a test can call it without rendering. Components stay presentational.

## Scopes

Each scope lends its **Commit Scope** to the `<scope>` of a commit message. A change that spans scopes, or that sits at the root, takes none:

| Scope                    | Commit Scope | Contents                                                  |
| ------------------------ | ------------ | --------------------------------------------------------- |
| [`/`](./)                | -            | The CLI, its tests, the rules, and the workflows          |
| [`desktop/`](./desktop/) | `desktop`    | The Electron wrapper, its build, and its packaging config |

## Commands

Every command runs from the repository root:

| Command         | Does                                                                          |
| --------------- | ----------------------------------------------------------------------------- |
| `npm ci`        | Install from the lockfile, and the Husky hooks through `prepare`              |
| `npm run build` | Clean `build/`, compile with `tsc`, and rewrite path aliases with `tsc-alias` |
| `npm start`     | Build, then run the dashboard from `build/`                                   |
| `npm test`      | Prettier check, xo, then AVA, the same gate CI runs                           |

## Universal Rules

These hold everywhere, and none may be broken on the way to finishing something else:

- **Isolate Tests from the Real Data Folder**: Pass `App` a temporary `file`; set `TERMINAL_SIGMA_HOME` when a test needs `progressFile()`. AVA runs in worker threads, where `os.homedir()` ignores an overridden `HOME`
- **Keep Old Progress Files Loading**: A field added to the schema is optional, and a test loads a file the previous version wrote
- **Never Bump a Version by Hand**: Semantic Release owns `version` in `package.json` and `package-lock.json`
- **Never Commit `build/`, `desktop/dist/`, or `desktop/release/`**: They are generated, and only CI publishes them
- **Never Hard-Code a Color in a Component**: Read it from `usePalette()`, so every theme recolors the whole dashboard
- **Never Hard-Code User-Facing Text**: Add it to all 3 languages in [`i18n.ts`](./source/i18n.ts); the `Messages` type rejects a language that misses a key
- **Never Overwrite an Unreadable `progress.json`**: `loadProgress` refuses one and `saveProgress` validates before writing. The file holds the user's whole journey
- **Pick Commit Types Deliberately**: Every `feat` or `fix` that reaches `main` publishes a new version to NPM and a new desktop release

Commit messages follow the `conventional-commit` skill from [`SiegeSailor/Claude-Plugins`](https://github.com/SiegeSailor/Claude-Plugins), enabled for this repository in [`.claude/settings.json`](./.claude/settings.json).

The options, keys, environment variables, and the format of `progress.json` are user-facing and live in [`README.md`](./README.md#usage); update it in the same commit as a change to any of them.
