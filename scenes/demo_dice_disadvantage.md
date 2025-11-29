---
id: demo_dice_disadvantage
bg: hallway_fluorescent.jpg
music: dicey_decisions.mp3
actions:
  - type: roll_dice
    dice: d20
    threshold: 10
    modifier: disadvantage
    skill: Hacking
    crit_text: "Against all odds, you're in!"
    fumble_text: "The system locks you out permanently!"
    success_target: demo_dice_success
    failure_target: demo_dice_fail
---

The keypad looks ancient and glitchy. This won't be easy...

**Roll with Disadvantage**: Rolling 2d20 and taking the LOWEST result.

This makes success much harder (and fumbles more likely)!

### Choices

- Attempt the hack [sfx: click.ogg] → _roll
