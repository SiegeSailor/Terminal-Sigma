---
paths:
  - "source/pixel-art.ts"
  - "source/components/character.tsx"
---

# Drawing the Character

The character is a slim, hooded wanderer facing right, in the spirit of Dead Cells and Drova, on a 20 by 28 pixel canvas in [`pixel-art.ts`](../../source/pixel-art.ts). Each terminal cell shows 2 stacked pixels as `▀`, with the top pixel as the foreground and the bottom one as the background, so the sprite takes 20 columns by 14 rows.

A layer is a list of strings placed at column `x` and row `y`, where `.` is transparent and every other character is a key in `paletteOf`. `upper()` layers move down 1 pixel when a frame breathes, while `layer()` ones, the legs and the props, stay planted. Layers draw in this order, so later ones cover earlier ones:

1. The weapon on the back
2. The frame's `behind` layers: the scarf tail, the desk
3. The frame's legs, then the torso, the neck scarf, and the hood
4. The hood's gear, then the pauldron
5. The frame's `front` layers: arms and props
6. The relic orb, which bobs on its own beat

## Colors and Gear

The hood, coat, scarf, and glow take their colors from the theme's `sprite` tones, so the character changes with the theme. Outlines, skin, cloth, and props keep fixed colors. `gearOf` upgrades exactly 1 of the 4 slots, weapon, armor, hood, and relic, per level from level 2 to level 9.

## Motion

The character must never look stuck: every activity needs at least 4 frames, and no frame may repeat the one before it, which [`pixel-art.test.ts`](../../source/tests/pixel-art.test.ts) checks along with the canvas size and the palette keys. Idle breathes, flutters its scarf, and blinks.

Render every frame to an image before calling art done; the shape is invisible in a diff and the test cannot tell ugly art from good.
