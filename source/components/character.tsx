import { Badge } from "@inkjs/ui";
import React from "react";
import { Box, Text } from "ink";

type InkColor = React.ComponentProps<typeof Text>["color"];
type BadgeColor = "blue" | "green" | "yellow" | "red";

const beltShape = String.raw` /_\ `;
const visorCrest = String.raw` /^\ `;
const hoodCrest = String.raw` /~\ `;
const backslash = String.raw`\ `.trimEnd();
const walkStride = `/ ${backslash}`;

export type ArmorOption = "scout-weave" | "carbon-shell" | "bulwark-plate";
export type WeaponOption = "arc-blade" | "pulse-rifle" | "signal-staff";
export type HelmetOption = "signal-visor" | "horned-guard" | "hood-shell";
export type BackpackOption = "field-pack" | "cargo-rig" | "reactor-pack";

type CharacterProps = Readonly<{
	width: number;
	name: string;
	armor?: ArmorOption;
	weapon?: WeaponOption;
	helmet?: HelmetOption;
	backpack?: BackpackOption;
}>;

type SpriteSegment = Readonly<{
	key: string;
	text: string;
	color?: InkColor;
}>;

type LoadoutDisplay = Readonly<{
	label: string;
	color: InkColor;
}>;

type ArmorDisplay = LoadoutDisplay &
	Readonly<{
		chest: string;
		belt: string;
	}>;

type WeaponDisplay = LoadoutDisplay &
	Readonly<{
		top: string;
		middle: string;
		bottom: string;
	}>;

type HelmetDisplay = LoadoutDisplay &
	Readonly<{
		crest: string;
		frameLeft: string;
		frameRight: string;
	}>;

type BackpackDisplay = LoadoutDisplay &
	Readonly<{
		top: string;
		middle: string;
		bottom: string;
	}>;

type AnimationFrame = Readonly<{
	mode: "walk" | "talk" | "guard";
	leftArm: string;
	rightArm: string;
	legs: string;
	expression: string;
	callout: string;
}>;

type AnimationMode = AnimationFrame["mode"];

type SpriteRowProps = Readonly<{
	indent: number;
	segments: readonly SpriteSegment[];
}>;

type LoadoutRowProps = Readonly<{
	label: string;
	value: string;
	color: InkColor;
}>;

const armorOptions: Record<ArmorOption, ArmorDisplay> = {
	"scout-weave": {
		label: "Scout Weave",
		color: "greenBright",
		chest: "|=^=|",
		belt: beltShape,
	},
	"carbon-shell": {
		label: "Carbon Shell",
		color: "yellowBright",
		chest: "|###|",
		belt: beltShape,
	},
	"bulwark-plate": {
		label: "Bulwark Plate",
		color: "cyanBright",
		chest: "|*#*|",
		belt: beltShape,
	},
};

const weaponOptions: Record<WeaponOption, WeaponDisplay> = {
	"arc-blade": {
		label: "Arc Blade",
		color: "magentaBright",
		top: " /",
		middle: "==>",
		bottom: ` ${backslash}`,
	},
	"pulse-rifle": {
		label: "Pulse Rifle",
		color: "redBright",
		top: " _",
		middle: "-|>",
		bottom: " /",
	},
	"signal-staff": {
		label: "Signal Staff",
		color: "blueBright",
		top: " *",
		middle: " |",
		bottom: " |",
	},
};

const helmetOptions: Record<HelmetOption, HelmetDisplay> = {
	"signal-visor": {
		label: "Signal Visor",
		color: "cyanBright",
		crest: visorCrest,
		frameLeft: "[",
		frameRight: "]",
	},
	"horned-guard": {
		label: "Horned Guard",
		color: "yellowBright",
		crest: `/^^${backslash}`,
		frameLeft: "{",
		frameRight: "}",
	},
	"hood-shell": {
		label: "Hood Shell",
		color: "magentaBright",
		crest: hoodCrest,
		frameLeft: "<",
		frameRight: ">",
	},
};

const backpackOptions: Record<BackpackOption, BackpackDisplay> = {
	"field-pack": {
		label: "Field Pack",
		color: "greenBright",
		top: "[]",
		middle: "[]",
		bottom: "[]",
	},
	"cargo-rig": {
		label: "Cargo Rig",
		color: "yellowBright",
		top: "{}",
		middle: "{}",
		bottom: "{}",
	},
	"reactor-pack": {
		label: "Reactor Pack",
		color: "cyanBright",
		top: "()",
		middle: "()",
		bottom: "()",
	},
};

const animationFrames: readonly AnimationFrame[] = [
	{
		mode: "walk",
		leftArm: "/",
		rightArm: "-",
		legs: walkStride,
		expression: "o_o",
		callout: "Stride calibrated.",
	},
	{
		mode: "walk",
		leftArm: "<",
		rightArm: backslash,
		legs: "| /",
		expression: "o_o",
		callout: "Route locked.",
	},
	{
		mode: "talk",
		leftArm: "/",
		rightArm: "^",
		legs: walkStride,
		expression: "o-o",
		callout: "Telemetry sounds clean.",
	},
	{
		mode: "talk",
		leftArm: "/",
		rightArm: "~",
		legs: walkStride,
		expression: "o_o",
		callout: "Backlog pressure nominal.",
	},
	{
		mode: "guard",
		leftArm: "/",
		rightArm: backslash,
		legs: walkStride,
		expression: "o_o",
		callout: "Holding formation.",
	},
];

