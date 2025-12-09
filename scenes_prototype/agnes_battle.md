---
id: agnes_battle
bg: hallway_red_alert.jpg
music: BOSS_TIME.mp3
chars:
  - agnes_blocking.svg
actions:
  - type: start_battle
    terrain: none
    enemy_id: agnes_hr
    win_target: agnes_defeated
    lose_target: lost_to_HR
    flee_target: attempt_pass
---

Agnes lunges forward with surprising speed, her HR badge glinting under the red emergency lights.

"Let's see if your resignation letter is as strong as your resolve!"

### Choices

- Attack! (battle: attack) [sfx: thud.ogg] → agnes_battle
- Skills (battle: skill) [sfx: click.ogg] → agnes_battle
- Defend (battle: defend) [sfx: click.ogg] → agnes_battle
- Item (battle: item) [sfx: click.ogg] → agnes_battle
