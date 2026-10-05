import { homedir } from "node:os";
import zod from "zod";
import React from "react";
import { ThemeProvider } from "@inkjs/ui";
import { Box, Text, useApp, useInput, useStdout, useWindowSize } from "ink";
import AutocompleteInput from "./components/autocomplete-input.js";
import Character from "./components/character.js";
import Choice from "./components/choice.js";
import EntryForm from "./components/entry-form.js";
import Footer, { type Tone } from "./components/footer.js";
import LogsView, { LogRow } from "./components/logs-view.js";
import MultiChoice from "./components/multi-choice.js";
import TodayPanel from "./components/today-panel.js";
import {
	categoryOptionsOf,
	characterWidth,
	dietFieldsOf,
	intervalOptionsOf,
	layoutOf,
	type MenuKey,
	menuEntriesOf,
	menuListWidth,
	menuOrder,
	moodOf,
	profileFieldsOf,
	quoteOptionsOf,
	sectionsOf,
	workoutFieldsOf,
} from "./content.js";
import { adviceOf, targetsOf } from "./health.js";
import {
	formatNumber,
	genders,
	healthGoals,
	intensities,
	type Language,
	languages,
	type Messages,
	messagesOf,
	workoutActivities,
	workStyles,
} from "./i18n.js";
import { type Activity, lookOf } from "./pixel-art.js";
import {
	type EventAction,
	experienceOf,
	experiencePerMeal,
	levelOf,
	logsOf,
	type Progress,
	saveProgress,
	todayOf,
	workoutExperience,
} from "./progress.js";
import {
	bundledQuotes,
	defaultQuoteSettings,
	fetchQuote,
	hasQuoteApi,
	localizedQuote,
	pickBundled,
	type Quote,
	quoteCategories,
	quoteIntervals,
	type QuoteSettings,
} from "./quotes.js";
import {
	type Palette,
	paletteContext,
	type ThemeName,
	themeNames,
	themes,
	uiThemeOf,
} from "./theme.js";
import {
	advanceTimer,
	formatClock,
	idleTimer,
	remainingOf,
	toggleTimer,
} from "./timer.js";

export const optionsSchema = zod.object({
	name: zod.string().min(1).optional(),
	focus: zod.number().int().positive().default(25),
	break: zod.number().int().positive().default(5),
});

export type AppOptions = zod.infer<typeof optionsSchema>;

type AppProps = Readonly<{
	options: AppOptions;
	file: string;
	initialProgress: Progress;
}>;

type View = "menu" | MenuKey | "diet" | "workout";
type QuoteEditor = "interval" | "categories" | "excluded" | "author" | "work";
type Flash = Readonly<{ activity: Activity; until: number }>;

const flashMilliseconds = 6000;
const recentCount = 4;

const workoutAnimation = (activity: string | undefined): Activity => {
	if (activity === "strength") {
		return "lift";
	}

	return activity === "yoga" ? "stretch" : "run";
};

const languageOptions = languages.map((language) => ({
	label: messagesOf(language).languageName,
	value: language,
}));

const pick = <Value extends string>(
	options: readonly Value[],
	value: string | undefined,
	fallback: Value,
): Value => options.find((option) => option === value) ?? fallback;

// Appends an event, so every action lands in the logs with the change it made.
const withEvent = (
	progress: Progress,
	action: EventAction,
	detail?: string,
): Progress => ({
	...progress,
	events: [
		...progress.events,
		{
			at: new Date().toISOString(),
			action,
			...(detail === undefined ? {} : { detail }),
		},
	],
});

// Names to suggest for the author and work filters.
const quoteNames = (field: "author" | "work") => [
	...new Set(
		bundledQuotes.flatMap((quote) =>
			field === "author"
				? [
						quote.author,
						...Object.values(quote.translations ?? {}).map(
							(text) => text.author,
						),
					]
				: quote.work
					? [quote.work]
					: [],
		),
	),
];

