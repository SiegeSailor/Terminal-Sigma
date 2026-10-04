import React from "react";
import { TextInput } from "@inkjs/ui";
import { Box, Text } from "ink";
import type { Messages } from "../i18n.js";
import { parseWholeNumber } from "../progress.js";
import { usePalette } from "../theme.js";
import Choice, { type Option } from "./choice.js";

export type Field = Readonly<
	{ key: string; label: string; defaultValue?: string } & (
		| { kind: "text"; placeholder?: string }
		| { kind: "number"; minimum: number; maximum: number }
		| { kind: "select"; options: readonly Option[] }
	)
>;

type EntryFormProps = Readonly<{
	title: string;
	fields: readonly Field[];
	messages: Messages;
	onSubmit: (values: Record<string, string>) => void;
	onValues?: (values: Record<string, string>) => void;
}>;

export default function EntryForm({
	title,
	fields,
	messages,
	onSubmit,
	onValues,
}: EntryFormProps) {
	const palette = usePalette();
	const [values, setValues] = React.useState<Record<string, string>>({});
	const [error, setError] = React.useState<string>();
	const field = fields[Object.keys(values).length];

	const accept = (value: string) => {
		if (!field) {
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

		const next = { ...values, [field.key]: value.trim() };
		setError(undefined);
		setValues(next);
		onValues?.(next);

		if (Object.keys(next).length === fields.length) {
			onSubmit(next);
		}
	};

	const shown = (done: Field) => {
		const value = values[done.key] ?? "";
		return done.kind === "select"
			? (done.options.find((option) => option.value === value)?.label ?? value)
			: value;
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
					<Box paddingLeft={2}>
						{field.kind === "select" ? (
							<Choice
								key={field.key}
								initialValue={field.defaultValue}
								options={field.options}
								onSelect={accept}
							/>
						) : (
							<TextInput
								key={field.key}
								defaultValue={field.defaultValue}
								placeholder={
									field.kind === "text"
										? field.placeholder
										: `${field.minimum} - ${field.maximum}`
								}
								onSubmit={accept}
							/>
						)}
					</Box>
				</Box>
			) : null}
			{error ? <Text color={palette.error}>{error}</Text> : null}
		</Box>
	);
}
