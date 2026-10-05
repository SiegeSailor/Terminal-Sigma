import React from "react";
import { Box, Text, useInput } from "ink";
import { usePalette } from "../theme.js";

export type Suggestion = Readonly<{
	label: string;
	detail?: string;
	tag?: string;
	values?: Readonly<Record<string, string>>;
}>;

type AutocompleteInputProps = Readonly<{
	placeholder?: string;
	initialValue?: string;
	suggest: (text: string) => readonly Suggestion[];
	onSubmit: (text: string, suggestion?: Suggestion) => void;
}>;

// A text input that lists suggestions under itself as you type: ↑↓ picks one,
// Tab copies it into the text, and Enter takes the picked one or the text.
export default function AutocompleteInput({
	placeholder,
	initialValue = "",
	suggest,
	onSubmit,
}: AutocompleteInputProps) {
	const palette = usePalette();
	const [text, setText] = React.useState(initialValue);
	const [picked, setPicked] = React.useState(-1);
	const suggestions = suggest(text);

	useInput((input, key) => {
		const highlighted = suggestions[picked];

		if (key.return) {
			onSubmit(highlighted ? highlighted.label : text, highlighted);
		} else if (key.upArrow) {
			setPicked((current) => Math.max(current - 1, -1));
		} else if (key.downArrow) {
			setPicked((current) => Math.min(current + 1, suggestions.length - 1));
		} else if (key.tab) {
			const choice = highlighted ?? suggestions[0];

			if (choice) {
				setText(choice.label);
				setPicked(-1);
			}
		} else if (key.backspace || key.delete) {
			setText((current) => current.slice(0, -1));
			setPicked(-1);
		} else if (input && !key.ctrl && !key.meta && !key.escape) {
			setText((current) => current + input);
			setPicked(-1);
		}
	});

	return (
		<Box flexDirection="column">
			<Text>
				{text ? (
					<Text color={palette.accent}>{text}</Text>
				) : (
					<Text dimColor>{placeholder}</Text>
				)}
				<Text inverse> </Text>
			</Text>
			{suggestions.map((suggestion, index) => {
				const isPicked = index === picked;

				return (
					<Box key={suggestion.label} gap={1}>
						<Box flexShrink={0}>
							<Text color={palette.accent}>{isPicked ? "❯" : " "}</Text>
						</Box>
						<Text wrap="truncate-end">
							<Text
								bold={isPicked}
								color={isPicked ? palette.accent : undefined}
							>
								{suggestion.label}
							</Text>
							{suggestion.tag ? (
								<Text color={palette.soft}> {suggestion.tag}</Text>
							) : null}
							{suggestion.detail ? (
								<Text dimColor> {suggestion.detail}</Text>
							) : null}
						</Text>
					</Box>
				);
			})}
		</Box>
	);
}
