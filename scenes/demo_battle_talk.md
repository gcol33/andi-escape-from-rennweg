---
id: demo_battle_talk
bg: office_corridor.jpg
music: questioning.mp3
chars:
  - agnes_angry.svg
actions:
  - type: roll_dice
    dice: d20
    threshold: 15
    modifier: disadvantage
    skill: Persuasion
    crit_text: "Your words are so moving, Agnes tears up!"
    fumble_text: "You accidentally insult her mother!"
    success_target: demo_battle_avoided
    failure_target: demo_battle_talk_fail
---

You try to calm Agnes down with words...

"Look, I'm sure we can work this out..."

**Persuasion Check with Disadvantage** - Agnes is VERY angry!

### Choices

- Attempt persuasion [sfx: click.ogg] → _roll
