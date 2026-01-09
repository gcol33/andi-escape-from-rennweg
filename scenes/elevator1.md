---
id: elevator1
bg: elevator_path.png
set_flags:
  - franz_return_elevator1
clear_flags:
  - franz_return_elevator0
  - franz_return_stairs
actions:
  - type: goto
    target: FRANZ_1
    requires: !met_franz
---

The elevator arrives with a familiar ding. You step inside. Scuffed interior, flickering fluorescent light, button panel worn smooth from years of use. Where to?

### Choices

- Go to rooftop (require_skills: Rooftop Discovery) → cat_scene_4
- Go to ground floor → floor0
- Go to 4th floor (requires: !visited_4th_floor) → floor4

