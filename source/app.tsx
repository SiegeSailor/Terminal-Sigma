import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import process from "node:process";
import zod from "zod";
import React from "react";
import { ThemeProvider } from "@inkjs/ui";
import { Box, Text, useApp, useInput, useStdout, useWindowSize } from "ink";
import {
	accountsOf,
	aiAsker,
	type Asker,
	type AskReply,
	clearCooldown,
} from "./asker.js";
import {
	type Coach,
	type CoachKind,
	coachPathOf,
	contextOf,
	instructionsOf,
	loadCoach,
	type PlanReply,
	estimateSchema,
	planReplySchema,
	planTextOf,
	promptOf,
	recentTurnsOf,
	saveCoach,
	type Session,
	withTurns,
} from "./coach.js";
import AutocompleteInput from "./components/autocomplete-input.js";
import Character from "./components/character.js";
import Choice from "./components/choice.js";
import CoachView, {
	AccountsView,
	type CoachMode,
} from "./components/coach-view.js";
import EntryForm from "./components/entry-form.js";
import EnvironmentView from "./components/environment-view.js";
import Footer, { type Tone } from "./components/footer.js";
import Header from "./components/header.js";
import LogView from "./components/log-view.js";
import HistoryView, { LogRow } from "./components/history-view.js";
import MultiChoice from "./components/multi-choice.js";
import TodayPanel from "./components/today-panel.js";
import {
	type Account,
	type Config,
	type Environment,
	isReducedMotion,
	type Provider,
	providers as aiProviders,
	saveConfig,
	sourceOf,
	type VariableName,
	variableOf,
	variables,
	withVariable,
	writeVariable,
} from "./config.js";
import {
	accountFieldsOf,
	accountOf,
	activityOfKind,
	categoryOptionsOf,
	coachOptionsOf,
	characterWidth,
	intervalOptionsOf,
	layoutOf,
	type MenuKey,
	menuEntriesOf,
	menuListWidth,
	menuOrder,
	moodOf,
	movedAccounts,
	appearanceFieldsOf,
	appearanceOf,
	profileFieldsOf,
	quoteOptionsOf,
	type Release,
	sectionsOf,
	updateViewOf,
} from "./content.js";
import { adviceOf, targetsOf } from "./health.js";
import { streakOf } from "./insights.js";
import {
	formatNumber,
	genders,
	healthGoals,
	type Language,
	languages,
	type Messages,
	messagesOf,
	workStyles,
} from "./i18n.js";
import { type Activity, lookOf } from "./pixel-art.js";
import {
	signalClockOf,
	signalsOf,
	stageSignalsOf,
	strengthLoadOf,
} from "./signals.js";
import {
	type EventAction,
	experienceOf,
	levelOf,
	logsOf,
	type Log,
	type Progress,
	saveProgress,
	profileNow,
	todayOf,
} from "./progress.js";
import {
	type Added,
	applyDrafts,
	type Draft,
	draftOf,
	isEditable,
	lineOf,
	type MealDraft,
	restoreLog,
	summaryOf,
	undoAdded,
	withEstimate,
} from "./quick-log.js";
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
	spinnerFrames,
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
import type { Updater } from "./update.js";

export const optionsSchema = zod.object({
	name: zod.string().min(1).optional(),
	focus: zod.number().int().positive().default(25),
	break: zod.number().int().positive().default(5),
});

export type AppOptions = zod.infer<typeof optionsSchema>;

type AppProps = Readonly<{
	options: AppOptions;
	file: string;
	configFile: string;
	initialConfig: Config;
	// The live environment; tests pass their own so they never touch the real one.
	env?: Environment;
	initialProgress: Progress;
	updater: Updater;
	// Asks the Coach; tests pass a fake, so they never reach a provider.
	asker?: Asker;
}>;

type View = "menu" | MenuKey;
type QuoteEditor = "interval" | "categories" | "excluded" | "author" | "work";
type Flash = Readonly<{
	activity: Activity;
	until: number;
	experience: number;
}>;

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

const errorText = (error: unknown) =>
	error instanceof Error ? error.message : String(error);

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

