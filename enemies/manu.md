---
id: manu
name: Manu
sprite: manuela_annoyed_with_code.png

# Base Stats - 18 HP but hits harder than Agnes
hp: 18
ac: 10
attack_bonus: 4
damage: d10
type: psychic
stagger_threshold: 40

# AI Behavior
ai: aggressive

# Moves
moves:
  - name: Dataset Disaster
    damage: 2d6
    type: psychic
    description: She shows you the horrifying state of the data!

  - name: Pleading Eyes
    damage: d8
    type: psychic
    statusEffect:
      type: confusion
      chance: 0.2
    description: Those desperate eyes bore into your soul...

  - name: Python Pressure
    damage: d10+2
    type: psychic
    description: "Just a quick script, pleeeease?"

  - name: Bison Stampede
    damage: 3d4
    type: physical
    description: The chaotic dataset overwhelms you!

# Telegraphed Intent Skills
intents:
  - id: week_long_project
    type: big_attack
    chance: 0.25
    minTurn: 2
    cooldown: 4
    prepTurns: 1
    dialogue: "This dataset is HUGE... You should DEFEND yourself from getting trapped!"
    executeDialogue: "You've been here for a WEEK!"
    skill:
      name: Week-Long Project
      damage: 18
      type: psychic
      description: Time flies when you're debugging...

# Dialogue
dialogue:
  attack_default:
    - "Just one more column to fix!"
    - "The GPS coordinates are all wrong!"
    - "Who even formatted this CSV?!"

  attack_player_low_hp:
    - "You're almost done, just a few more hours!"
    - "Don't give up now, we're so close!"
    - "The Bisons are counting on you!"

  attack_player_healed:
    - "Coffee break? Good idea!"
    - "Refreshed? Great, back to coding!"

  attack_player_defended:
    - "You can't hide from messy data!"
    - "The dataset will find you!"

  attack_player_missed:
    - "Ha! Even the data misses sometimes!"
    - "Null pointer exception!"

  attack_got_hit:
    - "Ow! That's not very collaborative!"
    - "I thought we were friends!"

  attack_got_crit:
    - "Okay okay, I'll try it myself..."
    - "That was harsh!"

  attack_self_low_hp:
    - "Please, I really need this!"
    - "The deadline is tomorrow!"

  battle_start:
    - "I could reaaaally use your Python skills!"
    - "Just a quick look at this dataset?"

  victory:
    - "Thanks for helping! See you next week!"
    - "The Coca-Cola is on me!"

  defeat:
    - "Fine, I'll learn Python myself..."
    - "Maybe R isn't so bad after all..."
---

Manu from the Bison tracking project. Armed with a hopelessly messy dataset and puppy-dog eyes that could trap you for weeks.
