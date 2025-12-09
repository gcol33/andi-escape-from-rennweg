---
id: anna
name: Anna
sprite: agnes_neutral.svg

# Base Stats
hp: 24
ac: 12
attack_bonus: 3
damage: d6
type: physical
stagger_threshold: 55
ai: default

# Moves
moves:
  - name: Attack
    damage: d6
    type: physical
    description: A swift strike!

  - name: Focus Strike
    damage: 2d4
    type: physical

dialogue:
  battle_start:
    - "Let's see what you've got!"

  attack_default:
    - "Here I come!"
    - "Take this!"

  victory:
    - "Better luck next time!"

  defeat:
    - "Well played..."
---

Anna. A placeholder enemy.