function Titled({
	title,
	children,
}: Readonly<{ title: string; children: React.ReactNode }>) {
	return (
		<paletteContext.Consumer>
			{(palette) => (
				<Box flexDirection="column">
					<Text bold color={palette.accent}>
						{title}
					</Text>
					{children}
				</Box>
			)}
		</paletteContext.Consumer>
	);
}

function Swatches({ palette }: Readonly<{ palette: Palette }>) {
	return (
		<Text>
			{Object.values(palette.metrics).map((color) => (
				<Text key={color} color={color}>
					██
				</Text>
			))}
		</Text>
	);
}

export default function App({ options, file, initialProgress }: AppProps) {
	const { exit } = useApp();
	const { stdout } = useStdout();
	const size = useWindowSize();
	const [progress, setProgress] = React.useState(initialProgress);
	const [now, setNow] = React.useState(Date.now);
	const durations = React.useMemo(
		() => ({ focus: options.focus, break: options.break }),
		[options.focus, options.break],
	);
	const [timer, setTimer] = React.useState(() => idleTimer(durations));
	const quoteSettings: QuoteSettings = progress.quotes ?? defaultQuoteSettings;
	const [quote, setQuote] = React.useState<Quote>(() =>
		pickBundled(quoteSettings, Date.now()),
	);
	const [view, setView] = React.useState<View>("menu");
	const [focusedMenu, setFocusedMenu] = React.useState<MenuKey>("quotes");
	const [quoteEditor, setQuoteEditor] = React.useState<QuoteEditor>();
	const [quoteOption, setQuoteOption] = React.useState("draw");
	const [flash, setFlash] = React.useState<Flash>();
	const [draftActivity, setDraftActivity] = React.useState<string>();
	const language = progress.language ?? "en";
	const messages = messagesOf(language);
	const themeName = progress.theme ?? "ember";
	// While the theme picker is open, the focused theme previews live.
	const [previewTheme, setPreviewTheme] = React.useState<ThemeName>();
	const palette = themes[previewTheme ?? themeName];
	const uiTheme = React.useMemo(() => uiThemeOf(palette), [palette]);
	const name = options.name ?? progress.profile?.name ?? "Rook Sigma";
	const [message, setMessage] = React.useState<{ text: string; tone: Tone }>(
		() => ({
			text: messages.savedTo(file.replace(homedir(), "~")),
			tone: "info",
		}),
	);

	const say = (text: string, tone: Tone = "info") => {
		setMessage({ text, tone });
	};

	// Saves first and only then shows the change, so the screen never claims
	// something the file does not hold.
	const commit = React.useCallback(
		(next: Progress, text?: string, tone: Tone = "info") => {
			try {
				saveProgress(file, next);
			} catch (error) {
				setMessage({
					text: messagesOf(next.language ?? "en").notSaved(String(error)),
					tone: "error",
				});
				return false;
			}

			setProgress(next);

			if (text) {
				setMessage({ text, tone });
			}

			return true;
		},
		[file],
	);

	const record = React.useCallback(
		(
			update: (current: Progress) => Progress,
			text: string,
			activity: Activity,
		) => {
			let next = update(progress);
			const after = levelOf(experienceOf(next));
			const leveledUp = after > levelOf(experienceOf(progress));

			if (leveledUp) {
				next = withEvent(next, "levelUp", String(after));
			}

			const { form } = messagesOf(next.language ?? "en");

			if (
				commit(
					next,
					leveledUp ? `${text} ${form.levelUp(after)}` : text,
					"success",
				)
			) {
				setFlash({
					activity: leveledUp ? "levelUp" : activity,
					until: Date.now() + flashMilliseconds,
				});
			}
		},
		[progress, commit],
	);

	React.useEffect(() => {
		const interval = setInterval(() => {
			setNow(Date.now());
		}, 1000);

		return () => {
			clearInterval(interval);
		};
	}, []);

	// Opening the app is an action too.
	const hasOpened = React.useRef(false);

	React.useEffect(() => {
		if (!hasOpened.current) {
			hasOpened.current = true;
			commit(withEvent(progress, "appOpened"));
		}
	}, [commit, progress]);

	React.useEffect(() => {
		const { timer: next, finished } = advanceTimer(timer, now, durations);

		if (!finished) {
			return;
		}

		const { timer: words } = messagesOf(language);
		setTimer(next);
		stdout.write("\u0007");

		if (finished === "break") {
			commit(withEvent(progress, "breakOver"), words.breakOver);
			return;
		}

		record(
			(current) => ({
				...current,
				focus: [
					...current.focus,
					{ at: new Date(now).toISOString(), minutes: durations.focus },
				],
			}),
			words.focusComplete(durations.focus, durations.break),
			"idle",
		);
	}, [now, timer, durations, record, commit, progress, stdout, language]);

	React.useEffect(() => {
		let isMounted = true;
		const refresh = async () => {
			const next = await fetchQuote(quoteSettings);

			if (isMounted) {
				setQuote(next);
			}
		};

		// The bundled quote shown first is already fresh; only the API is worth a call.
		if (hasQuoteApi()) {
			void refresh();
		}

		if (!quoteSettings.autoRefresh) {
			return () => {
				isMounted = false;
			};
		}

		const interval = setInterval(() => {
			void refresh();
		}, quoteSettings.interval * 1000);

		return () => {
			isMounted = false;
			clearInterval(interval);
		};
	}, [quoteSettings]);

	const backToMenu = (text?: string) => {
		setView("menu");
		setQuoteEditor(undefined);
		setDraftActivity(undefined);
		setPreviewTheme(undefined);

		if (text) {
			say(text);
		}
	};

	useInput(
		(input, key) => {
			if (view === "menu" && input === "q") {
				exit();
			} else if (view === "quotes" && quoteEditor && key.escape) {
				setQuoteEditor(undefined);
			} else if (view !== "menu" && key.escape) {
				const isForm = ["diet", "workout", "profile"].includes(view);
				backToMenu(isForm ? messages.form.cancelled : undefined);
			}
		},
		{ isActive: progress.language !== undefined },
	);

	const chooseLanguage = (value: string) => {
		const next = pick(languages, value, "en");

		if (
			commit(
				withEvent({ ...progress, language: next }, "languageChanged", next),
			)
		) {
			backToMenu(messagesOf(next).languageChanged);
		}
	};

	const providers = (children: React.ReactNode) => (
		<paletteContext.Provider value={palette}>
			<ThemeProvider theme={uiTheme}>{children}</ThemeProvider>
		</paletteContext.Provider>
	);

	if (progress.language === undefined) {
		return providers(
			<Box
				borderColor={palette.accent}
				borderStyle="round"
				flexDirection="column"
				paddingX={2}
				paddingY={1}
			>
				<Titled title="✻ Terminal Sigma">
					<Text dimColor>{messages.chooseLanguage}</Text>
					<Box marginTop={1}>
						<Choice options={languageOptions} onSelect={chooseLanguage} />
					</Box>
				</Titled>
			</Box>,
		);
	}

	const isRunning = timer.endsAt !== undefined;
	const isIdle =
		!isRunning &&
		timer.phase === "focus" &&
		timer.remaining === durations.focus * 60_000;
	const clock = formatClock(remainingOf(timer, now));
	const phaseLabel = messages.timer[timer.phase];

	const chooseTimerAction = (action: string) => {
		if (action === "start" || action === "toggle") {
			const [event, text, detail]: [EventAction, string, string?] =
				action === "start"
					? ["timerStarted", messages.timer.started, String(durations.focus)]
					: isRunning
						? ["timerPaused", messages.timer.paused, clock]
						: ["timerResumed", messages.timer.resumed];
			setTimer(toggleTimer(timer, now));
			commit(withEvent(progress, event, detail));
			backToMenu(text);
		} else if (action === "stop") {
			setTimer(idleTimer(durations));
			commit(withEvent(progress, "timerStopped", clock));
			backToMenu(messages.timer.stopped);
		} else {
			backToMenu();
		}
	};

	const chooseHealthAction = (action: string) => {
		if (action === "diet" || action === "workout" || action === "profile") {
			setView(action);
		} else {
			backToMenu();
		}
	};

	const submitMeal = (values: Record<string, string>) => {
		const food = values.food ?? "";
		backToMenu();
		record(
			(current) => ({
				...current,
				meals: [
					...current.meals,
					{
						at: new Date().toISOString(),
						food,
						calories: Number(values.calories),
						protein: Number(values.protein),
					},
				],
			}),
			messages.form.mealLogged(food, experiencePerMeal),
			"eat",
		);
	};

	const submitWorkout = (values: Record<string, string>) => {
		const workout = {
			at: new Date().toISOString(),
			activity: pick(workoutActivities, values.activity, "other"),
			minutes: Number(values.minutes),
			intensity: pick(intensities, values.intensity, "moderate"),
		};
		backToMenu();
		record(
			(current) => ({ ...current, workouts: [...current.workouts, workout] }),
			messages.form.workoutLogged(
				messages.workoutActivity[workout.activity],
				workout.minutes,
				workoutExperience(workout),
			),
			workoutAnimation(workout.activity),
		);
	};

	const submitProfile = (values: Record<string, string>) => {
		const next = withEvent(
			{
				...progress,
				profile: {
					name: values.name ?? name,
					age: Number(values.age),
					height: Number(values.height),
					weight: Number(values.weight),
					gender: pick(genders, values.gender, "other"),
					workStyle: pick(workStyles, values.workStyle, "desk"),
					goal: pick(healthGoals, values.goal, "maintain"),
				},
			},
			"profileSaved",
		);

		if (commit(next)) {
			backToMenu(messages.form.profileSaved);
		}
	};

	const chooseTheme = (value: string) => {
		const next: ThemeName = pick(themeNames, value, "ember");

		if (commit(withEvent({ ...progress, theme: next }, "themeChanged", next))) {
			backToMenu(messages.themes.changed(messages.themes.names[next]));
		}
	};

	const drawQuote = (settings: QuoteSettings, base: Progress) => {
		void fetchQuote(settings).then(setQuote);
		return withEvent(base, "quoteDrawn");
	};

	// Saves 1 quote setting, logs it as "setting:value", and draws a quote that
	// follows the new filters.
	const updateQuotes = (patch: Partial<QuoteSettings>, detail: string) => {
		const settings = { ...quoteSettings, ...patch };
		const next = withEvent(
			{ ...progress, quotes: settings },
			"quoteSettingsChanged",
			detail,
		);

		if (commit(next, messages.quotes.changed)) {
			setQuoteEditor(undefined);
			setQuote(pickBundled(settings, Date.now()));
		}
	};

	const chooseQuoteOption = (value: string) => {
		setQuoteOption(value);

		switch (value) {
			case "draw": {
				commit(drawQuote(quoteSettings, progress), messages.quoteDrawn);
				break;
			}

			case "autoRefresh": {
				const isOn = !quoteSettings.autoRefresh;
				updateQuotes(
					{ autoRefresh: isOn },
					`autoRefresh:${isOn ? "on" : "off"}`,
				);
				break;
			}

			case "mode": {
				const mode = quoteSettings.mode === "random" ? "daily" : "random";
				updateQuotes({ mode }, `mode:${mode}`);
				break;
			}

			case "back": {
				backToMenu();
				break;
			}

			default: {
				setQuoteEditor(
					pick(
						["interval", "categories", "excluded", "author", "work"] as const,
						value,
						"interval",
					),
				);
			}
		}
	};

	const openMenu = (value: string) => {
		const item = pick(menuOrder, value, "quotes");
		setFocusedMenu(item);
		setView(item);

		if (item === "theme") {
			setPreviewTheme(themeName);
		}
	};

	const experience = experienceOf(progress);
	const level = levelOf(experience);
	const today = todayOf(progress, now);
	const logs = logsOf(progress);
	const columns = size.columns || 100;
	const rows = size.rows || 40;
	const layout = layoutOf(columns, rows);
	const mood = moodOf(progress, now);

	const activity: Activity =
		flash && flash.until > now
			? flash.activity
			: view === "diet"
				? "eat"
				: view === "workout"
					? workoutAnimation(draftActivity)
					: isRunning
						? ({ focus: "focus", break: "break" } as const)[timer.phase]
						: "idle";

	let activityLabel = messages.activity[activity];

	if (activity === "idle") {
		activityLabel = messages.mood[mood];
	} else if (activity === "levelUp") {
		activityLabel = `${messages.activity.levelUp} ${messages.level(level)}`;
	}

	let timerSignal = isRunning ? clock : messages.signal.paused;

	if (isIdle) {
		timerSignal = messages.signal.ready;
	}

	const entries = menuEntriesOf(messages, {
		timerSignal,
		progress,
		quotes: quoteSettings,
		now,
		logs: logs.length,
		theme: themeName,
		focus: durations.focus,
		rest: durations.break,
	});
	const focusedEntry =
		entries.find((entry) => entry.key === focusedMenu) ?? entries[0];

	const isTyping =
		view === "diet" ||
		(view === "quotes" && (quoteEditor === "author" || quoteEditor === "work"));
	let hint = messages.hints.select;

	if (view === "menu") {
		hint = messages.hints.menu;
	} else if (view === "logs") {
		hint = messages.hints.logs;
	} else if (isTyping) {
		hint = messages.hints.suggest;
	} else if (view === "workout" || view === "profile") {
		hint = messages.hints.form;
	}

	const shownQuote = localizedQuote(quote, language);

	const quoteEditors: Record<QuoteEditor, React.ReactNode> = {
		interval: (
			<Choice
				initialValue={String(quoteSettings.interval)}
				options={intervalOptionsOf(messages)}
				onSelect={(value) => {
					const interval =
						quoteIntervals.find((option) => String(option) === value) ?? 1500;
					updateQuotes({ interval }, `interval:${interval}`);
				}}
			/>
		),
		categories: (
			<MultiChoice
				doneLabel={messages.quotes.done}
				initial={quoteSettings.categories}
				options={categoryOptionsOf(messages)}
				onDone={(selected) => {
					const categories = quoteCategories.filter((category) =>
						selected.includes(category),
					);
					updateQuotes({ categories }, `categories:${categories.join(",")}`);
				}}
			/>
		),
		excluded: (
			<MultiChoice
				doneLabel={messages.quotes.done}
				initial={quoteSettings.excluded}
				options={categoryOptionsOf(messages)}
				onDone={(selected) => {
					const excluded = quoteCategories.filter((category) =>
						selected.includes(category),
					);
					updateQuotes({ excluded }, `excluded:${excluded.join(",")}`);
				}}
			/>
		),
		author: (
			<AutocompleteInput
				initialValue={quoteSettings.author}
				placeholder={messages.quotes.authorPrompt}
				suggest={(text) =>
					quoteNames("author")
						.filter((author) =>
							author.toLowerCase().includes(text.trim().toLowerCase()),
						)
						.slice(0, 5)
						.map((label) => ({ label }))
				}
				onSubmit={(text) => {
					updateQuotes({ author: text.trim() }, `author:${text.trim()}`);
				}}
			/>
		),
		work: (
			<AutocompleteInput
				initialValue={quoteSettings.work}
				placeholder={messages.quotes.workPrompt}
				suggest={(text) =>
					quoteNames("work")
						.filter((work) =>
							work.toLowerCase().includes(text.trim().toLowerCase()),
						)
						.slice(0, 5)
						.map((label) => ({ label }))
				}
				onSubmit={(text) => {
					updateQuotes({ work: text.trim() }, `work:${text.trim()}`);
				}}
			/>
		),
	};

	const timerOptions = isIdle
		? [{ label: messages.timer.start, value: "start" }]
		: [
				{
					label: isRunning ? messages.timer.pause : messages.timer.resume,
					value: "toggle",
				},
				{ label: messages.timer.stop, value: "stop" },
			];

	const panels: Record<Exclude<View, "menu">, React.ReactNode> = {
		quotes: (
			<Titled title={messages.menu.quotes}>
				<Text dimColor italic wrap="truncate-end">
					{`“${shownQuote.quote}” — ${shownQuote.author}`}
				</Text>
				<Box marginTop={1}>
					{quoteEditor ? (
						<Box key={quoteEditor}>{quoteEditors[quoteEditor]}</Box>
					) : (
						<Choice
							key="options"
							initialValue={quoteOption}
							options={quoteOptionsOf(messages, quoteSettings)}
							onSelect={chooseQuoteOption}
						/>
					)}
				</Box>
			</Titled>
		),
		timer: (
			<Titled title={messages.menu.timer}>
				<Choice
					options={[
						...timerOptions,
						{ label: messages.timer.back, value: "back" },
					]}
					onSelect={chooseTimerAction}
				/>
			</Titled>
		),
		health: (
			<HealthPanel
				language={language}
				messages={messages}
				palette={palette}
				progress={progress}
				today={today}
				onSelect={chooseHealthAction}
			/>
		),
		logs: (
			<LogsView
				height={Math.max(rows - 9, 6)}
				language={language}
				logs={logs}
				messages={messages}
			/>
		),
		diet: (
			<EntryForm
				fields={dietFieldsOf(messages, language, progress.meals)}
				messages={messages}
				title={messages.form.dietTitle}
				onSubmit={submitMeal}
			/>
		),
		workout: (
			<EntryForm
				fields={workoutFieldsOf(messages, progress.workouts)}
				messages={messages}
				title={messages.form.workoutTitle}
				onSubmit={submitWorkout}
				onValues={(values) => {
					setDraftActivity(values.activity);
				}}
			/>
		),
		profile: (
			<EntryForm
				fields={profileFieldsOf(messages, progress.profile, name)}
				messages={messages}
				title={messages.form.profileTitle}
				onSubmit={submitProfile}
			/>
		),
		theme: (
			<Titled title={messages.menu.theme}>
				<Choice
					initialValue={themeName}
					options={themeNames.map((option) => ({
						label: messages.themes.names[option].padEnd(8),
						value: option,
						hint: <Swatches palette={themes[option]} />,
					}))}
					onFocus={(value) => {
						setPreviewTheme(pick(themeNames, value, themeName));
					}}
					onSelect={chooseTheme}
				/>
			</Titled>
		),
		language: (
			<Titled title={messages.menu.language}>
				<Choice
					initialValue={language}
					options={languageOptions}
					onSelect={chooseLanguage}
				/>
			</Titled>
		),
	};

	const preview = focusedEntry ? (
		<Box flexDirection="column">
			<Text bold color={palette.soft}>
				{focusedEntry.status}
			</Text>
			<Box marginTop={1}>
				<Text dimColor>{focusedEntry.description}</Text>
			</Box>
			<Box marginTop={1}>
				<Text dimColor italic>
					{messages.describe.open}
				</Text>
			</Box>
		</Box>
	) : null;

	const todayPanel = (
		<TodayPanel
			isCompact={layout.isTodayCompact}
			sections={sectionsOf(language, palette, progress, now)}
			title={messages.today.title}
			width={layout.todayWidth}
		/>
	);

	const recentBlock = (
		<Box
			borderColor={palette.border}
			borderStyle="round"
			flexDirection="column"
			flexShrink={0}
			paddingX={1}
		>
			<Text bold color={palette.soft}>
				{messages.recent.title}
			</Text>
			{logs.length === 0 ? <Text dimColor>{messages.recent.empty}</Text> : null}
			{logs.slice(0, recentCount).map((log) => (
				<LogRow
					key={`${log.kind}-${log.at}`}
					language={language}
					log={log}
					messages={messages}
				/>
			))}
		</Box>
	);

	return providers(
		<Box
			flexDirection="column"
			height={size.rows ? rows : undefined}
			overflow="hidden"
			width={columns}
		>
			<Box
				borderColor={palette.accent}
				borderStyle="round"
				flexDirection="column"
				flexShrink={0}
				paddingX={1}
			>
				<Box justifyContent="space-between">
					<Text bold color={palette.accent}>
						✻ Terminal Sigma
					</Text>
					<Text dimColor>{new Date(now).toTimeString().slice(0, 8)}</Text>
				</Box>
				<Text dimColor italic wrap="truncate-end">
					{`“${shownQuote.quote}” — ${shownQuote.author}`}
				</Text>
			</Box>

			<Box
				flexDirection={layout.stacked ? "column-reverse" : "row"}
				flexGrow={1}
			>
				{layout.showCharacter ? (
					<Character
						activity={activity}
						label={activityLabel}
						level={messages.level(level)}
						levelNumber={level}
						look={lookOf(progress.profile)}
						mood={mood}
						name={name}
						width={characterWidth}
					/>
				) : null}
				{layout.showToday && layout.todayBeside ? todayPanel : null}
				<Box flexDirection="column" width={layout.panelWidth}>
					<Box
						flexDirection={layout.isMenuSplit ? "row" : "column"}
						flexGrow={1}
					>
						<Box
							borderColor={view === "menu" ? palette.accent : palette.border}
							borderStyle="round"
							display={view === "logs" ? "none" : "flex"}
							flexShrink={0}
							paddingX={1}
							width={layout.isMenuSplit ? menuListWidth : undefined}
						>
							<Choice
								isNumbered
								initialValue={focusedMenu}
								isActive={view === "menu"}
								options={entries.map((entry) => ({
									label: entry.label,
									value: entry.key,
								}))}
								onFocus={(value) => {
									setFocusedMenu(pick(menuOrder, value, "quotes"));
								}}
								onSelect={openMenu}
							/>
						</Box>
						<Box
							borderColor={view === "menu" ? palette.border : palette.accent}
							borderStyle="round"
							flexDirection="column"
							flexGrow={1}
							overflow="hidden"
							paddingX={1}
						>
							{view === "menu" ? preview : panels[view]}
						</Box>
					</Box>
					{layout.showRecent && view !== "logs" ? recentBlock : null}
				</Box>
			</Box>
			{layout.showToday && !layout.todayBeside ? todayPanel : null}

			<Footer
				hint={hint}
				message={
					isIdle || isRunning
						? message.text
						: `${messages.timer.pausedAt(phaseLabel, clock)} · ${message.text}`
				}
				status={isRunning ? messages.timer.left(phaseLabel, clock) : undefined}
				tone={message.tone}
			/>
		</Box>,
	);
}

