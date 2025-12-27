---
id: AGNES_battle
bg: office_corridor.jpg
chars:
  - agnes_angry.svg
music: BOSS_TIME.mp3
actions:
  - type: start_battle
    enemy_id: agnes_hr
    win_target: AGNES_victory
    lose_target: AGNES_defeat
---

Agnes assumes a fighting stance. Her HR badge glints under the fluorescent lights like a warning.

---

"You're not leaving without a fight!"

### Choices

- Attack! (battle: attack) → AGNES_battle
- Skills (battle: skill) → AGNES_battle
- Defend (battle: defend) → AGNES_battle
- Item (battle: item) → AGNES_battle
- Chug Coffee (battle: skip_battle, uses: Coffee Mug) → AGNES_battle
