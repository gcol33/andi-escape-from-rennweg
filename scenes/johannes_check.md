---
id: johannes_check
actions:
  - type: goto
    target: jk_return
    requires: johannes_defeated
  - type: goto
    target: johannes_battle
    requires: jk_seen_2
  - type: goto
    target: johannes_2
    requires: jk_seen_1
  - type: goto
    target: johannes_1
---
