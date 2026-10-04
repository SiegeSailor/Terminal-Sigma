---
paths:
  - "source/**"
---

# Terminal Layout

The dashboard fills the whole terminal in the alternate screen buffer, like htop, and [`app.tsx`](../../source/app.tsx) lays it out from the rules in [`content.ts`](../../source/content.ts). The snapshot is 120 columns by 30 rows with a profile set, the colors left out:

```text
╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│ ✻ Terminal Sigma                                                                                            09:30:00 │
│ “Do what you can, with what you have, where you are.” — Theodore Roosevelt                                           │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
╭────────────────────────╮╭─────────────────────────────────────────────╮╭─────────────────────────────────────────────╮
│ Ken               Lv 1 ││ Today                                       ││ ❯ 1. Tomato Timer                     Ready │
│                        ││ Character                     40 XP to Lv 2 ││   2. Health                   128 g protein │
│                        ││ ███████████████████████░░░░░░░░░░░░░░░  60% ││   3. Logs                            3 logs │
│                        ││ Focus                       1 of 4 sessions ││   4. Everyday Quotes                    New │
│                        ││ ██████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░  25% ││   5. Profile                            Ken │
│                        ││                                             ││   6. Theme                            Ember │
│        ▄▄▄▄            ││ Health · Build muscle                       ││   7. Language                            EN │
│    ▄▄▀▀▀▀▀▀▀▀▄         ││ Protein                         12 of 140 g ││                                             │
│  ▀▀▀▀▀▀▀▀▀▀▀▀▀▀▄       ││ ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   9% ││ Enter starts a 25-minute focus, and pauses, │
│     ▀▀▀▀▀▀▀▀▀▀▀        ││ Calories         350 of 2,280 kcal · 1 meal ││  resumes, or stops a running one. A         │
│    ▄▄▀▀▀▀▀▀▀▀▄         ││ ██████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  15% ││ finished focus earns 25 XP, then a 5-minute │
│  ▄▀▀▀ ▀▀▀▀▀▀▀▄         ││ Workout                    20 of 45 minutes ││  break begins.                              │
│    ▄▀▄▀▀▀▀▀▀▀▀▀        ││ █████████████████░░░░░░░░░░░░░░░░░░░░░  44% ││                                             │
│     ▀ ▀▀▀▀▀▀▀▀         ││ ⏺ 25 more minutes of exercise today: a str… ││ Recent                                      │
│     ▀▀▀▀▀▀▀▀▀▀▀        ││                                             ││ 10/03, 09:30  Focus     25-minut…    +25 XP │
│     ▀ ▀▀▀▀ ▀▀▀▀        ││                                             ││ 10/03, 09:30  Diet      Oatmeal …     +5 XP │
│        ▀▀▀ ▀▀▀▀        ││                                             ││ 10/03, 09:30  Workout   Running …    +30 XP │
│       ▄▀▀▀ ▀▀▀▀▄       ││                                             ││                                             │
│       ▀▀▀▀ ▀▀▀▀▀       ││                                             ││                                             │
│                        ││                                             ││                                             │
│                        ││                                             ││                                             │
│                        ││                                             ││                                             │
│ ✻ Standing watch       ││                                             ││                                             │
╰────────────────────────╯╰─────────────────────────────────────────────╯╰─────────────────────────────────────────────╯
 ⏺ Progress is saved to ~/.terminal-sigma/progress.json                                ↑↓←→ move · enter select · q quit
```

The regions of the dashboard:

| Region    | Contents                                                                                                     |
| --------- | ------------------------------------------------------------------------------------------------------------ |
| Character | Name, level, the animated pixel sprite, and a Claude Code spinner with what the character is doing           |
| Footer    | 1 line: a spinner and the timer while it runs, otherwise a bullet and the last event, then the key hints     |
| Header    | `✻ Terminal Sigma`, the clock, and the everyday quote on 1 truncated line                                    |
| Panel     | The menu with the 4 most recent logs, or the view it opened: timer actions, Health, a form, or a picker      |
| Today     | Character and Focus bars, then the Health group: protein, calories, and workout, with the most urgent advice |

The Logs view replaces the Character, Today, and Panel regions while it is open.

## Responsive Rules

[`layoutOf`](../../source/content.ts) decides what fits, and the Panel always does, because it takes the input:

| Columns  | Layout                                                                 |
| -------- | ---------------------------------------------------------------------- |
| 120 up   | Character, Today, and Panel side by side                               |
| 76 - 119 | Character beside Panel, with Today below once the terminal has 40 rows |
| Below 76 | Panel alone, then Character from 39 rows, then Today from 56 rows      |

The Panel switches its menu between 1, 2, and 3 columns by its own inner width. Update `layoutOf` and its test together, never the widths inside a component.

## Rules for Components

These keep the layout intact in all 3 languages and all 5 themes:

- **Let Ink Measure Text**: Never pad with `String.length`; CJK and Hangul take 2 cells. Use `Box` widths, `justifyContent`, and `wrap="truncate-end"`
- **Read Colors from the Palette**: Call `usePalette()` from [`theme.ts`](../../source/theme.ts) and never write a hex color in a component; a theme is 1 hue family, so `accent` marks anything selected or running and `soft` marks headings
- **Route Input to 1 Place**: Only the open view listens; the menu passes `isActive: false` to `useInput` while another view is open, and the dashboard itself listens only for `q` and Esc
- **Use `Choice` for Picking**: [`choice.tsx`](../../source/components/choice.tsx) accepts Enter on a preselected option, which `@inkjs/ui`'s `Select` ignores
