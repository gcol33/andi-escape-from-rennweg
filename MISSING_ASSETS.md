# Missing Assets

## Summary
- **Available character PNGs:** 46
- **Available background PNGs:** 5 + 2 utility SVGs
- **Missing backgrounds:** 10 (all .jpg files)
- **Missing enemy sprites:** 7 (all .svg, but placeholders exist)
- **Missing scene characters:** cat_1-5.svg (placeholders exist)

---

## MISSING BACKGROUNDS (10 total)

All referenced backgrounds are .jpg files that don't exist. Only .png backgrounds are available.

### CRITICAL - Game Start/Core
| Background | Status | Notes |
|------------|--------|-------|
| **dark_office_desk.jpg** | MISSING | First scene - start |
| **hallway_fluorescent.jpg** | MISSING | Elevator/floor navigation (8 scenes) |
| **stairwell_landing.jpg** | MISSING | Stair scenes (5 scenes) |

### HIGH - Multiple Scenes
| Background | Status | Notes |
|------------|--------|-------|
| **rooftop.jpg** | MISSING | BBQ endings (10+ scenes) |
| **sunny_street_freedom.jpg** | MISSING | Good endings (8+ scenes) |
| **meeting_room_whiteboard.jpg** | MISSING | Quiz/GIS (6 scenes) |
| **back_stairwell_dim.jpg** | MISSING | Cellar/DND (5 scenes) |
| **office_corridor.jpg** | MISSING | office_corridor.png exists but wrong extension |

### MEDIUM - Few Scenes
| Background | Status | Notes |
|------------|--------|-------|
| **office_kitchen.jpg** | MISSING | Kitchen scenes (2 scenes) |
| **hallway_dim.jpg** | MISSING | Cat chase (1 scene) |
| **stairwell_escape.jpg** | MISSING | Cat chase (1 scene) |

### Available Backgrounds
```
4th_floor.png
black.svg (utility - transitions)
coffee_machine.png
elevator_path.png
fallback.svg (utility - fallback)
office_corridor.png
office_corridor_stairs.png
```

---

## MISSING ENEMY SPRITES (7 total)

All enemy sprites reference .svg files. Placeholders exist in `assets/char/_placeholders/`.

| Enemy Sprite | Placeholder | Real PNG Alternative |
|--------------|-------------|---------------------|
| agnes_blocking.svg | YES | agnes_fight.png, agnes_neutral.png |
| anna_neutral.svg | YES | anna_coffee_high.png |
| dnd_group.svg | YES | dnd_group.png |
| johannes.svg | YES | johannes_neutral.png |
| karl.svg | YES | karl_neutral.png |
| michi_whiteboard.svg | YES | michi_neutral.png |
| stefan_neutral.svg | YES | stefan_arms_crossed.png, stefan_hi.png |

### Stefan Phase Sprites (additional)
| Phase Sprite | Placeholder | Real PNG |
|--------------|-------------|----------|
| stefan_super.svg | ? | stefan_super.png |
| stefan_ultra.svg | ? | stefan_ultra.png |

---

## MISSING SCENE CHARACTERS (5 total)

Cat sprites for chase/ending scenes. Placeholders exist.

| Character | Placeholder | Scenes |
|-----------|-------------|--------|
| cat_1.svg | YES | cat_scene_1 |
| cat_2.svg | YES | cat_scene_2 |
| cat_3.svg | YES | cat_scene_3 |
| cat_4.svg | YES | cat_scene_4 |
| cat_5.svg | YES | 7+ BBQ endings |

---

## AVAILABLE CHARACTER PNGs (46 files)

```
adrian_smiling.png       agnes_fight.png          agnes_fight2.png
agnes_neutral.png        agnes_robot_phase.png    agnes_timesheet_annoyed.png
agnes_timesheet_looking_down.png                  anna_coffee.png
anna_coffee_high.png     charlie-jpg.png          didi_neutral.png
dnd_group.png            emma_happy_at_desk.png   emma_hello.png
emma_notes.png           emma_run.png             emma_wave.png
emma_working.png         franz_chicken.png        franz_tarot.png
jacqueline_neutral.png   jen_cop.png              jen_nuts.png
johannes_neutral.png     joni_smoking.png         karl_neutral.png
lisa_questioning.png     lisa_searching.png       lisa_searching2.png
lisa_searching_questioning.png                    lisa_shrug.png
manuela_annoyed_with_code.png                     manuela_coca_machine.png
manuela_desk.png         manuela_pray.png         manuela_showing_clipper.png
michi_neutral.png        moritz_excursion.png     siegrun_pray.png
siegrun_thumbs_up.png    stefan_arms_crossed.png  stefan_get_out.png
stefan_hi.png            stefan_super.png         stefan_ultra.png
wolfgang_neutral.png
```

---

## RECOMMENDED FIXES

### Option 1: Update scene/enemy references to use .png
Change all `.jpg` background references to `.png` and `.svg` sprite references to `.png`.

### Option 2: Generate missing assets
Use ChatGPT/DALL-E to generate the missing .jpg backgrounds.

### Option 3: Rename existing assets
- Rename `office_corridor.png` → `office_corridor.jpg`
- Or update scenes to reference `.png` versions

---

## ChatGPT Prompts for Missing Backgrounds

### dark_office_desk (CRITICAL - Start Scene)
```
An office desk from the perspective of someone sitting at it. Multiple computer monitors glowing with code/terminal windows. Dark room lit mainly by screen glow. Cooling fans visible. Server room vibes - cold and techy.

Style: Detailed pencil sketch / graphite drawing. Grayscale with soft tonal gradients.
```

### rooftop (BBQ scenes - 10+ uses)
```
A rooftop terrace/garden of an office building. Evening light, fairy lights strung up. BBQ grill visible. Casual seating area. Vienna cityscape in background.

Style: Detailed pencil sketch / graphite drawing. Grayscale. Warm, social atmosphere.
```

### sunny_street_freedom (Endings - 8+ uses)
```
A sunny Vienna street scene. Historic buildings, tram tracks, pedestrians. Bright daylight, sense of freedom and new beginnings. Rennweg area style.

Style: Detailed pencil sketch / graphite drawing. Grayscale. High-key, bright and optimistic.
```

### hallway_fluorescent (Navigation - 8 uses)
```
An institutional office corridor. Fluorescent lights overhead. Glass doors, concrete/painted walls. Generic office building interior.

Style: Detailed pencil sketch / graphite drawing. Grayscale. Cold, institutional lighting.
```

### stairwell_landing (5 uses)
```
A stairwell landing in an office building. Concrete stairs, metal railing. Window letting in afternoon light. Fire extinguisher on wall.

Style: Detailed pencil sketch / graphite drawing. Grayscale. Dramatic lighting from window.
```

---

*Updated: 2024-12-29*
