---
id: AGNES_battle_coffee
bg: ../char/agnes_fight.png
music: BOSS_TIME.mp3
actions:
  - type: start_battle
    enemy_id: agnes_hr
    enemy_hp_modifier: 0.5
    win_target: AGNES_victory
    lose_target: AGNES_defeat
---

You offer Agnes the steaming coffee. She takes a sip... and immediately grimaces. "This is from the BREAK ROOM?!" The inferior coffee seems to have weakened her resolve.

---

"You'll pay for this insult to proper beverage protocol!"

### Choices

- Attack! (battle: attack) → AGNES_battle_coffee
- Skills (battle: skill) → AGNES_battle_coffee
- Defend (battle: defend) → AGNES_battle_coffee
- Item (battle: item) → AGNES_battle_coffee
