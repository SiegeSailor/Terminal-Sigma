import React from "react";
import { Box, Text, useAnimation } from "ink";
import {
	type Activity,
	animationOf,
	composeFrame,
	paletteOf,
	toSegments,
} from "../pixel-art.js";
import { colors, spinnerFrames } from "../theme.js";

type CharacterProps = Readonly<{
	name: string;
	level: string;
	levelNumber: number;
	activity: Activity;
	label: string;
	width: number;
}>;

export default function Character({
	name,
	level,
	levelNumber,
	activity,
	label,
	width,
}: CharacterProps) {
	const { frame } = useAnimation({ interval: animationOf(activity).interval });
	const lines = toSegments(
		composeFrame(activity, frame, levelNumber),
		paletteOf(levelNumber),
	);
	const spinner =
		activity === "idle" ? "·" : spinnerFrames[frame % spinnerFrames.length];

	return (
		<Box
			borderColor={colors.border}
			borderStyle="round"
			flexDirection="column"
			paddingX={1}
			width={width}
		>
			<Box justifyContent="space-between">
				<Text bold wrap="truncate-end">
					{name}
				</Text>
				<Text color={colors.accent}>{level}</Text>
			</Box>
			<Box
				alignItems="center"
				flexDirection="column"
				flexGrow={1}
				justifyContent="center"
			>
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
			<Text
				color={colors.accent}
				wrap="truncate-end"
			>{`${spinner} ${label}`}</Text>
		</Box>
	);
}
