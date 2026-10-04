---
paths:
  - "source/pixel-art.ts"
  - "source/components/character.tsx"
---

# Drawing the Character

The character is a casual, modern figure in 3/4 side view, in the style of a slim pixel portrait in a hoodie, jeans, and sneakers. [`pixel-art.ts`](../../source/pixel-art.ts) paints it procedurally onto a stage as wide as its panel and 30 pixels tall. Each terminal cell shows 2 stacked pixels as `▀`, with the top pixel as the foreground and the bottom one as the background, so the stage takes 15 rows.

## What Shapes It

3 things feed `composeScene`, and each changes the figure in a fixed place:

| Input    | Comes From             | Changes                                                                                                  |
| -------- | ---------------------- | -------------------------------------------------------------------------------------------------------- |
| Activity | What the user is doing | The pose, the props, and where on the stage it stands                                                    |
| Body     | `bodyOf(profile)`      | Height from 20 to 26 pixels by the profile's height, the build by BMI, and hair and silhouette by gender |
| Level    | `gearOf(level)`        | 4 equipment slots, each upgraded once from level 2 and again 4 levels later                              |

The slots are the gadget (headphones, then headphones and a smartwatch), the top (a tee, a hoodie, then a jacket), the headwear (a cap, then a crown), and the back (a backpack, then a cape). Every level from 2 to 9 changes exactly 1 of them.

## How It Is Painted

All drawing happens in local coordinates: x grows toward where the character faces, and y grows up from the ground. `composeScene` mirrors the figure when it walks left. A pose sets the feet relative to their hips and the hands relative to their shoulders, and the painters run in this order:

1. `paintBack`: the cape or the backpack
2. `paintArm` for the far arm
3. `paintLegs`, then `paintTorso`
4. `paintHead`, then `paintHeadgear`
5. `paintArm` for the near arm, then the scene's props

`upper` moves with the breathing bob while `put` stays planted. Clothes and accessories take the theme's `sprite` tones; skin, hair, denim, and sneakers keep fixed colors.

## Motion

The character must never look stuck. Idle wanders: it pauses, looks around, walks across the stage, and comes back; running laps the stage. [`pixel-art.test.ts`](../../source/tests/pixel-art.test.ts) fails when any activity holds 1 frame for 3 ticks, when idle stops covering the stage, or when a taller, heavier profile stops drawing a taller, wider figure.

Render every scene to an image before calling art done; the shape is invisible in a diff, and the tests cannot tell ugly art from good.
