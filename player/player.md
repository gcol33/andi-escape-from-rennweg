---
# Player Configuration
# Max name length: 12 characters
name: Andi

# Base Stats
hp: 42
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

  - id: summon_keyboard
    name: Summon Keyboard
    isSummon: true
    summonId: sentient_keyboard
    manaCost: 5
    description: Summon a sentient mechanical keyboard to type furiously at enemies!

  # Item-based skills (unlocked by collecting key items)
  - id: lighter_ignite
    name: Lighter Flick
    damage: 1d6
    type: fire
    manaCost: 2
    statusEffect:
      type: burn
      chance: 0.6
    requiresItem: Lighter
    description: Flick your lighter at the enemy. High burn chance!

  - id: charming_smile
    name: Charming Smile
    type: psychic
    manaCost: 3
    statusEffect:
      type: charmed
      chance: 0.5
    requiresFlag: can_smile
    description: Flash your best smile. May charm the enemy!

  - id: focused_strike
    name: Focused Strike
    damage: 2d6
    type: physical
    manaCost: 4
    critBonus: 5
    requiresItem: Magnifying Glass
    description: Focus sunlight for a precise strike. Much higher crit chance!

  - id: botanical_lecture
    name: Botanical Lecture
    type: psychic
    manaCost: 3
    statusEffect:
      type: confusion
      chance: 0.7
    requiresItem: Flora Book
    description: Bore them with plant taxonomy. High confusion chance!

  - id: coal_dust
    name: Coal Dust
    damage: 1d4
    type: physical
    manaCost: 2
    statusEffect:
      type: coaled
      chance: 0.9
    requiresItem: Charcoal
    description: Throw charcoal dust. If they burn, they take DOUBLE burn damage!

  - id: beer_chug
    name: Liquid Courage
    manaCost: 0
    isHeal: true
    healsToFull: true
    appliesSelfStatus:
      type: confusion
      duration: 2
    requiresItem: Beer
    consumesItem: true
    description: Chug a beer. Full HP but confused for 2 turns!

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
