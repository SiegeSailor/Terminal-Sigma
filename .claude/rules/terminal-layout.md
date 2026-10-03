---
paths:
  - "source/**"
---

# Terminal Layout

Keep the Ink components rendered by [`commands/index.tsx`](../../source/commands/index.tsx) in this layout. The snapshot is the dashboard at 120 columns, with Diet Tracker selected:

```text
╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│                                                                                                              │
│ TERMINAL SIGMA                                                                                               │
│ 17:16:18  |  Progress is saved to ~/.terminal-sigma/progress.json.                                           │
│                                                                                                              │
│ STATUS BOARD                                                                ╭──────────────────────────────╮ │
│ "Well begun is half done." - Aristotle                                      │                              │ │
│                                                                             │ Rook Sigma  LV 1       WALK  │ │
│ Character Progression                                                  0%   │ Gear unlocks as you level    │ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░     │                              │ │
│ 100 XP to level 2.                                                  LV 1    │ "Route locked."              │ │
│                                                                             │                              │ │
│ Tomato Timer                                                           0%   │           /~\                │ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░     │        [] <o_o> *            │ │
│ 0 of 4 focus sessions today.                                       START    │        []<|=^=|\ |           │ │
│                                                                             │        []  /_\   |           │ │
│ Diet Tracker                                                           0%   │           | /                │ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░     │                              │ │
│ 0 of 3 meals, 0 kcal today.                                        START    │ Armor            Scout Weave │ │
│                                                                             │ Weapon          Signal Staff │ │
│ Workout Tracker                                                        0%   │ Helmet            Hood Shell │ │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░     │ Backpack          Field Pack │ │
│ 0 of 30 workout minutes today.                                     START    │                              │ │
│                                                                             ╰──────────────────────────────╯ │
│                                                                                                              │
│ ------------------------------------------------------------------------------------------------------------ │
│                                                                                                              │
│ NAVIGATION MENU                                                                    Arrows / hjkl / Enter / q │
│                                                                                                              │
│   [1] Tomato Timer                             READY   > [2] Diet Tracker                           0 MEALS  │
│   [3] Workout Tracker                          0 MIN     [4] Everyday Quotes                            NEW  │
│                                                                                                              │
│ Enter logs a meal as food and optional calories, e.g. Oatmeal 350. Each meal earns 5 XP.                     │
│                                                                                                              │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

The regions, from top to bottom:

| Region          | Contents                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------- |
| Header          | `TERMINAL SIGMA`, then 1 real-time line, truncated, never wrapped: the clock, the timer, and the last event |
| Status Board    | An everyday quote, then 1 progress bar per feature, each with a detail line and a badge                     |
| Character       | Right of the status board: name, level, an animated sprite, and the gear the level unlocked                 |
| Navigation Menu | 4 features in a grid, the key hints, and the description of the selected feature                            |
| Entry Input     | Below the menu, only while the Diet Tracker or Workout Tracker is taking an entry                           |

The layout adapts to the terminal width:

- **Panel**: `columns - 4`, clamped between 68 and 112
- **Character**: Stacks below the status board when the content is narrower than 88 columns
- **Menu**: Drops to 1 column when the content is narrower than 56 columns

Keyboard input belongs to 1 place at a time. While the entry input is open, the menu passes `isActive: false` to `useInput` and the dashboard listens only for Esc, so typing never moves the menu or quits.
