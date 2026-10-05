---
paths:
  - "source/pixel-art.ts"
  - "source/components/character.tsx"
---

# Drawing the Pet

The character is a pet in the spirit of Claude Code's mascot: a wide, flat body on 4 short legs, with 2 dark eyes and side nubs for arms. [`pixel-art.ts`](../../source/pixel-art.ts) paints it procedurally onto a stage as wide as its panel and 28 pixels tall. Each terminal cell shows 2 stacked pixels as `▀`, with the top pixel as the foreground and the bottom one as the background, so the stage takes 14 rows. [`character.tsx`](../../source/components/character.tsx) leaves 1 blank row between the stage and the spinner label, so the pet never stands on the text.

## What Shapes It

5 things feed `composeScene`, and each one must change the pet visibly, not by a pixel:

| Input    | Comes From                   | Changes                                                                                                          |
| -------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Activity | What the user is doing       | The pose, the props, and where on the stage it stands                                                            |
| Badges   | `petStateOf` in `content.ts` | A tomato, an apple, and a dumbbell in the top-right corner for a focus, a meal, and a workout logged today       |
| Level    | `gearOf(level)`, `growthOf`  | 4 gear slots, each upgraded once from level 2 and again 4 levels later, and growth at levels 4 and 7             |
| Look     | `lookOf(profile)`            | Size from 4 steps by height, width by BMI, a bow, tuft, or sprout by gender, and an accessory by the health goal |
| Mood     | `petStateOf` in `content.ts` | Sleepy naps with drifting Zs until anything is logged today; happy bounces with `^ ^` eyes and blush             |

The slots are the gadget (headphones, then an antenna), the wear (a scarf, then a cape), the headwear (a cap, then a crown), and the aura (an orb, then sparkles). Every level from 2 to 9 changes exactly 1 of them. The goal accessories are a sweatband to lose fat, a heart to maintain, bigger arms to build muscle, and white sneakers for endurance.

## How It Is Painted

All drawing happens in local coordinates: x grows toward where the pet faces, and y grows up from the ground. `composeScene` mirrors the pet when it walks left, and the painters run in this order:

1. `paintBehind`: the cape and the sparkles
2. `paintLegs`, then `paintBody`
3. `paintFace`, then `paintArms`
4. `paintHead`: the gender ornament and the headwear, gadget, and orb
5. The scene's props, then the badges

The body takes the theme's accent tones, so every theme recolors the pet; gear takes the `sprite` tones, and props keep fixed colors.

## Motion

The pet must never look stuck. Idle wanders: it pauses, walks across the stage, and comes back; running laps the stage. [`pixel-art.test.ts`](../../source/tests/pixel-art.test.ts) fails when any activity holds 1 frame for 3 ticks in any mood, when idle stops covering the stage, when a taller, heavier profile or a higher level stops drawing a bigger pet, or when a mood or badge stops showing.

Render every scene to an image before calling art done; the shape is invisible in a diff, and the tests cannot tell ugly art from good.
