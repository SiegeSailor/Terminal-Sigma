import React from "react";
import { TextInput } from "@inkjs/ui";
import { Box, Text } from "ink";
import type { Messages } from "../i18n.js";
import { parseWholeNumber } from "../progress.js";
import { usePalette } from "../theme.js";
import AutocompleteInput, { type Suggestion } from "./autocomplete-input.js";
import Choice, { type Option } from "./choice.js";

// A combination fills several fields at once, such as a past workout.
export type Combination = Readonly<{
	label: string;
	values: Readonly<Record<string, string>>;
}>;

export type Field = Readonly<
	{ key: string; label: string; defaultValue?: string } & (
		| {
				kind: "text";
				placeholder?: string;
				suggest?: (text: string) => readonly Suggestion[];
		  }
		| { kind: "number"; minimum: number; maximum: number }
		| {
				kind: "select";
				options: readonly Option[];
				combinations?: readonly Combination[];
		  }
	)
>;

type EntryFormProps = Readonly<{
	title: string;
	fields: readonly Field[];
	messages: Messages;
	onSubmit: (values: Record<string, string>) => void;
	onValues?: (values: Record<string, string>) => void;
}>;

const combinationPrefix = "combination:";

export default function EntryForm({
	title,
	fields,
	messages,
	onSubmit,
	onValues,
}: EntryFormProps) {
	const palette = usePalette();
	const [values, setValues] = React.useState<Record<string, string>>({});
	// A picked suggestion pre-fills the fields after it.
	const [defaults, setDefaults] = React.useState<Record<string, string>>({});
	const [error, setError] = React.useState<string>();
	const field = fields.find((candidate) => !(candidate.key in values));

	const commit = (next: Record<string, string>) => {
		setError(undefined);
		setValues(next);
		onValues?.(next);

		if (fields.every((candidate) => candidate.key in next)) {
			onSubmit(next);
		}
	};

	const accept = (value: string, suggestion?: Suggestion) => {
		if (!field) {
			return;
		}

		if (field.kind === "select" && value.startsWith(combinationPrefix)) {
			const combination =
				field.combinations?.[Number(value.slice(combinationPrefix.length))];
			commit({ ...values, ...combination?.values });
			return;
		}

		if (field.kind === "text" && !value.trim()) {
			setError(messages.form.required);
			return;
		}

		if (
			field.kind === "number" &&
			parseWholeNumber(value, field.minimum, field.maximum) === undefined
		) {
			setError(messages.form.wholeNumber(field.minimum, field.maximum));
			return;
		}

		if (suggestion?.values) {
			setDefaults((current) => ({ ...current, ...suggestion.values }));
		}

		commit({ ...values, [field.key]: value.trim() });
	};

	const shown = (done: Field) => {
		const value = values[done.key] ?? "";
		return done.kind === "select"
			? (done.options.find((option) => option.value === value)?.label ?? value)
			: value;
	};

	const defaultOf = (current: Field) =>
		defaults[current.key] ?? current.defaultValue;

	const input = (current: Field) => {
		if (current.kind === "select") {
			return (
				<Choice
					key={current.key}
					initialValue={defaultOf(current)}
					options={[
						...(current.combinations ?? []).map((combination, index) => ({
							label: `↺ ${combination.label}`,
							value: `${combinationPrefix}${index}`,
						})),
						...current.options,
					]}
					onSelect={accept}
				/>
			);
		}

		if (current.kind === "text" && current.suggest) {
			return (
				<AutocompleteInput
					key={current.key}
					initialValue={defaultOf(current)}
					placeholder={current.placeholder}
					suggest={current.suggest}
					onSubmit={accept}
				/>
			);
		}

		return (
			<TextInput
				key={`${current.key}-${defaultOf(current) ?? ""}`}
				defaultValue={defaultOf(current)}
				placeholder={
					current.kind === "text"
						? current.placeholder
						: `${current.minimum} - ${current.maximum}`
				}
				onSubmit={(value) => {
					accept(value);
				}}
			/>
		);
	};

	return (
		<Box flexDirection="column">
			<Text bold color={palette.accent}>
				{title}
			</Text>
			{fields
				.filter((done) => done.key in values)
				.map((done) => (
					<Text key={done.key} wrap="truncate-end">
						<Text color={palette.success}>✓ </Text>
						<Text dimColor>{`${done.label}: `}</Text>
						<Text>{shown(done)}</Text>
					</Text>
				))}
			{field ? (
				<Box flexDirection="column">
					<Text bold>{`❯ ${field.label}`}</Text>
					<Box paddingLeft={2}>{input(field)}</Box>
				</Box>
			) : null}
			{error ? <Text color={palette.error}>{error}</Text> : null}
		</Box>
	);
}
