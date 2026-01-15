---
id: STEFAN_battle_coffee
bg: ../char/stefan_arms_crossed.png
music: BOSS_TIME.mp3
actions:
  - type: start_battle
    enemy_id: stefan
    enemy_hp_modifier: 0.5
    win_target: STEFAN_victory
    lose_target: STEFAN_defeat
---

You thrust the coffee mug into Stefan's hands. He takes a cautious sip. "Wait... is this the good stuff from the 4th floor machine?" His fighting spirit wavers as he savors the brew.

---

"Okay, okay... but I'm still fighting you! Just... more relaxed now."

### Choices

- Attack! (battle: attack) → STEFAN_battle_coffee
- Skills (battle: skill) → STEFAN_battle_coffee
- Defend (battle: defend) → STEFAN_battle_coffee
- Item (battle: item) → STEFAN_battle_coffee
