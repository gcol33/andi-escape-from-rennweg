---
id: jk_r5
bg: office_corridor.png
clear_flags:
  - jk_return_lisa
  - jk_return_jacqueline
  - jk_return_siegrun
  - jk_return_dnd
set_flags:
  - jk_return_michi
---

You head toward the computing center.

### Choices

- Continue (requires: michi_defeated) → MICHI_rematch
- Continue (requires: jk_battle_done, !michi_defeated) → MICHI
- Continue (requires: !jk_battle_done, !michi_defeated) → jk_r5_roll
