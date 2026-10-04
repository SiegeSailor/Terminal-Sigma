---
paths:
  - "source/**"
---

# Terminal Layout

The dashboard fills the whole terminal in the alternate screen buffer, like htop, and [`app.tsx`](../../source/app.tsx) lays it out from the rules in [`content.ts`](../../source/content.ts). The snapshot is 120 columns by 30 rows, the colors left out:

```text
╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ ✻ Terminal Sigma                                                                                            09:30:00 │
│ “Well begun is half done.” — Aristotle                                                                               │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
╭────────────────────────────╮╭───────────────────────────────────────────╮╭───────────────────────────────────────────╮
│ Ken                   Lv 1 ││ Today                                     ││ ❯ 1. Tomato Timer                   Ready │
│                            ││ Character                   40 XP to Lv 2 ││   2. Diet Tracker                  1 meal │
│                            ││ ██████████████████████░░░░░░░░░░░░░░  60% ││   3. Workout Tracker               20 min │
│                            ││                                           ││   4. Logs                          3 logs │
│                            ││ Focus                     1 of 4 sessions ││   5. Everyday Quotes                  New │
│                            ││ █████████░░░░░░░░░░░░░░░░░░░░░░░░░░░  25% ││   6. Language                          EN │
│                            ││                                           ││                                           │
│                            ││ Diet 1 of 3 meals · 350 kcal · 12 g prot… ││ Enter starts a 25-minute focus, and       │
│         ▄▀▀▀▀▀▀▀▀▄ ▀       ││ ████████████░░░░░░░░░░░░░░░░░░░░░░░░  33% ││ pauses, resumes, or stops a running one.  │
│        ▀▀▀▀▀▀▀▀▀▀▀▀▀       ││                                           ││ A finished focus earns 25 XP, then a      │
│        ▀▀▀▀▀▀▀▀▀▀▀▀▀       ││ Workout                  20 of 30 minutes ││ 5-minute break begins.                    │
│         ▀▀▀▀▀▀▀▀▀▀ ▀       ││ ████████████████████████░░░░░░░░░░░░  67% ││                                           │
│        ▀▀▀▀▀▀▀▀▀▀▀▀▀       ││                                           ││                                           │
│        ▀▀▀▀▀▀▀▀▀▀▀▀▀       ││                                           ││                                           │
│         ▀▀▀▀▀▀▀▀▀▀ ▀       ││                                           ││                                           │
│          ▀▀▀  ▀▀▀  ▀       ││                                           ││                                           │
│         ▀▀▀▀  ▀▀▀▀         ││                                           ││                                           │
│                            ││                                           ││                                           │
│                            ││                                           ││                                           │
│                            ││                                           ││                                           │
│                            ││                                           ││                                           │
│                            ││                                           ││                                           │
│ · Standing by              ││                                           ││                                           │
╰────────────────────────────╯╰───────────────────────────────────────────╯╰───────────────────────────────────────────╯
 ⏺ Progress is saved to ~/.terminal-sigma/progress.json                                ↑↓←→ move · enter select · q quit
```

The regions of the dashboard:

| Region    | Contents                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------- |
| Character | Name, level, the animated pixel sprite, and a Claude Code spinner with what the character is doing       |
| Footer    | 1 line: a spinner and the timer while it runs, otherwise a bullet and the last event, then the key hints |
| Header    | `✻ Terminal Sigma`, the clock, and the everyday quote on 1 truncated line                                |
| Panel     | The menu, or the view it opened: the timer actions, a log form, or the language picker                   |
| Today     | 1 progress bar per feature, each with a truncated detail                                                 |

The Logs view replaces the Character, Today, and Panel regions while it is open.

## Responsive Rules

[`layoutOf`](../../source/content.ts) decides what fits, and the Panel always does, because it takes the input:

| Columns  | Layout                                                                 |
| -------- | ---------------------------------------------------------------------- |
| 120 up   | Character, Today, and Panel side by side                               |
| 76 - 119 | Character beside Panel, with Today below once the terminal has 35 rows |
| Below 76 | Panel alone, then Character from 35 rows, then Today from 50 rows      |

The Panel switches its menu between 1, 2, and 3 columns by its own inner width. Update `layoutOf` and its test together, never the widths inside a component.

## Rules for Components

These keep the layout intact in both languages:

- **Let Ink Measure Text**: Never pad with `String.length`; CJK takes 2 cells. Use `Box` widths, `justifyContent`, and `wrap="truncate-end"`
- **Keep Colors in [`theme.ts`](../../source/theme.ts)**: The palette is Claude Code's, with `colors.accent` for anything selected or running
- **Route Input to 1 Place**: Only the open view listens; the menu passes `isActive: false` to `useInput` while another view is open, and the dashboard itself listens only for `q` and Esc
