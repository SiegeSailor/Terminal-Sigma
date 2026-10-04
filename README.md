# Terminal-Sigma

[![NPM version](https://img.shields.io/npm/v/%40siegesailor/terminal-sigma?logo=npm)](https://www.npmjs.com/package/@siegesailor/terminal-sigma)
[![Desktop app](https://img.shields.io/github/v/release/SiegeSailor/Terminal-Sigma?label=desktop&logo=electron)](https://github.com/SiegeSailor/Terminal-Sigma/releases/latest)
[![push: Verify](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/push-verify.yml/badge.svg)](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/push-verify.yml)
[![main: Release](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/main-release.yml/badge.svg)](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/main-release.yml)
[![release: Desktop](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/release-desktop.yml/badge.svg)](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/release-desktop.yml)

Terminal-Sigma is a terminal-based application that gives game-style feedback on your self-development journey. Though it is a CLI, it is meant to stay open: it fills the terminal, updates in real time, and is operated through menus rather than commands. It speaks English and Traditional Chinese, and it features 5 main components:

| Component             | What It Does                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| Character Progression | A pixel-art character that levels up with you, unlocks gear, and acts out what you are doing                  |
| Diet Tracker          | Logs each meal step by step, with its calories and protein, against a daily goal of 3 meals                   |
| Everyday Quotes       | An inspiring quote that refreshes every 30 minutes, on restart, or on demand                                  |
| Tomato Timer          | A Pomodoro timer: 25 minutes of focus, then a 5-minute break, against a daily goal of 4 focus sessions        |
| Workout Tracker       | Logs each workout step by step, with its activity, minutes, and intensity, against a daily goal of 30 minutes |

Underneath, your journey is written to the local file `~/.terminal-sigma/progress.json`. There is no plan to support logging at this point, and we chose JSON as a readable format, so that you can port it easily.

## Installation

Terminal-Sigma comes as a CLI on NPM and as a desktop app on every GitHub release. Both read and write the same `progress.json`, so you can switch between them.

### CLI

Install it globally to get the command:

```shell
npm install --global @siegesailor/terminal-sigma
```

The CLI requires [Node.js](https://nodejs.org/) `>= 22`.

### Desktop

Download the file for your system from the [latest release](https://github.com/SiegeSailor/Terminal-Sigma/releases/latest). The desktop app needs no Node.js:

| System                | File                                             | First Launch                                                        |
| --------------------- | ------------------------------------------------ | ------------------------------------------------------------------- |
| Linux                 | `Terminal-Sigma-<version>-linux-x86_64.AppImage` | Run `chmod +x` on the file, then open it                            |
| macOS (Apple Silicon) | `Terminal-Sigma-<version>-mac-arm64.dmg`         | Drag the app to Applications, then see the note below               |
| macOS (Intel)         | `Terminal-Sigma-<version>-mac-x64.dmg`           | Drag the app to Applications, then see the note below               |
| Windows               | `Terminal-Sigma-<version>-win-x64.exe`           | Choose **More info**, then **Run anyway** in the SmartScreen prompt |

> [!note]
> The apps are not signed by Apple or Microsoft yet. If macOS says the app "is damaged and can't be opened", it only means the download is quarantined; clear the flag once:
>
> ```shell
> xattr -dr com.apple.quarantine "/Applications/Terminal Sigma.app"
> ```

The desktop app opens the dashboard in its own window, sends a system notification when a focus or break ends, and uses the default options below.

## Usage

Start the dashboard and leave it open in a terminal tab:

```shell
siegesailor-terminal-sigma --name "Ken"
```

On the first run, it asks for your language and saves the answer in `progress.json`; change it at any time from **Language** in the menu. Every option has a default:

| Option          | Default      | Description                        |
| --------------- | ------------ | ---------------------------------- |
| `--break <min>` | `5`          | Minutes of each Tomato Timer break |
| `--focus <min>` | `25`         | Minutes of each Tomato Timer focus |
| `--name <name>` | `Rook Sigma` | The name of your character         |

### Menu

The menu at the bottom drives everything, and Enter opens an item:

| Item            | Enter Does                                                                 |
| --------------- | -------------------------------------------------------------------------- |
| Diet Tracker    | Asks for the food, its calories, and its protein, one at a time            |
| Everyday Quotes | Draws a new quote                                                          |
| Language        | Switches between English and Traditional Chinese                           |
| Logs            | Lists every focus, meal, and workout, newest first, with a filter per kind |
| Tomato Timer    | Starts a focus, or pauses, resumes, or stops the running one               |
| Workout Tracker | Asks for the activity, its minutes, and its intensity, one at a time       |

A stopped focus earns nothing. While you log a meal or a workout, the character eats, runs, lifts, or stretches to match, and it celebrates when you level up.

### Keys

Every view shows its keys at the bottom right:

| Key                       | Action                                                    |
| ------------------------- | --------------------------------------------------------- |
| `1` to `6`                | Jump to a menu item                                       |
| Arrows or `h` `j` `k` `l` | Move through the menu, a list, or the log filters         |
| Enter                     | Open the item, choose the option, or go to the next field |
| Esc                       | Go back to the menu without logging anything              |
| `q` or Ctrl+C             | Quit from the menu                                        |

When a focus or break ends, the terminal rings its bell.

### Environment Variables

Both are optional:

| Variable              | Effect                                                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `API_NINJAS_KEY`      | Fetch quotes from [API Ninjas](https://api-ninjas.com/api/quotes) instead of the bundled list, in English only, falling back on any error |
| `TERMINAL_SIGMA_HOME` | The folder that holds `progress.json`, instead of `~/.terminal-sigma`, e.g. a synced folder                                               |

## Progress File

`progress.json` holds your language and what you logged. Your experience, level, and daily progress are worked out from it every time, so editing the file by hand can never put them out of sync:

```json
{
	"language": "en",
	"focus": [{ "at": "2026-10-03T09:00:00.000Z", "minutes": 25 }],
	"meals": [
		{
			"at": "2026-10-03T08:00:00.000Z",
			"food": "Oatmeal",
			"calories": 350,
			"protein": 12
		}
	],
	"workouts": [
		{
			"at": "2026-10-03T07:00:00.000Z",
			"activity": "running",
			"minutes": 30,
			"intensity": "moderate"
		}
	]
}
```

`language` is `en` or `zh-TW`. A workout's `activity` is one of `cycling`, `other`, `running`, `strength`, `swimming`, `walking`, or `yoga`, and its `intensity` is `light`, `moderate`, or `vigorous`. Files written by version 1 still load as they are.

Every 100 XP is a level, and every level from level 2 to level 9 upgrades 1 piece of your character's gear. Experience is earned as follows:

| Entry          | Experience                                                            |
| -------------- | --------------------------------------------------------------------- |
| Finished focus | 1 XP per minute                                                       |
| Meal           | 5 XP                                                                  |
| Workout        | Per minute: 1 XP when light, 1.5 XP when moderate, 2 XP when vigorous |

> [!important]
> If `progress.json` is not valid, Terminal-Sigma refuses to start rather than overwrite it. Fix or move the file, then start again.

## Contributing

See [`CONTRIBUTING.md`](./.github/CONTRIBUTING.md) to work on Terminal-Sigma, and [`SECURITY.md`](./.github/SECURITY.md) to report a vulnerability.

## License

[MIT](./LICENSE.md)
