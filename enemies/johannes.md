---
id: johannes
name: Johannes
sprite: johannes.svg

# Base Stats
hp: 30
ac: 11
attack_bonus: 2
damage: d6
type: psychic
stagger_threshold: 50
ai: default

# Moves
moves:
  - name: Pi Recitation
    damage: d6
    type: psychic
    description: He starts reciting pi to 50 decimal places. Your brain hurts.

  - name: Euler's Identity
    damage: 2d4
    type: psychic
    statusEffect:
      type: confusion
      chance: 0.2
    description: The most beautiful equation in mathematics. Too beautiful. It burns.

  - name: Statistical Analysis
    damage: d4
    type: psychic
    description: He calculates your probability of winning. It's not looking good.

dialogue:
  battle_start:
    - "Did you know today is exactly 3.14159... days until the next pi day?"

  attack_default:
    - "The numbers don't lie!"
    - "Let me show you some elegant proofs!"
    - "This is statistically optimal!"

  victory:
    - "Q.E.D."

  defeat:
    - "But... the math was perfect..."
---

Johannes. Mathematician. Pi enthusiast. Will corner you to talk about prime numbers.
