---
# Player Configuration
# Max name length: 12 characters
name: Andi

# Base Stats
hp: 20
mana: 10
ac: 11
attack_bonus: 2
damage: 1d6

# Combat Type (for elemental interactions)
type: physical

# Stagger threshold (how much damage before stunned)
stagger_threshold: 100

# Skills - the abilities the player can use
skills:
  - id: power_strike
    name: Power Strike
    damage: 2d6
    type: physical
    manaCost: 3
    description: A powerful blow that deals extra damage.

  - id: heal
    name: Heal
    healAmount: 2d4
    manaCost: 4
    description: Restore some health.

  - id: fire_bolt
    name: Fire Bolt
    damage: 1d8
    type: fire
    manaCost: 2
    description: Launch a bolt of fire at the enemy.

  - id: ice_shard
    name: Ice Shard
    damage: 1d6
    type: ice
    manaCost: 2
    statusEffect:
      type: slow
      chance: 0.25
    description: A shard of ice that may slow the target.

# Passives - permanent bonuses (optional)
# passives:
#   - id: resilient
#     name: Resilient
#     description: Recover 1 HP at the start of each turn

# Limit Break (optional)
limit_break:
  name: Overdrive
  damage: 3d8
  type: physical
  description: A devastating attack that unleashes all your power!
---

The protagonist of our story. An office worker who has had enough.
