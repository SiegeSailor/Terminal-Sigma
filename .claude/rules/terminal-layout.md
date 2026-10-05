---
paths:
  - "source/**"
---

# Terminal Layout

The dashboard fills the whole terminal in the alternate screen buffer, like htop, and [`app.tsx`](../../source/app.tsx) lays it out from the rules in [`content.ts`](../../source/content.ts). The snapshot is 136 columns by 32 rows with a profile set, the colors left out:

```text
╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ ✻ Terminal Sigma                                                                                                            23:17:38 │
│ “It does not matter how slowly you go as long as you do not stop.” — Confucius                                                       │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
╭──────────────────────────────────╮╭──────────────────────────────────────╮╭──────────────────────╮╭──────────────────────────────────╮
│ Ken                         Lv 1 ││                                      ││ ❯ 1. Everyday Quotes ││ Auto · every 25 minutes          │
│                                  ││  Today                               ││   2. Tomato Timer    ││                                  │
│                                  ││                                      ││   3. Health          ││ Draw a new quote, or choose how  │
│                                  ││  Pet              25 XP to Lv 2 75%  ││   4. Logs            ││ often quotes refresh and which   │
│                                  ││  ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀  ││   5. Profile         ││ kinds you see.                   │
│                                  ││  Focus          1 of 4 sessions 25%  ││   6. Theme           ││                                  │
│                                  ││  ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀  ││   7. Language        ││ Enter to open                    │
│                                  ││                                      ││                      ││                                  │
│                                  ││  Health · Build muscle               ││                      ││                                  │
│                     ▄ ▄  ▄  ▄▄▄  ││  Protein             12 of 156 g 8%  ││                      ││                                  │
│                     ▀▀▀ ▀▀▀ ▀▀▀  ││  ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀  ││                      ││                                  │
│                                  ││  Calories 350 of 2,410 kcal · … 15%  ││                      ││                                  │
│                                  ││  ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀  ││                      ││                                  │
│                                  ││  Workout       30 of 45 minutes 67%  ││                      ││                                  │
│                                  ││  ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀  ││                      ││                                  │
│                                  ││  ⏺ 15 more minutes of exercise tod…  ││                      ││                                  │
│      ▄                           ││                                      ││                      ││                                  │
│     ▀▄▀▄▄▄▄▄▄▄▄                  ││                                      ││                      ││                                  │
│    ▀▀▀▀▀▀▀▀▀▀▀▀▀                 ││                                      │╰──────────────────────╯╰──────────────────────────────────╯
│    ▀▀▀▀▀▀▀▀▀▀▀▀▀                 ││                                      │╭──────────────────────────────────────────────────────────╮
│ ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀              ││                                      ││ Recent                                                   │
│ ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀▀              ││                                      ││ 10/04, 23:17 Action   Opened Terminal Sigma              │
│     ▀ ▀     ▀ ▀                  ││                                      ││ 10/04, 23:02 Focus    25-minute focus             +25 XP │
│                                  ││                                      ││ 10/04, 23:02 Diet     Oatmeal · 350 kcal · 12 …    +5 XP │
│ ✻ Wandering…                     ││                                      ││ 10/04, 23:02 Workout  Running · 30 min · Moder…   +45 XP │
╰──────────────────────────────────╯╰──────────────────────────────────────╯╰──────────────────────────────────────────────────────────╯
 ⏺ Progress is saved to ~/.terminal-sigma/progress.json                                                                ↑↓ move · enter open · q quit
```

The regions of the dashboard:

| Region      | Contents                                                                                                 |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| Character   | Name, level, the stage the pet walks on, a blank row, then a Claude Code spinner with what it is doing   |
| Description | The right box of the menu: what the focused item does, or once opened, its options, form, or picker      |
| Footer      | 1 line: a spinner and the timer while it runs, otherwise a bullet and the last event, then the key hints |
| Header      | `✻ Terminal Sigma`, the clock, and the everyday quote on 1 truncated line                                |
| Menu        | The left box: the 7 numbered items, highlighted while it takes the input                                 |
| Recent      | Its own block under the menu: the 4 latest logs                                                          |
| Today       | Pet and Focus bars, then the Health group: protein, calories, and workout, with the most urgent advice   |

The Logs view takes the place of the Menu, the Description, and Recent while it is open. Today draws each bar with `▀`, half a row tall, right under its label, which carries the percentage because text centers in its row; there is no blank row between items, only a group gets a blank row above it, and the border padding goes when `layoutOf` marks it compact.

## Responsive Rules

[`layoutOf`](../../source/content.ts) decides what fits, and the Menu always does, because it takes the input:

| Columns  | Layout                                                                                   |
| -------- | ---------------------------------------------------------------------------------------- |
| 120 up   | Character, Today, and the Menu over Recent, side by side; Today is compact below 24 rows |
| 80 - 119 | Character beside the Menu over Recent, with Today below from 40 rows, compact below 43   |
| Below 80 | The Menu and Recent, then Character, then Today, each from as many rows as it needs      |

The Description sits beside the Menu once the panel is 60 columns wide, which takes 136 columns at 120 up, 96 from 80, and 60 below 80; otherwise it sits under the Menu. Update `layoutOf` and its test together, never the widths inside a component.

## Rules for Components

These keep the layout intact in all 3 languages and all 5 themes:

- **Let Ink Measure Text**: Never pad with `String.length`; CJK and Hangul take 2 cells. Use `Box` widths, `justifyContent`, and `wrap="truncate-end"`, and wrap a value that must stay whole, such as a `❯` cursor beside text that truncates, in a `Box` with `flexShrink={0}`
- **Key What Shares a Slot**: Give each view that replaces another in the same place its own `key`, or React carries the cursor of 1 `Choice` into the next
- **Read Colors from the Palette**: Call `usePalette()` from [`theme.ts`](../../source/theme.ts) and never write a hex color in a component; a theme is 1 hue family, so `accent` marks anything selected or running and `soft` marks headings
- **Route Input to 1 Place**: Only the open view listens; the menu passes `isActive: false` to `useInput` while another view is open, and the dashboard itself listens only for `q` and Esc
- **Use `Choice` for Picking**: [`choice.tsx`](../../source/components/choice.tsx) accepts Enter on a preselected option, which `@inkjs/ui`'s `Select` ignores, and its `onFocus` lets the menu describe and the theme picker preview the focused option before anything is saved