const modeBadgeColor: Record<AnimationMode, BadgeColor> = {
	walk: "blue",
	talk: "green",
	guard: "yellow",
};

const modeLabel: Record<AnimationMode, string> = {
	walk: "WALK",
	talk: "TALK",
	guard: "GUARD",
};

const calloutColor: Record<AnimationMode, InkColor> = {
	walk: "cyanBright",
	talk: "magentaBright",
	guard: "yellowBright",
};

function SpriteRow({ indent, segments }: SpriteRowProps) {
	return (
		<Box marginLeft={indent}>
			{segments.map((segment) => (
				<Text key={segment.key} color={segment.color}>
					{segment.text}
				</Text>
			))}
		</Box>
	);
}

function LoadoutRow({ label, value, color }: LoadoutRowProps) {
	return (
		<Box justifyContent="space-between">
			<Text color="gray">{label}</Text>
			<Text color={color}>{value}</Text>
		</Box>
	);
}

export default function Character({
	width,
	name,
	armor = "carbon-shell",
	weapon = "arc-blade",
	helmet = "signal-visor",
	backpack = "field-pack",
}: CharacterProps) {
	const [frameIndex, setFrameIndex] = React.useState(0);

	React.useEffect(() => {
		const interval = setInterval(() => {
			setFrameIndex((current) => (current + 1) % animationFrames.length);
		}, 240);

		return () => {
			clearInterval(interval);
		};
	}, []);

	const fallbackFrame = animationFrames[0];

	if (!fallbackFrame) {
		throw new Error("Character animation frames are required.");
	}

	const frame = animationFrames[frameIndex] ?? fallbackFrame;
	const armorView = armorOptions[armor];
	const weaponView = weaponOptions[weapon];
	const helmetView = helmetOptions[helmet];
	const backpackView = backpackOptions[backpack];
	const face = `${helmetView.frameLeft}${frame.expression}${helmetView.frameRight}`;
	const spriteWidth = 13;
	const contentWidth = Math.max(width - 4, spriteWidth);
	const indent = Math.max(Math.floor((contentWidth - spriteWidth) / 2), 0);

	return (
		<Box
			borderStyle="round"
			borderColor="cyan"
			flexDirection="column"
			paddingX={1}
			paddingY={1}
			width={width}
		>
			<Box justifyContent="space-between">
				<Text color="whiteBright">{name}</Text>
				<Badge color={modeBadgeColor[frame.mode]}>
					{modeLabel[frame.mode]}
				</Badge>
			</Box>
			<Text color="gray">Animated loadout preview</Text>
			<Box marginTop={1}>
				<Text color={calloutColor[frame.mode]}>{`"${frame.callout}"`}</Text>
			</Box>

			<Box flexDirection="column" marginTop={1}>
				<SpriteRow
					indent={indent}
					segments={[
						{ key: "indent", text: "  " },
						{
							key: "crest",
							text: helmetView.crest,
							color: helmetView.color,
						},
					]}
				/>
				<SpriteRow
					indent={indent}
					segments={[
						{
							key: "pack-top",
							text: backpackView.top,
							color: backpackView.color,
						},
						{ key: "face-gap", text: " " },
						{ key: "face", text: face, color: helmetView.color },
						{
							key: "weapon-top",
							text: weaponView.top,
							color: weaponView.color,
						},
					]}
				/>
				<SpriteRow
					indent={indent}
					segments={[
						{
							key: "pack-middle",
							text: backpackView.middle,
							color: backpackView.color,
						},
						{ key: "left-arm", text: frame.leftArm, color: armorView.color },
						{ key: "chest", text: armorView.chest, color: armorView.color },
						{
							key: "right-arm",
							text: frame.rightArm,
							color: armorView.color,
						},
						{
							key: "weapon-middle",
							text: weaponView.middle,
							color: weaponView.color,
						},
					]}
				/>
				<SpriteRow
					indent={indent}
					segments={[
						{
							key: "pack-bottom",
							text: backpackView.bottom,
							color: backpackView.color,
						},
						{ key: "belt-gap-left", text: " " },
						{ key: "belt", text: armorView.belt, color: armorView.color },
						{ key: "belt-gap-right", text: " " },
						{
							key: "weapon-bottom",
							text: weaponView.bottom,
							color: weaponView.color,
						},
					]}
				/>
				<SpriteRow
					indent={indent}
					segments={[
						{ key: "leg-indent", text: "   " },
						{ key: "legs", text: frame.legs },
					]}
				/>
			</Box>

			<Box flexDirection="column" marginTop={1}>
				<LoadoutRow
					label="Armor"
					value={armorView.label}
					color={armorView.color}
				/>
				<LoadoutRow
					label="Weapon"
					value={weaponView.label}
					color={weaponView.color}
				/>
				<LoadoutRow
					label="Helmet"
					value={helmetView.label}
					color={helmetView.color}
				/>
				<LoadoutRow
					label="Backpack"
					value={backpackView.label}
					color={backpackView.color}
				/>
			</Box>
		</Box>
	);
}
