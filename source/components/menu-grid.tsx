import React from "react";
import { Box, Text, useInput } from "ink";

type InkColor = React.ComponentProps<typeof Text>["color"];

export type MenuItem = Readonly<{
	label: string;
	signal: string;
	description: string;
	color: InkColor;
}>;

type MenuGridProps = Readonly<{
	title: string;
	width: number;
	items: readonly MenuItem[];
	onSelect: (index: number) => void;
	columns?: number;
	isActive?: boolean;
}>;

const clamp = (value: number, minimum: number, maximum: number) =>
	Math.min(Math.max(value, minimum), maximum);

const formatMenuCell = (
	item: MenuItem,
	index: number,
	isSelected: boolean,
	cellWidth: number,
) => {
	const prefix = isSelected ? ">" : " ";
	const label = `${prefix} [${index + 1}] ${item.label}`;
	const signal = item.signal.toUpperCase();
	const gapWidth = Math.max(cellWidth - label.length - signal.length, 1);

	return `${label}${" ".repeat(gapWidth)}${signal}`;
};

export default function MenuGrid({
	title,
	width,
	items: menuItems,
	onSelect,
	columns = 2,
	isActive = true,
}: MenuGridProps) {
	const [selectedIndex, setSelectedIndex] = React.useState(0);
	const safeColumns = Math.max(columns, 1);
	const gapWidth = safeColumns > 1 ? 3 : 0;
	const cellWidth = Math.max(
		Math.floor((width - gapWidth * (safeColumns - 1)) / safeColumns),
		20,
	);

	useInput(
		(input, key) => {
			if (key.leftArrow || input === "h") {
				setSelectedIndex((current) => Math.max(current - 1, 0));
				return;
			}

			if (key.rightArrow || input === "l") {
				setSelectedIndex((current) =>
					Math.min(current + 1, menuItems.length - 1),
				);
				return;
			}

			if (key.upArrow || input === "k") {
				setSelectedIndex((current) => Math.max(current - safeColumns, 0));
				return;
			}

			if (key.downArrow || input === "j") {
				setSelectedIndex((current) =>
					Math.min(current + safeColumns, menuItems.length - 1),
				);
				return;
			}

			if (key.return) {
				onSelect(selectedIndex);
				return;
			}

			const numericChoice = Number.parseInt(input, 10);

			if (Number.isNaN(numericChoice)) {
				return;
			}

			const nextIndex = clamp(numericChoice - 1, 0, menuItems.length - 1);
			setSelectedIndex(nextIndex);
		},
		{ isActive },
	);

	const activeItem = menuItems[selectedIndex] ?? menuItems[0];
	const rowCount = Math.ceil(menuItems.length / safeColumns);
	const rows = Array.from({ length: rowCount }, (_, rowIndex) =>
		menuItems.slice(
			rowIndex * safeColumns,
			rowIndex * safeColumns + safeColumns,
		),
	);

	return (
		<Box flexDirection="column" width={width}>
			<Box justifyContent="space-between">
				<Text color="greenBright">{title}</Text>
				<Text color="gray">Arrows / hjkl / Enter / q</Text>
			</Box>

			<Box flexDirection="column" marginTop={1}>
				{rows.map((row, rowIndex) => (
					<Box key={row.map((item) => item.label).join("-")}>
						{row.map((item, columnIndex) => {
							const index = rowIndex * safeColumns + columnIndex;
							const isSelected = index === selectedIndex;
							const marginRight = columnIndex < row.length - 1 ? gapWidth : 0;

							return (
								<Box
									key={item.label}
									marginRight={marginRight}
									width={cellWidth}
								>
									<Text
										backgroundColor={isSelected ? "cyan" : undefined}
										color={isSelected ? "black" : item.color}
									>
										{formatMenuCell(item, index, isSelected, cellWidth)}
									</Text>
								</Box>
							);
						})}
					</Box>
				))}
			</Box>

			{activeItem ? (
				<Box marginTop={1}>
					<Text color={activeItem.color}>{activeItem.description}</Text>
				</Box>
			) : null}
		</Box>
	);
}
