import React from "react";
import { Box, Text } from "ink";
import { colors } from "../theme.js";

export type Metric = Readonly<{
	label: string;
	detail: string;
	value: number;
	color: string;
}>;

type TodayPanelProps = Readonly<{
	title: string;
	metrics: readonly Metric[];
	width: number;
}>;

export default function TodayPanel({ title, metrics, width }: TodayPanelProps) {
	// Border and padding take 4 columns, and " 100%" takes 5.
	const barWidth = Math.max(width - 9, 4);

	return (
		<Box
			borderColor={colors.border}
			borderStyle="round"
			flexDirection="column"
			flexShrink={0}
			paddingX={1}
			width={width}
		>
			<Text bold>{title}</Text>
			{metrics.map((metric, index) => {
				const value = Math.min(Math.max(Math.round(metric.value), 0), 100);
				const filled = Math.round((value / 100) * barWidth);

				return (
					<Box
						key={metric.label}
						flexDirection="column"
						marginTop={index === 0 ? 0 : 1}
					>
						<Box gap={1} justifyContent="space-between">
							<Box flexShrink={0}>
								<Text bold color={metric.color}>
									{metric.label}
								</Text>
							</Box>
							<Text dimColor wrap="truncate-end">
								{metric.detail}
							</Text>
						</Box>
						<Text>
							<Text color={metric.color}>{"█".repeat(filled)}</Text>
							<Text dimColor>{"░".repeat(barWidth - filled)}</Text>
							<Text>{` ${String(value).padStart(3)}%`}</Text>
						</Text>
					</Box>
				);
			})}
		</Box>
	);
}
