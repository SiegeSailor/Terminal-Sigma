import { homedir } from "node:os";
import zod from "zod";
import React from "react";
import { Select, ThemeProvider } from "@inkjs/ui";
import { Box, Text, useApp, useInput, useStdout, useWindowSize } from "ink";
import Character from "./components/character.js";
import EntryForm from "./components/entry-form.js";
import Footer, { type Tone } from "./components/footer.js";
import LogsView from "./components/logs-view.js";
import MenuGrid from "./components/menu-grid.js";
import TodayPanel from "./components/today-panel.js";
import {
	characterWidth,
	dietFieldsOf,
	layoutOf,
	menuItemsOf,
	menuOrder,
	metricsOf,
	workoutFieldsOf,
} from "./content.js";
import {
	intensities,
	type Language,
	languages,
	messagesOf,
	workoutActivities,
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
import { colors, uiTheme } from "./theme.js";
import {
	advanceTimer,
	formatClock,
	idleTimer,
	remainingOf,
	toggleTimer,
} from "./timer.js";

export const optionsSchema = zod.object({
	name: zod.string().min(1).default("Rook Sigma"),
	focus: zod.number().int().positive().default(25),
	break: zod.number().int().positive().default(5),
});

export type AppOptions = zod.infer<typeof optionsSchema>;

type AppProps = Readonly<{
	options: AppOptions;
	file: string;
	initialProgress: Progress;
}>;

type View = "menu" | "timer" | "diet" | "workout" | "logs" | "language";
type Flash = Readonly<{ activity: Activity; until: number }>;

const flashMilliseconds = 6000;

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

const asLanguage = (value: string): Language =>
	value === "zh-TW" ? "zh-TW" : "en";

function Titled({
	title,
	children,
}: Readonly<{ title: string; children: React.ReactNode }>) {
	return (
		<Box flexDirection="column">
			<Text bold color={colors.accent}>
				{title}
			</Text>
			{children}
		</Box>
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
	const record = React.useCallback(
		(
			update: (current: Progress) => Progress,
			text: string,
			activity: Activity,
		) => {
			const next = update(progress);
			const { form, notSaved } = messagesOf(next.language ?? "en");

			try {
				saveProgress(file, next);
			} catch (error) {
				setMessage({ text: notSaved(String(error)), tone: "error" });
				return;
			}

			const after = levelOf(experienceOf(next));
			const leveledUp = after > levelOf(experienceOf(progress));
			setProgress(next);
			setMessage({
				text: leveledUp ? `${text} ${form.levelUp(after)}` : text,
				tone: "success",
			});
			setFlash({
				activity: leveledUp ? "levelUp" : activity,
				until: Date.now() + flashMilliseconds,
			});
		},
		[file, progress],
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
				const isForm = view === "diet" || view === "workout";
				backToMenu(isForm ? messages.form.cancelled : undefined);
			}
		},
		{ isActive: progress.language !== undefined },
	);

	const chooseLanguage = (next: Language) => {
		const updated = { ...progress, language: next };

		try {
			saveProgress(file, updated);
		} catch (error) {
			say(messagesOf(next).notSaved(String(error)), "error");
			return;
		}

		setProgress(updated);
		backToMenu(messagesOf(next).languageChanged);
	};

	if (progress.language === undefined) {
		return (
			<ThemeProvider theme={uiTheme}>
				<Box
					borderColor={colors.accent}
					borderStyle="round"
					flexDirection="column"
					paddingX={2}
					paddingY={1}
				>
					<Titled title="✻ Terminal Sigma">
						<Text dimColor>{messages.chooseLanguage}</Text>
						<Box marginTop={1}>
							<Select
								options={languageOptions}
								onChange={(value) => {
									chooseLanguage(asLanguage(value));
								}}
							/>
						</Box>
					</Titled>
				</Box>
			</ThemeProvider>
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
			activity:
				workoutActivities.find((option) => option === values.activity) ??
				"other",
			minutes: Number(values.minutes),
			intensity:
				intensities.find((option) => option === values.intensity) ?? "moderate",
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
		timer: messages.hints.select,
		language: messages.hints.select,
	};

	const panels: Record<Exclude<View, "logs">, React.ReactNode> = {
		menu: (
			<MenuGrid
				columns={layout.menuColumns}
				isActive={view === "menu"}
				items={menuItemsOf(messages, language, {
					timerSignal,
					meals: today.meals,
					workoutMinutes: today.workoutMinutes,
					logs: logs.length,
					focus: durations.focus,
					rest: durations.break,
				})}
				onSelect={selectMenu}
			/>
		),
		timer: (
			<Titled title={messages.menu.timer}>
				<Select
					options={[
						{
							label: isRunning ? messages.timer.pause : messages.timer.resume,
							value: "toggle",
						},
						{ label: messages.timer.stop, value: "stop" },
						{ label: messages.timer.back, value: "back" },
					]}
					onChange={chooseTimerAction}
				/>
			</Titled>
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
		language: (
			<Titled title={messages.menu.language}>
				<Select
					options={languageOptions}
					onChange={(value) => {
						chooseLanguage(asLanguage(value));
					}}
				/>
			</Titled>
		),
	};

	const shownQuote = localizedQuote(quote, language);
	const todayPanel = (
		<TodayPanel
			metrics={metricsOf(messages, language, progress, now)}
			title={messages.today.title}
			width={layout.todayWidth}
		/>
	);

	return (
		<ThemeProvider theme={uiTheme}>
			<Box
				flexDirection="column"
				height={size.rows ? rows : undefined}
				overflow="hidden"
				width={columns}
			>
				<Box
					borderColor={colors.accent}
					borderStyle="round"
					flexDirection="column"
					flexShrink={0}
					paddingX={1}
				>
					<Box justifyContent="space-between">
						<Text bold color={colors.accent}>
							✻ Terminal Sigma
						</Text>
						<Text dimColor>
							{new Date(now).toLocaleTimeString(language, { hour12: false })}
						</Text>
					</Box>
					<Text dimColor italic wrap="truncate-end">
						{`“${shownQuote.quote}” — ${shownQuote.author}`}
					</Text>
				</Box>

				{view === "logs" ? (
					<Box
						borderColor={colors.accent}
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
									name={options.name}
									width={characterWidth}
								/>
							) : null}
							{layout.showToday && layout.todayBeside ? todayPanel : null}
							<Box
								borderColor={view === "menu" ? colors.border : colors.accent}
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
					status={
						isRunning ? messages.timer.left(phaseLabel, clock) : undefined
					}
					tone={message.tone}
				/>
			</Box>
		</ThemeProvider>
	);
}
