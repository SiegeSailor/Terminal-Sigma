import { extendTheme, defaultTheme } from "@inkjs/ui";

// The palette Claude Code uses, so the dashboard feels at home next to it.
export const colors = {
	accent: "#D97757",
	border: "#888888",
	error: "#FF6B80",
	focus: "#4EBA65",
	diet: "#FFC107",
	workout: "#B48EF2",
} as const;

// Claude Code's spinner: the glyphs grow, then shrink back.
const spinnerGlyphs = ["·", "✢", "✳", "✶", "✻", "✽"];
export const spinnerFrames = [
	...spinnerGlyphs,
	...spinnerGlyphs.slice(1, -1).toReversed(),
];

export const uiTheme = extendTheme(defaultTheme, {
	components: {
		// Keys are @inkjs/ui component names.
		// eslint-disable-next-line @typescript-eslint/naming-convention
		Select: {
			styles: {
				focusIndicator: () => ({ color: colors.accent }),
				label: ({ isFocused }: { isFocused: boolean }) => ({
					color: isFocused ? colors.accent : undefined,
				}),
			},
		},
		// eslint-disable-next-line @typescript-eslint/naming-convention
		TextInput: {
			styles: {
				value: () => ({ color: colors.accent }),
			},
		},
	},
});
