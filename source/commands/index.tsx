import zod from "zod";
import React from "react";
import { Box, Text, useWindowSize } from "ink";
import Character from "../components/character.js";
import MenuGrid from "../components/menu-grid.js";
import StatusPanel from "../components/status-panel.js";

const clamp = (value: number, minimum: number, maximum: number) =>
	Math.min(Math.max(value, minimum), maximum);

export const options = zod.object({
	name: zod.string().describe("Your name").default("Unknown"),
});

type Props = Readonly<{
	options: zod.infer<typeof options>;
}>;

export default function Index({ options }: Props) {
	const { columns } = useWindowSize();
	const terminalWidth = columns || 100;
	const panelWidth = Math.min(clamp(terminalWidth - 4, 68, 112), terminalWidth);
	const contentWidth = Math.max(panelWidth - 4, 40);
	const shouldStackTopRow = contentWidth < 88;
	const characterWidth = shouldStackTopRow ? contentWidth : 32;
	const statusWidth = shouldStackTopRow
		? contentWidth
		: Math.max(contentWidth - characterWidth - 3, 32);
	const menuColumns = contentWidth < 56 ? 1 : 2;
	const operatorName = options.name === "Unknown" ? "Rook Sigma" : options.name;

	return (
		<Box flexDirection="column" width={panelWidth}>
			<Box
				borderStyle="round"
				borderColor="gray"
				flexDirection="column"
				paddingX={1}
				paddingY={1}
				width={panelWidth}
			>
				<Text color="cyanBright">TERMINAL SIGMA</Text>
				<Text color="gray">
					Status on the left, animated character on the right, menu routes
					below.
				</Text>

				<Box
					flexDirection={shouldStackTopRow ? "column" : "row"}
					justifyContent="space-between"
					marginTop={1}
				>
					<StatusPanel operatorName={operatorName} width={statusWidth} />
					<Box
						marginLeft={shouldStackTopRow ? 0 : 3}
						marginTop={shouldStackTopRow ? 1 : 0}
					>
						<Character
							armor="carbon-shell"
							backpack="field-pack"
							helmet="signal-visor"
							name={operatorName}
							weapon="arc-blade"
							width={characterWidth}
						/>
					</Box>
				</Box>

				<Box marginTop={1}>
					<Text color="gray">{"-".repeat(contentWidth)}</Text>
				</Box>

				<Box marginTop={1}>
					<MenuGrid
						columns={menuColumns}
						title="NAVIGATION MENU"
						width={contentWidth}
					/>
				</Box>
			</Box>
		</Box>
	);
}
