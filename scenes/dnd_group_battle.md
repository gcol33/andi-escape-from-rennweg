---
id: dnd_group_battle
bg: ../char/dnd_group.png
music: BOSS_TIME.mp3
actions:
  - type: start_battle
    enemy_id: dnd_group
    win_target: dnd_group_victory
    lose_target: dnd_group_defeat
---

The D&D group rises from their chairs, dice rattling in their hands. Character sheets flutter to the ground like fallen soldiers.

---

"Roll for initiative!"

### Choices

- Attack! (battle: attack) → dnd_group_battle
- Skills (battle: skill) → dnd_group_battle
- Defend (battle: defend) → dnd_group_battle
- Item (battle: item) → dnd_group_battle
