---
id: MICHI_battle_coffee
bg: ../char/michi_neutral.png
music: BOSS_TIME.mp3
actions:
  - type: start_battle
    enemy_id: michi
    enemy_hp_modifier: 0.5
    win_target: MICHI_victory
    lose_target: MICHI_defeat
---

You offer Michi the coffee. He eyes it suspiciously, then takes a sip. "Hmm. Not bad. But I've seen you put MILK in coffee before. You're still not off the hook."

---

"Let's see if you fight better than you make coffee!"

### Choices

- Attack! (battle: attack) → MICHI_battle_coffee
- Skills (battle: skill) → MICHI_battle_coffee
- Defend (battle: defend) → MICHI_battle_coffee
- Item (battle: item) → MICHI_battle_coffee
