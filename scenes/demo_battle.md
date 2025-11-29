---
id: demo_battle
bg: office_corridor.jpg
music: BOSS_TIME.mp3
chars:
  - agnes_angry.svg
actions:
  - type: start_battle
    enemy_name: Agnes
    enemy_hp: 30
    enemy_max_hp: 30
    enemy_attack: 6
    enemy_defense: 12
    player_attack: 4
    player_defense: 10
    victory_target: demo_victory
    defeat_target: demo_defeat
    flee_target: demo_fled
---

**BATTLE START!**

Agnes assumes a fighting stance!

"You asked for this!"

---

Choose your action wisely. Attack to deal damage, Defend to reduce incoming damage, or try to Flee!

If you picked up healing items earlier, you can use them too!

### Choices

- Attack! [sfx: thud.ogg] (battle: attack) → _battle
- Defend [sfx: click.ogg] (battle: defend) → _battle
- Try to Flee [sfx: footstep.ogg] (battle: flee) → _battle
- Use Coffee (uses: Coffee) (heals: 5) [sfx: gulp.ogg] (battle: item) → _battle
- Use Energy Bar (uses: Energy Bar) (heals: 8) [sfx: gulp.ogg] (battle: item) → _battle
