---
id: dnd_group_battle_coffee
bg: ../char/dnd_group.png
music: BOSS_TIME.mp3
actions:
  - type: start_battle
    enemy_id: dnd_group
    enemy_hp_modifier: 0.5
    win_target: dnd_group_victory
    lose_target: dnd_group_defeat
---

You offer your coffee as tribute. The group passes it around, each taking a sip. Tobias nods approvingly. "The offering is accepted. But you still face our challenge... at reduced difficulty."

---

"Roll for initiative! We'll go easy on you."

### Choices

- Attack! (battle: attack) → dnd_group_battle_coffee
- Skills (battle: skill) → dnd_group_battle_coffee
- Defend (battle: defend) → dnd_group_battle_coffee
- Item (battle: item) → dnd_group_battle_coffee
