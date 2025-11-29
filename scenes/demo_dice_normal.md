---
id: demo_dice_normal
bg: hallway_fluorescent.jpg
music: dicey_decisions.mp3
actions:
  - type: roll_dice
    dice: d20
    threshold: 12
    skill: Sleight of Hand
    crit_text: "The lock practically opens itself!"
    fumble_text: "You break your lockpick AND set off an alarm!"
    success_target: demo_dice_success
    failure_target: demo_dice_fail
---

You pull out your lockpicking tools and get to work...

**Normal Roll**: Rolling a d20 against DC 12.

Watch for critical hits (nat 20) and fumbles (nat 1)!

### Choices

- Roll the dice! [sfx: dice_roll.ogg] → _roll
