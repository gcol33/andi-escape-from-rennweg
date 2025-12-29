---
id: ANNA_battle
bg: ../char/anna_coffee_high.png
music: BOSS_TIME.mp3
actions:
  - type: start_battle
    enemy_id: anna
    win_target: ANNA_victory
    lose_target: ANNA_defeat
---

You take a sip of the tea. It tastes... interesting. After a few minutes, you start feeling lightheaded. Suddenly, Anna's monitor begins growing hair. Wait, is Anna also... growing whiskers? She looks suspiciously like a Coipu now.

---

"Oh," Anna says, her voice echoing strangely. "Did I mention I've been experimenting with mushroom teas?" She tilts her furry head. "Is it working?" The world begins to spin. You must fight off the hallucinations!

### Choices

- Attack! (battle: attack) → ANNA_battle
- Skills (battle: skill) → ANNA_battle
- Defend (battle: defend) → ANNA_battle
- Item (battle: item) → ANNA_battle
