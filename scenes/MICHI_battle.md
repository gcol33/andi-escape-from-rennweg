---
id: MICHI_battle
bg: hallway_fluorescent.jpg
music: BOSS_TIME.mp3
actions:
  - type: start_battle
    enemy_id: michi
    win_target: MICHI_victory
    lose_target: MICHI_defeat
---

Michi twirls the marker between his fingers like a switchblade. The fluorescent lights flicker ominously. Or maybe that's just your imagination.

---

"Let's see what you've learned!"

### Choices

- Attack! (battle: attack) → MICHI_battle
- Skills (battle: skill) → MICHI_battle
- Defend (battle: defend) → MICHI_battle
- Item (battle: item) → MICHI_battle
