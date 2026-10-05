import React from "react";
import { Box, Text } from "ink";
import type { Mood } from "../i18n.js";
import {
	type Activity,
	advance,
	composeScene,
	frameMilliseconds,
	type Look,
	paletteOf,
	startMotion,
	toSegments,
} from "../pixel-art.js";
import { spinnerFrames, usePalette } from "../theme.js";

type Wanted = Readonly<{ activity: Activity; mood: Mood }>;

type CharacterProps = Readonly<{
	name: string;
	level: string;
	levelNumber: number;
	activity: Activity;
	look: Look;
	mood: Mood;
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
	label,
	width,
}: CharacterProps) {
	const palette = usePalette();
	// Border and padding take 4 columns; the rest is the stage it roams.
	const stage = width - 4;
	const [motion, step] = React.useReducer(
		(state: ReturnType<typeof startMotion>, wanted: Wanted) =>
			advance(state, wanted, stage),
		undefined,
		() => startMotion(activity, mood, stage),
	);
	// The timer reads what is wanted now, and the motion decides when to
	// switch, so an animation finishes where it began before the next starts.
	const wanted = React.useRef<Wanted>({ activity, mood });

	React.useEffect(() => {
		wanted.current = { activity, mood };
	}, [activity, mood]);

	React.useEffect(() => {
		const timer = setInterval(() => {
			step(wanted.current);
		}, frameMilliseconds);

		return () => {
			clearInterval(timer);
		};
	}, []);

	const lines = toSegments(
		composeScene({
			activity: motion.activity,
			counter: motion.tick,
			anchor: motion.anchor,
			level: levelNumber,
			look,
			mood: motion.mood,
			width: stage,
		}),
		paletteOf(palette),
	);
	const spinner = Math.floor(motion.tick / 2) % spinnerFrames.length;

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
					{`${spinnerFrames[spinner] ?? "·"} ${label}`}
				</Text>
			</Box>
		</Box>
	);
}
