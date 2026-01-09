---
id: karl_battle
bg: ../char/karl_neutral.png
music: BOSS_TIME.mp3
no_read_tracking: true
set_flags:
  - jk_seen_3
actions:
  - type: start_battle
    enemy_id: karl
    win_target: karl_victory
    lose_target: karl_defeat
---

"Third time." Karl sighs, finally making eye contact. "The universe clearly wants us to interact. I disagree with the universe, but here we are."

---

"I don't want to fight you. I don't want to do most things. But sometimes existence forces our hand."

---

"Let's get this over with."

### Choices

- Attack! (battle: attack) → karl_battle
- Skills (battle: skill) → karl_battle
- Defend (battle: defend) → karl_battle
- Item (battle: item) → karl_battle
