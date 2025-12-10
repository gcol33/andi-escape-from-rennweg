---
id: STEFAN_battle
bg: stairwell_landing.jpg
chars:
  - stefan_neutral.svg
music: BOSS_TIME.mp3
actions:
  - type: start_battle
    enemy_id: stefan
    win_target: STEFAN_victory
    lose_target: STEFAN_defeat
---

Stefan blocks the stairwell, arms crossed. The ghost of Hercules looms between you—thousands of euros of unassembled hardware gathering dust in some storage closet.

---

"For Hercules!"

### Choices

- Attack! (battle: attack) → STEFAN_battle
- Skills (battle: skill) → STEFAN_battle
- Defend (battle: defend) → STEFAN_battle
- Item (battle: item) → STEFAN_battle
