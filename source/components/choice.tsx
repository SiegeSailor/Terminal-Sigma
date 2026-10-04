import React from "react";
import { Box, Text, useInput } from "ink";
import { usePalette } from "../theme.js";

export type Option = Readonly<{
	label: string;
	value: string;
	hint?: React.ReactNode;
}>;

type ChoiceProps = Readonly<{
	options: readonly Option[];
	onSelect: (value: string) => void;
	onFocus?: (value: string) => void;
	initialValue?: string;
	isActive?: boolean;
}>;

// A vertical list in Claude Code's style. Unlike @inkjs/ui's Select, Enter on
// the preselected option still counts, which editing a saved value needs.
export default function Choice({
	options,
	onSelect,
	onFocus,
	initialValue,
	isActive = true,
}: ChoiceProps) {
	const palette = usePalette();
	const [index, setIndex] = React.useState(() =>
		Math.max(
			options.findIndex((option) => option.value === initialValue),
			0,
		),
	);

	useInput(
		(input, key) => {
			const move = (step: number) => {
				const next = (index + step + options.length) % options.length;
				setIndex(next);

				const option = options[next];

				if (option) {
					onFocus?.(option.value);
				}
			};

			if (key.upArrow || input === "k") {
				move(-1);
			} else if (key.downArrow || input === "j") {
				move(1);
			} else if (key.return) {
				const option = options[index];

				if (option) {
					onSelect(option.value);
				}
			}
		},
		{ isActive },
	);

	return (
		<Box flexDirection="column">
			{options.map((option, optionIndex) => {
				const isFocused = optionIndex === index;

				return (
					<Box key={option.value} gap={1}>
						<Text color={palette.accent}>{isFocused ? "❯" : " "}</Text>
						<Text
							bold={isFocused}
							color={isFocused ? palette.accent : undefined}
						>
							{option.label}
						</Text>
						{option.hint}
					</Box>
				);
			})}
		</Box>
	);
}
