import { Badge, ProgressBar } from "@inkjs/ui";
import React from "react";
import { Box, Text } from "ink";
import type { Quote } from "../quotes.js";

type InkColor = React.ComponentProps<typeof Text>["color"];
type BadgeColor = "blue" | "green" | "yellow" | "red";

export type StatusMetric = Readonly<{
	label: string;
	value: number;
	detail: string;
	signal: string;
	badgeColor: BadgeColor;
	numberColor: InkColor;
}>;

type StatusPanelProps = Readonly<{
	width: number;
	quote: Quote;
	metrics: readonly StatusMetric[];
}>;

export default function StatusPanel({
	width,
	quote,
	metrics,
}: StatusPanelProps) {
	const progressWidth = Math.max(width - 2, 18);

	return (
		<Box flexDirection="column" width={width}>
			<Text color="yellowBright">STATUS BOARD</Text>
			<Text color="gray">{`"${quote.quote}" - ${quote.author}`}</Text>

			{metrics.map((metric) => (
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
