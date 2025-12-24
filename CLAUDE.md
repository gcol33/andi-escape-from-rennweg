# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Reference

```bash
# Build story from markdown (REQUIRED after editing scenes/*.md, enemies/*.md, player/*.md, or theme.md)
python tools/build_story_from_md.py

# Run tests
node tests/run-tests.js           # Battle system (177 tests)
node tests/run-theme-tests.js     # Theme CSS validation (126 tests)
node tests/run-tuning-tests.js    # Tuning validation
node tests/run-qte-tests.js       # QTE tests
```

**Dev Mode**: Hold **q+w+e+r+t** simultaneously to toggle (enables undo, theme selector, force dice rolls).

## Critical Rules

1. **Generated files - DO NOT edit manually:**
   - `js/story.js` - generated from `scenes/*.md`
   - `js/enemies.js` - generated from `enemies/*.md`
   - `js/player.js` - generated from `player/player.md`
   - `js/theme.js` - generated from `theme.md`

   Always edit the source Markdown files and run `python tools/build_story_from_md.py`.

2. **Content/Code separation**: Writers edit Markdown only, never JS. No story text in engine code.

3. **Logic/UI separation**: `js/battle/*.js` = pure logic (no DOM), `js/battle-ui.js` = rendering.

4. **Tuning layer**: All magic numbers (timing, speeds, balance) in `js/tuning.js`.

5. **Theme-agnostic UI**: Use CSS classes, never inline styles.

## Architecture Overview

| Layer | Source | Output | Purpose |
|-------|--------|--------|---------|
| Story | `scenes/*.md` | `js/story.js` | Scene content, choices, flags |
| Enemies | `enemies/*.md` | `js/enemies.js` | Enemy stats, moves, dialogue |
| Player | `player/player.md` | `js/player.js` | Player config, skills |
| Theme | `theme.md` | `js/theme.js` | Active theme selection |

### Core Modules

- `js/engine.js` - VN engine: scene rendering, typewriter, choices, flags, inventory, action registry
- `js/battle/` - Modular battle system:
  - `battle-facade.js` - Main entry point, orchestrates battle flow
  - `battle-core.js` - Shared state and logic
  - `battle-data.js` - Skills, status effects, type chart
  - `battle-dnd.js` - D&D-style combat (default)
  - `battle-dice.js` + `battle-dice-ui.js` - Dice rolling
  - `battle-barrier.js` - Enemy shield system
  - `battle-intent.js` - Enemy telegraph system
- `js/qte.js` + `js/qte-ui.js` - Quick-time event system
- `js/tuning.js` - All balance values and timing constants
- `css/themes/*.css` - Visual themes (20+ available)

### Battle System Flow

```
Player Turn: Status tick → Check can act → Player action → Check enemy defeated
Enemy Turn:  Status tick → Check can act → AI selects move → Execute → Check player defeated
```

Key state in `BattleCore`: `player`, `enemy`, `phase` ('player'|'enemy'|'animating'|'ended'), `turn`.

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
