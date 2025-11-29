---
id: attempt_pass_normal
bg: stairwell_landing.jpg
music: dicey_decisions.mp3
chars:
  - agnes_blocking.svg
actions:
  - type: roll_dice
    dice: d20
    threshold: 13
    skill: Evasion
    crit_text: "You move like the wind!"
    fumble_text: "You trip over your own feet!"
    success_target: d20_success
    failure_target: d20_failure
---

You take a deep breath and sprint!

### Choices

- ROLL D20... [sfx: dice_roll.ogg] → _roll
