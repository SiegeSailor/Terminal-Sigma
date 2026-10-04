import { homedir } from "node:os";
import zod from "zod";
import React from "react";
import { ThemeProvider } from "@inkjs/ui";
import { Box, Text, useApp, useInput, useStdout, useWindowSize } from "ink";
import Character from "./components/character.js";
import Choice from "./components/choice.js";
import EntryForm from "./components/entry-form.js";
import Footer, { type Tone } from "./components/footer.js";
import LogsView, { LogRow } from "./components/logs-view.js";
import MenuGrid from "./components/menu-grid.js";
import TodayPanel from "./components/today-panel.js";
import {
	characterWidth,
	dietFieldsOf,
	layoutOf,
	menuItemsOf,
	menuOrder,
	profileFieldsOf,
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
import type { Activity } from "./pixel-art.js";
import {
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
	fetchQuote,
	hasQuoteApi,
	localizedQuote,
	type Quote,
	quoteRefreshMinutes,
	randomBundledQuote,
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

type View =
	| "menu"
	| "timer"
	| "health"
	| "diet"
	| "workout"
	| "logs"
	| "profile"
	| "theme"
	| "language";
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
	const [quote, setQuote] = React.useState<Quote>(randomBundledQuote);
	const [view, setView] = React.useState<View>("menu");
	const [flash, setFlash] = React.useState<Flash>();
	const [draftActivity, setDraftActivity] = React.useState<string>();
	const language = progress.language ?? "en";
	const messages = messagesOf(language);
	const themeName = progress.theme ?? "ember";
	const palette = themes[themeName];
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
	const save = React.useCallback(
		(next: Progress) => {
			try {
				saveProgress(file, next);
				return true;
			} catch (error) {
				setMessage({
					text: messagesOf(next.language ?? "en").notSaved(String(error)),
					tone: "error",
				});
				return false;
			}
		},
		[file],
	);

	const record = React.useCallback(
		(
			update: (current: Progress) => Progress,
			text: string,
			activity: Activity,
		) => {
			const next = update(progress);

			if (!save(next)) {
				return;
			}

			const after = levelOf(experienceOf(next));
			const leveledUp = after > levelOf(experienceOf(progress));
			setProgress(next);
			setMessage({
				text: leveledUp
					? `${text} ${messagesOf(next.language ?? "en").form.levelUp(after)}`
					: text,
				tone: "success",
			});
			setFlash({
				activity: leveledUp ? "levelUp" : activity,
				until: Date.now() + flashMilliseconds,
			});
		},
		[progress, save],
	);

	React.useEffect(() => {
		const interval = setInterval(() => {
			setNow(Date.now());
		}, 1000);

		return () => {
			clearInterval(interval);
		};
	}, []);

	React.useEffect(() => {
		const { timer: next, finished } = advanceTimer(timer, now, durations);

		if (!finished) {
			return;
		}

		const { timer: words } = messagesOf(language);
		setTimer(next);
		stdout.write("\u0007");

		if (finished === "break") {
			setMessage({ text: words.breakOver, tone: "info" });
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
	}, [now, timer, durations, record, stdout, language]);

	React.useEffect(() => {
		let isMounted = true;
		const refresh = async () => {
			const next = await fetchQuote();

			if (isMounted) {
				setQuote(next);
			}
		};

		// The bundled quote shown first is already fresh; only the API is worth a call.
		if (hasQuoteApi()) {
			void refresh();
		}

		const interval = setInterval(() => {
			void refresh();
		}, quoteRefreshMinutes * 60_000);

		return () => {
			isMounted = false;
			clearInterval(interval);
		};
	}, []);

	const backToMenu = (text?: string) => {
		setView("menu");
		setDraftActivity(undefined);

		if (text) {
			say(text);
		}
	};

	useInput(
		(input, key) => {
			if (view === "menu" && input === "q") {
				exit();
			} else if (view !== "menu" && key.escape) {
				const isForm = ["diet", "workout", "profile"].includes(view);
				backToMenu(isForm ? messages.form.cancelled : undefined);
			}
		},
		{ isActive: progress.language !== undefined },
	);

	const saveSetting = (next: Progress, text: string) => {
		if (save(next)) {
			setProgress(next);
			backToMenu(text);
		}
	};

	const chooseLanguage = (value: string) => {
		const next = pick(languages, value, "en");
		saveSetting(
			{ ...progress, language: next },
			messagesOf(next).languageChanged,
		);
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

	const selectMenu = (index: number) => {
		const item = menuOrder[index];

		if (item === "timer" && isIdle) {
			setTimer(toggleTimer(timer, Date.now()));
			say(messages.timer.started);
		} else if (item === "quotes") {
			void fetchQuote().then(setQuote);
			say(messages.quoteDrawn);
		} else if (item) {
			setView(item);
		}
	};

	const chooseTimerAction = (action: string) => {
		if (action === "toggle") {
			setTimer(toggleTimer(timer, Date.now()));
			backToMenu(isRunning ? messages.timer.paused : messages.timer.resumed);
		} else if (action === "stop") {
			setTimer(idleTimer(durations));
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
		saveSetting(
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
			messages.form.profileSaved,
		);
	};

	const chooseTheme = (value: string) => {
		const next: ThemeName = pick(themeNames, value, "ember");
		saveSetting(
			{ ...progress, theme: next },
			messages.themes.changed(messages.themes.names[next]),
		);
	};

	const experience = experienceOf(progress);
	const level = levelOf(experience);
	const today = todayOf(progress, now);
	const logs = logsOf(progress);
	const columns = size.columns || 100;
	const rows = size.rows || 40;
	const layout = layoutOf(columns, rows);

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

	let timerSignal = isRunning ? clock : messages.signal.paused;

	if (isIdle) {
		timerSignal = messages.signal.ready;
	}

	const hints: Record<View, string> = {
		menu: messages.hints.menu,
		logs: messages.hints.logs,
		diet: messages.hints.form,
		workout: messages.hints.form,
		profile: messages.hints.form,
		timer: messages.hints.select,
		health: messages.hints.select,
		theme: messages.hints.select,
		language: messages.hints.select,
	};

	const panels: Record<Exclude<View, "logs">, React.ReactNode> = {
		menu: (
			<Box flexDirection="column">
				<MenuGrid
					columns={layout.menuColumns}
					isActive={view === "menu"}
					items={menuItemsOf(messages, language, {
						timerSignal,
						progress,
						now,
						logs: logs.length,
						theme: themeName,
						focus: durations.focus,
						rest: durations.break,
					})}
					onSelect={selectMenu}
				/>
				<Box flexDirection="column" marginTop={1}>
					<Text bold color={palette.soft}>
						{messages.recent.title}
					</Text>
					{logs.length === 0 ? (
						<Text dimColor>{messages.recent.empty}</Text>
					) : null}
					{logs.slice(0, recentCount).map((log) => (
						<LogRow
							key={`${log.kind}-${log.at}`}
							language={language}
							log={log}
							messages={messages}
						/>
					))}
				</Box>
			</Box>
		),
		timer: (
			<Titled title={messages.menu.timer}>
				<Choice
					options={[
						{
							label: isRunning ? messages.timer.pause : messages.timer.resume,
							value: "toggle",
						},
						{ label: messages.timer.stop, value: "stop" },
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
		diet: (
			<EntryForm
				fields={dietFieldsOf(messages)}
				messages={messages}
				title={messages.form.dietTitle}
				onSubmit={submitMeal}
			/>
		),
		workout: (
			<EntryForm
				fields={workoutFieldsOf(messages)}
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

	const shownQuote = localizedQuote(quote, language);
	const todayPanel = (
		<TodayPanel
			sections={sectionsOf(language, palette, progress, now)}
			title={messages.today.title}
			width={layout.todayWidth}
		/>
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

			{view === "logs" ? (
				<Box
					borderColor={palette.accent}
					borderStyle="round"
					flexGrow={1}
					paddingX={1}
				>
					<LogsView
						height={rows - 7}
						language={language}
						logs={logs}
						messages={messages}
					/>
				</Box>
			) : (
				<>
					<Box
						flexDirection={layout.stacked ? "column-reverse" : "row"}
						flexGrow={1}
					>
						{layout.showCharacter ? (
							<Character
								activity={activity}
								label={
									activity === "levelUp"
										? `${messages.activity.levelUp} ${messages.level(level)}`
										: messages.activity[activity]
								}
								level={messages.level(level)}
								levelNumber={level}
								name={name}
								width={characterWidth}
							/>
						) : null}
						{layout.showToday && layout.todayBeside ? todayPanel : null}
						<Box
							borderColor={view === "menu" ? palette.border : palette.accent}
							borderStyle="round"
							flexDirection="column"
							paddingX={1}
							width={layout.panelWidth}
						>
							{view === "menu" ? panels.menu : panels[view]}
						</Box>
					</Box>
					{layout.showToday && !layout.todayBeside ? todayPanel : null}
				</>
			)}

			<Footer
				hint={hints[view]}
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
