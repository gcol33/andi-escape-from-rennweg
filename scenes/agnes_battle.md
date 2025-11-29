---
id: agnes_battle
bg: hallway_red_alert.jpg
music: BOSS_TIME.mp3
chars:
  - agnes_blocking.svg
actions:
  - type: start_battle
    player_max_hp: 25
    player_max_mana: 25
    player_ac: 11
    player_attack_bonus: 3
    player_damage: d6
    player_skills:
      - power_strike
      - fireball
      - heal
      - fortify
      - ice_shard
    terrain: none
    enemy:
      name: Agnes (HR)
      hp: 22
      ac: 11
      attack_bonus: 3
      damage: d6
      type: physical
      ai: default
      stagger_threshold: 50
      moves:
        - name: HR Memo
          damage: d6
          type: physical
        - name: Performance Review
          damage: 2d4
          type: psychic
          statusEffect:
            type: stun
            chance: 0.15
        - name: Policy Enforcement
          damage: d4
          type: physical
          statusEffect:
            type: bleed
            chance: 0.25
        - name: Break Room Retreat
          isHeal: true
          healAmount: 1d4+1
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
