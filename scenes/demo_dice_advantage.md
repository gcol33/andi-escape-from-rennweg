---
id: demo_dice_advantage
bg: hallway_fluorescent.jpg
music: dicey_decisions.mp3
actions:
  - type: roll_dice
    dice: d20
    threshold: 14
    modifier: advantage
    skill: Athletics
    crit_text: "The door flies off its hinges!"
    fumble_text: "You hurt your shoulder badly!"
    success_target: demo_dice_success
    failure_target: demo_dice_fail
---

You take a few steps back and prepare to shoulder-charge the door!

**Roll with Advantage**: Rolling 2d20 and taking the HIGHEST result.

This gives you a better chance of success (and crits)!

### Choices

- CHARGE! [sfx: thud.ogg] → _roll
