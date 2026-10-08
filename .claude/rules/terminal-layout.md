---
paths:
  - "source/**"
---

# Terminal Layout

The dashboard fills the whole terminal in the alternate screen buffer, like htop, and [`app.tsx`](../../source/app.tsx) lays it out from the rules in [`content.ts`](../../source/content.ts). The snapshot is 138 columns by 36 rows with a profile set, the colors left out:

```text
╭────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ ✻ Terminal Sigma                                                                                                              11:13:51 │
│ “No man is free who is not master of himself.” — Epictetus                                                                             │
╰────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
╭──────────────────────────────────╮╭──────────────────────────────────────╮╭────────────────────────╮╭──────────────────────────────────╮
│ Ken                         Lv 1 ││                                      ││ Today                  ││ 2 logged today                   │
│                                  ││  Today                               ││ ❯ 1. Log               ││                                  │
│                                  ││                                      ││   2. Tomato Timer      ││ Log anything in 1 line, e.g. 2   │
│                                  ││  Character        25 XP to Lv 2 75%  ││ Journal                ││ eggs, toast · w 500 · wo run 30m │
│                                  ││  ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀  ││   3. History           ││  · sl 23:30-7:10. While the line │
│                                  ││  Focus          1 of 4 sessions 25%  ││ Settings               ││  is empty, it suggests what you  │
│                                  ││  ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀  ││   4. Everyday Quotes   ││ usually log now.                 │
│                                  ││                                      ││   5. Profile           ││                                  │
│                                  ││  Health · Build muscle               ││   6. Theme             ││ Health · Build muscle            │
│                                  ││  Protein             12 of 140 g 9%  ││   7. Language          ││ Daily targets: 2,280 kcal, 140 g │
│                                  ││  ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀  ││   8. Environment       ││  protein, 45 minutes of          │
│              ▄▀▀▀▀▀▄             ││  Calories 350 of 2,280 kcal · … 15%  ││ System                 ││ exercise.                        │
│             ▄▀▀▀▀▀▀▀▄            ││  ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀  ││   9. Software Update   ││ ⏺ 15 more minutes of exercise    │
│             ▀▀▀▀▀▀▀▀▀            ││  Workout       30 of 45 minutes 67%  ││                        ││ today: a strength session.       │
│              ▄▀▀▀▀▀▄             ││  ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀  ││                        ││ ⏺ 128 g of protein to go today,  │
│        ▄▄▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▄▄       ││  Water             0 of 3,000 ml 0%  ││                        ││ e.g. a chicken breast has about  │
│        ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀       ││  ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀  ││                        ││ 30 g.                            │
│        ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀       ││  Sleep                  0m of 7h 0%  ││                        ││ ⏺ 1,930 kcal left in today's     │
│        ▀▀▀  ▀▀▀▀▀▀▀▀▀  ▀▀▀       ││  ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀  ││                        ││ budget.                          │
│         ▀▀  ▀▀▀▀▀▀▀▀▀  ▀▀        ││  ⏺ 15 more minutes of exercise tod…  ││                        ││ ⏺ 3,000 ml of water to go today, │
│         ▀▀   ▀▀▀▀▀▀▀   ▀▀        ││                                      ││                        ││  about 12 glasses.               │
│         ▀▀   ▀▀▀ ▀▀▀   ▀▀        ││                                      ││                        ││ ⏺ Log last night's sleep, e.g.   │
│              ▀▀▀ ▀▀▀             ││                                      │╰────────────────────────╯╰──────────────────────────────────╯
│               ▀▀ ▀▀              ││                                      │╭────────────────────────────────────────────────────────────╮
│               ▀▀ ▀▀              ││                                      ││ Recent                                                     │
│        ▄▄▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▄▄       ││                                      ││ 10/08, 11:13 Action   Opened Terminal Sigma                │
│         ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀        ││                                      ││ 10/08, 11:13 Focus    25-minute focus               +25 XP │
│                                  ││                                      ││ 10/08, 11:13 Diet     Oatmeal · 350 kcal · 12 g …    +5 XP │
│ ✳ Wandering…                     ││                                      ││ 10/08, 11:13 Workout  Running · 30 min · Moderate   +45 XP │
╰──────────────────────────────────╯╰──────────────────────────────────────╯╰────────────────────────────────────────────────────────────╯
 ⏺ Progress is saved to ~/.terminal-sigma/progress.json                                                     ↑↓ move · enter open · q quit
```

The regions of the dashboard:

| Region      | Contents                                                                                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Character   | Name, level, the stage the character walks on, a blank row, then a Claude Code spinner with what it is doing                                                 |
| Description | The right box of the menu: what the focused item does, or once opened, its options, form, or picker                                                          |
| Footer      | 1 line: a spinner and the timer while it runs, otherwise a bullet and the last event, then the key hints                                                     |
| Header      | `✻ Terminal Sigma`, the clock, and the everyday quote on 1 truncated line, marked ✦ New for 8 seconds after it changes                                       |
| Menu        | The left box: the 9 numbered items under 4 headings: Today, Journal, Settings, and System, highlighted while it takes the input, padded evenly on both sides |
| Recent      | Its own block under the menu: the 4 latest logs                                                                                                              |
| Today       | Character and Focus bars, then protein, calories, workout, water, and last night's sleep, with the most urgent advice                                        |

History takes the place of the Menu, the Description, and Recent while it is open, and the Log view the place of the Menu and the Description, with Recent under it. Today draws each bar with `▀`, half a row tall, right under its label, which carries the percentage because text centers in its row; there is no blank row between items, only a group gets a blank row above it, and the border padding goes when `layoutOf` marks it compact.

## Responsive Rules

[`layoutOf`](../../source/content.ts) decides what fits, and the Menu always does, because it takes the input:

| Columns  | Layout                                                                                   |
| -------- | ---------------------------------------------------------------------------------------- |
| 120 up   | Character, Today, and the Menu over Recent, side by side; Today is compact below 28 rows |
| 80 - 119 | Character beside the Menu over Recent, with Today below from 50 rows, compact below 53   |
| Below 80 | The Menu and Recent, then Character, then Today, each from as many rows as it needs      |

The Description sits beside the Menu once the panel is 62 columns wide, which takes 138 columns at 120 up, 98 from 80, and 62 below 80; otherwise it sits under the Menu. The Menu shows its group headings from 27 rows, and drops them below that so Recent still fits. Update `layoutOf` and its test together, never the widths inside a component.

## Rules for Components

These keep the layout intact in all 3 languages and all 5 themes:

- **Let Ink Measure Text**: Never pad with `String.length`; CJK and Hangul take 2 cells. Use `Box` widths, `justifyContent`, and `wrap="truncate-end"`, and wrap a value that must stay whole, such as a `❯` cursor beside text that truncates, in a `Box` with `flexShrink={0}`
- **Key What Shares a Slot**: Give each view that replaces another in the same place its own `key`, or React carries the cursor of 1 `Choice` into the next
- **Read Colors from the Palette**: Call `usePalette()` from [`theme.ts`](../../source/theme.ts) and never write a hex color in a component; a theme is 1 hue family, so `accent` marks anything selected or running and `soft` marks headings
- **Route Input to 1 Place**: Only the open view listens; the menu passes `isActive: false` to `useInput` while another view is open, and the dashboard itself listens only for `q` and Esc
- **Use `Choice` for Picking**: [`choice.tsx`](../../source/components/choice.tsx) accepts Enter on a preselected option, which `@inkjs/ui`'s `Select` ignores, and its `onFocus` lets the menu describe and the theme picker preview the focused option before anything is saved; an option's `group` draws a heading above it that the cursor skips
