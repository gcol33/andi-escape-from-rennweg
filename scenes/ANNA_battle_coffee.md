---
id: ANNA_battle_coffee
bg: ../char/anna_coffee_high.png
music: BOSS_TIME.mp3
actions:
  - type: start_battle
    enemy_id: anna
    enemy_hp_modifier: 0.5
    win_target: ANNA_victory
    lose_target: ANNA_defeat
---

You quickly swap your coffee for her suspicious tea. Anna takes a sip of the coffee and blinks. "Oh! This is... actually quite good. Very grounding." The psychedelic effects of her own tea seem diminished.

---

"But I still need to test my formula on SOMEONE!"

### Choices

- Attack! (battle: attack) → ANNA_battle_coffee
- Skills (battle: skill) → ANNA_battle_coffee
- Defend (battle: defend) → ANNA_battle_coffee
- Item (battle: item) → ANNA_battle_coffee
