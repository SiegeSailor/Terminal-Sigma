import React from "react";
import { Box, Text, useInput } from "ink";
import { describeLog } from "../content.js";
import type { Language, Messages } from "../i18n.js";
import { type Log, logKinds } from "../progress.js";
import { usePalette } from "../theme.js";

export { describeLog } from "../content.js";

const filters = ["all", ...logKinds] as const;
type Filter = (typeof filters)[number];

type LogRowProps = Readonly<{
	log: Log;
	language: Language;
	messages: Messages;
}>;

export function LogRow({ log, language, messages }: LogRowProps) {
	const palette = usePalette();
	const kindColor: Record<Log["kind"], string> = {
		focus: palette.metrics.focus,
		meal: palette.metrics.protein,
		workout: palette.metrics.workout,
		water: palette.soft,
		sleep: palette.deep,
		body: palette.metrics.character,
		mood: palette.accent,
		habit: palette.metrics.calories,
		steps: palette.metrics.workout,
		note: palette.soft,
		event: palette.soft,
	};
	const formatDate = new Intl.DateTimeFormat(language, {
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});

	return (
		<Box gap={1}>
			<Box flexShrink={0} width={12}>
				<Text dimColor>{formatDate.format(new Date(log.at))}</Text>
			</Box>
			<Box flexShrink={0} width={8}>
				<Text color={kindColor[log.kind]} wrap="truncate-end">
					{messages.logs.kinds[log.kind]}
				</Text>
			</Box>
			<Box flexGrow={1}>
				<Text wrap="truncate-end">{describeLog(log, language, messages)}</Text>
			</Box>
			<Box flexShrink={0} justifyContent="flex-end" width={8}>
				<Text color={palette.accent}>
					{log.experience > 0 ? `+${log.experience} XP` : ""}
				</Text>
			</Box>
		</Box>
	);
}

type HistoryViewProps = Readonly<{
	logs: readonly Log[];
	language: Language;
	messages: Messages;
	height: number;
	onEdit: (log: Log) => void;
	onDelete: (log: Log) => void;
	onRepeat: (log: Log) => void;
	onUndo: () => void;
}>;

// Every log, newest first, filtered by kind, with a cursor: e edits the log
// under it, d deletes it, r logs it again now, and u puts back the last
// deleted one. App does the saving through the callbacks.
export default function HistoryView({
	logs,
	language,
	messages,
	height,
	onEdit,
	onDelete,
	onRepeat,
	onUndo,
}: HistoryViewProps) {
	const palette = usePalette();
	const [filter, setFilter] = React.useState<Filter>("all");
	const [cursor, setCursor] = React.useState(0);
	const [offset, setOffset] = React.useState(0);
	const shown = logs.filter((log) => filter === "all" || log.kind === filter);
	// Title, summary, and their spacing take 3 rows.
	const pageSize = Math.max(height - 3, 3);
	const at = Math.min(cursor, Math.max(shown.length - 1, 0));
	const top = Math.min(offset, at);
	const label = (option: Filter) =>
		option === "all" ? messages.logs.all : messages.logs.kinds[option];

	useInput((input, key) => {
		const picked = shown[at];
		const moveFilter = (step: number) => {
			const next =
				filters[
					(filters.indexOf(filter) + step + filters.length) % filters.length
				];

			if (next) {
				setFilter(next);
				setCursor(0);
				setOffset(0);
			}
		};

		const moveCursor = (step: number) => {
			const next = Math.min(Math.max(at + step, 0), shown.length - 1);
			setCursor(next);
			setOffset(Math.min(Math.max(top, next - pageSize + 1), next));
		};

		if (key.leftArrow || input === "h") {
			moveFilter(-1);
		} else if (key.rightArrow || input === "l" || key.tab) {
			moveFilter(1);
		} else if (key.upArrow || input === "k") {
			moveCursor(-1);
		} else if (key.downArrow || input === "j") {
			moveCursor(1);
		} else if (key.pageUp) {
			moveCursor(-pageSize);
		} else if (key.pageDown) {
			moveCursor(pageSize);
		} else if (input === "u") {
			onUndo();
		} else if (picked && input === "e") {
			onEdit(picked);
		} else if (picked && input === "d") {
			onDelete(picked);
		} else if (picked && input === "r") {
			onRepeat(picked);
		}
	});

	return (
		<Box flexDirection="column" flexGrow={1}>
			<Box gap={2}>
				<Text bold color={palette.accent}>
					{messages.logs.title}
				</Text>
				<Text>
					<Text dimColor>{"‹ "}</Text>
					<Text bold color={palette.accent}>
						{label(filter)}
					</Text>
					<Text dimColor>{" ›"}</Text>
				</Text>
				<Text dimColor wrap="truncate-end">
					{messages.logs.summary(
						shown.length,
						shown.reduce((total, log) => total + log.experience, 0),
					)}
				</Text>
			</Box>
			<Box flexDirection="column" marginTop={1}>
				{shown.length === 0 ? (
					<Text dimColor>{messages.logs.empty}</Text>
				) : null}
				{shown.slice(top, top + pageSize).map((log, row) => (
					<Box key={`${log.kind}-${log.index}`} gap={1}>
						<Box flexShrink={0}>
							<Text color={palette.accent}>{top + row === at ? "❯" : " "}</Text>
						</Box>
						<Box flexGrow={1}>
							<LogRow language={language} log={log} messages={messages} />
						</Box>
					</Box>
				))}
			</Box>
		</Box>
	);
}
