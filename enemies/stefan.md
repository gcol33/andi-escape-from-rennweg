---
id: stefan
name: Stefan
sprite: stefan_neutral.svg

# Base Stats
hp: 25
ac: 12
attack_bonus: 3
damage: d6
type: physical
stagger_threshold: 60
ai: default

# Moves
moves:
  - name: Attack
    damage: d6
    type: physical
    description: A standard attack!

  - name: Heavy Strike
    damage: 2d4
    type: physical

dialogue:
  battle_start:
    - "You want to pass? Fight me first!"

  attack_default:
    - "Take this!"
    - "Here I come!"

  victory:
    - "Better luck next time!"

  defeat:
    - "Impossible..."
---

Stefan. A placeholder enemy.
