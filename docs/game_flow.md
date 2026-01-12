# Game Flow Overview

```
                                    start
                                      │
                                 cat_scene_1
                                      │
                                   charlie
                                   /      \
                            GIS_scene    jk_r1 ─────────────────────────────────────┐
                               │            \                                        │
                          GIS_ending      LISA_scene ──────┐                        │
                          (ENDING)            │            │                        │
                                           ADRIAN      MORITZ_excursion             │
                                              │             │                       │
                                            DIDI      quiz_excursion ──► ending_quiz_fail_moritz
                                              │             │                (ENDING)
                                 ┌────────────┴─────┐  quiz_excursion_win
                                 │                  │       │
                           AGNES_rematch          AGNES     JEN ─────────────────┐
                                 │                  │       │  \                 │
                              stairs_1         AGNES_battle │  JEN_no         squirrel_bad
                                 │                  │       │     │               │
                    ┌────────────┼────────────┐     │    squirrel_good    squirrel_police_ending
                    │            │            │     │         │                (ENDING)
               STEFAN_rematch  STEFAN     WOLFGANG  │    AGNES_rematch ─► stairs_1
                    │            │            │     │         │
               cat_scene_3  STEFAN_battle  cellar  │         └──────────────────────┐
                    │            │            │     │                                │
                  billa     ┌────┴────┐    jk_r6   │                                │
                    │       │         │      │     │                                │
                  jk_r4  STEFAN_   STEFAN_   │     │                                │
                    │    victory   defeat    │     │                                │
                SIEGRUN     │     (ENDING)   │     │                                │
                    │    cat_scene_3         │     │                                │
           SIEGRUN_excursion    │      ┌─────┴─────┴───┐                            │
                    │           └──────┤               │                            │
              quiz_excursion2          │         dnd_group ─────────────────────────┤
                    │                  │               │                            │
           quiz_excursion2_win     dnd_group_rematch   │                            │
                    │                  │          dnd_group_battle                  │
                elevator1              │               │                            │
                    │             stairs_0        ┌────┴────┐                       │
    ┌───────────────┴───────────────┐  │          │         │                       │
    │               │               │  │    dnd_group_   dnd_group_                 │
FRANZ_before_   cat_scene_4      floor4│    victory      defeat                     │
elevator1           │               │  │       │        (ENDING)                    │
    │            rooftop       floor4_plant    │                                    │
 floor0             │               │   dnd_group_dancing                           │
    │        ┌──────┴───────┐    jk_r5      │                                       │
  out1       │              │       │    stairs_0                                   │
    │     bbq1        ending_bbq_   │                                               │
cat_scene_5  │          nosmile  MICHI ────────────────────┐                        │
    │     ┌──┴──────┐  (ENDING)    │  \                    │                        │
ending_   │         │         MICHI_battle          MICHI_rematch                   │
early_  bbq2  ending_bbq_*        │                        │                        │
exit      │    (ENDINGS)     ┌────┴────┐                  EMMA                      │
(ENDING)  │               MICHI_    MICHI_                 │                        │
       ┌──┴───┐           victory   defeat              elevator1 ─────────────┐    │
       │      │              │     (ENDING)                                    │    │
     bbq3  ending_bbq_*     EMMA                                               │    │
       │    (ENDINGS)        │                                                 │    │
  win_screen              elevator1 ───────────────────────────────────────────┘    │
   (WIN!)                                                                           │
                                                                                    │
                                    ┌───────────────────────────────────────────────┘
                                    │
                               jk_r1_roll ─► johannes_check/karl_check
                                                    │
                                            ┌───────┴───────┐
                                            │               │
                                     johannes_battle   karl_battle
                                            │               │
                                      ┌─────┴─────┐   ┌─────┴─────┐
                                      │           │   │           │
                               johannes_    johannes_ karl_    karl_
                               victory      defeat  victory   defeat
                                  │        (ENDING)    │     (ENDING)
                              jk_return             jk_return
                                  │                    │
                               (back to             (back to
                             unvisited NPCs)      unvisited NPCs)
```

## Simplified Main Path

```
start
  └── cat_scene_1
       └── charlie
            ├── GIS_scene → GIS_ending (ENDING)
            └── jk_r1 (main path)
                 └── LISA_scene
                      ├── ADRIAN → DIDI → AGNES loop
                      └── MORITZ_excursion → quiz_excursion
                           ├── FAIL → ending_quiz_fail_moritz (ENDING)
                           └── WIN → JEN
                                ├── squirrel_bad → squirrel_police_ending (ENDING)
                                └── squirrel_good → stairs_1
                                     ├── STEFAN → battle (win/lose)
                                     ├── WOLFGANG → cellar → dnd_group
                                     └── FRANZ_1 → tarot reading

                                     (eventually leads to...)

                                     → elevator → rooftop → bbq1
                                          ├── Missing items? → ending_bbq_* (ENDINGS)
                                          └── Have all items? → bbq3 → win_screen (WIN!)
```

## Key Locations

| Floor | Location | NPCs/Events |
|-------|----------|-------------|
| 4 | Office (start) | Cat appears |
| 4 | floor4 | Plant puzzle |
| 1 | floor1 | Office visit |
| 0 | stairs_0 | Ground floor hub |
| 0 | out1 | Outside |
| Cellar | cellar | Wolfgang's domain |
| Roof | rooftop | BBQ finale |

## Battle System

Each major NPC has a battle path:
```
CHARACTER → CHARACTER_battle ─┬─► CHARACTER_victory → continue
                              └─► CHARACTER_defeat (ENDING)

Optional: CHARACTER_battle_coffee (with coffee buff)
          CHARACTER_rematch (if met before)
```

## Endings Summary

| Type | Count | Examples |
|------|-------|----------|
| Win | 1 | win_screen |
| Battle defeats | 7 | AGNES_defeat, ANNA_defeat, etc. |
| Quiz fails | 2 | ending_quiz_fail_moritz, ending_quiz_fail_siegrun |
| BBQ fails | 7 | Missing items at final BBQ |
| Early exit | 1 | ending_early_exit |
| Special | 2 | GIS_ending, squirrel_police_ending |

**Total: 20 distinct endings** (1 win, 19 various failures)
