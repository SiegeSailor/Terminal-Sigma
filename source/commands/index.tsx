import { homedir } from "node:os";
import process from "node:process";
import zod from "zod";
import React from "react";
import { TextInput } from "@inkjs/ui";
import { Box, Text, useApp, useInput, useWindowSize } from "ink";
import Character from "../components/character.js";
import MenuGrid, { type MenuItem } from "../components/menu-grid.js";
import StatusPanel, { type StatusMetric } from "../components/status-panel.js";
import {
	dailyGoals,
	experienceOf,
	experiencePerLevel,
	experiencePerMeal,
	levelOf,
	loadProgress,
	parseEntry,
	type Progress,
	progressFile,
	saveProgress,
	todayOf,
} from "../progress.js";
import {
	fetchQuote,
	quoteRefreshMinutes,
	randomBundledQuote,
} from "../quotes.js";
import {
	advanceTimer,
	formatClock,
	idleTimer,
	remainingOf,
	toggleTimer,
} from "../timer.js";

const clamp = (value: number, minimum: number, maximum: number) =>
	Math.min(Math.max(value, minimum), maximum);

const percentOf = (value: number, goal: number) =>
	Math.min(Math.round((value / goal) * 100), 100);

const goalSignal = (value: number, goal: number) => {
	if (value >= goal) {
		return { signal: "Done", badgeColor: "green" } as const;
	}

	return value > 0
		? ({ signal: "Going", badgeColor: "yellow" } as const)
		: ({ signal: "Start", badgeColor: "blue" } as const);
};

export const options = zod.object({
	name: zod.string().describe("Your name").default("Rook Sigma"),
	focus: zod.number().int().positive().describe("Focus minutes").default(25),
	break: zod.number().int().positive().describe("Break minutes").default(5),
});

type Props = Readonly<{
	options: zod.infer<typeof options>;
}>;

type Entry = "meal" | "workout";

