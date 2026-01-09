---
# Player Configuration
# Max name length: 12 characters
name: Andi

# Base Stats
hp: 42
mana: 10
ac: 11
attack_bonus: 3
damage: 1d8

# Combat Type (for elemental interactions)
type: physical

# Stagger threshold (how much damage before stunned)
stagger_threshold: 100

# Skills - the abilities the player can use
# Short Rest is the only starting skill - others unlocked via items/story
skills:
  - id: short_rest
    name: Short Rest
    manaCost: 0
    isRest: true
    restoreMana: 2d4
    skipsTurn: true
    description: Take a breather to restore 2d4 MP. Skips your turn!

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

  # Consumable items (one-time use, found during exploration or after battles)
  - id: granola_bar
    name: Granola Bar
    manaCost: 0
    isHeal: true
    healAmount: 10
    appliesSelfBuff:
      type: fortified
      duration: infinite
      acBonus: 1
    requiresItem: Granola Bar
    consumesItem: true
    description: A healthy snack. +10 HP and +1 AC for this fight.

  - id: energy_drink
    name: Energy Drink
    manaCost: 0
    isHeal: true
    healAmount: 8
    appliesSelfBuff:
      type: energized
      duration: infinite
      attackBonus: 2
    requiresItem: Energy Drink
    consumesItem: true
    description: Caffeinated boost. +8 HP and +2 Attack for this fight.

  - id: aspirin
    name: Aspirin
    manaCost: 0
    isHeal: true
    healAmount: 5
    appliesSelfBuff:
      type: clear_headed
      duration: infinite
      immuneTo: [stun, confusion]
    requiresItem: Aspirin
    consumesItem: true
    description: Clear your head. +5 HP and immune to stun/confusion this fight.

  - id: spicy_goulash
    name: Spicy Goulash
    manaCost: 0
    isHeal: true
    healAmount: 5
    appliesSelfStatus:
      type: burn
      duration: 1
    appliesSelfBuff:
      type: burning_attacks
      duration: infinite
      burnOnAttack: 3
    requiresItem: Spicy Goulash
    consumesItem: true
    description: Hot stuff! +5 HP, burn yourself, but next 3 attacks apply burn.

  - id: break_room_snacks
    name: Break Room Snacks
    manaCost: 0
    isHeal: true
    healAmount: 10
    requiresItem: Break Room Snacks
    consumesItem: true
    description: Stolen from Agnes's stash. +10 HP.

  - id: first_aid_kit
    name: First Aid Kit
    manaCost: 0
    isHeal: true
    healAmount: 15
    clearsStatus: true
    requiresItem: First Aid Kit
    consumesItem: true
    description: Proper medical supplies. +15 HP and removes all negative status effects.

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