type HealthPanelProps = Readonly<{
	language: Language;
	messages: Messages;
	palette: Palette;
	progress: Progress;
	today: ReturnType<typeof todayOf>;
	onSelect: (action: string) => void;
}>;

function HealthPanel({
	language,
	messages,
	palette,
	progress,
	today,
	onSelect,
}: HealthPanelProps) {
	const { profile } = progress;
	const targets = targetsOf(profile);
	const { health } = messages;
	const options = [
		...(profile ? [] : [{ label: health.setUp, value: "profile" }]),
		{ label: health.logMeal, value: "diet" },
		{ label: health.logWorkout, value: "workout" },
		{ label: health.back, value: "back" },
	];

	return (
		<Box flexDirection="column">
			<Text bold color={palette.accent}>
				{profile
					? health.title(messages.goal[profile.goal])
					: messages.menu.health}
			</Text>
			<Text dimColor>
				{health.targets(
					formatNumber(language, targets.calories),
					targets.protein,
					targets.workoutMinutes,
				)}
			</Text>
			<Box flexDirection="column" marginY={1}>
				{profile ? null : <Text dimColor>{health.noProfile}</Text>}
				{adviceOf(profile, today, language, messages).map((advice) => (
					<Text key={advice.text}>
						<Text color={advice.isDone ? palette.success : palette.accent}>
							{"⏺ "}
						</Text>
						<Text>{advice.text}</Text>
					</Text>
				))}
				{profile ? (
					<Text dimColor italic>
						{health.tip[profile.goal]}
					</Text>
				) : null}
			</Box>
			<Choice options={options} onSelect={onSelect} />
		</Box>
	);
}
