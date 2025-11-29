---
id: agnes_battle
bg: hallway_red_alert.jpg
music: BOSS_TIME.mp3
chars:
  - agnes_blocking.svg
actions:
  - type: start_battle
    player_max_hp: 20
    player_ac: 10
    player_attack_bonus: 2
    player_damage: d6
    enemy:
      name: Agnes (HR)
      hp: 25
      ac: 12
      attack_bonus: 4
      damage: d8
    win_target: agnes_defeated
    lose_target: lost_to_HR
    flee_target: attempt_pass
---

Agnes lunges forward with surprising speed, her HR badge glinting under the red emergency lights.

"Let's see if your resignation letter is as strong as your resolve!"

### Choices

- Attack with your briefcase! (battle: attack) [sfx: thud.ogg] → agnes_battle
- Defend yourself! (battle: defend) [sfx: click.ogg] → agnes_battle
- Drink coffee for energy (uses: Coffee Mug, heals: 8) [sfx: gulp.ogg] → agnes_battle
- Try to flee! (battle: flee) [sfx: footstep.ogg] → agnes_battle
