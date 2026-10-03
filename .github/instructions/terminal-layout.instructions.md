---
description: "Guides visual consistency for UI design across the project. Provides instructions for terminal layout, including dimensions, spacing, and component placement to ensure a cohesive user interface."
applyTo: "source/**"
---

# Terminal Layout

Maintain `ink` components rendered in commands within a terminal layout that adheres to the following specifications. The current layout snapshot:

```plaintext
╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│                                                                                                              │
│ Title.                                                                                                       │
│ Real-time message here.                                                                                      │
│                                                                                                              │
│ STATUS BOARD                                                                ╭──────────────────────────────╮ │
│ Operator Rook Sigma. Mock telemetry, quick bars, clear reads.               │                              │ │
│                                                                             │ Rook Sigma             TALK  │ │
│ Focus Stability                                                       83%   │ Animated loadout preview     │ │
│ ███████████████████████████████████████████████████████████░░░░░░░░░░░░     │                              │ │
│ 2h 14m of uninterrupted deep-work time.                           STABLE    │ "Telemetry sounds clean."    │ │
│                                                                             │                              │ │
│ Quest Queue                                                           58%   │           /^\                │ │
│ █████████████████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░     │        [] [o-o] /            │ │
│ 7 mock actions sitting in the backlog.                            LOADED    │        []/|###|^==>          │ │
│                                                                             │        []  /_\   \           │ │
│ Battery Reserve                                                       71%   │           / \                │ │
│ ██████████████████████████████████████████████████░░░░░░░░░░░░░░░░░░░░░     │                              │ │
│ Projected runtime holds for 41 more minutes.                       READY    │ Armor           Carbon Shell │ │
│                                                                             │ Weapon             Arc Blade │ │
│ Comms Noise                                                           34%   │ Helmet          Signal Visor │ │
│ ████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░     │ Backpack          Field Pack │ │
│ Only 2 chatter spikes hit the shell loop.                            LOW    │                              │ │
│                                                                             ╰──────────────────────────────╯ │
│                                                                                                              │
│ ------------------------------------------------------------------------------------------------------------ │
│                                                                                                              │
│ NAVIGATION MENU  MOCK                                                                  Arrows / hjkl / Enter │
│ Use arrows or hjkl to browse. Enter triggers a mock route.                                                   │
│                                                                                                              │
│   [1] Mission Log                              3 NEW   > [2] Loadout Bay                            2 SWAPS  │
│   [3] Habit Forge                                91%     [4] Signal Deck                               LIVE  │
│                                                                                                              │
│ Preview future armor, weapon, helmet, and backpack presets.                                                  │
│                                                                                                              │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
```

Be concise, the layout consists of:

```plaintext
╭──────────────────────────────────────────────────────────────────────────────────────────────────────────────╮
│                                                                                                              │
│ Title                                                                                                        │
│ Real-time message here.                                                                                      │
│                                                                                                              │
│ STATUS BOARD                                                                ╭──────────────────────────────╮ │
│ Inspiring quote goes here. Refresh every x minutes or when restarted.       │                              │ │
│                                                                             │ Rook Sigma             TALK  │ │
│ Focus Stability                                                       83%   │ Animated loadout preview     │ │
│ ███████████████████████████████████████████████████████████░░░░░░░░░░░░     │                              │ │
│ 2h 14m of uninterrupted deep-work time.                           STABLE    │ "Telemetry sounds clean."    │ │
│                                                                             │                              │ │
│ Quest Queue                                                           58%   ╰──────────────────────────────╯ │
│ ------------------------------------------------------------------------------------------------------------ │
│                                                                                                              │
│ NAVIGATION MENU  MOCK                                                                  Arrows / hjkl / Enter │
│ Use arrows or hjkl to browse. Enter triggers a mock route.                                                   │
│                                                                                                              │
│   [1] Mission Log                              3 NEW   > [2] Loadout Bay                            2 SWAPS  │
│   [3] Habit Forge                                91%     [4] Signal Deck                               LIVE  │
│                                                                                                              │
│ Preview future armor, weapon, helmet, and backpack presets.                                                  │
│                                                                                                              │
╰──────────────────────────────────────────────────────────────────────────────────────────────────────────────╯
```
