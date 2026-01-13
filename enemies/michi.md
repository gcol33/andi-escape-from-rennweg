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

  - name: Methodology Defense
    damage: 2d4
    type: psychic
    description: "Let me explain why this approach is valid..."

  - name: Literature Review
    damage: d6
    type: psychic
    statusEffect:
      type: stun
      chance: 0.2
    description: 47 citations. From memory.

  - name: Permanent Marker
    damage: 2d6
    type: physical
    description: This one doesn't wash off

dialogue:
  battle_start:
    - "I've been practicing this presentation for weeks."
    - "Finally, someone to explain my research to!"

  attack_default:
    - "As you can see from this diagram—"
    - "The whiteboard never lies."
    - "This is simplified, obviously."
    - "I have seventeen backup slides."

  attack_player_low_hp:
    - "Wait, I haven't even reached the methods section."
    - "You're leaving? But I have supplementary materials!"

  victory:
    - "Any questions? No? Good."

  defeat:
    - "...I should revise this presentation."
    - "Back to the literature, I suppose."
---

Michi. The whiteboard master.
