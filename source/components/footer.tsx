import React from "react";
import { Box, Text, useAnimation } from "ink";
import { colors, spinnerFrames } from "../theme.js";

export type Tone = "info" | "success" | "error";

type FooterProps = Readonly<{
	status?: string;
	message: string;
	tone: Tone;
	hint: string;
}>;

function Spinner() {
	const { frame } = useAnimation({ interval: 120 });
	return (
		<Text color={colors.accent}>
			{spinnerFrames[frame % spinnerFrames.length]}
		</Text>
	);
}

const toneColor: Record<Tone, string | undefined> = {
	info: undefined,
	success: colors.focus,
	error: colors.error,
};

// Like Claude Code's status line: a spinner while something runs, a bullet otherwise.
export default function Footer({ status, message, tone, hint }: FooterProps) {
	return (
		<Box flexShrink={0} gap={2} justifyContent="space-between" paddingX={1}>
			<Text wrap="truncate-end">
				{status ? (
					<>
						<Spinner />
						<Text color={colors.accent}>{` ${status}`}</Text>
						<Text dimColor>{`  ${message}`}</Text>
					</>
				) : (
					<>
						<Text color={toneColor[tone]} dimColor={tone === "info"}>
							⏺
						</Text>
						<Text>{` ${message}`}</Text>
					</>
				)}
			</Text>
			<Box flexShrink={0}>
				<Text dimColor>{hint}</Text>
			</Box>
		</Box>
	);
}
