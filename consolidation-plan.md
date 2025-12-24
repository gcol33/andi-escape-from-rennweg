# Code Consolidation Plan

## Overview
This document tracks the consolidation of duplicate/split code across the codebase.

---

## Phase 1: Pausable Timer Module (CRITICAL)
**Status:** [x] COMPLETED

**Problem:** ~150 lines of identical pause/timeout management in two files.

**Files:**
- `js/battle/battle-facade.js` (lines 78-320)
- `js/battle/battle-dice-ui.js` (lines 60-250)

**Solution Applied:**
1. Created `js/battle/pausable-timer.js` - factory pattern creating independent timer instances
2. Updated battle-facade.js to use `PausableTimer.create()` with hooks for UI/dice coordination
3. Updated battle-dice-ui.js to use `PausableTimer.create()` with CSS class hooks
4. Removed ~150 lines of duplicated code
5. Added to index.html script loading

**Lines Saved:** ~150 lines

---

## Phase 2: Audio Manager Consolidation (CRITICAL)
**Status:** [~] SKIPPED - Not true duplication

**Problem:** Two separate audio implementations (~350 lines).

**Files:**
- `js/engine-audio.js` (IIFE pattern) - **ACTIVE**
- `js/managers/audio-manager.js` (Class pattern) - **INACTIVE, future architecture**

**Finding:**
HTML comment states managers are "new architecture - not yet active".
`engine-audio.js` is the canonical active implementation.
`managers/audio-manager.js` is intentional dead code for future migration.

**Decision:** No action needed. This is planned future architecture, not accidental duplication.

---

## Phase 3: Typewriter Effect Module (HIGH)
**Status:** [~] DEFERRED - Complex, low risk

**Problem:** ~100 lines of similar (not identical) typewriter animation.

**Files:**
- `js/battle/battle-ui.js` (lines 998-1121) - Row-aware, uses regular setTimeout
- `js/battle/battle-dice-ui.js` (lines 612-679) - Simple, uses pausable diceTimeout

**Analysis:**
The implementations are functionally different:
- battle-dice-ui uses PausableTimer (pausable during battle pause)
- battle-ui uses regular setTimeout (NOT pausable - potential bug!)
- battle-ui has complex row/segment handling for multi-line text

**Current State:**
Both work correctly after scroll fix. Consolidation would require:
1. Making battle-ui.js use pausable timers
2. Unifying the row handling logic
3. Creating shared surrogate pair / HTML tag handling

**Decision:** Defer to avoid regressions. Could revisit if typewriter bugs appear.

**Note:** battle-ui.js should probably use pausable timers too (future fix)

---

## Phase 4: Event System Unification (HIGH)
**Status:** [x] COMPLETED

**Problem:** Two event bus implementations.

**Files:**
- `js/events.js` (EventEmitter - simple IIFE) - **DEPRECATED**
- `js/core/event-bus.js` (eventBus - class pattern) - **CANONICAL**

**Solution Applied:**
1. Migrated 4 `EventEmitter.emit()` calls to `eventBus.emit()`:
   - `js/animation-manager.js` - animations:cancelled
   - `js/engine.js` - scene:transition, asset:load-error
   - `js/battle/battle-core.js` - general event helper
2. Commented out `events.js` in index.html with deprecation note
3. `eventBus` is now the single event system (38+ usages)

**Lines Saved:** ~100 lines (events.js no longer loaded)

---

## Phase 5: SFX Callback Pattern (MEDIUM)
**Status:** [x] COMPLETED

**Problem:** Duplicated callback registration for SFX.

**Files:**
- `js/battle/battle-ui.js` (lines 111-141)
- `js/battle/battle-dice-ui.js` (lines 54-67)

**Solution Applied:**
1. Added shared `setSfxCallback()` and `playSfx()` to `BattleUtils`
2. Updated battle-ui.js to delegate to `BattleUtils.setSfxCallback/playSfx`
3. Updated battle-dice-ui.js to delegate to `BattleUtils.setSfxCallback/playSfx`
4. Updated battle-facade.js to set callback once via `BattleUtils.setSfxCallback`
5. Removed local `playSfxCallback` variables from both modules

**Lines Saved:** ~20 lines

---

## Progress Log

| Date | Phase | Action | Status |
|------|-------|--------|--------|
| 2024-12-24 | 1 | Created plan | Started |
| 2024-12-24 | 1 | Created pausable-timer.js | Done |
| 2024-12-24 | 1 | Updated battle-facade.js | Done |
| 2024-12-24 | 1 | Updated battle-dice-ui.js | Done |
| 2024-12-24 | 1 | Added to index.html | Done |
| 2024-12-24 | 1 | Phase 1 complete | **COMPLETED** |
| 2024-12-24 | 2 | Analyzed - not true duplication | SKIPPED |
| 2024-12-24 | 3 | Analyzed - complex, defer | DEFERRED |
| 2024-12-24 | 4 | Migrated EventEmitter to eventBus | Done |
| 2024-12-24 | 4 | Deprecated events.js | Done |
| 2024-12-24 | 4 | Phase 4 complete | **COMPLETED** |
| 2024-12-24 | 5 | Added shared SFX to BattleUtils | Done |
| 2024-12-24 | 5 | Updated battle-ui.js delegation | Done |
| 2024-12-24 | 5 | Updated battle-dice-ui.js delegation | Done |
| 2024-12-24 | 5 | Updated battle-facade.js single call | Done |
| 2024-12-24 | 5 | Phase 5 complete | **COMPLETED** |

---

## Notes
- Test after each phase to ensure no regressions
- Keep backwards compatibility where possible
- Update CLAUDE.md if architecture changes significantly
