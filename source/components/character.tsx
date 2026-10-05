import React from "react";
import { Box, Text, useAnimation } from "ink";
import type { Mood } from "../i18n.js";
import {
	type Activity,
	type Badges,
	composeScene,
	intervalOf,
	type Look,
	paletteOf,
	toSegments,
} from "../pixel-art.js";
import { spinnerFrames, usePalette } from "../theme.js";

type CharacterProps = Readonly<{
	name: string;
	level: string;
	levelNumber: number;
	activity: Activity;
	look: Look;
	mood: Mood;
	badges: Badges;
	label: string;
	width: number;
}>;

export default function Character({
	name,
	level,
	levelNumber,
	activity,
	look,
	mood,
	badges,
	label,
	width,
}: CharacterProps) {
	const palette = usePalette();
	const { frame } = useAnimation({ interval: intervalOf(activity) });
	// Border and padding take 4 columns; the rest is the stage it roams.
	const lines = toSegments(
		composeScene({
			activity,
			counter: frame,
			level: levelNumber,
			look,
			mood,
			badges,
			width: width - 4,
		}),
		paletteOf(palette),
	);

	return (
		<Box
			borderColor={palette.border}
			borderStyle="round"
			flexDirection="column"
			flexShrink={0}
			paddingX={1}
			width={width}
		>
			<Box gap={1} justifyContent="space-between">
				<Text bold wrap="truncate-end">
					{name}
				</Text>
				<Text color={palette.accent}>{level}</Text>
			</Box>
			<Box flexDirection="column" flexGrow={1} justifyContent="flex-end">
				{lines.map((line, row) => (
					// Rows and runs are positional by nature: a sprite never reorders.
					// eslint-disable-next-line react/no-array-index-key
					<Box key={row}>
						{line.map((segment, column) => (
							<Text
								// eslint-disable-next-line react/no-array-index-key
								key={column}
								backgroundColor={segment.backgroundColor}
								color={segment.color}
							>
								{segment.text}
							</Text>
						))}
					</Box>
				))}
			</Box>
			<Box marginTop={1}>
				<Text color={palette.accent} wrap="truncate-end">
					{`${spinnerFrames[frame % spinnerFrames.length] ?? "·"} ${label}`}
				</Text>
			</Box>
		</Box>
	);
}
