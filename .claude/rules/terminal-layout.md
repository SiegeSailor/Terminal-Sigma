---
paths:
  - "source/**"
---

# Terminal Layout

The dashboard fills the whole terminal in the alternate screen buffer, like htop, and [`app.tsx`](../../source/app.tsx) lays it out from the rules in [`content.ts`](../../source/content.ts). The snapshot is 120 columns by 32 rows with a profile set, the colors left out:

```text
╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ ✻ Terminal Sigma                                                                                            09:30:00 │
│ “Habit is a cable; we weave a thread of it each day, and at last we cannot break it.” — Horace Mann                  │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
╭──────────────────────────╮╭────────────────────────────────────────────╮╭────────────────────────────────────────────╮
│ Ken                 Lv 1 ││                                            ││ ❯ 1. Tomato Timer                    Ready │
│                          ││  Today                                     ││   2. Health                  132 g protein │
│                          ││                                            ││   3. Logs                           3 logs │
│                          ││  Character                  40 XP to Lv 2  ││   4. Everyday Quotes                   New │
│                          ││  █████████████████████░░░░░░░░░░░░░░  60%  ││   5. Profile                           Ken │
│                          ││                                            ││   6. Theme                           Ember │
│                          ││  Focus                    1 of 4 sessions  ││   7. Language                           EN │
│                          ││  █████████░░░░░░░░░░░░░░░░░░░░░░░░░░  25%  ││                                            │
│                          ││                                            ││ Enter starts a 25-minute focus, and        │
│                          ││                                            ││ pauses, resumes, or stops a running one. A │
│                          ││  Health · Build muscle                     ││  finished focus earns 25 XP, then a        │
│                          ││                                            ││ 5-minute break begins.                     │
│                          ││  Protein                      12 of 144 g  ││                                            │
│    ▀▀▀▀                  ││  ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   8%  ││                                            │
│    ▀▀▀▀▄                 ││                                            ││                                            │
│    ▀▀▀▀                  ││  Calories      350 of 2,330 kcal · 1 meal  ││                                            │
│   ▀▀▀▀▀                  ││  █████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  15%  ││                                            │
│   ▀▀▀▀▀                  ││                                            ││                                            │
│   ▀▀▀▀▀                  ││  Workout                 20 of 45 minutes  ││                                            │
│   ▀▀ ▀▀                  ││  ███████████████░░░░░░░░░░░░░░░░░░░░  44%  │╰────────────────────────────────────────────╯
│   ▀▀ ▀▀                  ││                                            │╭────────────────────────────────────────────╮
│   ▀▀ ▀▀                  ││  ⏺ 25 more minutes of exercise today: a …  ││ Recent                                     │
│   ▀▀ ▀▀                  ││                                            ││ 10/04, 09:30  Focus     25-minu…    +25 XP │
│   ▀▀▄▀▀▄                 ││                                            ││ 10/04, 09:30  Diet      Oatmeal…     +5 XP │
│ ✶ Standing watch         ││                                            ││ 10/04, 09:30  Workout   Running…    +30 XP │
╰──────────────────────────╯╰────────────────────────────────────────────╯╰────────────────────────────────────────────╯
 ⏺ Progress is saved to ~/.terminal-sigma/progress.json                                ↑↓←→ move · enter select · q quit
```

The regions of the dashboard:

| Region    | Contents                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------ |
| Character | Name, level, the stage the character walks on, and a Claude Code spinner with what it is doing               |
| Footer    | 1 line: a spinner and the timer while it runs, otherwise a bullet and the last event, then the key hints     |
| Header    | `✻ Terminal Sigma`, the clock, and the everyday quote on 1 truncated line                                    |
| Panel     | The menu, or the view it opened: timer actions, Health, a form, or a picker                                  |
| Recent    | Its own block under the Panel: the 4 latest logs                                                             |
| Today     | Character and Focus bars, then the Health group: protein, calories, and workout, with the most urgent advice |

The Logs view replaces the Character, Today, Panel, and Recent regions while it is open. Today puts a blank row between items and inside its border, and drops both only when `layoutOf` marks it compact.

## Responsive Rules

[`layoutOf`](../../source/content.ts) decides what fits, and the Panel always does, because it takes the input:

| Columns  | Layout                                                                                |
| -------- | ------------------------------------------------------------------------------------- |
| 120 up   | Character, Today, and Panel over Recent, side by side; Today is compact below 30 rows |
| 76 - 119 | Character beside Panel over Recent, with Today below from 40 rows, compact below 49   |
| Below 76 | Panel and Recent, then Character from 42 rows, then Today from 58 rows                |

Recent needs 23 rows in every layout. The Panel switches its menu between 1, 2, and 3 columns at inner widths of 60 and 96. Update `layoutOf` and its test together, never the widths inside a component.

## Rules for Components

These keep the layout intact in all 3 languages and all 5 themes:

- **Let Ink Measure Text**: Never pad with `String.length`; CJK and Hangul take 2 cells. Use `Box` widths, `justifyContent`, and `wrap="truncate-end"`, and give a value that must stay whole `flexShrink={0}`
- **Read Colors from the Palette**: Call `usePalette()` from [`theme.ts`](../../source/theme.ts) and never write a hex color in a component; a theme is 1 hue family, so `accent` marks anything selected or running and `soft` marks headings
- **Route Input to 1 Place**: Only the open view listens; the menu passes `isActive: false` to `useInput` while another view is open, and the dashboard itself listens only for `q` and Esc
- **Use `Choice` for Picking**: [`choice.tsx`](../../source/components/choice.tsx) accepts Enter on a preselected option, which `@inkjs/ui`'s `Select` ignores, and its `onFocus` lets the theme picker preview the focused theme before anything is saved
