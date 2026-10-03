# Terminal-Sigma

[![NPM version](https://img.shields.io/npm/v/%40siegesailor/terminal-sigma?logo=npm)](https://www.npmjs.com/package/@siegesailor/terminal-sigma)
[![push: Verify](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/push-verify.yml/badge.svg)](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/push-verify.yml)
[![main: Release](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/main-release.yml/badge.svg)](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/main-release.yml)

Terminal-Sigma is a terminal-based application that gives game-style feedback on your self-development journey. Though it is a CLI, it is meant to stay open: it updates in real time and is operated through its terminal UI rather than through commands. It features 5 main components:

| Component             | What It Does                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| Character Progression | An animated character that levels up with your experience and unlocks new gear as it does              |
| Diet Tracker          | Logs meals with optional calories, e.g. `Oatmeal 350`, against a daily goal of 3 meals                 |
| Everyday Quotes       | An inspiring quote that refreshes every 30 minutes, on restart, or on demand                           |
| Tomato Timer          | A Pomodoro timer: 25 minutes of focus, then a 5-minute break, against a daily goal of 4 focus sessions |
| Workout Tracker       | Logs workouts in minutes, e.g. `Run 30`, against a daily goal of 30 minutes                            |

Underneath, your journey is written to the local file `~/.terminal-sigma/progress.json`. There is no plan to support logging at this point, and we chose JSON as a readable format, so that you can port it easily.

## Installation

The package is available on NPM. Install it globally to get the command:

```shell
npm install --global @siegesailor/terminal-sigma
```

### Prerequisites

Required software for this module:

- [Node.js](https://nodejs.org/): `>= 22`

## Usage

Start the dashboard and leave it open in a terminal tab:

```shell
siegesailor-terminal-sigma --name "Ken"
```

Every option has a default:

| Option          | Default      | Description                        |
| --------------- | ------------ | ---------------------------------- |
| `--break <min>` | `5`          | Minutes of each Tomato Timer break |
| `--focus <min>` | `25`         | Minutes of each Tomato Timer focus |
| `--name <name>` | `Rook Sigma` | The name of your character         |

### Keys

The navigation menu at the bottom drives everything:

| Key                       | Action                                                                    |
| ------------------------- | ------------------------------------------------------------------------- |
| `1` to `4`                | Select a menu item                                                        |
| Arrows or `h` `j` `k` `l` | Move through the menu                                                     |
| Enter                     | Start or pause the timer, open the meal or workout entry, or draw a quote |
| Esc                       | Cancel a meal or workout entry                                            |
| `q` or Ctrl+C             | Quit                                                                      |

A meal or workout entry is a name followed by a number: the calories of a meal, which are optional, or the minutes of a workout, which are required. When a focus or break ends, the terminal rings its bell.

### Environment Variables

Both are optional:

| Variable              | Effect                                                                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `API_NINJAS_KEY`      | Fetch quotes from [API Ninjas](https://api-ninjas.com/api/quotes) instead of the bundled list, falling back to it on any error |
| `TERMINAL_SIGMA_HOME` | The folder that holds `progress.json`, instead of `~/.terminal-sigma`, e.g. a synced folder                                    |

## Progress File

`progress.json` holds only what you logged. Your experience, level, and daily progress are worked out from it every time, so editing the file by hand can never put them out of sync:

```json
{
	"focus": [{ "at": "2026-10-03T09:00:00.000Z", "minutes": 25 }],
	"meals": [
		{ "at": "2026-10-03T08:00:00.000Z", "food": "Oatmeal", "calories": 350 }
	],
	"workouts": [
		{ "at": "2026-10-03T07:00:00.000Z", "activity": "Run", "minutes": 30 }
	]
}
```

Every 100 XP is a level, and every level from level 2 to level 9 upgrades 1 piece of your character's gear. Experience is earned as follows:

| Entry          | Experience      |
| -------------- | --------------- |
| Finished focus | 1 XP per minute |
| Meal           | 5 XP            |
| Workout        | 1 XP per minute |

> [!important]
> If `progress.json` is not valid, Terminal-Sigma refuses to start rather than overwrite it. Fix or move the file, then start again.

## Contributing

See [`CONTRIBUTING.md`](./.github/CONTRIBUTING.md) to work on Terminal-Sigma, and [`SECURITY.md`](./.github/SECURITY.md) to report a vulnerability.

## License

[MIT](./LICENSE.md)
