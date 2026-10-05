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
	isNumbered?: boolean;
}>;

// A vertical list in Claude Code's style. Unlike @inkjs/ui's Select, Enter on
// the preselected option still counts, which editing a saved value needs.
export default function Choice({
	options,
	onSelect,
	onFocus,
	initialValue,
	isActive = true,
	isNumbered = false,
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
			const focus = (next: number) => {
				setIndex(next);

				const option = options[next];

				if (option) {
					onFocus?.(option.value);
				}
			};

			const count = options.length;

			if (key.upArrow || input === "k") {
				focus((index - 1 + count) % count);
			} else if (key.downArrow || input === "j") {
				focus((index + 1) % count);
			} else if (isNumbered && /^[1-9]$/v.test(input)) {
				focus(Math.min(Number(input), count) - 1);
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
							{isNumbered
								? `${optionIndex + 1}. ${option.label}`
								: option.label}
						</Text>
						{option.hint}
					</Box>
				);
			})}
		</Box>
	);
}
