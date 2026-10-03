import { Badge, ProgressBar } from "@inkjs/ui";
import React from "react";
import { Box, Text } from "ink";

type InkColor = React.ComponentProps<typeof Text>["color"];
type BadgeColor = "blue" | "green" | "yellow" | "red";

type StatusMetric = Readonly<{
	label: string;
	value: number;
	detail: string;
	signal: string;
	badgeColor: BadgeColor;
	numberColor: InkColor;
}>;

const statusMetrics: readonly StatusMetric[] = [
	{
		label: "Focus Stability",
		value: 83,
		detail: "2h 14m of uninterrupted deep-work time.",
		signal: "Stable",
		badgeColor: "green",
		numberColor: "greenBright",
	},
	{
		label: "Quest Queue",
		value: 58,
		detail: "7 mock actions sitting in the backlog.",
		signal: "Loaded",
		badgeColor: "yellow",
		numberColor: "yellowBright",
	},
	{
		label: "Battery Reserve",
		value: 71,
		detail: "Projected runtime holds for 41 more minutes.",
		signal: "Ready",
		badgeColor: "blue",
		numberColor: "cyanBright",
	},
	{
		label: "Comms Noise",
		value: 34,
		detail: "Only 2 chatter spikes hit the shell loop.",
		signal: "Low",
		badgeColor: "green",
		numberColor: "magentaBright",
	},
];

type StatusPanelProps = Readonly<{
	width: number;
	operatorName: string;
}>;

export default function StatusPanel({ width, operatorName }: StatusPanelProps) {
	const progressWidth = Math.max(width - 2, 18);

	return (
		<Box flexDirection="column" width={width}>
			<Text color="yellowBright">STATUS BOARD</Text>
			<Text color="gray">{`Operator ${operatorName}. Mock telemetry, quick bars, clear reads.`}</Text>

			{statusMetrics.map((metric) => (
				<Box key={metric.label} flexDirection="column" marginTop={1}>
					<Box justifyContent="space-between">
						<Text color="whiteBright">{metric.label}</Text>
						<Text color={metric.numberColor}>{`${metric.value}%`}</Text>
					</Box>
					<Box width={progressWidth}>
						<ProgressBar value={metric.value} />
					</Box>
					<Box justifyContent="space-between">
						<Text color="gray">{metric.detail}</Text>
						<Badge color={metric.badgeColor}>{metric.signal}</Badge>
					</Box>
				</Box>
			))}
		</Box>
	);
}
