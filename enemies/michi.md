---
id: michi
name: Michi
sprite: michi_whiteboard.svg

# Base Stats
hp: 55
ac: 13
attack_bonus: 4
damage: d10
type: physical
stagger_threshold: 65
ai: default

# Moves
moves:
  - name: Whiteboard Strike
    damage: d8
    type: physical
    description: Michi swings the whiteboard!

  - name: Marker Throw
    damage: 2d4
    type: physical

  - name: Lecture
    damage: d6
    type: psychic
    statusEffect:
      type: stun
      chance: 0.2

dialogue:
  battle_start:
    - "Let's see what you've learned!"

  attack_default:
    - "Pay attention!"
    - "This is important!"
    - "Take notes!"

  victory:
    - "Back to studying for you!"

  defeat:
    - "You've learned well..."
---

Michi. The whiteboard master.
