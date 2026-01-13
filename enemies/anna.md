---
id: anna
name: Anna
sprite: anna_neutral.svg

# Base Stats
hp: 40
ac: 12
attack_bonus: 3
damage: d8
type: poison
stagger_threshold: 55
ai: default

# Moves
moves:
  - name: Herbal Infusion
    damage: d6
    type: psychic
    description: The aroma alone is disorienting

  - name: Mystery Blend
    damage: 2d4
    type: poison
    statusEffect:
      type: confusion
      chance: 0.25
    description: You're not sure what's in this one

  - name: Concentrated Extract
    damage: d10
    type: poison
    description: Triple-steeped for maximum potency

dialogue:
  battle_start:
    - "You should have tried the tea."
    - "Nobody ever accepts the tea."

  attack_default:
    - "This blend is from the Gesäuse!"
    - "Nettle builds character!"
    - "The aftertaste is supposed to linger!"
    - "It's an acquired taste. You'll acquire it."

  attack_player_low_hp:
    - "You look like you need some chamomile..."
    - "The weakness will pass. Probably."

  victory:
    - "Rest now. The tea will help."

  defeat:
    - "Fine. More tea for me."
---

Anna. The tea alchemist.
