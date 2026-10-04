import React from "react";
import { Box, Text, useInput } from "ink";
import { colors } from "../theme.js";

export type MenuItem = Readonly<{
	label: string;
	signal: string;
	description: string;
}>;

type MenuGridProps = Readonly<{
	items: readonly MenuItem[];
	columns: number;
	onSelect: (index: number) => void;
	isActive?: boolean;
}>;

const clamp = (value: number, minimum: number, maximum: number) =>
	Math.min(Math.max(value, minimum), maximum);

export default function MenuGrid({
	items,
	columns,
	onSelect,
	isActive = true,
}: MenuGridProps) {
	const [selectedIndex, setSelectedIndex] = React.useState(0);
	const last = items.length - 1;

	useInput(
		(input, key) => {
			if (key.leftArrow || input === "h") {
				setSelectedIndex((current) => clamp(current - 1, 0, last));
			} else if (key.rightArrow || input === "l") {
				setSelectedIndex((current) => clamp(current + 1, 0, last));
			} else if (key.upArrow || input === "k") {
				setSelectedIndex((current) => clamp(current - columns, 0, last));
			} else if (key.downArrow || input === "j") {
				setSelectedIndex((current) => clamp(current + columns, 0, last));
			} else if (key.return) {
				onSelect(selectedIndex);
			} else if (/^[1-9]$/v.test(input)) {
				setSelectedIndex(clamp(Number(input) - 1, 0, last));
			}
		},
		{ isActive },
	);

	const rows = Array.from(
		{ length: Math.ceil(items.length / columns) },
		(_, row) => items.slice(row * columns, row * columns + columns),
	);

	return (
		<Box flexDirection="column">
			{rows.map((row, rowIndex) => (
				<Box key={row.map((item) => item.label).join("-")} gap={3}>
					{row.map((item, columnIndex) => {
						const index = rowIndex * columns + columnIndex;
						const isSelected = index === selectedIndex;

						return (
							<Box
								key={item.label}
								flexBasis={0}
								flexGrow={1}
								justifyContent="space-between"
							>
								<Text
									bold={isSelected}
									color={isSelected ? colors.accent : undefined}
									wrap="truncate-end"
								>
									{`${isSelected ? "❯" : " "} ${index + 1}. ${item.label}`}
								</Text>
								<Text dimColor>{item.signal}</Text>
							</Box>
						);
					})}
					{Array.from({ length: columns - row.length }, (_, filler) => (
						<Box key={`filler-${filler}`} flexBasis={0} flexGrow={1} />
					))}
				</Box>
			))}
			<Box marginTop={1}>
				<Text dimColor>{items[selectedIndex]?.description}</Text>
			</Box>
		</Box>
	);
}
