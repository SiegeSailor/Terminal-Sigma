import React from "react";
import { Box, Text, useInput } from "ink";
import { usePalette } from "../theme.js";
import type { Option } from "./choice.js";

type MultiChoiceProps = Readonly<{
	options: readonly Option[];
	initial: readonly string[];
	doneLabel: string;
	onDone: (selected: string[]) => void;
	visibleCount?: number;
}>;

// A checklist: Enter or Space toggles, and the last row saves.
export default function MultiChoice({
	options,
	initial,
	doneLabel,
	onDone,
	visibleCount = 8,
}: MultiChoiceProps) {
	const palette = usePalette();
	const [chosen, setChosen] = React.useState(() => new Set(initial));
	const [index, setIndex] = React.useState(0);
	const rows = [...options, { label: doneLabel, value: "" }];
	const start = Math.min(
		Math.max(index - Math.floor(visibleCount / 2), 0),
		Math.max(rows.length - visibleCount, 0),
	);

	useInput((input, key) => {
		if (key.upArrow || input === "k") {
			setIndex((current) => (current - 1 + rows.length) % rows.length);
		} else if (key.downArrow || input === "j") {
			setIndex((current) => (current + 1) % rows.length);
		} else if (key.return || input === " ") {
			const option = options[index];

			if (!option) {
				onDone(
					options.flatMap((item) =>
						chosen.has(item.value) ? [item.value] : [],
					),
				);
				return;
			}

			setChosen((current) => {
				const next = new Set(current);

				if (next.has(option.value)) {
					next.delete(option.value);
				} else {
					next.add(option.value);
				}

				return next;
			});
		}
	});

	return (
		<Box flexDirection="column">
			{rows.slice(start, start + visibleCount).map((row, offset) => {
				const isFocused = start + offset === index;
				const isDone = start + offset === options.length;

				return (
					<Box key={row.value || "done"} gap={1}>
						<Text color={palette.accent}>{isFocused ? "❯" : " "}</Text>
						{isDone ? null : (
							<Text color={chosen.has(row.value) ? palette.accent : undefined}>
								{chosen.has(row.value) ? "[x]" : "[ ]"}
							</Text>
						)}
						<Text
							bold={isFocused}
							color={isFocused ? palette.accent : undefined}
						>
							{row.label}
						</Text>
					</Box>
				);
			})}
		</Box>
	);
}
