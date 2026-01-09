---
id: jk_r5_roll
bg: office_corridor.png
actions:
  # Both defeated - skip encounter entirely
  - type: goto
    target: jk_return
    requires: johannes_defeated, karl_defeated
  # Only Johannes defeated - always Karl
  - type: goto
    target: karl_check
    requires: johannes_defeated
  # Only Karl defeated - always Johannes
  - type: goto
    target: johannes_check
    requires: karl_defeated
  # Neither defeated - random roll
  - type: roll_dice
    dice: d2
    threshold: 2
    success_target: johannes_check
    failure_target: karl_check
    hidden: true
---

The elevator doors open to reveal a familiar face...
