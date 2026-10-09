import React from "react";
import { Box, Text, useInput, usePaste } from "ink";
import { foodSuggestions } from "../foods.js";
import { formatNumber, type Language, type Messages } from "../i18n.js";
import type { Progress } from "../progress.js";
import {
	completionOf,
	describeDraft,
	type Draft,
	type MealDraft,
	type ParseContext,
	parseQuickLog,
	suggestionsOf,
} from "../quick-log.js";
import { usePalette } from "../theme.js";

type LogViewProps = Readonly<{
	progress: Progress;
	language: Language;
	messages: Messages;
	// The time a line is logged at: now, or an edited entry's own time.
	now: number;
	// The line of an entry being edited, logged again in its place on Enter.
	initialLine?: string;
	// A line to start from, such as one with an estimate filled in; unlike
	// initialLine, it edits nothing.
	draftLine?: string;
	// Whether a Coach account exists, so the hint can offer an estimate.
	canEstimate?: boolean;
	// Asks the Coach about a food nobody knows, or says an account is needed.
	onEstimate?: (line: string, draft: MealDraft) => void;
	// Whether the line was saved; a line that was not stays to try again.
	onLog: (line: string, drafts: Draft[]) => boolean;
	onUndo: () => void;
}>;

type Option = Readonly<{ label: string; line: string; detail: string }>;

// With the line empty, the suggestions for now; while a food name is typed,
// the foods it matches, each completing the line.
function optionsOf(
	text: string,
	{ progress, language }: ParseContext,
	messages: Messages,
	suggestions: ReturnType<typeof suggestionsOf>,
): Option[] {
	if (!text) {
		return suggestions.map((suggestion) => ({
			label: suggestion.line,
			line: suggestion.line,
			detail: suggestion.label,
		}));
	}

	const completion = completionOf(text);
	const format = (value: number | undefined) =>
		formatNumber(language, Math.round(value ?? 0));

	if (!completion?.query.trim()) {
		return [];
	}

	return foodSuggestions(completion.query, language, progress.meals).map(
		(food) => ({
			label: food.label,
			line: `${completion.head}${food.label}`,
			detail: [
				food.isYours ? messages.form.yours : food.serving,
				messages.form.nutrition(format(food.calories), format(food.protein)),
			]
				.filter(Boolean)
				.join(" · "),
		}),
	);
}

// Drafts shown under the line before the rest are counted.
const previewCount = 4;

// The Log command line: a live preview of what the line will log, and below
// it the suggestions for now or the foods matching the name being typed.
// Logging, undo, and saving happen in App, through the callbacks.
export default function LogView({
	progress,
	language,
	messages,
	now,
	initialLine,
	draftLine,
	canEstimate,
	onEstimate,
	onLog,
	onUndo,
}: LogViewProps) {
	const palette = usePalette();
	const [text, setText] = React.useState(initialLine ?? draftLine ?? "");
	const [picked, setPicked] = React.useState(-1);
	const { log } = messages;
	const isEditing = initialLine !== undefined;
	// A full-width ｕ from an input method, or a capital U, undoes too.
	const isUndo =
		!isEditing && text.normalize("NFKC").trim().toLowerCase() === "u";
	const context = { progress, now, language };
	const minute = Math.floor(now / 60_000);
	const suggestions = React.useMemo(
		() => suggestionsOf(progress, minute * 60_000),
		[progress, minute],
	);
	const options = isUndo ? [] : optionsOf(text, context, messages, suggestions);
	const highlighted = options[picked];
	const line = highlighted?.line ?? text;
	const result = line.trim() ? parseQuickLog(line, context) : undefined;
	const unknown = result?.ok
		? result.drafts.find(
				(draft): draft is MealDraft => draft.kind === "meal" && !draft.isKnown,
			)
		: undefined;
	const type = (typed: string) => {
		setText((current) => current + typed);
		setPicked(-1);
	};

	useInput((input, key) => {
		if (key.return) {
			if (isUndo) {
				onUndo();
				setText("");
			} else if (result?.ok && onLog(line, result.drafts)) {
				setText("");
				setPicked(-1);
			}
		} else if (key.upArrow) {
			setPicked((current) => Math.max(current - 1, -1));
		} else if (key.downArrow) {
			setPicked((current) => Math.min(current + 1, options.length - 1));
		} else if (key.tab) {
			const choice = highlighted ?? options[0];

			if (choice) {
				setText(choice.line);
				setPicked(-1);
			} else if (unknown && onEstimate) {
				onEstimate(line, unknown);
			}
		} else if (key.backspace || key.delete) {
			setText((current) => [...current].slice(0, -1).join(""));
			setPicked(-1);
		} else if (input && !key.ctrl && !key.meta && !key.escape) {
			type(input);
		}
	});

	// A paste arrives whole and waits for Enter like anything typed; its lines
	// become the items of 1 line.
	usePaste((pasted) => {
		type(
			pasted
				.split(/\r\n|\r|\n/v)
				.map((part) => part.trim())
				.filter(Boolean)
				.join(", "),
		);
	});

	let preview: React.ReactNode = null;

	if (isUndo) {
		preview = <Text dimColor>{log.undoHint}</Text>;
	} else if (result && !result.ok) {
		preview = <Text color={palette.error}>{log.errors[result.error]}</Text>;
	} else if (result?.ok) {
		const { drafts } = result;
		// The items of 1 line may read the same, so each keeps its position.
		const rows = drafts.slice(0, previewCount).map((draft, position) => ({
			position,
			text: describeDraft(draft, messages, language),
			isKnown: draft.kind !== "meal" || draft.isKnown,
		}));
		preview = (
			<>
				{rows.map((row) => (
					<Text key={row.position} wrap="truncate-end">
						<Text color={row.isKnown ? palette.success : palette.error}>
							{"⏺ "}
						</Text>
						<Text>{row.text}</Text>
					</Text>
				))}
				{drafts.length > previewCount ? (
					<Text dimColor>{log.more(drafts.length - previewCount)}</Text>
				) : null}
			</>
		);
	}

	return (
		<Box flexDirection="column">
			<Text bold color={palette.accent}>
				{isEditing ? log.editTitle : log.title}
			</Text>
			<Box gap={1}>
				<Box flexShrink={0}>
					<Text color={palette.accent}>❯</Text>
				</Box>
				<Text wrap="truncate-start">
					{text ? (
						<Text color={palette.accent}>{text}</Text>
					) : (
						<Text dimColor>{log.placeholder}</Text>
					)}
					<Text inverse> </Text>
				</Text>
			</Box>
			<Box flexDirection="column" flexShrink={0} paddingLeft={2}>
				{preview}
				{unknown && onEstimate && canEstimate ? (
					<Text dimColor>{log.estimateHint}</Text>
				) : null}
			</Box>
			{options.length > 0 ? (
				<Box flexDirection="column" flexShrink={0} marginTop={1}>
					{options.map((option, index) => {
						const isPicked = index === picked;

						return (
							<Box key={option.line} gap={1}>
								<Box flexShrink={0}>
									<Text color={palette.accent}>{isPicked ? "❯" : " "}</Text>
								</Box>
								<Text wrap="truncate-end">
									<Text
										bold={isPicked}
										color={isPicked ? palette.accent : undefined}
									>
										{option.label}
									</Text>
									<Text dimColor>{` ${option.detail}`}</Text>
								</Text>
							</Box>
						);
					})}
				</Box>
			) : null}
			<Box flexDirection="column" marginTop={1}>
				<Text dimColor>{log.prefixes}</Text>
				<Text dimColor>{log.shortcuts}</Text>
			</Box>
		</Box>
	);
}
