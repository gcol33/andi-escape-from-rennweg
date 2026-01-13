---
id: jk_return
actions:
  - type: goto
    target: LISA_scene
    requires: jk_return_lisa
  - type: goto
    target: JACQUELINE
    requires: jk_return_jacqueline
  - type: goto
    target: SIEGRUN
    requires: jk_return_siegrun
  - type: goto
    target: MICHI_rematch
    requires: jk_return_michi, michi_defeated
  - type: goto
    target: MICHI
    requires: jk_return_michi, !michi_defeated
  - type: goto
    target: dnd_group_rematch
    requires: jk_return_dnd, dnd_group_defeated
  - type: goto
    target: dnd_group
    requires: jk_return_dnd, !dnd_group_defeated
  - type: goto
    target: floor1
---