export default function Index({ options }: Props) {
	const { exit } = useApp();
	const { columns } = useWindowSize();
	const file = React.useMemo(() => progressFile(), []);
	const [progress, setProgress] = React.useState(() => loadProgress(file));
	const [now, setNow] = React.useState(Date.now);
	const durations = React.useMemo(
		() => ({ focus: options.focus, break: options.break }),
		[options.focus, options.break],
	);
	const [timer, setTimer] = React.useState(() => idleTimer(durations));
	const [quote, setQuote] = React.useState(randomBundledQuote);
	const [entry, setEntry] = React.useState<Entry>();
	const [message, setMessage] = React.useState(
		`Progress is saved to ${file.replace(homedir(), "~")}.`,
	);

	const record = React.useCallback(
		(update: (current: Progress) => Progress, text: string) => {
			const next = update(progress);

			try {
				saveProgress(file, next);
			} catch (error) {
				setMessage(`Not saved: ${String(error)}`);
				return;
			}

			const before = levelOf(experienceOf(progress));
			const after = levelOf(experienceOf(next));
			setProgress(next);
			setMessage(after > before ? `${text} Level up! LV ${after}.` : text);
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

		setTimer(next);
		process.stdout.write("\u0007");

		if (finished === "break") {
			setMessage("Break over. Select Tomato Timer and press Enter to focus.");
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
			`Focus complete, +${durations.focus} XP. ${durations.break}-minute break started.`,
		);
	}, [now, timer, durations, record]);

	React.useEffect(() => {
		let isMounted = true;
		const refresh = async () => {
			const next = await fetchQuote();

			if (isMounted) {
				setQuote(next);
			}
		};

		void refresh();
		const interval = setInterval(() => {
			void refresh();
		}, quoteRefreshMinutes * 60_000);

		return () => {
			isMounted = false;
			clearInterval(interval);
		};
	}, []);

	useInput((input, key) => {
		if (entry) {
			if (key.escape) {
				setEntry(undefined);
				setMessage("Nothing logged.");
			}

			return;
		}

		if (input === "q") {
			exit();
		}
	});

	const submitEntry = (text: string) => {
		const parsed = parseEntry(text);
		const at = new Date().toISOString();
		setEntry(undefined);

		if (!parsed) {
			setMessage("Nothing logged.");
			return;
		}

		if (entry === "meal") {
			record(
				(current) => ({
					...current,
					meals: [
						...current.meals,
						{ at, food: parsed.label, calories: parsed.amount },
					],
				}),
				`Logged ${parsed.label}, +${experiencePerMeal} XP.`,
			);
			return;
		}

		if (!parsed.amount) {
			setMessage("Add the minutes to log a workout, e.g. Run 30.");
			return;
		}

		const minutes = parsed.amount;
		record(
			(current) => ({
				...current,
				workouts: [
					...current.workouts,
					{ at, activity: parsed.label, minutes },
				],
			}),
			`Logged ${parsed.label} for ${minutes} minutes, +${minutes} XP.`,
		);
	};

	const selectMenu = (index: number) => {
		switch (index) {
			case 0: {
				const next = toggleTimer(timer, Date.now());
				setTimer(next);
				setMessage(
					next.endsAt === undefined
						? "Timer paused."
						: `${next.phase === "focus" ? "Focus" : "Break"} running.`,
				);
				break;
			}

			case 1: {
				setEntry("meal");
				break;
			}

			case 2: {
				setEntry("workout");
				break;
			}

			default: {
				void fetchQuote().then(setQuote);
				setMessage("New quote drawn.");
			}
		}
	};

	const experience = experienceOf(progress);
	const level = levelOf(experience);
	const levelExperience = experience % experiencePerLevel;
	const today = todayOf(progress, now);
	const isIdle =
		timer.endsAt === undefined &&
		timer.phase === "focus" &&
		timer.remaining === durations.focus * 60_000;
	const clock = formatClock(remainingOf(timer, now));
	const phaseLabel = timer.phase.toUpperCase();
	let timerSignal = `${phaseLabel} ${clock}`;
	let timerStatus = `${phaseLabel} ${clock} left`;

	if (isIdle) {
		timerSignal = "Ready";
		timerStatus = "";
	} else if (timer.endsAt === undefined) {
		timerSignal = "Paused";
		timerStatus = `${phaseLabel} paused at ${clock}`;
	}

	const realtime = [
		new Date(now).toTimeString().slice(0, 8),
		timerStatus,
		message,
	]
		.filter(Boolean)
		.join("  |  ");

	const metrics: StatusMetric[] = [
		{
			label: "Character Progression",
			value: percentOf(levelExperience, experiencePerLevel),
			detail: `${experiencePerLevel - levelExperience} XP to level ${level + 1}.`,
			signal: `LV ${level}`,
			badgeColor: "blue",
			numberColor: "cyanBright",
		},
		{
			label: "Tomato Timer",
			value: percentOf(today.focusSessions, dailyGoals.focusSessions),
			detail: `${today.focusSessions} of ${dailyGoals.focusSessions} focus sessions today.`,
			...goalSignal(today.focusSessions, dailyGoals.focusSessions),
			numberColor: "greenBright",
		},
		{
			label: "Diet Tracker",
			value: percentOf(today.meals, dailyGoals.meals),
			detail: `${today.meals} of ${dailyGoals.meals} meals, ${today.calories} kcal today.`,
			...goalSignal(today.meals, dailyGoals.meals),
			numberColor: "yellowBright",
		},
		{
			label: "Workout Tracker",
			value: percentOf(today.workoutMinutes, dailyGoals.workoutMinutes),
			detail: `${today.workoutMinutes} of ${dailyGoals.workoutMinutes} workout minutes today.`,
			...goalSignal(today.workoutMinutes, dailyGoals.workoutMinutes),
			numberColor: "magentaBright",
		},
	];

	const menuItems: MenuItem[] = [
		{
			label: "Tomato Timer",
			signal: timerSignal,
			description: `Enter starts or pauses a ${durations.focus}-minute focus. Each finished focus earns ${durations.focus} XP, then a ${durations.break}-minute break begins.`,
			color: "greenBright",
		},
		{
			label: "Diet Tracker",
			signal: `${today.meals} meals`,
			description: `Enter logs a meal as food and optional calories, e.g. Oatmeal 350. Each meal earns ${experiencePerMeal} XP.`,
			color: "yellowBright",
		},
		{
			label: "Workout Tracker",
			signal: `${today.workoutMinutes} min`,
			description:
				"Enter logs a workout as activity and minutes, e.g. Run 30. Each minute earns 1 XP.",
			color: "magentaBright",
		},
		{
			label: "Everyday Quotes",
			signal: "New",
			description: `Enter draws a new quote. It also refreshes every ${quoteRefreshMinutes} minutes, from API Ninjas when API_NINJAS_KEY is set.`,
			color: "cyanBright",
		},
	];

	const terminalWidth = columns || 100;
	const panelWidth = Math.min(clamp(terminalWidth - 4, 68, 112), terminalWidth);
	const contentWidth = Math.max(panelWidth - 4, 40);
	const shouldStackTopRow = contentWidth < 88;
	const characterWidth = shouldStackTopRow ? contentWidth : 32;
	const statusWidth = shouldStackTopRow
		? contentWidth
		: Math.max(contentWidth - characterWidth - 3, 32);
	const menuColumns = contentWidth < 56 ? 1 : 2;

	return (
		<Box flexDirection="column" width={panelWidth}>
			<Box
				borderStyle="round"
				borderColor="gray"
				flexDirection="column"
				paddingX={1}
				paddingY={1}
				width={panelWidth}
			>
				<Text color="cyanBright">TERMINAL SIGMA</Text>
				<Text color="gray" wrap="truncate-end">
					{realtime}
				</Text>

				<Box
					flexDirection={shouldStackTopRow ? "column" : "row"}
					justifyContent="space-between"
					marginTop={1}
				>
					<StatusPanel metrics={metrics} quote={quote} width={statusWidth} />
					<Box
						marginLeft={shouldStackTopRow ? 0 : 3}
						marginTop={shouldStackTopRow ? 1 : 0}
					>
						<Character
							level={level}
							name={options.name}
							width={characterWidth}
						/>
					</Box>
				</Box>

				<Box marginTop={1}>
					<Text color="gray">{"-".repeat(contentWidth)}</Text>
				</Box>

				<Box marginTop={1}>
					<MenuGrid
						columns={menuColumns}
						isActive={!entry}
						items={menuItems}
						title="NAVIGATION MENU"
						width={contentWidth}
						onSelect={selectMenu}
					/>
				</Box>

				{entry ? (
					<Box marginTop={1}>
						<Text color="cyanBright">
							{entry === "meal" ? "Meal > " : "Workout > "}
						</Text>
						<TextInput
							placeholder={
								entry === "meal"
									? "Oatmeal 350, Enter to log, Esc to cancel"
									: "Run 30, Enter to log, Esc to cancel"
							}
							onSubmit={submitEntry}
						/>
					</Box>
				) : null}
			</Box>
		</Box>
	);
}
