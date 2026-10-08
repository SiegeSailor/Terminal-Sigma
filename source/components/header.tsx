import React from "react";
import { Box, Text, useAnimation } from "ink";
import { quoteNoticeMilliseconds, quoteNoticeOf, typedOf } from "../quotes.js";
import { usePalette } from "../theme.js";

type HeaderProps = Readonly<{
	clock: string;
	// What identifies the quote in any language, so a translation is not news.
	quoteKey: string;
	line: string;
	freshLabel: string;
	isReduced: boolean;
}>;

// The title, the clock, and the everyday quote, which marks itself new and
// types itself in whenever it changes.
export default function Header({
	clock,
	quoteKey,
	line,
	freshLabel,
	isReduced,
}: HeaderProps) {
	const palette = usePalette();
	const [isFresh, setIsFresh] = React.useState(false);
	const previous = React.useRef(quoteKey);
	// Redraws 20 times a second only while the notice shows. Its `time` is the
	// clock of the notice, since xo's react-hooks/purity forbids Date.now() here.
	const { time, reset } = useAnimation({
		interval: isReduced ? 1000 : 50,
		isActive: isFresh,
	});

	// A layout effect restarts typing before the commit paints, so the whole new quote never flashes.
	React.useLayoutEffect(() => {
		if (previous.current !== quoteKey) {
			previous.current = quoteKey;
			reset();
			setIsFresh(true);
		}
	}, [quoteKey, reset]);

	React.useEffect(() => {
		if (isFresh && time >= quoteNoticeMilliseconds) {
			setIsFresh(false);
		}
	}, [isFresh, time]);

	const notice = quoteNoticeOf(isFresh ? 0 : undefined, time, isReduced);

	return (
		<Box
			borderColor={palette.accent}
			borderStyle="round"
			flexDirection="column"
			flexShrink={0}
			paddingX={1}
		>
			<Box justifyContent="space-between">
				<Text bold color={palette.accent}>
					✻ Terminal Sigma
				</Text>
				<Text dimColor>{clock}</Text>
			</Box>
			<Text wrap="truncate-end">
				{notice.isNew ? (
					<Text bold color={palette.accent}>{`✦ ${freshLabel} `}</Text>
				) : null}
				<Text
					italic
					color={notice.isNew ? palette.soft : undefined}
					dimColor={!notice.isNew}
				>
					{typedOf(line, notice.shown)}
				</Text>
			</Text>
		</Box>
	);
}
