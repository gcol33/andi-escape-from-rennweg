---
id: karl_check
actions:
  - type: goto
    target: jk_return
    requires: karl_defeated
  - type: goto
    target: karl_battle
    requires: jk_seen_2
  - type: goto
    target: karl_2
    requires: jk_seen_1
  - type: goto
    target: karl_1
---
