# Terminal-Sigma

[![NPM version](https://img.shields.io/npm/v/%40siegesailor/terminal-sigma?logo=npm)](https://www.npmjs.com/package/@siegesailor/terminal-sigma)
[![Desktop app](https://img.shields.io/github/v/release/SiegeSailor/Terminal-Sigma?label=desktop&logo=electron)](https://github.com/SiegeSailor/Terminal-Sigma/releases/latest)
[![push: Verify](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/push-verify.yml/badge.svg)](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/push-verify.yml)
[![main: Release](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/main-release.yml/badge.svg)](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/main-release.yml)
[![release: Desktop](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/release-desktop.yml/badge.svg)](https://github.com/SiegeSailor/Terminal-Sigma/actions/workflows/release-desktop.yml)

Terminal-Sigma is a terminal-based application that gives game-style feedback on your self-development journey. Though it is a CLI, it is meant to stay open: it fills the terminal, updates in real time, and is operated through menus rather than commands. It speaks English, Traditional Chinese, and Korean, and it features 5 main components:

| Component             | What It Does                                                                                                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Character Progression | A pixel-art you, shaped by your profile, dressed by your level, and woken up by what you log today                                                                          |
| Everyday Quotes       | An inspiring quote that refreshes on your schedule, filtered by category, author, or work                                                                                   |
| History               | Every log and action, newest first, filtered by kind, where you edit, delete, or repeat a log, plus a Week tab of trends, streaks, habits, and what goes with a better mood |
| Log                   | 1 line that logs meals, workouts, water, sleep, weight, mood, habits, steps, and notes, suggesting what you usually log at this hour                                        |
| Tomato Timer          | A Pomodoro timer: 25 minutes of focus, then a 5-minute break, against a daily goal of 4 focus sessions                                                                      |

Underneath, your journey and your settings are written to the local file `~/.terminal-sigma/progress.json`. We chose JSON as a readable format, so that you can port it easily.

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

The desktop app opens the dashboard in its own window, sends a system notification when a focus or break ends, and uses your profile's name and the default timer options below. It updates itself from **Software Update** in the menu.

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

The menu drives everything. It sits in 2 boxes: the items on the left, grouped under headings that only label them, and on the right what the focused item does, which turns into its options once you press Enter:

| Key | Group    | Item            | Enter Opens                                                                                                                                              |
| --- | -------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `1` | Today    | Log             | The Log line; while focused, today's targets and advice show on the right                                                                                |
| `2` | Today    | Tomato Timer    | Start a focus, or pause, resume, or stop the running one                                                                                                 |
| `3` | Today    | Coach           | A review of your day or week, a workout plan, or any question, asked of your own AI accounts, and the accounts in the order they are tried               |
| `4` | Journal  | History         | Every log and action, newest first, with the Week tab                                                                                                    |
| `5` | Settings | Everyday Quotes | A new quote, and the settings below                                                                                                                      |
| `6` | Settings | Profile         | Your name, age, height, weight, body fat, gender, work style, and health goal, showing saved values, and your character's appearance with a live preview |
| `7` | Settings | Theme           | The color tone of the dashboard and your character, previewing each one as the cursor moves                                                              |
| `8` | Settings | Language        | English, Traditional Chinese, or Korean                                                                                                                  |
| `9` | Settings | Environment     | Every environment variable with its value and source; Enter edits 1, an empty value clears it                                                            |
| `0` | System   | Software Update | The version you run and the newest one, with an update when there is one                                                                                 |

The headings give way to Recent on a terminal shorter than 28 rows. Body fat is optional: press Enter to skip it.

A stopped focus earns nothing. The dashboard opens with **Log** focused.

### Log

**Log** takes 1 line. Without a prefix, a line is a meal: its items split on `,`, `+`, or `、`, each with an optional quantity, matched against your own past meals first and then 155 common foods in any of the 3 languages. A partial name needs at least 2 characters, unless it is Chinese or Korean. Typed amounts win: `ramen 500kcal 20p` logs exactly that. Every other kind starts with a short prefix, in ASCII so it works through a Chinese or Korean input method; `water` also works as `水` or `물`. A quantity can lead with a counter word, as in `2 slices pizza` or `1 cup rice`. `p`, `c`, and `f` must touch their number, as in `30p`, so `1 c rice` is not 1 g of carbs:

| Prefix  | Logs                                                                     | Examples                                                |
| ------- | ------------------------------------------------------------------------ | ------------------------------------------------------- |
| None    | A meal                                                                   | `2 eggs, toast` · `牛肉麵` · `계란 2개` · `450kcal 30p` |
| `bf`    | Body fat, in %                                                           | `bf 18`                                                 |
| `goal`  | Your own target for water, sleep, steps, or focus                        | `goal water 2.5l` · `goal sleep 8h` · `goal focus 6`    |
| `h`     | A habit done, with an optional amount, or `s` to skip it                 | `h read` · `h read 30` · `h read s`                     |
| `m`     | Your mood, 1 to 5, with energy, stress, and tags                         | `m 4 e3 s2 #work`                                       |
| `n`     | A note                                                                   | `n grateful for the sun`                                |
| `sl`    | Last night's sleep, with its quality from 1 to 5                         | `sl 23:30-7:10 q4` · `sl 7.5h` · `sl 8`                 |
| `st`    | Today's steps so far                                                     | `st 8400`                                               |
| `w`     | Water: 1 glass of 250 ml, or an amount; `water`, `水`, and `물` work too | `w` · `w 500` · `w 0.5l` · `w 2 glasses`                |
| `waist` | Your waist, in cm                                                        | `waist 82`                                              |
| `wo`    | A workout: minutes, intensity, distance, or sets                         | `wo run 30m hard 5k` · `wo bench 60x5x3` · `wo bench`   |
| `wt`    | Your weight, in kg; 1 line can carry several body fields                 | `wt 72.4` · `wt 72.4 bf 18`                             |

In `sl`, a bare number up to 24 is hours, so `sl 8` is 8 hours, and a larger one is minutes. Start any line with a time to log it then: `@y` for yesterday, `@-2d` for 2 days ago, `@7:30`, or `@y 21:00`; a time later than now means yesterday. `.` logs your last line again, `copy y` copies yesterday's meals to today, and `u` alone undoes the last line you logged since opening Log, though never a `goal`, which you set back by typing it again. While the line is empty, Log suggests the foods you usually eat around now, water when you are behind, last week's workout for today, and your regular habits; ↑↓ and Enter log one. While you type a food, ↑↓ picks a match and Tab completes it. A workout of known lifts without sets, such as `wo bench`, repeats the sets of your last session, and with a profile every workout counts its calories from the 2024 Compendium of Physical Activities.

### History

**History** lists every log and action, newest first. ←→ cycles the filter through every kind, and ↑↓ moves the cursor: `e` edits the log under it, keeping its day and time, `d` deletes it, `u` puts the last deleted log back, and `r` logs it again now. Focus sessions and actions cannot change. `e` also refuses a log that cannot be written back as 1 line, such as a workout mixing 2 exercises or a meal whose food contains a comma; delete it and log it again instead. The last filter, **Week**, draws the last 7 days as sparklines against your targets for calories, protein, exercise, water, sleep, and steps, then your streak, your weight trend, your habits' strength, what goes with a better mood, and your best lifts; `e`, `d`, `r`, and `u` do nothing there.

Your streak counts days in a row with any log, and today counts until it is over. Every 7 days in a row bank a grace day, at most 2, that covers a missed day. The weight trend moves 10% of the way to each day's weight, as the Hacker's Diet does, so 1 heavy morning barely moves it. A habit's strength follows Loop Habit Tracker: a month of daily checks reaches about 80%, and a skipped day leaves it alone. A mood difference shows only after at least 3 days with and 3 without.

Everything else you do is logged too, without experience: opening the app, starting, pausing, resuming, or stopping a tomato, finishing a break, leveling up, drawing a quote, changing the language, the theme, the profile, or a quote setting, saving or clearing an environment variable, and updating.

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

Every new quote marks itself with **✦ New** for 8 seconds and types itself in, whether you drew it or it refreshed on its own. Without an API key, a random draw never repeats the quote on screen unless only 1 quote matches the filters. With `TERMINAL_SIGMA_MOTION=reduced`, it appears whole at once.

### Character

Your character is a pixel-art you, standing on its own oval shadow and animating at 10 frames a second. It wanders around its panel, turning side on to walk with both feet stepping the way it goes and its arms swinging, then faces you to look about, blink, and shake out its hands. It types at a desk, sips a coffee, eats, runs a lap, lifts, or stretches to match what you do, and always finishes back where it started before the next animation begins. It draws from 4 sources, and every small change shows:

| Shaped By    | What Changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Appearance   | Skin tone, hair style and color, glasses, and facial hair, chosen under **Profile** → **Appearance** with a live preview                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Level        | 1 piece of gear per level up to level 9: headphones, a scarf, a cap, a backpack, a smartwatch, a jacket, sunglasses in place of the cap, and a medal                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Profile      | 1 pixel of height every 5 cm; a fuller body in 22 stages, 1 every 2 points of body fat, estimated from your weight, height, and age when you leave it out; hair that greys from the temples from age 35 and turns white later                                                                                                                                                                                                                                                                                                                                                                             |
| Today's Logs | Muscle in 4 stages, 0 to 3: strength work over 28 days adds up to 2 (150 intensity-weighted minutes each), and a build-muscle goal, the athlete work style, or a lean but heavy build (BMI 23 or more with fat stage 3 or less) adds more, up to 3, shadows under the eyes after under 6 hours of sleep, sweat or red cheeks after a workout, a bubble of water or food when you are behind on water or due a meal (shown while it idles, once you have logged water or food before), a fuller belly after a big meal, your logged mood on its face, and bed head after a week away until a cap covers it |

The stage follows the clock and the calendar: a sun in the corner at dawn, by day, and at dusk, a moon and stars at night, and petals, leaves, snowflakes, or, on summer evenings and nights, fireflies by the season. In the room, a plant grows once you log water and wilts after 2 days without, a dumbbell appears after 10 strength workouts, and a shelf of books after 25 hours of focus. Logging water makes it drink, logging weight or steps makes it step on a scale, and writing a mood, habit, or note makes it write. Your streak shows beside the level from 2 days in a row, and the bars in **Today** glide to each new value over half a second, naming what earned the experience, as in `Drinking water… +1 XP`. The signals refresh once a minute. With `TERMINAL_SIGMA_MOTION=reduced`, nothing falls and the bars jump, while the character and the stars keep their life.

Your work style dresses it: a hoodie and jeans at a desk, a shirt and an apron when standing, a tee and cargo pants when active, and a tank top and shorts as an athlete.

### Software Update

**Software Update** shows the version you run and the newest one, and checks once on start so the menu can tell you when there is a newer one. Choosing the update installs it, and **Restart now** starts the new version in place:

| Running As | How It Updates                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------- |
| CLI        | `npm install --global @siegesailor/terminal-sigma@<version>`, then the same command starts again   |
| Desktop    | Downloads this system's file from the release, swaps it in for the running app, and opens it again |

The desktop app waits until the release has its file for your system, a few minutes after the CLI. On Linux it updates the AppImage, and on Windows it runs the installer silently.

### Health Targets

**Today** works out 7 daily targets from your profile, in metric units, and falls back to 2,000 kcal, 50 g of protein, 30 minutes of exercise, 2,600 ml of water, 7 hours of sleep, 8,000 steps, and 4 focus sessions until you fill it in:

| Target   | How It Is Worked Out                                                                                                                                                                                                        |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Calories | The resting rate, times 1.2 to 1.725 by work style, then 500 less to lose fat or 200 to 300 more to build; the resting rate is Katch-McArdle from your lean mass when you give your body fat, and Mifflin-St Jeor otherwise |
| Exercise | 30 minutes to stay healthy, 45 to lose fat or build muscle, and 60 to build endurance                                                                                                                                       |
| Focus    | 4 Tomato Timer sessions                                                                                                                                                                                                     |
| Protein  | 1.0 to 2.0 g per kg of body weight by goal, plus up to 0.3 g for a physical job, never above 2.2 g                                                                                                                          |
| Sleep    | 7 hours, as the American Academy of Sleep Medicine recommends for adults                                                                                                                                                    |
| Steps    | 8,000 under 60 and 7,000 from 60, where studies find mortality stops falling                                                                                                                                                |
| Water    | 3,000 ml for men, 2,200 ml for women, and 2,600 ml otherwise: the drinks share of the National Academies' adequate intake                                                                                                   |

Calories and protein follow your latest weigh-in. `goal water 2.5l`, `goal sleep 8h`, `goal steps 9000`, or `goal focus 6` in Log replaces a default with your own.

The targets are general guidance for healthy adults, not medical advice.

### Keys

Every view shows its keys at the bottom right:

| Key                       | Action                                                                                                                                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.`                       | In Log: log your last line again                                                                                                                              |
| `1` to `9`, and `0`       | Jump to a menu item, `0` to the 10th                                                                                                                          |
| Arrows or `h` `j` `k` `l` | Move through the menu, a list, a suggestion, or the log filters; ↑↓ scroll the Coach's conversation                                                           |
| `e` `d` `r` `u`           | In History: edit, delete, repeat, or put back a log                                                                                                           |
| Enter                     | Open the item, choose the option, or go to the next field                                                                                                     |
| Esc                       | Go back to the menu, or out of a quote setting, without logging anything; while editing a log, back to History; while the Coach is asking, cancel the request |
| `q` or Ctrl+C             | Quit from the menu                                                                                                                                            |
| Space                     | Tick a category                                                                                                                                               |
| Tab                       | Copy the picked suggestion into the field, or complete the food name in Log; in History, cycle the filter                                                     |
| `u`                       | In Log, as the whole line: undo the last line logged                                                                                                          |

When a focus or break ends, the terminal rings its bell.

### Environment Variables

Every variable is optional, and **Environment** in the menu shows and edits each one. A value saved there goes to `config.json` in `~/.terminal-sigma`, readable only by you; a variable your shell sets always wins over a saved one:

| Variable                       | Effect                                                                                                                                    |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY`            | Let the Coach use Claude; it joins your accounts after the ones you added                                                                 |
| `API_NINJAS_KEY`               | Fetch quotes from [API Ninjas](https://api-ninjas.com/api/quotes) instead of the bundled list, in English only, falling back on any error |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Let the Coach use Gemini; it joins your accounts after the ones you added                                                                 |
| `LANGFUSE_BASE_URL`            | Your Langfuse server, e.g. `http://localhost:3000`, instead of Langfuse Cloud; applies after a restart                                    |
| `LANGFUSE_PUBLIC_KEY`          | With `LANGFUSE_SECRET_KEY`, trace every Coach request to Langfuse, including the logs it sends; applies after a restart                   |
| `LANGFUSE_SECRET_KEY`          | With `LANGFUSE_PUBLIC_KEY`, trace every Coach request to Langfuse; applies after a restart                                                |
| `OPENAI_API_KEY`               | Let the Coach use OpenAI; it joins your accounts after the ones you added                                                                 |
| `TERMINAL_SIGMA_BREAK`         | Minutes of each Tomato Timer break, from `1` to `180`; `--break` wins                                                                     |
| `TERMINAL_SIGMA_FOCUS`         | Minutes of each Tomato Timer focus, from `1` to `180`; `--focus` wins                                                                     |
| `TERMINAL_SIGMA_HOME`          | The folder that holds `progress.json`, instead of `~/.terminal-sigma`, e.g. a synced folder                                               |
| `TERMINAL_SIGMA_MOTION`        | `full`, or `reduced` to show every change at once, without text effects                                                                   |
| `XAI_API_KEY`                  | Let the Coach use Grok; it joins your accounts after the ones you added                                                                   |

`config.json` always lives in `~/.terminal-sigma`, whatever `TERMINAL_SIGMA_HOME` says; `TERMINAL_SIGMA_HOME` moves only `progress.json`, so your keys never travel with a synced folder.

## Progress File

The Coach keeps its conversations in `coach.json`, beside `progress.json`.

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
		"bodyFat": 18,
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
			"protein": 12,
			"servings": 1
		}
	],
	"water": [{ "at": "2026-10-03T10:00:00.000Z", "milliliters": 500 }],
	"sleep": [{ "at": "2026-10-03T06:30:00.000Z", "minutes": 450, "quality": 4 }],
	"body": [
		{
			"at": "2026-10-03T06:45:00.000Z",
			"weight": 70.4,
			"waist": 82,
			"bodyFat": 18
		}
	],
	"moods": [
		{
			"at": "2026-10-03T12:00:00.000Z",
			"score": 4,
			"energy": 3,
			"stress": 2,
			"tags": ["work"]
		}
	],
	"habits": [
		{ "at": "2026-10-03T08:30:00.000Z", "name": "read", "amount": 30 }
	],
	"steps": [{ "at": "2026-10-03T18:00:00.000Z", "count": 8400 }],
	"notes": [
		{ "at": "2026-10-03T20:00:00.000Z", "text": "Grateful for the sun" }
	],
	"goals": { "water": 2500, "sleep": 480, "steps": 9000, "focusSessions": 6 },
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

| Field                                         | Values                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `body`                                        | `weight` from `30` to `300` kg, `waist` from `40` to `250` cm, and `bodyFat` from `3` to `60` %, at least 1 of them                                                                                                                                                                                                                                                                                                    |
| `events.action`                               | `accountAdded`, `accountMoved`, `accountRemoved`, `appOpened`, `appearanceSaved`, `breakOver`, `coachAsked`, `conversationStarted`, `goalChanged`, `languageChanged`, `levelUp`, `logDeleted`, `logEdited`, `planSaved`, `profileSaved`, `quoteDrawn`, `quoteSettingsChanged`, `themeChanged`, `timerPaused`, `timerResumed`, `timerStarted`, `timerStopped`, `updateInstalled`, `variableCleared`, or `variableSaved` |
| `goals.focusSessions`                         | A whole number from `1` to `16`                                                                                                                                                                                                                                                                                                                                                                                        |
| `goals.sleep`                                 | Minutes, from `240` to `720`                                                                                                                                                                                                                                                                                                                                                                                           |
| `goals.steps`                                 | A whole number from `1,000` to `50,000`                                                                                                                                                                                                                                                                                                                                                                                |
| `goals.water`                                 | Milliliters, from `250` to `10,000`                                                                                                                                                                                                                                                                                                                                                                                    |
| `habits.skipped`                              | `true`, or left out                                                                                                                                                                                                                                                                                                                                                                                                    |
| `language`                                    | `en`, `ko`, or `zh-TW`                                                                                                                                                                                                                                                                                                                                                                                                 |
| `meals.servings`                              | A positive number, with the amounts already multiplied by it                                                                                                                                                                                                                                                                                                                                                           |
| `moods.score`, `moods.energy`, `moods.stress` | A whole number from `1` to `5`                                                                                                                                                                                                                                                                                                                                                                                         |
| `plans.days.activity`                         | `cycling`, `other`, `running`, `strength`, `swimming`, `walking`, or `yoga`                                                                                                                                                                                                                                                                                                                                            |
| `plans.days.intensity`                        | `light`, `moderate`, or `vigorous`                                                                                                                                                                                                                                                                                                                                                                                     |
| `plans.days.minutes`                          | A whole number from `5` to `240`                                                                                                                                                                                                                                                                                                                                                                                       |
| `plans.days.note`                             | Up to 80 characters, or left out                                                                                                                                                                                                                                                                                                                                                                                       |
| `plans.days.weekday`                          | `0` for Sunday to `6` for Saturday                                                                                                                                                                                                                                                                                                                                                                                     |
| `plans.title`                                 | Up to 60 characters                                                                                                                                                                                                                                                                                                                                                                                                    |
| `profile.bodyFat`                             | A whole percentage from `3` to `60`, or left out                                                                                                                                                                                                                                                                                                                                                                       |
| `profile.facialHair`                          | `beard`, `none`, or `stubble`, or left out                                                                                                                                                                                                                                                                                                                                                                             |
| `profile.gender`                              | `female`, `male`, or `other`                                                                                                                                                                                                                                                                                                                                                                                           |
| `profile.glasses`                             | `true` or `false`, or left out                                                                                                                                                                                                                                                                                                                                                                                         |
| `profile.goal`                                | `buildMuscle`, `endurance`, `loseFat`, or `maintain`                                                                                                                                                                                                                                                                                                                                                                   |
| `profile.hairColor`                           | `black`, `blonde`, `brown`, or `red`, or left out                                                                                                                                                                                                                                                                                                                                                                      |
| `profile.hairStyle`                           | `bob`, `bun`, `buzz`, `long`, `ponytail`, or `short`, or left out                                                                                                                                                                                                                                                                                                                                                      |
| `profile.skinTone`                            | A whole number from `1` to `5`, or left out                                                                                                                                                                                                                                                                                                                                                                            |
| `profile.workStyle`                           | `active`, `athlete`, `desk`, or `standing`                                                                                                                                                                                                                                                                                                                                                                             |
| `quotes.categories`, `quotes.excluded`        | `art`, `courage`, `death`, `faith`, `fear`, `freedom`, `happiness`, `humor`, `inspirational`, `leadership`, `life`, `love`, `nature`, `philosophy`, `relationships`, `success`, `time`, `truth`, `wisdom`, or `writing`                                                                                                                                                                                                |
| `quotes.interval`                             | Seconds: `15`, `60`, `300`, `900`, `1500`, or `3600`                                                                                                                                                                                                                                                                                                                                                                   |
| `quotes.mode`                                 | `daily` or `random`                                                                                                                                                                                                                                                                                                                                                                                                    |
| `sleep.minutes`                               | A whole number from `1` to `1,440`; `at` is the wake time                                                                                                                                                                                                                                                                                                                                                              |
| `sleep.quality`                               | A whole number from `1` to `5`                                                                                                                                                                                                                                                                                                                                                                                         |
| `steps.count`                                 | A whole number from `1` to `100,000`, the day's count so far                                                                                                                                                                                                                                                                                                                                                           |
| `theme`                                       | `dusk`, `ember`, `frost`, `mono`, or `moss`                                                                                                                                                                                                                                                                                                                                                                            |
| `water.milliliters`                           | From `1` to `5,000`                                                                                                                                                                                                                                                                                                                                                                                                    |
| `workouts.activity`                           | `cycling`, `other`, `running`, `strength`, `swimming`, `walking`, `yoga`, or any name you type                                                                                                                                                                                                                                                                                                                         |
| `workouts.intensity`                          | `light`, `moderate`, or `vigorous`                                                                                                                                                                                                                                                                                                                                                                                     |

Every setting is optional, and files written by version 1 still load as they are.

Every 100 XP is a level, and every level from level 2 to level 9 gives your character 1 piece of gear. Experience is earned as follows:

| Entry          | Experience                                                            | Daily Cap |
| -------------- | --------------------------------------------------------------------- | --------- |
| Action         | None                                                                  |           |
| Body           | 5 XP                                                                  | 5 XP      |
| Finished focus | 1 XP per minute                                                       |           |
| Habit          | 5 XP, none when skipped                                               | 25 XP     |
| Meal           | 5 XP                                                                  |           |
| Mood           | 3 XP                                                                  | 6 XP      |
| Note           | 3 XP                                                                  | 3 XP      |
| Sleep          | 10 XP                                                                 | 10 XP     |
| Steps          | 1 XP per 1,000, counting only what a later count adds                 | 20 XP     |
| Water          | 1 XP                                                                  | 8 XP      |
| Workout        | Per minute: 1 XP when light, 1.5 XP when moderate, 2 XP when vigorous |           |

Caps reset at your local midnight, and entries earn in the order they happened.

> [!important]
> If `progress.json` is not valid, Terminal-Sigma refuses to start rather than overwrite it. Fix or move the file, then start again.

> [!warning]
> An older version that loads a `progress.json` with the new kinds drops them when it saves, so update the CLI and the desktop app together.

## Config File

`config.json` holds the environment variables you saved in **Environment**, under `env`, and the Coach's accounts, under `accounts`. It always lives in `~/.terminal-sigma`, whatever `TERMINAL_SIGMA_HOME` says, and only you can read it (mode 600). Names Terminal-Sigma does not know are ignored, and keys it does not know are kept:

```json
{
	"env": { "TERMINAL_SIGMA_FOCUS": "50" },
	"accounts": [
		{
			"id": "5f0c…",
			"provider": "compatible",
			"label": "Ollama",
			"model": "llama3.2",
			"baseUrl": "http://localhost:11434/v1"
		}
	]
}
```

The Coach tries `accounts` in order, then 1 account for each key your shell or **Environment** sets; when one fails or hits a limit, the next answers. **Accounts** in the Coach adds, reorders, and removes them. Each account has these fields:

| Field      | Description                                                                          |
| ---------- | ------------------------------------------------------------------------------------ |
| `apiKey`   | The provider's key; only a `compatible` account, such as a local server, may omit it |
| `baseUrl`  | Optional: another endpoint, such as `http://localhost:11434/v1` for Ollama           |
| `id`       | A random ID                                                                          |
| `label`    | The name shown in **Accounts** and in the footer                                     |
| `model`    | The model to ask                                                                     |
| `provider` | `anthropic`, `compatible`, `google`, `openai`, or `xai`                              |

> [!important]
> If `config.json` is not valid, Terminal-Sigma refuses to start rather than overwrite it. Fix or move the file, then start again.

## Contributing

See [`CONTRIBUTING.md`](./.github/CONTRIBUTING.md) to work on Terminal-Sigma, and [`SECURITY.md`](./.github/SECURITY.md) to report a vulnerability.

## License

[MIT](./LICENSE.md)

Bundled nutrition and exercise data keep their own licenses, listed in [`DATA-LICENSES.md`](./DATA-LICENSES.md).
