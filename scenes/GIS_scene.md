---
id: GIS_scene
bg: meeting_room_whiteboard.jpg
chars:
  - charlie_neutral.svg
---

You follow Charlie to his workstation. Maps cover every surface. Topographical nightmares, satellite imagery, layers upon layers of geographic data. Charlie pulls up his code on the screen. "See? I'm trying to transform these coordinates from WGS84 to MGI, but the output is landing somewhere in the Atlantic Ocean."

---

You lean in, scanning the code. The transformation logic looks reasonable at first glance, but something's off. You spot the issue almost immediately: he's swapped the order of the coordinate axes. "There," you point at line 47. "You've got latitude and longitude reversed." Charlie's face cycles through confusion, realization, and mild embarrassment in rapid succession.

### Choices

- Help fix the code → GIS_ending
