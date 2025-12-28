---
id: karl
name: Karl
sprite: karl.svg

# Base Stats
hp: 48
ac: 10
attack_bonus: 3
damage: d8
type: psychic
stagger_threshold: 55
ai: defensive

# Moves
moves:
  - name: Existential Observation
    damage: d8
    type: psychic
    description: He points out that all species eventually go extinct. Including yours.

  - name: Nihilistic Sigh
    damage: d6
    type: psychic
    statusEffect:
      type: poison
      chance: 0.15
    description: The weight of meaninglessness seeps into your bones.

  - name: Passive Aggressive Comment
    damage: 2d4
    type: psychic
    description: "That's an... interesting approach to life you have there."

dialogue:
  battle_start:
    - "None of this matters, you know. But sure, let's do this."

  attack_default:
    - "..."
    - "Interesting."
    - "If you say so."
    - "That's one way to look at it."

  victory:
    - "As expected."

  defeat:
    - "Well. That happened."
---

Karl. Biologist. Wears Birkenstocks with socks. Has seen too much of nature to believe in anything.
