import React from "react";
import { TextInput } from "@inkjs/ui";
import {
	Box,
	type DOMElement,
	measureElement,
	Text,
	useAnimation,
	useInput,
} from "ink";
import type { Session } from "../coach.js";
import { type Account, maskSecret } from "../config.js";
import type { Messages } from "../i18n.js";
import { spinnerFrames, usePalette } from "../theme.js";
import Choice, { type Option } from "./choice.js";

export type CoachMode = "menu" | "ask" | "read";

// The rows of the content that do not fit its viewport, once laid out.
const hiddenRowsOf = (viewport?: DOMElement, content?: DOMElement) =>
	viewport && content
		? Math.max(
				measureElement(content).height - measureElement(viewport).height,
				0,
			)
		: 0;

type CoachViewProps = Readonly<{
	messages: Messages;
	mode: CoachMode;
	options: readonly Option[];
	session?: Session;
	// The account being asked right now.
	asking?: string;
	// The option the cursor returns to after a request.
	initialOption?: string;
	isSetUp: boolean;
	height: number;
	onSelect: (value: string) => void;
	onAsk: (text: string) => void;
}>;

// The requests, a spinner naming the account being asked, and the latest
// answer; Read scrolls the whole session row by row, from the latest turn.
export default function CoachView({
	messages,
	mode,
	options,
	session,
	asking,
	initialOption,
	isSetUp,
	height,
	onSelect,
	onAsk,
}: CoachViewProps) {
	const palette = usePalette();
	const { coach } = messages;
	const turns = session?.turns ?? [];
	const viewport = React.useRef<DOMElement>(null);
	const content = React.useRef<DOMElement>(null);
	const lastTurn = React.useRef<DOMElement>(null);
	// Rows of the session scrolled out of view above.
	const [offset, setOffset] = React.useState(0);
	const { frame } = useAnimation({
		interval: 120,
		isActive: asking !== undefined,
	});

	// Read opens on the latest turn, as far down as the session scrolls.
	React.useEffect(() => {
		if (mode === "read" && content.current && lastTurn.current) {
			setOffset(
				Math.min(
					measureElement(content.current).height -
						measureElement(lastTurn.current).height,
					hiddenRowsOf(
						viewport.current ?? undefined,
						content.current ?? undefined,
					),
				),
			);
		}
	}, [mode]);

	useInput(
		(_input, key) => {
			if (key.upArrow) {
				setOffset((current) => Math.max(current - 1, 0));
			} else if (key.downArrow) {
				const most = hiddenRowsOf(
					viewport.current ?? undefined,
					content.current ?? undefined,
				);
				setOffset((current) => Math.min(current + 1, most));
			}
		},
		{ isActive: mode === "read" },
	);

	const latest = turns.findLast((turn) => turn.role === "assistant");
	const shown = mode === "read" ? turns : latest ? [latest] : [];

	let controls: React.ReactNode = null;

	if (asking) {
		controls = (
			<Text color={palette.accent}>
				{`${spinnerFrames[frame % spinnerFrames.length] ?? "·"} ${coach.asking(asking)}`}
			</Text>
		);
	} else if (mode === "ask") {
		controls = (
			<Box>
				<Text color={palette.accent}>❯ </Text>
				<TextInput
					placeholder={coach.placeholder}
					onSubmit={(text) => {
						if (text.trim()) {
							onAsk(text.trim());
						}
					}}
				/>
			</Box>
		);
	} else if (mode === "menu") {
		controls = (
			<Choice
				initialValue={initialOption}
				options={options}
				onSelect={onSelect}
			/>
		);
	}

	return (
		<Box flexDirection="column" height={height} overflow="hidden">
			<Text bold color={palette.accent}>
				{messages.menu.coach}
			</Text>
			{isSetUp ? null : <Text dimColor>{coach.setUp}</Text>}
			{controls ? (
				<Box flexShrink={0} marginTop={1}>
					{controls}
				</Box>
			) : null}
			{/* Takes exactly the rows left, so the turns scroll inside it. */}
			<Box
				ref={viewport}
				flexBasis={0}
				flexDirection="column"
				flexGrow={1}
				overflow="hidden"
			>
				<Box
					ref={content}
					flexDirection="column"
					flexShrink={0}
					marginTop={-offset}
				>
					{shown.map((turn, index) => (
						<Box
							// Turns never reorder, and 2 can share a timestamp.
							// eslint-disable-next-line react/no-array-index-key
							key={`${turn.at}-${index}`}
							ref={index === shown.length - 1 ? lastTurn : undefined}
							flexDirection="column"
							flexShrink={0}
							marginTop={1}
						>
							<Text
								bold
								color={turn.role === "user" ? palette.soft : palette.accent}
							>
								{turn.role === "user"
									? coach.you
									: (turn.via ?? messages.menu.coach)}
							</Text>
							<Text>{turn.content}</Text>
						</Box>
					))}
				</Box>
			</Box>
		</Box>
	);
}

type AccountsViewProps = Readonly<{
	messages: Messages;
	accounts: readonly Account[];
	savedIds: ReadonlySet<string>;
	// The saved account whose actions show, if any.
	selected?: string;
	onSelect: (value: string) => void;
	onAction: (action: "up" | "down" | "remove" | "back") => void;
}>;

// Every account in the order the fallback tries them, keys masked.
export function AccountsView({
	messages,
	accounts,
	savedIds,
	selected,
	onSelect,
	onAction,
}: AccountsViewProps) {
	const palette = usePalette();
	const words = messages.accounts;
	const chosen = accounts.find((account) => account.id === selected);

	if (chosen) {
		const actions = ["up", "down", "remove", "back"] as const;

		return (
			<Box flexDirection="column">
				<Text bold color={palette.accent}>
					{chosen.label}
				</Text>
				<Choice
					options={actions.map((action) => ({
						label: words[action],
						value: action,
					}))}
					onSelect={(value) => {
						onAction(actions.find((action) => action === value) ?? "back");
					}}
				/>
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			<Text bold color={palette.accent}>
				{words.title}
			</Text>
			<Text dimColor>{words.order}</Text>
			<Box marginTop={1}>
				<Choice
					options={[
						...accounts.map((account) => ({
							label: account.label,
							value: account.id,
							hint: (
								<Text dimColor wrap="truncate-end">
									{[
										words.names[account.provider],
										...(account.apiKey ? [maskSecret(account.apiKey)] : []),
										account.model,
										...(savedIds.has(account.id) ? [] : [words.shell]),
									].join(" · ")}
								</Text>
							),
						})),
						{ label: words.add, value: "add" },
						{ label: words.back, value: "back" },
					]}
					onSelect={onSelect}
				/>
			</Box>
		</Box>
	);
}
