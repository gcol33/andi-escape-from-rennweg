---
id: agnes_hr
name: Agnes (HR)
sprite: agnes_blocking.svg

# Base Stats
hp: 22
ac: 11
attack_bonus: 3
damage: d6
type: physical
stagger_threshold: 50

# AI Behavior: default, aggressive, defensive, support
ai: default

# Moves - the attacks/abilities this enemy can use
moves:
  - name: HR Memo
    damage: d6
    type: physical
    description: A sharply worded memo flies your way!

  - name: Performance Review
    damage: 2d4
    type: psychic
    statusEffect:
      type: stun
      chance: 0.15
    description: Agnes critiques your life choices.

  - name: Policy Enforcement
    damage: d4
    type: physical
    statusEffect:
      type: bleed
      chance: 0.25
    description: Red tape cuts deep!

  - name: Break Room Retreat
    isHeal: true
    healAmount: 1d4+1
    description: Agnes takes a coffee break.

# Telegraphed Intent Skills - powerful moves that require preparation
intents:
  # Summon intent - can be broken by applying any status effect
  - id: call_intern
    type: summon
    chance: 0.15
    minTurn: 3
    cooldown: 5
    prepTurns: 1
    dialogue: "INTERN! Get in here NOW!"
    executeDialogue: "You wanted to see me, Agnes?"
    skill:
      name: Call Intern
      damage: 0
      type: physical
      isSummon: true
      summonId: office_intern
      description: Agnes summons an intern to assist her.

  # Big Attack intent - counter by defending
  - id: termination_notice
    type: big_attack
    chance: 0.2
    minTurn: 2
    cooldown: 4
    hpThreshold: 0.7
    prepTurns: 1
    dialogue: "I'm preparing your TERMINATION NOTICE!"
    executeDialogue: "Your employment is TERMINATED!"
    skill:
      name: Termination Notice
      damage: 15
      type: psychic
      description: A devastating psychological attack. You should have defended!

  # Multi-hit intent - counter with defense-boosting skills
  - id: policy_barrage
    type: multi_hit
    chance: 0.18
    minTurn: 4
    cooldown: 5
    prepTurns: 1
    dialogue: "Let me pull up ALL your violations..."
    executeDialogue: "Violation 1... 2... 3... 4... 5!"
    skill:
      name: Policy Barrage
      damage: d4
      type: physical
      hits: 5
      description: A rapid barrage of policy violations!

# Special Abilities (optional)
# can_limit_break: false
# limit_break_name: "Final Warning"
# limit_break_damage: 3d6
# limit_break_type: psychic

# Summons - enemies or allies this character can call for help
# summons:
#   - id: intern_helper
#     chance: 0.2         # 20% chance per turn when below 50% HP
#     hp_threshold: 0.5   # Only try to summon when HP below this %
#     max_active: 1       # Max number of this summon active at once
#     cooldown: 3         # Turns between summon attempts
#     dialogue: "Intern! Get in here!"

# Dialogue - context-aware taunts the enemy says before attacking
dialogue:
  # Before attacking (general)
  attack_default:
    - "Time for your annual review!"
    - "This is going in your file!"
    - "HR always wins!"

  # When player is low HP
  attack_player_low_hp:
    - "Your termination is imminent!"
    - "Should've read the employee handbook!"
    - "Exit interview time!"

  # When player just healed
  attack_player_healed:
    - "Wellness programs won't save you!"
    - "Self-care? In THIS economy?"
    - "Band-aids don't fix policy violations!"

  # When player defended
  attack_player_defended:
    - "No hiding behind bureaucracy!"
    - "Your shield is not OSHA-approved!"
    - "Defense won't help your performance review!"

  # When player missed
  attack_player_missed:
    - "Missed! Just like your deadlines!"
    - "That's going in your file!"
    - "Attendance issues AND accuracy issues?"

  # When player hit the enemy
  attack_got_hit:
    - "Ow! That's workplace violence!"
    - "I'm filing a complaint!"
    - "HR will remember this!"

  # When player crit the enemy
  attack_got_crit:
    - "That's... actually impressive."
    - "Noted for your performance review!"
    - "Fine! Gloves are OFF!"

  # When enemy is low HP
  attack_self_low_hp:
    - "I won't be outsourced!"
    - "HR never surrenders!"
    - "You can't fire ME!"

  # When enemy has status effects (burn, poison, etc.)
  attack_has_status:
    - "This is a hostile work environment!"
    - "I'm documenting EVERYTHING!"
    - "Workers' comp will hear about this!"

  # When player is stunned/can't act
  attack_player_stunned:
    - "Mandatory meeting time!"
    - "No skipping this one!"
    - "Captive audience!"

  # Battle start
  battle_start:
    - "Your resignation has been... REJECTED!"
    - "Let's discuss your future here!"
    - "Time for your exit interview!"

  # Victory (enemy wins)
  victory:
    - "Back to the cubicle with you!"
    - "HR: 1, Employee: 0"
    - "Your termination is complete!"

  # Defeat (enemy loses)
  defeat:
    - "This... isn't... protocol..."
    - "I'll be back... with forms..."
    - "HR will hear about this!"

  # When using specific moves (optional - key matches move name)
  move_performance_review:
    - "Let's review your quarterly goals!"
    - "Your metrics are... disappointing."

  move_break_room_retreat:
    - "Coffee break!"
    - "Even HR needs a breather..."
---

Agnes from HR. The final boss of every office worker's nightmare. Her weapon? Paperwork. Her armor? Policy. Her weakness? Actual human connection (which she lacks).
