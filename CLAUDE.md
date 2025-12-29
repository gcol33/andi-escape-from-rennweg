# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Reference

```bash
# Build story from markdown (REQUIRED after editing scenes/*.md, enemies/*.md, player/*.md, or theme.md)
python tools/build_story_from_md.py

# Run tests
node tests/run-tests.js           # Battle system (178 tests)
node tests/run-theme-tests.js     # Theme CSS validation (126 tests)
node tests/run-tuning-tests.js    # Tuning validation
node tests/run-qte-tests.js       # QTE tests
```

**Dev Mode**: Hold **q+w+e+r+t** simultaneously to toggle (enables undo, theme selector, force dice rolls).

## Critical Rules

1. **Generated files - DO NOT edit manually:**
   - `js/story.js` - generated from `scenes/*.md`
   - `js/enemies.js` - generated from `enemies/*.md`
   - `js/summons.js` - generated from `summons/*.md`
   - `js/player.js` - generated from `player/player.md`
   - `js/theme.js` - generated from `theme.md`

   Always edit the source Markdown files and run `python tools/build_story_from_md.py`.

2. **Content/Code separation**: Writers edit Markdown only, never JS. No story text in engine code.

3. **Logic/UI separation**: `js/modules/battle/*.js` = pure logic (no DOM), `battle-ui.js` = rendering.

4. **Tuning layer**: All magic numbers (timing, speeds, balance) in `js/tuning.js`.

5. **Theme-agnostic UI**: Use CSS classes, never inline styles.

## Architecture Overview

| Layer | Source | Output | Purpose |
|-------|--------|--------|---------|
| Story | `scenes/*.md` | `js/story.js` | Scene content, choices, flags |
| Enemies | `enemies/*.md` | `js/enemies.js` | Enemy stats, moves, intents, dialogue |
| Summons | `summons/*.md` | `js/summons.js` | Summonable allies/enemies |
| Player | `player/player.md` | `js/player.js` | Player config, skills |
| Theme | `theme.md` | `js/theme.js` | Active theme selection |

### Core Engine

- `js/engine.js` - VN engine: scene rendering, typewriter, choices, flags, inventory, action registry
- `js/tuning.js` - All balance values and timing constants
- `js/game-menu.js` - Full-screen RPG menu (Items, Skills, Stats, Journal)
- `css/themes/*.css` - Visual themes (19 available)

### Architecture Refactor (in progress)

- `js/core/` - New event-driven architecture
  - `event-bus.js` - Pub/sub event system
  - `store.js` - Centralized state management
- `js/managers/` - Manager pattern (not yet active)

### Optional Modules (`js/modules/`)

Modules can be included/excluded by adding/removing script tags in `index.html`.

- `js/modules/module-registry.js` - Module registration and lifecycle
- `js/modules/text-renderer/` - Text display system (core module)
  - `text-utils.js` - Markdown, measurement, HTML parsing
  - `typewriter.js` - Character-by-character display
  - `pagination.js` - Fixed-height page splitting
  - `index.js` - Unified API
- `js/modules/battle/` - Combat system (D&D-style, 18 files)
  - `index.js` - Module wrapper, provides `start_battle` action
  - `battle-facade.js` - Main entry point
  - `battle-core.js`, `battle-dnd.js`, `battle-data.js`, etc.
- `js/modules/qte/` - Quick-time events (parry/dodge mechanics)
  - `index.js`, `qte-engine.js`, `qte-ui.js`
- `js/modules/quiz/` - Timed quiz system
  - `index.js`, `quiz-engine.js`, `quiz-ui.js`
- `js/modules/overworld/` - Tile-based maps (not yet integrated)
- `js/modules/dev-tools/` - Developer panel (q+w+e+r+t chord)

### Battle System Flow

```
Player Turn: Status tick → Check can act → Player action → Check enemy defeated
Enemy Turn:  Status tick → Check can act → AI selects move → Execute → Check player defeated
```

Key state in `BattleCore`: `player`, `enemy`, `phase` ('player'|'enemy'|'animating'|'ended'), `turn`.

## Tuning Configuration

Key runtime options in `js/tuning.js`:

