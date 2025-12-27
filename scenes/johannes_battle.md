---
id: johannes_battle
bg: office_corridor.jpg
chars:
  - johannes.svg
music: BOSS_TIME.mp3
set_flags:
  - jk_seen_3
actions:
  - type: start_battle
    enemy_id: johannes
    win_target: johannes_victory
    lose_target: johannes_defeat
---

"Third time's the charm!" Johannes blocks your path, calculator raised like a weapon. "I've calculated the optimal strategy. Your probability of escape is... approaching zero."

---

"Let me demonstrate the beauty of mathematics. Through combat!"

### Choices

- Attack! (battle: attack) → johannes_battle
- Skills (battle: skill) → johannes_battle
- Defend (battle: defend) → johannes_battle
- Item (battle: item) → johannes_battle
