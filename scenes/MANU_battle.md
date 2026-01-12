---
id: MANU_battle
bg: ../char/manuela_showing_clipper.png
music: BOSS_TIME.mp3
actions:
  - type: start_battle
    enemy_id: manu
    win_target: MANU_victory
    lose_target: MANU_defeat
---

Manu's eyes narrow. "No way? NO WAY?! Do you have any idea how long I've been struggling with this?!"

---

She pulls out her laptop, the screen glowing with endless rows of corrupted GPS coordinates. "You WILL help me with this dataset!"

### Choices

- Attack! (battle: attack) → MANU_battle
- Skills (battle: skill) → MANU_battle
- Defend (battle: defend) → MANU_battle
- Item (battle: item) → MANU_battle
