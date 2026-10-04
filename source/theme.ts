import React from "react";
import { extendTheme, defaultTheme } from "@inkjs/ui";

export const themeNames = ["ember", "moss", "frost", "dusk", "mono"] as const;
export type ThemeName = (typeof themeNames)[number];

// Every color of a theme comes from 1 hue family, so nothing shouts over the rest.
export type Palette = Readonly<{
	accent: string;
	soft: string;
	deep: string;
	border: string;
	success: string;
	error: string;
	metrics: Readonly<{
		character: string;
		focus: string;
		protein: string;
		calories: string;
		workout: string;
	}>;
	sprite: Readonly<{
		cloak: string;
		cloakShade: string;
		scarf: string;
		scarfShade: string;
		glow: string;
	}>;
}>;

export const themes: Readonly<Record<ThemeName, Palette>> = {
	// Claude Code's orange.
	ember: {
		accent: "#D97757",
		soft: "#E8A87C",
		deep: "#A65A41",
		border: "#6E5A52",
		success: "#C4B07A",
		error: "#E0605A",
		metrics: {
			character: "#D97757",
			focus: "#E8A87C",
			protein: "#C98E6B",
			calories: "#B9785F",
			workout: "#F0C29C",
		},
		sprite: {
			cloak: "#4A3036",
			cloakShade: "#33212A",
			scarf: "#D97757",
			scarfShade: "#A65A41",
			glow: "#FFB38A",
		},
	},
	// The earthy greens of Drova.
	moss: {
		accent: "#8FB573",
		soft: "#B9D19F",
		deep: "#5E7F4A",
		border: "#56604E",
		success: "#C9D9A8",
		error: "#D9826B",
		metrics: {
			character: "#8FB573",
			focus: "#B9D19F",
			protein: "#A3B97E",
			calories: "#7E9C63",
			workout: "#C9D9A8",
		},
		sprite: {
			cloak: "#34402C",
			cloakShade: "#242D1F",
			scarf: "#8FB573",
			scarfShade: "#5E7F4A",
			glow: "#D6F0A8",
		},
	},
	frost: {
		accent: "#7FA7D9",
		soft: "#A9C7EC",
		deep: "#4F75A6",
		border: "#4F5866",
		success: "#9FD3C7",
		error: "#E07A8B",
		metrics: {
			character: "#7FA7D9",
			focus: "#A9C7EC",
			protein: "#8FB3DE",
			calories: "#6A92C4",
			workout: "#BFD6F2",
		},
		sprite: {
			cloak: "#2A3446",
			cloakShade: "#1D2433",
			scarf: "#7FA7D9",
			scarfShade: "#4F75A6",
			glow: "#BFE3FF",
		},
	},
	dusk: {
		accent: "#A98BD8",
		soft: "#C9B5EA",
		deep: "#7559A8",
		border: "#5A5266",
		success: "#D8C9F0",
		error: "#E07A9A",
		metrics: {
			character: "#A98BD8",
			focus: "#C9B5EA",
			protein: "#B49EDF",
			calories: "#8E6FC4",
			workout: "#D8C9F0",
		},
		sprite: {
			cloak: "#352B4A",
			cloakShade: "#251E36",
			scarf: "#A98BD8",
			scarfShade: "#7559A8",
			glow: "#E5D4FF",
		},
	},
	mono: {
		accent: "#D4D4D4",
		soft: "#EDEDED",
		deep: "#9A9A9A",
		border: "#5E5E5E",
		success: "#FFFFFF",
		error: "#E08080",
		metrics: {
			character: "#D4D4D4",
			focus: "#EDEDED",
			protein: "#BDBDBD",
			calories: "#A6A6A6",
			workout: "#FFFFFF",
		},
		sprite: {
			cloak: "#3A3A3A",
			cloakShade: "#262626",
			scarf: "#BDBDBD",
			scarfShade: "#8A8A8A",
			glow: "#FFFFFF",
		},
	},
};

export const paletteContext = React.createContext<Palette>(themes.ember);

export const usePalette = () => React.useContext(paletteContext);

// Claude Code's spinner: the glyphs grow, then shrink back.
const spinnerGlyphs = ["·", "✢", "✳", "✶", "✻", "✽"];
export const spinnerFrames = [
	...spinnerGlyphs,
	...spinnerGlyphs.slice(1, -1).toReversed(),
];

export const uiThemeOf = (palette: Palette) =>
	extendTheme(defaultTheme, {
		components: {
			// Keys are @inkjs/ui component names.
			// eslint-disable-next-line @typescript-eslint/naming-convention
			TextInput: {
				styles: {
					value: () => ({ color: palette.accent }),
				},
			},
		},
	});
