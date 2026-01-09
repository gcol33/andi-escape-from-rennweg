---
id: stairs_1
bg: staircase_elevator.png
set_flags:
  - franz_return_stairs
clear_flags:
  - franz_return_elevator0
  - franz_return_elevator1
---

You descend to the first floor landing, your footsteps echoing off the concrete walls. The stairwell is busier than usual. Someone leaning against the wall by the window, someone heading toward the basement, someone standing in the corner by the fire extinguisher.

---

You could talk to any of them before continuing.

### Choices

- Talk to the person by the window (requires: stefan_defeated) → STEFAN_rematch
- Talk to the person by the window (requires: !stefan_defeated) → STEFAN
- Follow whoever's going to the basement → WOLFGANG
- Approach the person in the corner (requires: !met_franz) → FRANZ_1
