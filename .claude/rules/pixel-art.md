---
paths:
  - "source/pixel-art.ts"
  - "source/components/character.tsx"
---

# Drawing the Character

The character is a person seen from the front, with realistic proportions for its size: a 5-row head on a 6-heads-tall body, legs taking 56% of the rest, and an oval shadow on the ground with the feet in its middle. [`pixel-art.ts`](../../source/pixel-art.ts) paints it procedurally onto a stage as wide as its panel and 32 pixels tall. Each terminal cell shows 2 stacked pixels as `▀`, with the top pixel as the foreground and the bottom one as the background, so the stage takes 16 rows. [`character.tsx`](../../source/components/character.tsx) leaves 1 blank row between the stage and the spinner label, so the character never stands on the text.

## What Shapes It

4 things feed `composeScene`, and each one must change the character visibly, not by a pixel:

| Input    | Comes From               | Changes                                                                                                                    |
| -------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Activity | What the user is doing   | The pose, the props, and where on the stage it stands                                                                      |
| Level    | `gearOf(level)`          | 4 gear slots, each upgraded once from level 2 and again 4 levels later                                                     |
| Look     | `lookOf(profile)`        | Height by the profile's height, the build by BMI, the body and hair by gender, grey hair by age, and clothes by work style |
| Mood     | `moodOf` in `content.ts` | Dozing with closed eyes and drifting Zs until anything is logged today; a smile, a hop, and a wave once targets are met    |

The body is 3 half widths around the center column: chest, waist, and hips. Men get the widest chest, women a waist narrower than their hips, a stocky or heavy build a wider waist, and a muscle goal a broader chest with 2-pixel arms. The slots are the gadget (headphones, then a smartwatch too), the wear (a scarf, then a jacket too), the headwear (a cap, then a crown), and the carry (a backpack, then a medal too). Every level from 2 to 9 changes exactly 1 of them.

## How It Is Painted

All drawing happens in local coordinates: x = 0 is the body's center column, and y grows up from the ground. `composeScene` mirrors the character when it walks left, and the painters run in this order:

1. `paintShadow`: the oval on the ground, which stays put and shrinks during a jump
2. `paintHairBehind`: long hair or a ponytail
3. `paintLegs`, then `paintTorso` with the clothes and the gear worn on it
4. `paintArms`, from each shoulder to the pose's hand, sleeved by the work style
5. `paintHead`: the face, the hair, and the headwear, then the scene's props

`upper` moves with the breathing bob while `put` stays planted. The top and accents take the theme's `sprite` tones, so every theme recolors the clothes; skin, hair, denim, and props keep fixed colors.

## Motion

The character must never look stuck. Idle wanders: it pauses, looks about, walks across the stage, and comes back; running laps the stage. [`pixel-art.test.ts`](../../source/tests/pixel-art.test.ts) fails when any activity holds 1 frame for 3 ticks in any mood, when idle stops covering the stage, when the profile stops changing the height, the width, the shoulders, the clothes, or the hair, when a level stops changing the gear, or when the shadow leaves the feet.

Render every scene to an image before calling art done; the shape is invisible in a diff, and the tests cannot tell ugly art from good.
