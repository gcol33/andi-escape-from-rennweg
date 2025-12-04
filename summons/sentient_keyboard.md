---
id: sentient_keyboard
name: Sentient Keyboard
sprite: keyboard.svg
icon: ⌨

# Combat Stats
hp: 12
ac: 10
damage: d6
damageType: physical
attackBonus: 2

# Duration (turns before expiring)
duration: 5

# Behavior
canProtect: false
canAttack: true

# Moves (optional - if empty, uses default attack)
moves:
  - name: Key Smash
    damage: d6
    type: physical
    description: The keyboard types furiously at the enemy!

  - name: Caps Lock
    damage: d4
    type: physical
    statusEffect:
      type: stun
      chance: 0.15
    description: AN ANGRY ALL-CAPS MESSAGE STUNS THE TARGET!

# Dialogue for various situations
dialogue:
  summon_appear:
    - "CLACK CLACK CLACK!"
    - "*mechanical keyboard sounds*"
    - "Ready to type some damage!"

  attack:
    - "CLICK CLACK!"
    - "*angry typing noises*"
    - "asdfghjkl;!"

  low_hp:
    - "*keys falling off*"
    - "Need... new... keycaps..."

  death:
    - "*sad beep*"
    - "Error 404: Keyboard not found..."

  expire:
    - "*powers down*"
    - "Going into sleep mode..."
---

A sentient mechanical keyboard that has gained consciousness through exposure to too many coffee spills and late-night coding sessions. It communicates primarily through aggressive typing sounds and occasionally coherent words.
