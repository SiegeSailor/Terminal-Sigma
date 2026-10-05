---
paths:
  - "source/pixel-art.ts"
  - "source/components/character.tsx"
---

# Drawing the Character

The character is a person with realistic proportions for its size: a 7-row head, legs taking 55% of the rest of the body, and an oval shadow on the ground with the feet in its middle. [`pixel-art.ts`](../../source/pixel-art.ts) paints it procedurally onto a stage as wide as its panel and 40 pixels tall, at 10 frames a second. Each terminal cell shows 2 stacked pixels as `▀`, with the top pixel as the foreground and the bottom one as the background, so the stage takes 20 rows. [`character.tsx`](../../source/components/character.tsx) leaves 1 blank row between the stage and the spinner label, so the character never stands on the text.

## What Shapes It

4 things feed `composeScene`, and each one must change the character visibly, not by a pixel:

| Input    | Comes From               | Changes                                                                                                                                     |
| -------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Activity | What the user is doing   | The pose, the props, the view, and where on the stage it stands                                                                             |
| Level    | `gearOf(level)`          | 4 gear slots, each upgraded once from level 2 and again 4 levels later                                                                      |
| Look     | `lookOf(profile)`        | Height by the profile's height, the build by body fat or else BMI, the body and hair by gender, grey hair by age, and clothes by work style |
| Mood     | `moodOf` in `content.ts` | Dozing with closed eyes and drifting Zs until anything is logged today; a smile, a hop, and a wave once targets are met                     |

The body is 3 half widths around the center column: chest, waist, and hips. Men get the widest chest, women a waist narrower than their hips, an athletic build or a muscle goal a broader chest with 3-pixel arms, and a stocky or heavy build a wider waist. Body fat decides the build when it is known, so the same weight draws lean or soft. The slots are the gadget (headphones, then a smartwatch too), the wear (a scarf, then a jacket too), the headwear (a cap, then sunglasses instead), and the carry (a backpack, then a medal too). Every level from 2 to 9 changes exactly 1 of them, and nothing ever sits on top of the head but hair or the cap.

## How It Is Painted

All drawing happens in local coordinates: x = 0 is the body's center column, and y grows up from the ground. A pose is either `front`, facing the viewer for anything done in place, or `side`, in profile for walking and running, where both feet point the way it goes on an 8-frame walk or 6-frame run and the arms swing against the legs. `composeScene` mirrors the character when it heads left, and the painters run in this order:

1. `paintShadow`: the oval on the ground, which stays put and shrinks during a jump
2. In front: `paintHairBehind`, `paintLegsFront`, `paintTorsoFront`, both arms, then `paintHeadFront`
3. In profile: the far arm and leg in shadow, the near leg, the torso, `paintSideHead`, then the near arm in light
4. The scene's props

`upper` moves with the breathing bob while `put` stays planted. The top and accents take the theme's `sprite` tones, with light and shade mixed from them, so every theme recolors the clothes; skin, hair, denim, and props keep fixed colors.

## Motion

The character must never look stuck or jump. [`character.tsx`](../../source/components/character.tsx) keeps a `Motion` and calls `advance` on every frame: idling gives way to a new activity at once, where the character stands, and anything else first finishes its loop back at its anchor, so every activity starts and ends in the same place. [`pixel-art.test.ts`](../../source/tests/pixel-art.test.ts) fails when any frame holds for 6 ticks in any mood, when the character moves more than 2 pixels in 1 tick across a switch, when a run does not come home, when idle stops covering the stage, when the profile or body fat stops changing the body, when a level stops changing the gear, or when the shadow leaves the feet.

Render every scene to an image before calling art done; the shape is invisible in a diff, and the tests cannot tell ugly art from good.
