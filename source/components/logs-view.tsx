import React from "react";
import { Box, Text, useInput } from "ink";
import {
	formatNumber,
	type Language,
	type Messages,
	workoutActivities,
	type WorkoutActivity,
} from "../i18n.js";
import type { Log } from "../progress.js";
import { colors } from "../theme.js";

const filters = ["all", "focus", "meal", "workout"] as const;
type Filter = (typeof filters)[number];

type LogsViewProps = Readonly<{
	logs: readonly Log[];
	language: Language;
	messages: Messages;
	height: number;
}>;

const kindColor: Record<Log["kind"], string> = {
	focus: colors.focus,
	meal: colors.diet,
	workout: colors.workout,
};

const isWorkoutActivity = (activity: string): activity is WorkoutActivity =>
	(workoutActivities as readonly string[]).includes(activity);

export function describeLog(log: Log, language: Language, messages: Messages) {
	const amount = (value: number | undefined) =>
		value === undefined ? "-" : formatNumber(language, value);

	switch (log.kind) {
		case "focus": {
			return messages.logs.focusEntry(log.entry.minutes);
		}

		case "meal": {
			return messages.logs.mealEntry(
				log.entry.food,
				amount(log.entry.calories),
				amount(log.entry.protein),
			);
		}

		case "workout": {
			const { activity, minutes, intensity } = log.entry;
			return messages.logs.workoutEntry(
				isWorkoutActivity(activity)
					? messages.workoutActivity[activity]
					: activity,
				minutes,
				intensity ? messages.intensity[intensity] : "-",
			);
		}
	}
}

export default function LogsView({
	logs,
	language,
	messages,
	height,
}: LogsViewProps) {
	const [filter, setFilter] = React.useState<Filter>("all");
	const [offset, setOffset] = React.useState(0);
	const shown = logs.filter((log) => filter === "all" || log.kind === filter);
	// Title, tabs, summary, and their spacing take 4 rows.
	const pageSize = Math.max(height - 4, 3);
	const maximumOffset = Math.max(shown.length - pageSize, 0);
	const labels: Record<Filter, string> = {
		all: messages.logs.all,
		focus: messages.logs.focus,
		meal: messages.logs.diet,
		workout: messages.logs.workout,
	};
	const formatDate = new Intl.DateTimeFormat(language, {
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});

	useInput((input, key) => {
		const move = (step: number) => {
			const next =
				filters[
					(filters.indexOf(filter) + step + filters.length) % filters.length
				];

			if (next) {
				setFilter(next);
				setOffset(0);
			}
		};

		const scroll = (step: number) => {
			setOffset((current) =>
				Math.min(Math.max(current + step, 0), maximumOffset),
			);
		};

		if (key.leftArrow || input === "h") {
			move(-1);
		} else if (key.rightArrow || input === "l" || key.tab) {
			move(1);
		} else if (key.upArrow || input === "k") {
			scroll(-1);
		} else if (key.downArrow || input === "j") {
			scroll(1);
		} else if (key.pageUp) {
			scroll(-pageSize);
		} else if (key.pageDown) {
			scroll(pageSize);
		}
	});

	return (
		<Box flexDirection="column" flexGrow={1}>
			<Box gap={2}>
				<Text bold color={colors.accent}>
					{messages.logs.title}
				</Text>
				{filters.map((option) => (
					<Text
						key={option}
						bold={option === filter}
						color={option === filter ? colors.accent : undefined}
						dimColor={option !== filter}
						underline={option === filter}
					>
						{labels[option]}
					</Text>
				))}
			</Box>
			<Text dimColor>
				{messages.logs.summary(
					shown.length,
					shown.reduce((total, log) => total + log.experience, 0),
				)}
			</Text>
			<Box flexDirection="column" marginTop={1}>
				{shown.length === 0 ? (
					<Text dimColor>{messages.logs.empty}</Text>
				) : null}
				{shown.slice(offset, offset + pageSize).map((log) => (
					<Box key={`${log.kind}-${log.at}`} gap={2}>
						<Box flexShrink={0} width={12}>
							<Text dimColor>{formatDate.format(new Date(log.at))}</Text>
						</Box>
						<Box flexShrink={0} width={8}>
							<Text color={kindColor[log.kind]}>{labels[log.kind]}</Text>
						</Box>
						<Box flexGrow={1}>
							<Text wrap="truncate-end">
								{describeLog(log, language, messages)}
							</Text>
						</Box>
						<Box flexShrink={0} justifyContent="flex-end" width={8}>
							<Text color={colors.accent}>{`+${log.experience} XP`}</Text>
						</Box>
					</Box>
				))}
			</Box>
		</Box>
	);
}
