---
paths:
  - "source/pixel-art.ts"
  - "source/components/character.tsx"
---

# Drawing the Character

The character is a 16 by 20 pixel canvas in [`pixel-art.ts`](../../source/pixel-art.ts). Each terminal cell shows 2 stacked pixels as `▀`, with the top pixel as the foreground and the bottom one as the background, so the sprite takes 16 columns by 10 rows.

A frame is a stack of layers, each a list of 16-character strings placed at a row `y`, where `.` is transparent and every other character is a key in the palette. Layers draw in this order, so later ones cover earlier ones:

1. The weapon, behind everything
2. The head, the body, and the backpack straps
3. The helmet
4. The frame's own layers: arms, legs, and props

`a`, `A`, and `P` take their color from the gear tier, and `gearOf` upgrades exactly 1 piece per level from level 2 to level 9. Every activity in `animations` needs at least 2 frames and an `interval` in milliseconds.

Render every frame to an image before calling art done; the shape is invisible in a diff. [`pixel-art.test.ts`](../../source/tests/pixel-art.test.ts) fails on a row that is not 16 characters or a key missing from the palette, but not on ugly art.
