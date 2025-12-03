---
id: office_intern
name: Office Intern
sprite: intern.svg
icon: 📋

# Combat Stats
hp: 8
ac: 8
damage: d4
damageType: physical
attackBonus: 1

# Duration (turns before expiring)
duration: 4

# Behavior
canProtect: true
canAttack: true

# Moves (optional - if empty, uses default attack)
moves:
  - name: Coffee Run
    damage: d4
    type: physical
    description: The intern throws hot coffee!

  - name: Paper Jam
    damage: d3
    type: physical
    statusEffect:
      type: stun
      chance: 0.1
    description: A stack of paperwork causes confusion!

# Dialogue for various situations
dialogue:
  summon_appear:
    - "You wanted to see me, Agnes?"
    - "I brought coffee!"
    - "Reporting for duty!"

  attack:
    - "Filing this under 'urgent'!"
    - "Let me handle this!"
    - "I got it!"

  protect:
    - "I'll take the hit!"
    - "Not on my watch!"
    - "Agnes needs me!"

  low_hp:
    - "I... I need a break..."
    - "This wasn't in my job description..."

  death:
    - "I quit!"
    - "I'm calling HR... wait..."
    - "Unpaid overtime wasn't worth this..."

  expire:
    - "My shift is over!"
    - "Time to clock out!"
---

The hapless office intern, eternally stuck in a cycle of coffee runs and paperwork. They try their best to help Agnes, though their enthusiasm often outpaces their competence. At least they're eager?
