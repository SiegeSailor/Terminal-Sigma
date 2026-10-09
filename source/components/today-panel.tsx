import React from "react";
import { Box, Text, useAnimation } from "ink";
import { glideMilliseconds, tweenOf } from "../motion.js";
import { usePalette } from "../theme.js";

export type Metric = Readonly<{
	label: string;
	detail: string;
	value: number;
	color: string;
}>;

export type Section = Readonly<{
	title?: string;
	metrics: readonly Metric[];
	advice?: Readonly<{ text: string; isDone: boolean }>;
}>;

type TodayPanelProps = Readonly<{
	title: string;
	sections: readonly Section[];
	width: number;
	isCompact?: boolean;
	isReduced?: boolean;
}>;

const percentOf = (metric: Metric) =>
	Math.min(Math.max(Math.round(metric.value), 0), 100);

// Glides from the shown value to a new one; useAnimation's clock keeps the
// render pure, which xo's react-hooks/purity requires.
function useGlide(value: number, isReduced: boolean) {
	const [span, setSpan] = React.useState({ from: value, to: value });
	const isMoving = !isReduced && span.from !== span.to;
	const { time, reset } = useAnimation({ interval: 40, isActive: isMoving });
	const shown = isMoving
		? tweenOf(span.from, span.to, time, glideMilliseconds)
		: span.to;

	React.useEffect(() => {
		if (value !== span.to) {
			setSpan({ from: shown, to: value });
			reset();
		}
	}, [value, span.to, shown, reset]);

	React.useEffect(() => {
		if (isMoving && time >= glideMilliseconds) {
			setSpan({ from: span.to, to: span.to });
		}
	}, [isMoving, time, span.to]);

	return isReduced ? value : shown;
}

// A half-height bar: "▀" fills only the top of its row, so the bottom half
// spaces the items apart without a whole blank row. Text centers in its row,
// so the percentage sits on the label's row instead of beside the bar.
function Bar({
	metric,
	width,
	isReduced,
}: Readonly<{ metric: Metric; width: number; isReduced: boolean }>) {
	const palette = usePalette();
	const percent = useGlide(percentOf(metric), isReduced);
	const filled = Math.round((percent / 100) * width);

	return (
		<Text>
			<Text color={metric.color}>{"▀".repeat(filled)}</Text>
			<Text color={palette.border}>{"▀".repeat(width - filled)}</Text>
		</Text>
	);
}

// Breathing room inside the border and between sections, unless the
// terminal is too short for it.
export default function TodayPanel({
	title,
	sections,
	width,
	isCompact = false,
	isReduced = false,
}: TodayPanelProps) {
	const palette = usePalette();
	const gap = isCompact ? 0 : 1;
	// Border and padding take 6 columns.
	const barWidth = Math.max(width - 6, 4);

	return (
		<Box
			borderColor={palette.border}
			borderStyle="round"
			flexDirection="column"
			flexShrink={0}
			paddingX={2}
			paddingY={gap}
			width={width}
		>
			<Text bold>{title}</Text>
			{sections.map((section, index) => (
				<Box
					key={section.title ?? `section-${index}`}
					flexDirection="column"
					marginTop={index === 0 ? gap : 1}
				>
					{section.title ? (
						<Text bold color={palette.soft}>
							{section.title}
						</Text>
					) : null}
					{section.metrics.map((metric) => (
						<Box key={metric.label} flexDirection="column">
							<Box gap={1} justifyContent="space-between">
								<Box flexShrink={0}>
									<Text color={metric.color}>{metric.label}</Text>
								</Box>
								<Box flexGrow={1} justifyContent="flex-end">
									<Text dimColor wrap="truncate-end">
										{metric.detail}
									</Text>
								</Box>
								<Box flexShrink={0}>
									<Text>{`${percentOf(metric)}%`}</Text>
								</Box>
							</Box>
							<Bar isReduced={isReduced} metric={metric} width={barWidth} />
						</Box>
					))}
					{section.advice ? (
						<Text wrap="truncate-end">
							<Text
								color={section.advice.isDone ? palette.success : palette.accent}
							>
								{"⏺ "}
							</Text>
							<Text dimColor>{section.advice.text}</Text>
						</Text>
					) : null}
				</Box>
			))}
		</Box>
	);
}
