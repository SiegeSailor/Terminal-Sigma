import React from "react";
import { PasswordInput, TextInput } from "@inkjs/ui";
import { Box, Text } from "ink";
import {
	type Config,
	type Environment,
	maskSecret,
	type Source,
	sourceOf,
	type VariableName,
	variableGroups,
	variableOf,
	variables,
} from "../config.js";
import type { Messages } from "../i18n.js";
import { usePalette } from "../theme.js";
import Choice from "./choice.js";

type EnvironmentViewProps = Readonly<{
	config: Config;
	env: Environment;
	messages: Messages;
	editing?: VariableName;
	// The row the cursor starts on: the variable edited last.
	initialValue?: VariableName;
	// The rows the view may use, so a long list scrolls instead of overflowing.
	height: number;
	onEdit: (name: VariableName) => void;
	onChange: (name: VariableName, value: string | undefined) => void;
}>;

// Every variable with its value and where it comes from; Enter edits 1, and
// an empty value clears what was saved.
export default function EnvironmentView({
	config,
	env,
	messages,
	editing,
	initialValue,
	height,
	onEdit,
	onChange,
}: EnvironmentViewProps) {
	const palette = usePalette();
	const [error, setError] = React.useState<string>();
	const { environment } = messages;
	const sourceColor: Record<Source, string | undefined> = {
		shell: palette.soft,
		saved: palette.accent,
		default: undefined,
	};
	const shown = (name: VariableName) => {
		const value = env[name];

		if (!value) {
			return environment.unset;
		}

		return variableOf(name)?.isSecret ? maskSecret(value) : value;
	};

	if (editing) {
		const variable = variableOf(editing);
		const Input = variable?.isSecret ? PasswordInput : TextInput;
		const submit = (text: string) => {
			if (!text.trim()) {
				onChange(editing, undefined);
				return;
			}

			const value = variable?.parse(text);

			if (value === undefined) {
				setError(environment.invalid);
				return;
			}

			onChange(editing, value);
		};

		return (
			<Box flexDirection="column">
				<Text bold color={palette.accent}>
					{environment.names[editing]}
				</Text>
				<Text dimColor>{environment.describe[editing]}</Text>
				{sourceOf(editing, config, env) === "shell" ? (
					<Text color={palette.soft}>{environment.shellWins}</Text>
				) : null}
				<Box marginTop={1}>
					<Input
						placeholder={environment.placeholder(shown(editing))}
						onSubmit={submit}
					/>
				</Box>
				{error ? <Text color={palette.error}>{error}</Text> : null}
			</Box>
		);
	}

	return (
		<Box flexDirection="column">
			<Text bold color={palette.accent}>
				{messages.menu.environment}
			</Text>
			<Choice
				initialValue={initialValue}
				limit={Math.max(height - 1 - variableGroups.length, 3)}
				options={variables.map(({ name, group }) => {
					const source = sourceOf(name, config, env);

					return {
						group: environment.groups[group],
						label: environment.names[name],
						value: name,
						hint: (
							<Text wrap="truncate-end">
								<Text dimColor>{shown(name)}</Text>
								<Text color={sourceColor[source]}>
									{` ${environment.sources[source]}`}
								</Text>
							</Text>
						),
					};
				})}
				onSelect={(value) => {
					const variable = variableOf(value);

					if (variable) {
						onEdit(variable.name);
					}
				}}
			/>
		</Box>
	);
}
