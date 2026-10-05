# Terminal-Sigma

[![NPM version](https://img.shields.io/npm/v/%40siegesailor/terminal-sigma?logo=npm)](https://www.npmjs.com/package/@siegesailor/terminal-sigma)
[![Desktop app](https://img.shields.io/github/v/release/SiegeSailor/Terminal-Sigma?label=desktop&logo=electron)](https://github.com/SiegeSailor/Terminal-Sigma/releases/latest)
[![push: Verify](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/push-verify.yml/badge.svg)](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/push-verify.yml)
[![main: Release](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/main-release.yml/badge.svg)](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/main-release.yml)
[![release: Desktop](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/release-desktop.yml/badge.svg)](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/release-desktop.yml)

Terminal-Sigma is a terminal-based application that gives game-style feedback on your self-development journey. Though it is a CLI, it is meant to stay open: it fills the terminal, updates in real time, and is operated through menus rather than commands. It speaks English, Traditional Chinese, and Korean, and it features 5 main components:

| Component             | What It Does                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| Character Progression | A pixel-art pet, shaped by your profile, dressed by your level, and woken up by what you log today            |
| Everyday Quotes       | An inspiring quote that refreshes on your schedule, filtered by category, author, or work                     |
| Health                | Your meals and workouts against daily targets worked out from your profile, with advice for the rest of today |
| Logs                  | Every focus, meal, workout, and action you took, with the latest 4 in a Recent block under the menu           |
| Tomato Timer          | A Pomodoro timer: 25 minutes of focus, then a 5-minute break, against a daily goal of 4 focus sessions        |

Underneath, your journey and your settings are written to the local file `~/.terminal-sigma/progress.json`. There is no plan to support logging at this point, and we chose JSON as a readable format, so that you can port it easily.

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

The desktop app opens the dashboard in its own window, sends a system notification when a focus or break ends, and uses your profile's name and the default timer options below.

## Usage

Start the dashboard and leave it open in a terminal tab:

```shell
siegesailor-terminal-sigma --name "Ken"
```

On the first run, it asks for your language and saves the answer in `progress.json`; change it at any time from **Language** in the menu. Every option has a default:

| Option          | Default                              | Description                        |
| --------------- | ------------------------------------ | ---------------------------------- |
| `--break <min>` | `5`                                  | Minutes of each Tomato Timer break |
| `--focus <min>` | `25`                                 | Minutes of each Tomato Timer focus |
| `--name <name>` | Your profile's name, or `Rook Sigma` | The name of your character         |

### Menu

The menu drives everything. It sits in 2 boxes: the items on the left, and on the right what the focused item does, which turns into its options once you press Enter:

| Key | Item            | Enter Opens                                                                               |
| --- | --------------- | ----------------------------------------------------------------------------------------- |
| `1` | Everyday Quotes | A new quote, and the settings below                                                       |
| `2` | Tomato Timer    | Start a focus, or pause, resume, or stop the running one                                  |
| `3` | Health          | Today's targets and advice, then log a meal or a workout                                  |
| `4` | Logs            | Every log and action, newest first, with a filter per kind                                |
| `5` | Profile         | Your name, age, height, weight, gender, work style, and health goal, showing saved values |
| `6` | Theme           | The color tone of the dashboard and your pet, previewing each one as the cursor moves     |
| `7` | Language        | English, Traditional Chinese, or Korean                                                   |

A meal asks for the food, its calories, and its protein; a workout asks for the activity, its minutes, and its intensity, one at a time. The food field suggests as you type, your past meals first and then 112 common foods matched in any of the 3 languages, and picking one fills in its calories and protein. The activity offers your 3 latest workouts to repeat in 1 step. A stopped focus earns nothing.

Everything else you do is logged too, without experience: opening the app, starting, pausing, resuming, or stopping a tomato, finishing a break, leveling up, drawing a quote, and changing the language, the theme, the profile, or a quote setting.

### Everyday Quotes

Each setting is saved as soon as you choose it:

| Setting      | Values                                                             | Default       |
| ------------ | ------------------------------------------------------------------ | ------------- |
| Author       | Any, or a name, suggested from the bundled quotes as you type      | Any           |
| Auto-refresh | On or off                                                          | On            |
| Categories   | Any of the 20 API Ninjas categories, from Art to Writing           | All           |
| Exclude      | Categories never to show                                           | None          |
| Interval     | 15 seconds, 1 minute, 5 minutes, 15 minutes, 25 minutes, or 1 hour | 25 minutes    |
| Source       | Random quotes, or the quote of the day                             | Random quotes |
| Work         | Any, or the title of a book, speech, or play                       | Any           |

Without an API key, the settings filter the 28 bundled quotes, which cover every category in all 3 languages, and fall back to all of them when nothing matches. With `API_NINJAS_KEY`, they become the query to API Ninjas.

### Pet

Your character is a pixel-art pet in the spirit of Claude Code's mascot. It wanders around its panel and switches to typing at a laptop, sipping from a cup, eating, running, lifting, or stretching to match what you do. 3 things shape it:

| Shaped By    | What Changes                                                                                                                                                                   |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Level        | It grows at levels 4 and 7, and gains 1 piece of gear per level up to level 9: headphones, a scarf, a cap, an orb, an antenna, a cape, a crown, and sparkles                   |
| Profile      | Its size follows your height and its width your weight for that height; a bow, a tuft, or a sprout follows your gender                                                         |
| Today's Logs | It naps until you log something, and beams once you meet your protein and exercise targets or finish 4 focus sessions; a tomato, an apple, and a dumbbell show what you logged |

Your health goal adds a sweatband to lose fat, a heart to maintain, bigger arms to build muscle, or sneakers for endurance.

### Health Targets

The Health group works out 3 daily targets from your profile, in metric units, and falls back to 2,000 kcal, 50 g of protein, and 30 minutes of exercise until you fill it in:

| Target   | How It Is Worked Out                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------- |
| Calories | The Mifflin-St Jeor resting rate, times 1.2 to 1.725 by work style, then 500 less to lose fat or 200 to 300 more to build |
| Exercise | 30 minutes to stay healthy, 45 to lose fat or build muscle, and 60 to build endurance                                     |
| Protein  | 1.0 to 2.0 g per kg of body weight by goal, plus up to 0.3 g for a physical job, never above 2.2 g                        |

The targets are general guidance for healthy adults, not medical advice.

### Keys

Every view shows its keys at the bottom right:

| Key                       | Action                                                                   |
| ------------------------- | ------------------------------------------------------------------------ |
| `1` to `7`                | Jump to a menu item                                                      |
| Arrows or `h` `j` `k` `l` | Move through the menu, a list, a suggestion, or the log filters          |
| Enter                     | Open the item, choose the option, or go to the next field                |
| Esc                       | Go back to the menu, or out of a quote setting, without logging anything |
| `q` or Ctrl+C             | Quit from the menu                                                       |
| Space                     | Tick a category                                                          |
| Tab                       | Copy the picked suggestion into the field                                |

When a focus or break ends, the terminal rings its bell.

### Environment Variables

Both are optional:

| Variable              | Effect                                                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `API_NINJAS_KEY`      | Fetch quotes from [API Ninjas](https://api-ninjas.com/api/quotes) instead of the bundled list, in English only, falling back on any error |
| `TERMINAL_SIGMA_HOME` | The folder that holds `progress.json`, instead of `~/.terminal-sigma`, e.g. a synced folder                                               |

## Progress File

`progress.json` holds your settings and what you logged. Your experience, level, and daily progress are worked out from it every time, so editing the file by hand can never put them out of sync:

```json
{
	"language": "en",
	"theme": "ember",
	"profile": {
		"name": "Ken",
		"age": 30,
		"height": 175,
		"weight": 70,
		"gender": "male",
		"workStyle": "desk",
		"goal": "buildMuscle"
	},
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
	],
	"quotes": {
		"autoRefresh": true,
		"interval": 1500,
		"mode": "random",
		"categories": ["wisdom"],
		"excluded": [],
		"author": "",
		"work": ""
	},
	"events": [
		{
			"at": "2026-10-03T09:30:00.000Z",
			"action": "themeChanged",
			"detail": "ember"
		}
	]
}
```

Each setting takes 1 of a fixed set of values:

| Field                                  | Values                                                                                                                                                                                                                  |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `events.action`                        | `appOpened`, `breakOver`, `languageChanged`, `levelUp`, `profileSaved`, `quoteDrawn`, `quoteSettingsChanged`, `themeChanged`, `timerPaused`, `timerResumed`, `timerStarted`, or `timerStopped`                          |
| `language`                             | `en`, `ko`, or `zh-TW`                                                                                                                                                                                                  |
| `profile.gender`                       | `female`, `male`, or `other`                                                                                                                                                                                            |
| `profile.goal`                         | `buildMuscle`, `endurance`, `loseFat`, or `maintain`                                                                                                                                                                    |
| `profile.workStyle`                    | `active`, `athlete`, `desk`, or `standing`                                                                                                                                                                              |
| `quotes.categories`, `quotes.excluded` | `art`, `courage`, `death`, `faith`, `fear`, `freedom`, `happiness`, `humor`, `inspirational`, `leadership`, `life`, `love`, `nature`, `philosophy`, `relationships`, `success`, `time`, `truth`, `wisdom`, or `writing` |
| `quotes.interval`                      | Seconds: `15`, `60`, `300`, `900`, `1500`, or `3600`                                                                                                                                                                    |
| `quotes.mode`                          | `daily` or `random`                                                                                                                                                                                                     |
| `theme`                                | `dusk`, `ember`, `frost`, `mono`, or `moss`                                                                                                                                                                             |
| `workouts.activity`                    | `cycling`, `other`, `running`, `strength`, `swimming`, `walking`, or `yoga`                                                                                                                                             |
| `workouts.intensity`                   | `light`, `moderate`, or `vigorous`                                                                                                                                                                                      |

Every setting is optional, and files written by version 1 still load as they are.

Every 100 XP is a level, and every level from level 2 to level 9 gives your pet 1 piece of gear. Experience is earned as follows:

| Entry          | Experience                                                            |
| -------------- | --------------------------------------------------------------------- |
| Action         | None                                                                  |
| Finished focus | 1 XP per minute                                                       |
| Meal           | 5 XP                                                                  |
| Workout        | Per minute: 1 XP when light, 1.5 XP when moderate, 2 XP when vigorous |

> [!important]
> If `progress.json` is not valid, Terminal-Sigma refuses to start rather than overwrite it. Fix or move the file, then start again.

## Contributing

See [`CONTRIBUTING.md`](./.github/CONTRIBUTING.md) to work on Terminal-Sigma, and [`SECURITY.md`](./.github/SECURITY.md) to report a vulnerability.

## License

[MIT](./LICENSE.md)
