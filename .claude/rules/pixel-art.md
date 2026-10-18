---
paths:
  - "source/pixel-art.ts"
  - "source/components/character.tsx"
  - "source/signals.ts"
  - "source/motion.ts"
---

# Drawing the Character

The character is a person with realistic proportions for its size: a 7-row head, legs taking 55% of the rest of the body, and an oval shadow on the ground with the feet in its middle. [`pixel-art.ts`](../../source/pixel-art.ts) paints it procedurally onto a stage as wide as its panel and 40 pixels tall, at 10 frames a second. Each terminal cell shows 2 stacked pixels as `▀`, with the top pixel as the foreground and the bottom one as the background, so the stage takes 20 rows. [`character.tsx`](../../source/components/character.tsx) leaves 1 blank row between the stage and the spinner label, so the character never stands on the text.

## What Shapes It

5 things feed `composeScene`, and each one must change the character visibly, by several pixels:

| Input    | Comes From                      | Changes                                                                                                                                                                                                 |
| -------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Activity | What the user is doing          | The pose, the props, the view, and where on the stage it stands, including `drink`, `weigh` on a 3-row scale, and `write`                                                                               |
| Level    | `gearOf(level)`                 | 4 gear slots, each upgraded once from level 2 and again 4 levels later                                                                                                                                  |
| Look     | `lookOf(profile, strengthLoad)` | Height every 5 cm, `fat` stages every 2 points of body fat from `fatFeatures`, `muscle` stages from `muscleFeatures`, the appearance with age, and the outfit chosen, or else the work style's          |
| Mood     | `moodOf` in `content.ts`        | Dozing with closed eyes and drifting Zs until anything is logged today; a smile, a hop, and a wave once targets are met                                                                                 |
| Signals  | `signalsOf` in `signals.ts`     | Rest, thirst, hunger, fullness, exertion, the logged mood, bed head, the sky by the clock, the season, and the room; `stageSignalsOf` drops the season under reduced motion, and `quietSignals` is none |

Fat and muscle are stages, not builds: each stage of `fatFeatures` or `muscleFeatures` adds 1 feature (a waist, a belly, an arm, a chest, and so on), and gender, appearance, and work style change what the rest of the body looks like. The slots are the gadget (headphones, then a smartwatch too), the wear (a scarf, then a jacket too), the headwear (a cap, then sunglasses instead), and the carry (a backpack, then a medal too). Every level from 2 to 9 changes exactly 1 of them, and nothing ever sits on top of the head but hair, a hat, and bed head until a hat covers it. `hatOf` gives the level's cap only when the look's hat is `level`; a chosen hat replaces it, and the sunglasses show under any hat. The outfit is 4 independent pieces, `top`, `pants`, `shoes`, and `hat`, each a key into `topOf`, `sleeveOf`, `pantsOf`, and `shoeOf`, and `outfitOf` fills in the pieces a profile leaves out from its work style.

Painters write skin only as `s` and `q`, and hair only as `h` and `i`; `plant` in `drawScene` recolors them by skin tone, hair color, and age, ranking each hair pixel so the temples grey first and the grey stays steady from frame to frame. A new stage must make a visible change of several pixels at the default height, or the test fails: at least 6 px for muscle stages (tested in front only), 5 for stubble and glasses, and 12 for `weigh`; fat stages are tested in front and side. Fat stages 0 to 21 and muscle stages 0 to 3 make the widest body, so the walk's margin is not a constant: `reachOf(look)` measures the columns the body covers on either side of its center in every pose, never under 9, and the motion adopts a new look's reach when the idle loop comes home to its anchor, or at an activity switch when the clamp moves 2 px or less.

## How It Is Painted

All drawing happens in local coordinates: x = 0 is the body's center column, and y grows up from the ground. A pose is either `front`, facing the viewer for anything done in place, or `side`, in profile for walking and running, where both feet point the way it goes on an 8-frame walk or 6-frame run and the arms swing against the legs. `composeScene` mirrors the character when it heads left, and the painters run in this order:

1. `paintScenery`: the sun or the moon and stars by the clock, and the season's falling particles, behind everything
2. `paintShadow`: the oval on the ground, which stays put and shrinks during a jump
3. `paintRoom`: the plant, the shelf of books, and the dumbbell at the stage's edges, after the shadow, so the shadow never covers them
4. The scene's ground layer, such as the scale, under the feet
5. In front: `paintHairBehind`, `paintLegsFront`, `paintTorsoFront`, both arms (drawn mirrored), then `paintHeadFront`
6. In profile: the far arm and leg in shadow, the near leg, the torso, `paintSideHead`, then the near arm in light
7. `paintSweat` and, for an idle front rest, `paintWish`, the thirst or hunger bubble
8. The scene's props

With `quietSignals` nothing extra is drawn, which keeps the motion tests honest.

`upper` moves with the breathing bob while `put` stays planted. The top and accents take the theme's `sprite` tones, with light and shade mixed from them, so every theme recolors the clothes; skin, hair, denim, and props keep fixed colors.

## Motion

The character must never look stuck or jump. [`character.tsx`](../../source/components/character.tsx) keeps a `Motion` and calls `advance` on every frame: idling gives way to a new activity at once, where the character stands, and anything else first finishes its loop back at its anchor, so every activity starts and ends in the same place. [`pixel-art.test.ts`](../../source/tests/pixel-art.test.ts) fails when any frame holds for 6 ticks in any mood, when the character moves more than 2 pixels in 1 tick across a switch, when a run does not come home, when idle stops covering the stage, when the profile, body fat, muscle, or appearance stops changing the body, when the walk clips the stage after a new look, when a level stops changing the gear, or when the shadow leaves the feet.

Render every scene to an image before calling art done; the shape is invisible in a diff, and the tests cannot tell ugly art from good. `npm run build && node build/tests/render-scenes.js scenes` writes 1 PNG sheet per entry of `sheets` in [`render-scenes.ts`](../../source/tests/render-scenes.ts): `activities`, `levels`, `bodies`, `widest`, `appearance`, `appearanceExtras`, `outfits`, `ages`, `signals`, and `scenery`. Look at every sheet a change touches, and add a sheet for a new input.
