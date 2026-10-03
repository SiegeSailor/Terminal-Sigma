import { Badge } from "@inkjs/ui";
import React from "react";
import { Box, Text, useInput } from "ink";

type InkColor = React.ComponentProps<typeof Text>["color"];

type MenuItem = Readonly<{
	label: string;
	signal: string;
	description: string;
	color: InkColor;
}>;

type MenuGridProps = Readonly<{
	title: string;
	width: number;
	columns?: number;
}>;

const menuItems: readonly MenuItem[] = [
	{
		label: "Mission Log",
		signal: "3 new",
		description:
			"Review active quests, streaks, and the current objective chain.",
		color: "cyanBright",
	},
	{
		label: "Loadout Bay",
		signal: "2 swaps",
		description: "Preview future armor, weapon, helmet, and backpack presets.",
		color: "greenBright",
	},
	{
		label: "Habit Forge",
		signal: "91%",
		description:
			"Inspect routines, timers, and pressure settings for focused sessions.",
		color: "yellowBright",
	},
	{
		label: "Signal Deck",
		signal: "live",
		description:
			"Check alerts, syncs, and shell-level notifications before deeper flows.",
		color: "magentaBright",
	},
];

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

export default function MenuGrid({ title, width, columns = 2 }: MenuGridProps) {
	const [selectedIndex, setSelectedIndex] = React.useState(0);
	const [lastAction, setLastAction] = React.useState(
		"Use arrows or hjkl to browse. Enter triggers a mock route.",
	);
	const safeColumns = Math.max(columns, 1);
	const gapWidth = safeColumns > 1 ? 3 : 0;
	const cellWidth = Math.max(
		Math.floor((width - gapWidth * (safeColumns - 1)) / safeColumns),
		20,
	);

	useInput((input, key) => {
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
			const activeItem = menuItems[selectedIndex] ?? menuItems[0];

			if (activeItem) {
				setLastAction(`Mock route queued: ${activeItem.label} opens next.`);
			}

			return;
		}

		const numericChoice = Number.parseInt(input, 10);

		if (Number.isNaN(numericChoice)) {
			return;
		}

		const nextIndex = clamp(numericChoice - 1, 0, menuItems.length - 1);
		setSelectedIndex(nextIndex);
	});

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
				<Box>
					<Text color="greenBright">{title}</Text>
					<Box marginLeft={1}>
						<Badge color="blue">MOCK</Badge>
					</Box>
				</Box>
				<Text color="gray">Arrows / hjkl / Enter</Text>
			</Box>
			<Text color="gray">{lastAction}</Text>

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