export default function App({
	options,
	file,
	configFile,
	initialConfig,
	env = process.env,
	initialProgress,
	updater,
	asker = aiAsker,
}: AppProps) {
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
	const quoteOnScreen = React.useRef(quote);

	React.useEffect(() => {
		quoteOnScreen.current = quote;
	}, [quote]);

	const [view, setView] = React.useState<View>("menu");
	const [focusedMenu, setFocusedMenu] = React.useState<MenuKey>("log");
	const [quoteEditor, setQuoteEditor] = React.useState<QuoteEditor>();
	const [config, setConfig] = React.useState(initialConfig);
	const [variableEditor, setVariableEditor] = React.useState<VariableName>();
	// The list's cursor comes back to the row just edited.
	const [lastVariable, setLastVariable] = React.useState<VariableName>();
	const [quoteOption, setQuoteOption] = React.useState("draw");
	const [flash, setFlash] = React.useState<Flash>();
	// What each line logged in the open Log view added, newest last, for undo.
	const [undoStack, setUndoStack] = React.useState<Added[][]>([]);
	// A line the Log view starts from, with a counter that remounts it.
	const [draftLine, setDraftLine] =
		React.useState<Readonly<{ line: string; count: number }>>();
	// The text the Log view shows now, to tell whether an estimate is stale.
	const typed = React.useRef("");
	const reportTyped = React.useCallback((text: string) => {
		typed.current = text;
	}, []);
	// The log being edited in the Log view, and what History deleted, newest
	// last, for its undo.
	const [editing, setEditing] = React.useState<Log>();
	const [deleted, setDeleted] = React.useState<Log[]>([]);
	const language = progress.language ?? "en";
	const messages = messagesOf(language);
	const themeName = progress.theme ?? "ember";
	// While the theme picker is open, the focused theme previews live.
	const [previewTheme, setPreviewTheme] = React.useState<ThemeName>();
	const [profileSection, setProfileSection] = React.useState<
		"body" | "appearance"
	>();
	// The appearance options focused so far, previewed on the character.
	const [draftAppearance, setDraftAppearance] = React.useState<
		Record<string, string>
	>({});
	const coachPath = coachPathOf(file);
	// Coach.json loads once; an unreadable one turns the Coach off rather than
	// being overwritten.
	// eslint-disable-next-line react/hook-use-state -- loaded once, never set
	const [coachLoad] = React.useState(() => {
		try {
			return { coach: loadCoach(coachPath), error: undefined };
		} catch (error) {
			return { coach: undefined, error: errorText(error) };
		}
	});
	const [coach, setCoach] = React.useState(coachLoad.coach);
	const latestCoach = React.useRef(coach);
	const [coachMode, setCoachMode] = React.useState<
		CoachMode | "accounts" | "add"
	>("menu");
	const [chosenAccount, setChosenAccount] = React.useState<string>();
	const [draftProvider, setDraftProvider] = React.useState<Provider>();
	// The account being asked; the request's controller lives in a ref, since
	// xo's react-hooks/immutability rejects calling abort() on a state value.
	const [asking, setAsking] = React.useState<string>();
	const controller = React.useRef<AbortController>(undefined);

	// Ctrl+C unmounts the dashboard; a request still in flight must not outlive it.
	React.useEffect(
		() => () => {
			controller.current?.abort();
		},
		[],
	);
	const [pendingPlan, setPendingPlan] = React.useState<PlanReply>();
	// The Coach option the cursor was last on, so it comes back after a request.
	const [coachOption, setCoachOption] = React.useState("ask");

	React.useEffect(() => {
		latestCoach.current = coach;
	}, [coach]);

	const palette = themes[previewTheme ?? themeName];
	const uiTheme = React.useMemo(() => uiThemeOf(palette), [palette]);
	const name = options.name ?? progress.profile?.name ?? "Rook Sigma";
	const [message, setMessage] = React.useState<{ text: string; tone: Tone }>(
		() => ({
			text: messages.savedTo(file.replace(homedir(), "~")),
			tone: "info",
		}),
	);

	const [release, setRelease] = React.useState<Release>({ phase: "checking" });
	// The latest progress, for work that finishes long after it started.
	const latest = React.useRef(progress);

	React.useEffect(() => {
		latest.current = progress;
	}, [progress]);

	const lookUp = React.useCallback(
		async () =>
			updater.newest().then(
				(newest): Release => ({ phase: "ready", newest }),
				(error: unknown): Release => ({
					phase: "checkFailed",
					error: errorText(error),
				}),
			),
		[updater],
	);

	// Looks for an update once on start, so the menu can say there is one.
	React.useEffect(() => {
		let isCurrent = true;

		void lookUp().then((next) => {
			if (isCurrent) {
				setRelease(next);
			}
		});

		return () => {
			isCurrent = false;
		};
	}, [lookUp]);

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
			const before = experienceOf(progress);
			const gained = experienceOf(next) - before;
			const after = levelOf(before + gained);
			const leveledUp = after > levelOf(before);

			if (leveledUp) {
				next = withEvent(next, "levelUp", String(after));
			}

			const { form } = messagesOf(next.language ?? "en");
			const isSaved = commit(
				next,
				leveledUp ? `${text} ${form.levelUp(after)}` : text,
				"success",
			);

			if (isSaved) {
				setFlash({
					activity: leveledUp ? "levelUp" : activity,
					until: Date.now() + flashMilliseconds,
					experience: gained,
				});
			}

			return isSaved;
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
			const next = await fetchQuote(
				quoteSettings,
				env.API_NINJAS_KEY,
				quoteOnScreen.current,
			);

			if (isMounted) {
				setQuote(next);
			}
		};

		// The bundled quote shown first is already fresh; only the API is worth a call.
		if (hasQuoteApi(env)) {
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
	}, [quoteSettings, env]);

	const backToMenu = (text?: string) => {
		setView("menu");
		setQuoteEditor(undefined);
		setVariableEditor(undefined);
		setUndoStack([]);
		setEditing(undefined);
		setDeleted([]);
		setPreviewTheme(undefined);
		setProfileSection(undefined);
		setDraftAppearance({});
		setCoachMode("menu");
		setChosenAccount(undefined);
		setDraftProvider(undefined);
		setPendingPlan(undefined);
		setDraftLine(undefined);
		controller.current?.abort();
		setAsking(undefined);

		if (text) {
			say(text);
		}
	};

	// Esc in the Coach cancels the request, or steps back 1 level.
	const coachBack = () => {
		if (asking !== undefined) {
			controller.current?.abort();
			setAsking(undefined);
			say(messages.coach.cancelled);
		} else if (chosenAccount === undefined && coachMode !== "add") {
			setCoachMode("menu");
		} else {
			setChosenAccount(undefined);
			setDraftProvider(undefined);
			setCoachMode("accounts");
		}
	};

	useInput(
		(input, key) => {
			if (view === "menu" && input === "q") {
				exit();
			} else if (view === "quotes" && quoteEditor && key.escape) {
				setQuoteEditor(undefined);
			} else if (view === "environment" && variableEditor && key.escape) {
				setVariableEditor(undefined);
			} else if (view === "log" && editing && key.escape) {
				setEditing(undefined);
				setView("logs");
			} else if (
				view === "coach" &&
				key.escape &&
				(asking !== undefined || coachMode !== "menu")
			) {
				coachBack();
			} else if (view !== "menu" && key.escape) {
				backToMenu(view === "profile" ? messages.form.cancelled : undefined);
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

	const accounts = accountsOf(config, env);
	const session = coach?.sessions.at(-1);
	const experience = React.useMemo(() => experienceOf(progress), [progress]);
	const logs = React.useMemo(() => logsOf(progress), [progress]);
	const signalClock = signalClockOf(now);
	const signals = React.useMemo(
		() => signalsOf(progress, signalClock, logs),
		[progress, signalClock, logs],
	);
	// The streak only changes with the data or the day.
	const dayKey = new Date(now).toDateString();
	const streak = React.useMemo(
		() => streakOf(progress, now),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[progress, dayKey],
	);
	const strengthLoad = React.useMemo(
		() => strengthLoadOf(progress, signalClock),
		[progress, signalClock],
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

	// Saves what 1 line logged, says what and how much XP it earned, and keeps
	// it for undo; a goal is logged as an event instead.
	const logLine = (_line: string, drafts: Draft[], isUndoable = true) => {
		const { next, added } = applyDrafts(progress, drafts);
		let withGoals = next;

		for (const draft of drafts) {
			if (draft.kind === "goal") {
				withGoals = withEvent(
					withGoals,
					"goalChanged",
					`${draft.goal}:${draft.value}`,
				);
			}
		}

		const [first] = drafts;
		let activity: Activity = "idle";

		if (first?.kind === "workout") {
			activity = workoutAnimation(first.activity);
		} else if (first && first.kind !== "goal") {
			activity = activityOfKind(first.kind);
		}

		const isSaved = record(
			() => withGoals,
			messages.log.logged(
				summaryOf(drafts, messages),
				experienceOf(next) - experienceOf(progress),
				isUndoable && added.length > 0,
			),
			activity,
		);

		// A goal-only line keeps an empty frame, so undo stops at it instead of
		// reaching the line before; a goal is changed back by typing it.
		if (isSaved && drafts.length > 0) {
			setUndoStack((stack) => [...stack, added]);
		}

		return isSaved;
	};

	// Takes back the newest line logged since the Log view opened.
	const undoLine = () => {
		const added = undoStack.at(-1);

		if (!added?.length) {
			say(messages.log.nothingToUndo);
			return;
		}

		const next = withEvent(
			undoAdded(progress, added),
			"logDeleted",
			added[0]?.kind,
		);

		if (commit(next, messages.log.undone, "success")) {
			setUndoStack((stack) => stack.slice(0, -1));
		}
	};

	// Focus sessions come from the timer and actions are the record of what
	// was done, so History changes neither.
	const isFixed = (log: Log) => log.kind === "focus" || log.kind === "event";

	const startEdit = (log: Log) => {
		if (isFixed(log)) {
			say(messages.logs.cannotEdit);
			return;
		}

		if (!isEditable(log, progress, language)) {
			say(messages.logs.cannotEditLine);
			return;
		}

		setEditing(log);
		setView("log");
	};

	// Swaps the edited log for what its line now says, at its own time.
	// ponytail: the edited entry is appended to its array, so a same-timestamp
	// tie can change order; reinsert at the entry's index if that order matters.
	const replaceLog = (_line: string, drafts: Draft[]) => {
		if (!editing) {
			return false;
		}

		if (
			drafts.length === 0 ||
			drafts.some((draft) => draft.kind !== editing.kind)
		) {
			say(messages.logs.mustKeepKind);
			return false;
		}

		const { next } = applyDrafts(undoAdded(progress, [editing]), drafts);
		const isSaved = commit(
			withEvent(next, "logEdited", editing.kind),
			messages.log.edited(summaryOf(drafts, messages)),
			"success",
		);

		if (isSaved) {
			setEditing(undefined);
			setDeleted([]);
			setView("logs");
		}

		return isSaved;
	};

	const deleteLog = (log: Log) => {
		if (isFixed(log)) {
			say(messages.logs.cannotEdit);
			return;
		}

		if (
			commit(
				withEvent(undoAdded(progress, [log]), "logDeleted", log.kind),
				messages.logs.deleted,
				"success",
			)
		) {
			setDeleted((stack) => [...stack, log]);
		}
	};

	const restoreDeleted = () => {
		const log = deleted.at(-1);

		if (!log) {
			say(messages.log.nothingToUndo);
			return;
		}

		if (
			commit(
				withEvent(restoreLog(progress, log), "logEdited", log.kind),
				messages.logs.restored,
				"success",
			)
		) {
			setDeleted((stack) => stack.slice(0, -1));
		}
	};

	const repeatLog = (log: Log) => {
		const draft = draftOf(log);

		if (draft) {
			// History's u only puts back deletes, so the message skips the hint.
			logLine("", [{ ...draft, at: new Date().toISOString() }], false);
		} else {
			say(messages.logs.cannotEdit);
		}
	};

	const submitProfile = (values: Record<string, string>) => {
		const next = withEvent(
			{
				...progress,
				profile: {
					...progress.profile,
					name: values.name ?? name,
					age: Number(values.age),
					height: Number(values.height),
					weight: Number(values.weight),
					...(values.bodyFat ? { bodyFat: Number(values.bodyFat) } : {}),
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

	const submitAppearance = (values: Record<string, string>) => {
		if (!progress.profile) {
			return;
		}

		const next = withEvent(
			{
				...progress,
				profile: { ...progress.profile, ...appearanceOf(values) },
			},
			"appearanceSaved",
		);

		if (commit(next)) {
			backToMenu(messages.appearance.saved);
		}
	};

	const chooseTheme = (value: string) => {
		const next: ThemeName = pick(themeNames, value, "ember");

		if (commit(withEvent({ ...progress, theme: next }, "themeChanged", next))) {
			backToMenu(messages.themes.changed(messages.themes.names[next]));
		}
	};

	// Saves 1 variable to config.json and the live environment, unless the shell
	// set it, and logs only its name: the value may be a secret.
	const changeVariable = (name: VariableName, value: string | undefined) => {
		const next = withVariable(config, name, value);
		const isShells = sourceOf(name, config, env) === "shell";

		try {
			saveConfig(configFile, next);
		} catch (error) {
			say(messages.notSaved(String(error)), "error");
			return;
		}

		if (!isShells) {
			writeVariable(env, name, value);
		}

		// A shell key's account is named after its variable; a fixed key is tried at once.
		for (const account of accounts) {
			if (account.label === name) {
				clearCooldown(account.id);
			}
		}

		setConfig(next);
		setVariableEditor(undefined);
		const { environment } = messages;
		let text = environment.cleared;

		if (value !== undefined) {
			text = variableOf(name)?.needsRestart
				? environment.savedRestart
				: environment.saved;
		}

		commit(
			withEvent(
				progress,
				value === undefined ? "variableCleared" : "variableSaved",
				name,
			),
			text,
			"success",
		);
	};

	const saveCoachState = (next: Coach) => {
		try {
			saveCoach(coachPath, next);
		} catch (error) {
			say(messages.notSaved(errorText(error)), "error");
			return false;
		}

		setCoach(next);
		return true;
	};

	// Keeps the answer, or says why there is none.
	const finishAsking = (
		kind: CoachKind,
		reply: AskReply,
		current: Session,
		question: Session["turns"][number],
	) => {
		setAsking(undefined);
		const words = messagesOf(latest.current.language ?? "en");

		if (!reply.ok) {
			const reasons = reply.attempts
				.map((attempt) =>
					words.coach.reason(
						attempt.account.label,
						words.coach.failures[attempt.failure?.kind ?? "network"],
					),
				)
				.join(", ");
			say(words.coach.allFailed(reasons), "error");
			return;
		}

		let content = typeof reply.result === "string" ? reply.result : "";

		if (kind === "plan") {
			const plan = planReplySchema.safeParse(reply.result);

			if (!plan.success) {
				say(words.coach.unreadablePlan, "error");
				return;
			}

			setPendingPlan(plan.data);
			content = planTextOf(plan.data, latest.current.language ?? "en", words);
		}

		const base = latestCoach.current;

		if (!base) {
			return;
		}

		saveCoachState(
			withTurns(base, current, [
				question,
				{
					role: "assistant",
					content,
					at: new Date().toISOString(),
					via: reply.account.label,
				},
			]),
		);

		const failed = reply.attempts
			.filter((attempt) => attempt.failure)
			.map((attempt) => attempt.account.label);
		say(
			failed.length > 0
				? words.coach.fellBack(failed.join(", "), reply.account.label)
				: words.coach.answered(reply.account.label),
			failed.length > 0 ? "info" : "success",
		);
	};

	const askCoach = (kind: Exclude<CoachKind, "estimate">, text = "") => {
		const [first] = accounts;

		if (!coach || !first) {
			return;
		}

		const at = new Date().toISOString();
		const current = coach.sessions.at(-1) ?? {
			id: randomUUID(),
			startedAt: at,
			turns: [],
		};
		const question = {
			role: "user" as const,
			content: kind === "chat" ? text : promptOf(kind, messages),
			at,
		};
		const aborter = new AbortController();
		controller.current = aborter;
		setAsking(first.label);
		commit(withEvent(progress, "coachAsked", kind));

		void asker({
			accounts,
			kind,
			env,
			schema: kind === "plan" ? planReplySchema : undefined,
			sessionId: current.id,
			signal: aborter.signal,
			instructions: instructionsOf(
				language,
				contextOf(latest.current, Date.now()),
			),
			turns: [
				...recentTurnsOf(current),
				{ role: "user", content: question.content },
			],
			onAttempt(account) {
				if (!aborter.signal.aborted) {
					setAsking(account.label);
				}
			},
		}).then(
			(reply) => {
				// After Esc, no late answer may reach the screen.
				if (!aborter.signal.aborted) {
					finishAsking(kind, reply, current, question);
				}
			},
			// The asker never rejects, but a rejection must not leave the spinner on.
			(error: unknown) => {
				if (!aborter.signal.aborted) {
					setAsking(undefined);
					say(messages.coach.allFailed(errorText(error)), "error");
				}
			},
		);
	};

	// Asks for 1 serving of a food nobody knows, and puts the totals into the
	// line for the user to check and log; nothing is logged on a guess.
	const estimateFood = (line: string, draft: MealDraft) => {
		const [first] = accounts;

		if (!first) {
			say(messages.log.estimateNeedsAccount);
			return;
		}

		// A newer Tab replaces an estimate still in flight.
		controller.current?.abort();
		const aborter = new AbortController();
		controller.current = aborter;
		setAsking(first.label);
		commit(
			withEvent(progress, "coachAsked", "estimate"),
			messages.coach.asking(first.label),
		);

		void asker({
			accounts,
			kind: "estimate",
			env,
			schema: estimateSchema,
			sessionId: "estimate",
			signal: aborter.signal,
			instructions: instructionsOf(
				language,
				contextOf(latest.current, Date.now()),
			),
			turns: [
				{ role: "user", content: promptOf("estimate", messages, draft.food) },
			],
			onAttempt(account) {
				if (!aborter.signal.aborted) {
					setAsking(account.label);
				}
			},
		}).then(
			(reply) => {
				if (aborter.signal.aborted) {
					return;
				}

				setAsking(undefined);
				const words = messagesOf(latest.current.language ?? "en");
				const estimate = reply.ok
					? estimateSchema.safeParse(reply.result)
					: undefined;
				if (typed.current !== line) {
					say(words.log.estimateStale, "error");
					return;
				}

				const filled =
					reply.ok && estimate?.success
						? withEstimate(line, draft, estimate.data, {
								progress: latest.current,
								now: Date.parse(draft.at),
								language: latest.current.language ?? "en",
							})
						: undefined;

				if (!reply.ok || filled === undefined) {
					say(words.log.estimateFailed, "error");
					return;
				}

				setDraftLine((current) => ({
					line: filled,
					count: (current?.count ?? 0) + 1,
				}));
				say(words.log.estimated(reply.account.label), "success");
			},
			() => {
				// The asker never rejects, but a rejection must not leave the spinner on.
				if (!aborter.signal.aborted) {
					setAsking(undefined);
					say(
						messagesOf(latest.current.language ?? "en").log.estimateFailed,
						"error",
					);
				}
			},
		);
	};

	const savePlan = () => {
		if (!pendingPlan) {
			return;
		}

		const next = withEvent(
			{
				...progress,
				plans: [
					...progress.plans,
					{ at: new Date().toISOString(), ...pendingPlan },
				],
			},
			"planSaved",
		);

		if (commit(next, messages.coach.planSaved, "success")) {
			setPendingPlan(undefined);
		}
	};

	const startConversation = () => {
		if (!coach) {
			return;
		}

		const fresh = {
			id: randomUUID(),
			startedAt: new Date().toISOString(),
			turns: [],
		};

		if (saveCoachState({ sessions: [...coach.sessions, fresh] })) {
			setPendingPlan(undefined);
			commit(
				withEvent(progress, "conversationStarted"),
				messages.coach.started,
			);
		}
	};

	const chooseCoachOption = (value: string) => {
		setCoachOption(value);

		switch (value) {
			case "ask": {
				setCoachMode("ask");
				break;
			}

			case "today":
			case "week":
			case "plan": {
				askCoach(value);
				break;
			}

			case "savePlan": {
				savePlan();
				break;
			}

			case "read": {
				setCoachMode("read");
				break;
			}

			case "fresh": {
				startConversation();
				break;
			}

			case "accounts": {
				setCoachMode("accounts");
				break;
			}

			default: {
				backToMenu();
			}
		}
	};

	// Saves the accounts to config.json, then logs which provider changed.
	const changeAccounts = (
		next: readonly Account[],
		action: "accountAdded" | "accountMoved" | "accountRemoved",
		provider: Provider,
		text: string,
	) => {
		const nextConfig = { ...config, accounts: [...next] };

		try {
			saveConfig(configFile, nextConfig);
		} catch (error) {
			say(messages.notSaved(errorText(error)), "error");
			return;
		}

		setConfig(nextConfig);
		commit(withEvent(progress, action, provider), text, "success");
	};

	const submitAccount = (values: Record<string, string>) => {
		const account = accountOf(values, randomUUID());
		setDraftProvider(undefined);
		setCoachMode("accounts");

		if (!account) {
			say(messages.accounts.invalid, "error");
			return;
		}

		changeAccounts(
			[...config.accounts, account],
			"accountAdded",
			account.provider,
			messages.accounts.added(account.label),
		);
	};

	const chooseAccountAction = (action: "up" | "down" | "remove" | "back") => {
		const account = config.accounts.find((known) => known.id === chosenAccount);
		setChosenAccount(undefined);

		if (!account || action === "back") {
			return;
		}

		// A changed account is tried again at once, whatever failed before.
		clearCooldown(account.id);

		if (action === "remove") {
			changeAccounts(
				config.accounts.filter((known) => known.id !== account.id),
				"accountRemoved",
				account.provider,
				messages.accounts.removed(account.label),
			);
		} else {
			changeAccounts(
				movedAccounts(config.accounts, account.id, action === "up" ? -1 : 1),
				"accountMoved",
				account.provider,
				messages.accounts.moved,
			);
		}
	};

	const drawQuote = (settings: QuoteSettings, base: Progress) => {
		void fetchQuote(settings, env.API_NINJAS_KEY, quoteOnScreen.current).then(
			setQuote,
		);
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
			setQuote(
				pickBundled(settings, Date.now(), Math.random(), quoteOnScreen.current),
			);
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

	const checkForUpdate = () => {
		if (release.phase === "installed") {
			return;
		}

		setRelease({ phase: "checking" });
		void lookUp().then(setRelease);
	};

	const chooseUpdateAction = (value: string) => {
		const { newest } = release;

		if (value === "install" && newest) {
			setRelease({ phase: "installing", newest });
			updater.install(newest).then(
				() => {
					setRelease({ phase: "installed", newest });
					const { current } = latest;
					commit(
						withEvent(current, "updateInstalled", newest),
						messagesOf(current.language ?? "en").update.installed(newest),
						"success",
					);
				},
				(error: unknown) => {
					setRelease({
						phase: "installFailed",
						newest,
						error: errorText(error),
					});
				},
			);
		} else if (value === "restart") {
			updater.restart();
			exit();
		} else if (value === "check") {
			checkForUpdate();
		} else {
			backToMenu();
		}
	};

	const openMenu = (value: string) => {
		const item = pick(menuOrder, value, "timer");
		setFocusedMenu(item);
		setView(item);

		if (item === "theme") {
			setPreviewTheme(themeName);
		}

		if (item === "update" && release.phase !== "installing") {
			checkForUpdate();
		}
	};

	const level = levelOf(experience);
	const today = todayOf(progress, now);
	const columns = size.columns || 100;
	const rows = size.rows || 40;
	const layout = layoutOf(columns, rows);
	const mood = moodOf(progress, now);
	const savedProfile = profileNow(progress);
	const shownProfile = savedProfile
		? { ...savedProfile, ...appearanceOf(draftAppearance) }
		: undefined;

	const activity: Activity =
		flash && flash.until > now
			? flash.activity
			: isRunning
				? ({ focus: "focus", break: "break" } as const)[timer.phase]
				: "idle";

	let activityLabel = messages.activity[activity];

	if (activity === "idle") {
		activityLabel = messages.mood[mood];
	} else if (activity === "levelUp") {
		activityLabel = `${messages.activity.levelUp} ${messages.level(level)}`;
	}

	if (flash && flash.until > now && flash.experience > 0) {
		activityLabel = `${activityLabel} ${messages.gained(flash.experience)}`;
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
		logs,
		theme: themeName,
		focus: durations.focus,
		rest: durations.break,
		version: updater.current,
		newest: release.newest,
		savedVariables: variables.filter(
			({ name }) => config.env[name] !== undefined,
		).length,
		accounts: accounts.length,
	});
	const profilePanel = () => {
		if (profileSection === "body") {
			return (
				<EntryForm
					key="body"
					fields={profileFieldsOf(messages, profileNow(progress), name)}
					messages={messages}
					title={messages.form.profileTitle}
					onSubmit={submitProfile}
				/>
			);
		}

		if (profileSection === "appearance") {
			return (
				<EntryForm
					key="appearance"
					fields={appearanceFieldsOf(messages, progress.profile)}
					messages={messages}
					title={messages.appearance.title}
					onFocus={(key, value) => {
						setDraftAppearance((current) => ({ ...current, [key]: value }));
					}}
					onSubmit={submitAppearance}
				/>
			);
		}

		return (
			<Titled title={messages.menu.profile}>
				<Choice
					key="sections"
					options={[
						{ label: messages.profileSections.body, value: "body" },
						{ label: messages.profileSections.appearance, value: "appearance" },
						{ label: messages.profileSections.back, value: "back" },
					]}
					onSelect={(value) => {
						if (value === "back") {
							backToMenu();
						} else if (value === "appearance" && progress.profile) {
							setProfileSection("appearance");
						} else {
							if (value === "appearance") {
								say(messages.appearance.needsProfile, "error");
							}

							setProfileSection("body");
						}
					}}
				/>
			</Titled>
		);
	};

	const coachPanel = () => {
		if (coachLoad.error) {
			return (
				<Titled title={messages.menu.coach}>
					<Text color={palette.error}>
						{messages.coach.broken(coachLoad.error)}
					</Text>
				</Titled>
			);
		}

		if (coachMode === "add") {
			return (
				<EntryForm
					key="add"
					fields={accountFieldsOf(messages, draftProvider)}
					messages={messages}
					title={messages.accounts.add}
					onSubmit={submitAccount}
					onValues={(values) => {
						setDraftProvider(
							aiProviders.find((provider) => provider === values.provider),
						);
					}}
				/>
			);
		}

		if (coachMode === "accounts") {
			return (
				<AccountsView
					key={chosenAccount ?? "list"}
					accounts={accounts}
					messages={messages}
					savedIds={new Set(config.accounts.map((account) => account.id))}
					selected={chosenAccount}
					onAction={chooseAccountAction}
					onSelect={(value) => {
						if (value === "add") {
							setCoachMode("add");
						} else if (value === "back") {
							setCoachMode("menu");
						} else if (
							config.accounts.some((account) => account.id === value)
						) {
							setChosenAccount(value);
						} else {
							say(messages.accounts.fromShell);
						}
					}}
				/>
			);
		}

		return (
			<CoachView
				key={coachMode}
				asking={asking}
				height={Math.max(rows - 9, 6)}
				initialOption={coachOption}
				isSetUp={accounts.length > 0}
				messages={messages}
				mode={coachMode}
				options={coachOptionsOf(messages, {
					isSetUp: accounts.length > 0,
					hasPlan: pendingPlan !== undefined,
					hasTurns: (session?.turns.length ?? 0) > 0,
					accounts: accounts.length,
				})}
				session={session}
				onAsk={(text) => {
					setCoachMode("menu");
					askCoach("chat", text);
				}}
				onSelect={chooseCoachOption}
			/>
		);
	};

	const focusedEntry =
		entries.find((entry) => entry.key === focusedMenu) ?? entries[0];

	// The keys of the open view; any view not named here picks from a list.
	const hints: Partial<Record<View, string>> = {
		menu: messages.hints.menu,
		log: messages.hints.log,
		logs: messages.hints.logs,
		profile: profileSection ? messages.hints.form : messages.hints.select,
		environment: variableEditor
			? messages.hints.edit
			: messages.hints.environment,
		quotes:
			quoteEditor === "author" || quoteEditor === "work"
				? messages.hints.suggest
				: undefined,
		coach: asking
			? messages.hints.asking
			: {
					menu: messages.hints.coach,
					ask: messages.hints.ask,
					read: messages.hints.read,
					accounts: messages.hints.coach,
					add: messages.hints.form,
				}[coachMode],
	};
	const hint = hints[view] ?? messages.hints.select;

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

	const updateView = updateViewOf(messages, release, updater);

	const panels: Record<Exclude<View, "menu">, React.ReactNode> = {
		update: (
			<Titled title={messages.menu.update}>
				<Text>{messages.update.current(updater.current)}</Text>
				<Text
					color={
						release.phase.endsWith("Failed") ? palette.error : palette.soft
					}
				>
					{updateView.status}
				</Text>
				<Text dimColor>{messages.update.via[updater.source]}</Text>
				<Box marginTop={1}>
					{release.phase === "installing" ? (
						<Text color={palette.accent}>
							{`${spinnerFrames[Math.floor(now / 1000) % spinnerFrames.length] ?? "·"} ${updateView.status}`}
						</Text>
					) : (
						<Choice
							key={release.phase}
							options={updateView.options}
							onSelect={chooseUpdateAction}
						/>
					)}
				</Box>
			</Titled>
		),
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
		logs: (
			<HistoryView
				height={Math.max(rows - 9, 6)}
				language={language}
				logs={logs}
				messages={messages}
				now={now}
				progress={progress}
				onDelete={deleteLog}
				onEdit={startEdit}
				onRepeat={repeatLog}
				onUndo={restoreDeleted}
			/>
		),
		log: (
			<LogView
				key={
					editing
						? `edit-${editing.kind}-${editing.index}`
						: `log-${draftLine?.count ?? 0}`
				}
				canEstimate={accounts.length > 0}
				draftLine={editing ? undefined : draftLine?.line}
				initialLine={editing ? lineOf(editing, language) : undefined}
				language={language}
				messages={messages}
				now={editing ? Date.parse(editing.at) : now}
				progress={progress}
				onEstimate={editing ? undefined : estimateFood}
				onLog={editing ? replaceLog : logLine}
				onTextChange={reportTyped}
				onUndo={undoLine}
			/>
		),
		profile: profilePanel(),
		coach: coachPanel(),
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
		environment: (
			<EnvironmentView
				key={variableEditor ?? "list"}
				config={config}
				editing={variableEditor}
				env={env}
				height={Math.max(rows - 9, 6)}
				initialValue={lastVariable}
				messages={messages}
				onChange={changeVariable}
				onEdit={(name) => {
					setLastVariable(name);
					setVariableEditor(name);
				}}
			/>
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
		<Box flexDirection="column" flexShrink={0}>
			<Text bold color={palette.soft}>
				{focusedEntry.status}
			</Text>
			<Box marginTop={1}>
				<Text dimColor>{focusedEntry.description}</Text>
			</Box>
			{focusedEntry.key === "log" ? (
				<HealthSummary
					language={language}
					messages={messages}
					palette={palette}
					progress={progress}
					today={today}
				/>
			) : null}
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
			isReduced={isReducedMotion(env)}
			sections={sectionsOf(language, palette, progress, now, experience)}
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
					key={`${log.kind}-${log.index}`}
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
			<Header
				clock={new Date(now).toTimeString().slice(0, 8)}
				freshLabel={messages.quotes.fresh}
				isReduced={isReducedMotion(env)}
				line={`“${shownQuote.quote}” — ${shownQuote.author}`}
				quoteKey={`${quote.quote}|${quote.author}`}
			/>

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
						streak={streak >= 2 ? messages.streak(streak) : undefined}
						look={lookOf(shownProfile, strengthLoad)}
						mood={mood}
						signals={stageSignalsOf(signals, isReducedMotion(env))}
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
							// The Log, History, Environment, and Coach views need the width more than the menu.
							display={
								view === "log" ||
								view === "logs" ||
								view === "environment" ||
								view === "coach"
									? "none"
									: "flex"
							}
							flexShrink={0}
							paddingX={1}
							width={layout.isMenuSplit ? menuListWidth : undefined}
						>
							<Choice
								isNumbered
								initialValue={focusedMenu}
								isActive={view === "menu"}
								options={entries.map((entry) => ({
									group: layout.isMenuGrouped ? entry.group : undefined,
									label: entry.label,
									value: entry.key,
								}))}
								onFocus={(value) => {
									setFocusedMenu(pick(menuOrder, value, "timer"));
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
					{layout.showRecent &&
					view !== "logs" &&
					view !== "environment" &&
					view !== "coach"
						? recentBlock
						: null}
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

type HealthSummaryProps = Readonly<{
	language: Language;
	messages: Messages;
	palette: Palette;
	progress: Progress;
	today: ReturnType<typeof todayOf>;
}>;

// Today's targets and what is left of them, under the Log item.
function HealthSummary({
	language,
	messages,
	palette,
	progress,
	today,
}: HealthSummaryProps) {
	const profile = profileNow(progress);
	const targets = targetsOf(profile, progress.goals);
	const { health } = messages;

	return (
		<Box flexDirection="column" marginTop={1}>
			<Text bold color={palette.soft}>
				{profile ? health.title(messages.goal[profile.goal]) : health.noProfile}
			</Text>
			<Text dimColor>
				{health.targets(
					formatNumber(language, targets.calories),
					targets.protein,
					targets.workoutMinutes,
				)}
			</Text>
			{adviceOf(profile, today, language, messages, progress.goals).map(
				(advice) => (
					<Text key={advice.text}>
						<Text color={advice.isDone ? palette.success : palette.accent}>
							{"⏺ "}
						</Text>
						<Text>{advice.text}</Text>
					</Text>
				),
			)}
		</Box>
	);
}
