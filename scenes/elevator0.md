---
id: elevator0
bg: elevator_path.png
set_flags:
  - franz_return_elevator0
clear_flags:
  - franz_return_elevator1
  - franz_return_stairs
actions:
  - type: goto
    target: FRANZ_1
    requires: !met_franz
---

The elevator doors slide open with their familiar mechanical wheeze. You step inside the tiny metal box that has carried you between floors countless times over the years. The buttons glow softly in the dim light. Where to?

### Choices

- Go to rooftop (require_skills: Rooftop Discovery) → cat_scene_4
- Go to 1st floor → floor1
- Go to 4th floor (requires: !visited_4th_floor) → floor4

