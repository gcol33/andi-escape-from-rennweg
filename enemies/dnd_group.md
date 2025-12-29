---
id: dnd_group
name: D&D Group
sprite: dnd_group.svg

# Base Stats
hp: 50
ac: 13
attack_bonus: 4
damage: d10
type: physical
stagger_threshold: 70
ai: default

# Moves
moves:
  - name: Fireball
    damage: 2d6
    type: fire
    description: The wizard casts fireball!

  - name: Sneak Attack
    damage: 2d4
    type: physical
    description: The rogue strikes from the shadows!

  - name: Smite
    damage: d10
    type: holy
    description: The paladin channels divine energy!

dialogue:
  battle_start:
    - "Roll for initiative!"
    - "You dare challenge our party?"

  attack_default:
    - "Natural 20!"
    - "The dice gods favor us!"
    - "Critical hit incoming!"

  victory:
    - "TPK! Total Party Kill!"

  defeat:
    - "We... need a long rest..."
---

The D&D group. A formidable party of nerds.