```javascript
TUNING.text.displayMode      // 'fixed' (paginated) or 'expanding' (dynamic height)
TUNING.text.fixedLines       // Lines per page in fixed mode (default: 3)
TUNING.battle.dice.skipMode  // 'stepwise' (click advances) or 'instant' (skip all)
```

Runtime API:
- `VNEngine.setTextDisplayMode('fixed'|'expanding')`
- `VNEngine.setFixedLines(n)`

## Scene Markdown Format

```markdown
---
id: scene_id
bg: background.jpg
music: track.mp3
chars:
  - character.svg
set_flags:
  - flag_name
actions:
  - type: roll_dice
    dice: d20
    threshold: 13
    success_target: success_scene
    failure_target: failure_scene
---

First text block (shown on scene load).

---

Second text block (after "Continue" click).

### Choices

- Go left → left_scene
- Open door (requires: has_key) → locked_room
- Use key (uses: Master Key) → opened_door
- Fight! (battle: attack) → battle_continue
- Heal (heals: 5) → healed
```

## Enemy Markdown Format

```markdown
---
id: enemy_id
name: Display Name
sprite: sprite.svg
hp: 50
ac: 12
attack_bonus: 2
damage: d6
type: physical
ai: default  # default, aggressive, defensive, support

moves:
  - name: Attack Name
    damage: 2d4
    type: psychic
    statusEffect:
      type: stun  # burn, bleed, poison, stun, confusion
      chance: 0.15
    description: Flavor text for battle log

  - name: Heal Move
    isHeal: true
    healAmount: 1d4+1

intents:  # Telegraphed attacks (enemy announces, player can counter)
  - id: big_attack
    type: big_attack  # big_attack, summon, multi_hit
    chance: 0.2
    minTurn: 2
    cooldown: 4
    prepTurns: 1
    dialogue: "Preparing..."
    executeDialogue: "Attack!"
    skill:
      name: Big Hit
      damage: 15
      type: physical

dialogue:
  battle_start: ["Opening line"]
  attack_default: ["Generic attack taunt"]
  attack_player_low_hp: ["When player is weak"]
  defeat: ["Death line"]
---
```

## CSS Standards

- **Never use pixel-based media queries** - use `em` (e.g., `56em` not `900px`)
- Use `dvh` instead of `vh` for mobile compatibility
- **Provide fallbacks for modern CSS**:
  - `aspect-ratio`: Use padding-bottom trick
  - `clamp()/min()/max()`: Provide static fallback first
  - `gap` in flexbox: Use margin + `@supports`
  - `:has()`: Add fallback class via JS

## Asset Conventions

- Backgrounds: `assets/bg/`, lowercase with underscores, `.jpg`
- Sprites: `assets/char/`, 200x400 viewBox, `.svg`
- Music: `assets/music/`, `.mp3`
- SFX: `assets/sfx/`, `.ogg`
- Scene IDs: lowercase with underscores (`main_stairs`, `lost_to_coffee`)

## Changelog

Recent changes are documented at the end of this file to track balance changes and bug fixes.

### 2025-12-26
- Added click-to-skip for battle UI typewriter and dice animations
- Configurable skip mode in `TUNING.battle.dice.skipMode`: 'stepwise' (default) or 'instant'
- Fixed summon damage messages to use uppercase "DAMAGE" for consistency
- Fixed manga theme neutral color visibility

### 2025-12-22
- Added modular text display modes: 'fixed' (3-line stable height with pagination) and 'expanding' (original behavior)
- Config in `js/tuning.js`: `TUNING.text.displayMode` ('fixed'/'expanding') and `TUNING.text.fixedLines` (default 3)
- Fixed mode auto-paginates long text and shows Continue button between pages
- Runtime API: `VNEngine.setTextDisplayMode('fixed'|'expanding')` and `VNEngine.setFixedLines(n)`

### 2025-12-03
- Removed AC bonus from defensive stance (relies on QTE parry/dodge only)

### 2025-12-02
- Fixed: Dev mode undo after battle shows "Continue" instead of battle choices
- Fixed: Status wore-off messages no longer interleave with attack roll text
- Fixed: Status effects don't apply when player parries/dodges
- Fixed: Defensive stance lasts full duration (2 attacks), cooldown decrements on player actions only
- Added: Flavored text for dodge/parry outcomes

### 2025-12-01
- Improved "cannot act" message includes status icon and verb form
