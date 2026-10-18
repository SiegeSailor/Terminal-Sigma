# Terminal-Sigma

[![NPM version](https://img.shields.io/npm/v/%40siegesailor/terminal-sigma?logo=npm)](https://www.npmjs.com/package/@siegesailor/terminal-sigma)
[![Desktop app](https://img.shields.io/github/v/release/SiegeSailor/Terminal-Sigma?label=desktop&logo=electron)](https://github.com/SiegeSailor/Terminal-Sigma/releases/latest)
[![push: Verify](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/push-verify.yml/badge.svg)](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/push-verify.yml)
[![main: Release](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/main-release.yml/badge.svg)](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/main-release.yml)
[![release: Desktop](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/release-desktop.yml/badge.svg)](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/release-desktop.yml)

Terminal-Sigma is a game-style dashboard for your self-development, open in a terminal tab or its own desktop window. You log your day in 1 line, and a pixel-art you grows with it. It works offline, keeps your data on your computer, and speaks English, Traditional Chinese, and Korean.

![The dashboard: your character, today's targets, the menu, and your latest logs](./docs/images/dashboard.png)

## Features

Your character is always on screen, and the menu opens everything else with a number key.

### Character

A pixel-art you wanders its own little room. It takes your body, skin, and hair from your profile, wears the top, pants, shoes, and hat you choose, earns gear as it levels up, and shows your day on its face: tired eyes after a short night, a flush after a run, or a thought bubble when you need water.

![Body stages for each gender, from lean to heavy](./docs/images/bodies.png)

![How the day shows on the character: tired, sweaty, flushed, thirsty, hungry, full, happy, sad, and bed head](./docs/images/signals.png)

### Coach

An optional AI reviews your day or week, plans your next 7 days of workouts, and answers questions about training, food, and sleep. It runs on your own OpenAI, Claude, Gemini, Grok, or OpenAI-compatible account, such as [Ollama](https://ollama.com/), moves on to the next account when one fails, and stays off until you add one.

![The Coach reviewing the last 7 days](./docs/images/coach.png)

### History

History lists everything you logged to edit, delete, or repeat, and its Week tab shows your streak, your weight trend, your habits, and what goes with a better mood.

![The Week tab of History](./docs/images/week.png)

### Log

Log takes 1 line in any of the 3 languages and shows what it understood before you press Enter: `2 eggs, toast` for a meal, `m 4 #work` for your mood, `sl 23:30-7:10` for sleep, `w 500` for water, or `wo run 30m` for a workout.

![The Log line reading a meal before it is logged](./docs/images/log.png)

### And More

The menu also holds a Tomato Timer of 25-minute focus sessions against a daily goal, everyday quotes, 5 color themes, and **Environment** for every setting and API key.

## Installation

The CLI and the desktop app read and write the same data, so you can switch between them.

### CLI

The CLI needs [Node.js](https://nodejs.org/) `>= 22`. Install it, then leave it open in a terminal tab:

```shell
npm install --global @siegesailor/terminal-sigma
siegesailor-terminal-sigma --name "Ken"
```

### Desktop

Download the file for your system from the [latest release](https://github.com/SiegeSailor/Terminal-Sigma/releases/latest); it needs no Node.js and updates itself from **Software Update**:

| System                | File                                             |
| --------------------- | ------------------------------------------------ |
| Linux                 | `Terminal-Sigma-<version>-linux-x86_64.AppImage` |
| macOS (Apple Silicon) | `Terminal-Sigma-<version>-mac-arm64.dmg`         |
| macOS (Intel)         | `Terminal-Sigma-<version>-mac-x64.dmg`           |
| Windows               | `Terminal-Sigma-<version>-win-x64.exe`           |

> [!note]
> The apps are not signed yet. On Linux, run `chmod +x` on the AppImage; on Windows, choose **More info**, then **Run anyway**; on macOS, if the app "is damaged and can't be opened", clear the quarantine flag once:
>
> ```shell
> xattr -dr com.apple.quarantine "/Applications/Terminal Sigma.app"
> ```

## Your Data

Everything stays in `~/.terminal-sigma` on your computer: your profile and logs in `progress.json`, and your settings, keys, and Coach conversations in `config.json` and `coach.json`, readable only by you. Nothing leaves it unless you add a Coach account, an API key for quotes, or tracing with [Langfuse](https://langfuse.com/).

## Documentation

The [Guide](./docs/GUIDE.md) covers every key, option, environment variable, health target, and file format. [`CONTRIBUTING.md`](./.github/CONTRIBUTING.md) explains how to work on Terminal-Sigma, including how to tune the character, and [`SECURITY.md`](./.github/SECURITY.md) how to report a vulnerability.

## License

[MIT](./LICENSE.md). Bundled nutrition and exercise data keep their own licenses, listed in [`DATA-LICENSES.md`](./DATA-LICENSES.md).
