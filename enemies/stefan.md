---
id: stefan
name: Stefan
sprite: stefan_neutral.svg

# Base Stats
hp: 110
ac: 12
attack_bonus: 3
damage: d8
type: physical
stagger_threshold: 80
ai: aggressive

# Phase System - Stefan transforms as he takes damage
# Phase 1: Base (100-66% HP) - Normal moveset
# Phase 2: Super (66-33% HP) - Buffed stats, new moves, sprite change
# Phase 3: Ultra (<33% HP) - Intents only, maximum power
phases:
  - id: base
    name: Base
    hp_threshold: 1.0
    sprite: stefan_neutral.svg
    attack_bonus: 3
    damage: d8

  - id: super
    name: Super Stefan
    hp_threshold: 0.66
    sprite: stefan_super.svg
    attack_bonus: 5
    damage: d10
    dialogue: "You think this is my full power? HAAAAAAAA!"
    music: BOSS_TIME_INTENSE.mp3

  - id: ultra
    name: Ultra Stefan
    hp_threshold: 0.33
    sprite: stefan_ultra.svg
    attack_bonus: 7
    damage: d12
    dialogue: "No one has ever pushed me this far..."
    intents_only: true
    music: BOSS_TIME_FINAL.mp3

# Regular Moves (used in Base and Super phases)
moves:
  - name: Server Punch
    damage: d6
    type: physical
    description: Stefan channels his frustration from the Hercules project!

  - name: Cable Whip
    damage: 2d4
    type: physical
    description: He swings a bundle of ethernet cables!

  - name: Overclock
    damage: d8
    type: fire
    statusEffect:
      type: burn
      chance: 0.2
    description: Stefan's rage runs hot!

  - name: Debug Mode
    isHeal: true
    healAmount: 1d6+2
    description: Stefan patches himself up.

# Super Phase Moves (unlocked at 66% HP)
super_moves:
  - name: Power Surge
    damage: 2d6
    type: physical
    description: Raw power flows through Stefan!

  - name: Rage Mode
    isBuff: true
    statusEffect:
      type: rage
      duration: 2
    description: Stefan's eyes glow with fury!

# Telegraphed Intent Skills - powerful moves that require preparation
# In Ultra phase, Stefan ONLY uses intents
intents:
  - id: hercules_slam
    type: big_attack
    chance: 0.25
    minTurn: 2
    cooldown: 3
    prepTurns: 1
    dialogue: "Remember the Hercules server? IT REMEMBERS YOU!"
    executeDialogue: "HERCULES SMASH!"
    skill:
      name: Hercules Slam
      damage: 14
      type: physical
      description: The ghost of the abandoned server project strikes!

  - id: ethernet_barrage
    type: multi_hit
    chance: 0.2
    minTurn: 3
    cooldown: 4
    prepTurns: 1
    dialogue: "Let me show you TRUE network traffic... DEFEND yourself!"
    executeDialogue: "Packets incoming!"
    skill:
      name: Ethernet Barrage
      damage: d6
      type: physical
      hits: 3
      description: A storm of data cables!

  - id: final_compile
    type: big_attack
    chance: 0.3
    minTurn: 1
    cooldown: 5
    prepTurns: 2
    dialogue: "Initiating FINAL COMPILE... You should DEFEND yourself!"
    executeDialogue: "BUILD COMPLETE!"
    skill:
      name: Final Compile
      damage: 20
      type: physical
      description: The ultimate attack. Should have defended!

# Dialogue - context-aware taunts
dialogue:
  battle_start:
    - "You abandoned the Hercules project... Now face its GHOST!"
    - "Time to settle this, once and for all!"

  attack_default:
    - "You call that code?!"
    - "Segmentation fault... IN YOUR FACE!"
    - "Did you even read the documentation?!"
    - "This is for all those unmerged pull requests!"

  attack_player_low_hp:
    - "System failure imminent!"
    - "Your process is about to be killed!"
    - "Stack overflow detected in YOUR HP!"

  attack_player_defended:
    - "Firewall won't save you!"
    - "Nice try, but I'll find another port!"
    - "Defense won't help against my attacks!"

  attack_got_hit:
    - "A minor bug... I'll patch it!"
    - "Interesting approach..."
    - "Is that all you've got?!"

  attack_got_crit:
    - "Critical error... but I can recover!"
    - "That actually hurt..."
    - "You're better than I thought!"

  attack_self_low_hp:
    - "I WON'T BE DEPRECATED!"
    - "MY POWER LEVEL IS OVER 9000!"
    - "This isn't even my final form... wait, yes it is!"

  # Phase transition dialogue
  phase_super:
    - "You think this is my full power? HAAAAAAAA!"
    - "Entering SUPER mode! My stats just doubled!"

  phase_ultra:
    - "No one has ever pushed me this far..."
    - "ULTRA INSTINCT ACTIVATED!"
    - "Now you face my TRUE power!"

  victory:
    - "Your process has been terminated."
    - "Back to the server room with you!"
    - "git commit -m 'defeated player'"

  defeat:
    - "Impossible... my calculations were perfect..."
    - "The Hercules project... finally laid to rest..."
    - "You... you actually did it..."
---

Stefan. Former IT colleague. Still bitter about the abandoned Hercules server project. His power grows with his rage - push him too far and face his ultimate form.
