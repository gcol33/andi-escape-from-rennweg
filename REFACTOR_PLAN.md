# Refactor Plan - Practical Improvements

**Updated:** 2025-12-12
**Constraint:** Pure HTML+JS with IIFE pattern (no build system)

---

## Architecture Assessment

### What We Have

**Legacy System (active, working):**
- `engine.js` - Main VN engine (~5000 lines)
- `engine-audio.js` - Audio module (legacy AudioManager)
- `engine-inventory.js` - Inventory module (legacy InventoryManager)
- `engine-saves.js` - Save/load module (legacy SaveManager)

**New Foundation (ready, not yet active):**
- `js/core/` - EventBus, Store, Error classes, Bootstrap bridge
- `js/managers/` - New manager templates (flagManager, inventoryManager, etc.)
- `js/input/input-controller.js` - Centralized input handling (keyboard/mouse/touch)
- SceneManager initialized, CoreBridge syncing state to store

**Utility Modules (active, used by engine):**
- `js/timer-manager.js` - Centralized timeout/interval tracking with cleanup
- `js/listener-manager.js` - Event listener tracking with automatic cleanup
- `js/animation-manager.js` - Animation frame tracking with cleanup
- `js/logger.js` - Centralized logging with debug levels
- `js/utils.js` - DOM utilities and helper functions

### The Reality

The new managers were designed to work with the store, but engine.js works with its own state object. Full migration would require:
1. Make engine.js read from store instead of its own state
2. Update all battle/QTE modules to use store
3. Risk breaking working code

**Better approach:** Incremental improvements that add value without breaking changes.

---

## Practical Improvements

### 1. Event-Driven Communication (Low Risk)

Use eventBus for new features and optional enhancements:

```javascript
// In engine.js, after scene loads:
eventBus.emit(SceneEvents.SCENE_ENTER, { sceneId: sceneId, scene: scene });

// New modules can subscribe without modifying engine.js:
eventBus.on(SceneEvents.SCENE_ENTER, function(data) {
    analytics.trackScene(data.sceneId);
});
```

### 2. Store as Debug View (No Risk)

The store is synced with engine state via CoreBridge. Useful for:
- Dev tools showing current state
- Debugging save/load issues
- Future features that need state access

### 3. Code Quality in engine.js (Medium Effort)

Extract cohesive functions into local helpers:
- Group related functions with comments
- Reduce nesting in complex functions
- Add defensive checks

### 4. Test Coverage (High Value)

Expand test suite for:
- Scene navigation edge cases
- Flag/inventory interactions
- Save/load round-trip

---

## Completed

- [x] Core architecture (eventBus, store, errors, bootstrap)
- [x] Manager templates created (base, audio, flag, inventory, save, scene)
- [x] Input controller created (keyboard/mouse/touch handling)
- [x] Utility modules (TimerManager, ListenerManager, AnimationManager, Logger, Utils)
- [x] SceneManager initialized with story data
- [x] CoreBridge syncing engine→store at key points
- [x] All 461 tests passing (178 battle + 77 QTE + 125 theme + 81 engine)
- [x] EventBus emissions added at key points:
  - `SceneEvents.ENTER` - when scene loads
  - `SceneEvents.CHOICE_SELECTED` - when choice is clicked
  - `SceneEvents.BLOCK_ADVANCE` - when text block advances
  - `BattleEvents.START` - when battle begins
  - `BattleEvents.END` - when battle ends (win/lose/flee)
  - `InventoryEvents.ITEM_ADDED` - when key item, consumable, or skill added
  - `InventoryEvents.ITEM_REMOVED` - when key item or consumable removed
  - `StateEvents.CHANGED` - when flags or key flags change
  - `AudioEvents.MUSIC_PLAY` - when music track starts
  - `AudioEvents.MUSIC_STOP` - when music stops
  - `AudioEvents.SFX_PLAY` - when sound effect plays
  - `AudioEvents.MUTE_CHANGE` - when mute toggled
  - `AudioEvents.VOLUME_CHANGE` - when volume adjusted
- [x] Dev Panel enhancements (v0.7.0):
  - **Event Log** - Real-time monitoring of eventBus emissions with color-coded event types
  - **State Viewer** - Live inspection of store state (scene, player, flags, inventory)
  - Pause/resume and clear controls for event log
  - Auto-refresh state viewer on store changes
  - Subscribes to 24 event types for comprehensive monitoring
- [x] Engine test suite added (v0.7.5):
  - **Flag management** - regular flags, key flags, negation support
  - **Inventory management** - key items, consumables, skills, has checks
  - **Save/load round-trip** - serialization, deserialization, legacy format conversion
  - **Edge cases** - empty state handling, null checks, boundary conditions
  - 81 new tests covering scene navigation, flags, inventory, save/load

---

## Next Actions

(All practical improvements completed.)

---

## Completed Migration (v0.7.6)

The Future Migration Path has been implemented:

### Flag Management Delegation
- `engine.js` flag functions now delegate to `flagManager`
- Flags stored in `store.player.flags` (Set) and `store.player.keyFlags` (Set)
- `setFlag()`, `clearFlag()`, `hasFlag()` → `flagManager.set()`, `flagManager.clear()`, `flagManager.has()`
- `setKeyFlag()`, `clearKeyFlag()`, `hasKeyFlag()` → `flagManager.setKey()`, `flagManager.clearKey()`, `flagManager.hasKey()`
- `getKeyFlags()` now returns array (was object)
- Save/load handles both legacy object format and new array format

### Store Updates
- Added `player.keyFlags` (Set) to store initial state
- Added `player.inventory.skills` (array) to store initial state
- Managers write directly to store via `BaseManager.setState()`

### Inventory Manager Updates
- Added skills support: `addSkill()`, `removeSkill()`, `hasSkill()`, `getSkills()`, `hasAllSkills()`
- Added `clearEverything()` for full reset (including skills)
- `clearAll()` now preserves skills (soft reset behavior)

### Test Runner Updates
- `run-engine-tests.js` now loads core modules (eventBus, store, events)
- `run-engine-tests.js` now loads managers (BaseManager, flagManager, inventoryManager)
- All 461 tests passing (178 battle + 77 QTE + 125 theme + 81 engine)

---

## File Structure

```
js/
├── core/                      # New architecture core
│   ├── events.js             # Event type constants (SceneEvents, BattleEvents, etc.)
│   ├── event-bus.js          # Pub/sub event system (window.eventBus)
│   ├── store.js              # State management (window.store)
│   ├── errors.js             # Custom error classes
│   └── bootstrap.js          # Core init & bridge (window.CoreBridge)
├── managers/                  # Domain managers (not yet active)
│   ├── base-manager.js       # Abstract base class
│   ├── audio-manager.js      # window.audioManager
│   ├── flag-manager.js       # window.flagManager
│   ├── inventory-manager.js  # window.inventoryManager
│   ├── save-manager.js       # window.saveManager
│   └── scene-manager.js      # window.sceneManager (initialized)
├── input/
│   └── input-controller.js   # window.inputController
├── utils.js                  # DOM utilities (window.Utils)
├── logger.js                 # Logging (window.Logger)
├── timer-manager.js          # Timeout tracking (window.TimerManager)
├── listener-manager.js       # Event listener tracking (window.ListenerManager)
├── animation-manager.js      # Animation tracking (window.AnimationManager)
├── events.js                 # Legacy EventEmitter (window.EventEmitter)
├── tuning.js                 # Game constants (window.TUNING)
├── engine.js                 # Main VN engine (window.VNEngine)
├── engine-audio.js           # Legacy audio (window.AudioManager)
├── engine-inventory.js       # Legacy inventory (window.InventoryManager)
├── engine-saves.js           # Legacy saves (window.SaveManager)
└── battle/                   # Battle system (unchanged)
```

---

## Future Migration Path (COMPLETED)

~~When ready for full migration:~~
1. ~~Make engine.js functions delegate to managers~~ ✓ (Flags delegate to flagManager)
2. ~~Managers write to store~~ ✓ (flagManager, inventoryManager use BaseManager.setState)
3. ~~Store triggers UI updates via eventBus~~ ✓ (StateEvents.CHANGED emitted on updates)
4. ~~Remove duplicate logic from engine.js~~ ✓ (state.flags/state.keyFlags removed)

**Remaining future work:**
- Inventory operations could delegate to inventoryManager (currently engine.js manages state.inventory directly)
- Audio operations could delegate to audioManager
- Scene operations could delegate to sceneManager

---

## Refactoring Table (Code Quality)

**Updated:** 2025-12-12
**Based on:** Clean Code principles, JavaScript best practices, codebase analysis

### Priority Legend
- 🔴 **HIGH** - Significant impact on maintainability/bugs
- 🟡 **MEDIUM** - Improves readability/consistency
- 🟢 **LOW** - Nice to have, minor improvement

### Effort Legend
- **S** - Small (< 1 hour)
- **M** - Medium (1-4 hours)
- **L** - Large (4+ hours)

---

### 1. Modern JavaScript (`var` → `const`/`let`)

| Priority | Effort | File | Line(s) | Current | Refactored |
|----------|--------|------|---------|---------|------------|
| 🔴 | L | engine.js | 25 | `var config = {...}` | `const config = {...}` |
| 🔴 | L | engine.js | 87 | `var state = {...}` | `let state = {...}` |
| 🔴 | M | battle-core.js | 58-60 | `var T = typeof TUNING` | `const hasTuning = typeof TUNING !== 'undefined'` |
| 🔴 | M | battle-facade.js | 40-63 | `var T = ...` shorthands | `const tuningConfig = ...` |
| 🔴 | M | qte.js | 50 | `var T = typeof TUNING` | `const hasTuning = ...` |
| 🔴 | S | password.js | 31 | `var config = {...}` | `const config = {...}` |
| 🟡 | L | all files | loops | `for (var i = 0; ...)` | `for (let i = 0; ...)` |
| 🟡 | L | all modules | IIFE vars | `var privateVar` | `const` or `let` as appropriate |

**Total `var` occurrences:** ~1004
**Recommended approach:** File-by-file migration, starting with smaller modules

---

### 2. Magic Numbers → TUNING Constants

| Priority | Effort | File | Line | Magic Value | TUNING Key |
|----------|--------|------|------|-------------|------------|
| 🔴 | S | engine.js | 911 | `hintSpeed = 45` | `TUNING.text.hintSpeed` |
| 🔴 | S | engine.js | 860 | `setTimeout(..., 400)` | `TUNING.timing.cardRevealDelay` |
| 🔴 | S | engine.js | 865 | `setTimeout(..., 600)` | `TUNING.timing.cardFlipDuration` |
| 🟡 | S | qte.js | 306 | `0.5 * Math.sin(...)` | `TUNING.qte.speedOscillationAmplitude` |
| 🟡 | S | qte.js | 310 | `adjustedTime / 500` | `TUNING.qte.edgeFactorDivisor` |
| 🟡 | S | qte.js | 310 | `* 0.1` | `TUNING.qte.edgeFactorMultiplier` |
| 🟡 | M | battle-ui.js | 207-211 | `0.95, 1.6, 0.5, 0.2` | `TUNING.ui.logFontSize`, `.logLineHeight`, etc. |
| 🟡 | S | engine.js | 754-757 | shuffle loop | Extract to `Utils.shuffle()` |
| 🟢 | S | password.js | 20 | `lockoutDuration: 5000` | Already in local config (OK) |

**Total magic numbers:** ~347 in various files
**Recommended approach:** Add `TUNING.ui` and `TUNING.timing` sections

---

### 3. Large Functions → Extract Helpers

| Priority | Effort | File | Function | Lines | Extract To |
|----------|--------|------|----------|-------|------------|
| 🔴 | L | battle-core.js | `startBattle()` | 140 | `initializePlayerState()`, `initializeEnemyState()`, `initializeMusicState()` |
| 🔴 | L | engine.js | `loadScene()` | ~300 | `prepareSceneAssets()`, `renderSceneUI()`, `executeSceneActions()` |
| 🟡 | M | engine.js | Tarot reveal (800-950) | 150 | `TarotReveal` module or `revealTarotSequence()` |
| 🟡 | M | battle-facade.js | `processTurn()` | ~200 | `processPlayerTurn()`, `processEnemyTurn()` (already partially done) |
| 🟡 | S | qte.js | `updateMarkerPosition()` | 42 | Extract sine wave calculation to `calculateMarkerSpeed()` |
| 🟢 | S | battle-core.js | HP persistence (272-293) | 20 | `initializePlayerHP(config, currentState)` |

---

### 4. Nested Conditionals → Early Returns

| Priority | Effort | File | Line(s) | Nesting | Fix |
|----------|--------|------|---------|---------|-----|
| 🟡 | S | engine.js | 829-868 | 4 levels | Early return: `if (currentIndex >= slots.length) return;` |
| 🟡 | S | qte.js | 237-260 | 4 levels | Extract to `calculateZone(distance, config)` |
| 🟡 | S | battle-core.js | 272-293 | 3 levels | Use ternary or extract helper |
| 🟡 | S | battle-ui.js | 356-365 | 3 levels | Early returns for edge cases |
| 🟢 | S | battle-facade.js | various | 3+ levels | Guard clauses at function start |

---

### 5. DRY Violations → Shared Utilities

| Priority | Effort | Pattern | Locations | Extract To |
|----------|--------|---------|-----------|------------|
| 🟡 | M | Dependency checking | battle-core:22, battle-dnd:22, qte:40 | `Utils.checkDependency(name, fallback)` |
| 🟡 | M | Element caching | battle-ui:315, engine.js, qte-ui.js | `Utils.cacheElements(idMap)` |
| 🟡 | M | HTML string building | engine:803, battle-ui:261 | `Utils.createPanel(config)` template |
| 🟢 | S | EventEmitter checks | engine.js (14 occurrences) | Already using `emitEvent()` helper in battle-core |

---

### 6. Naming Conventions

| Priority | Effort | File | Line | Current | Suggested |
|----------|--------|------|------|---------|-----------|
| 🟢 | S | battle-core.js | 58 | `var T = typeof TUNING` | `var hasTuning = ...` |
| 🟢 | S | qte.js | 50 | `var T = typeof TUNING` | `var tuningAvailable = ...` |
| 🟢 | S | engine.js | 775 | `for (var k = ...)` | `for (var cardIndex = ...)` |
| 🟢 | S | battle-facade.js | 78-80 | `_pauseKeyListenerAdded` | Consistent underscore prefix (OK, just document convention) |

---

### 7. Callback Nesting → Promises/Async

| Priority | Effort | File | Line(s) | Pattern | Refactored |
|----------|--------|------|---------|---------|------------|
| 🟢 | M | engine.js | 855-865 | Double setTimeout | `async function revealCards()` with `await delay()` |
| 🟢 | S | qte.js | 288-330 | requestAnimationFrame | OK - standard pattern for animation |
| 🟢 | M | battle-facade.js | 200-230 | Timeout chain | `async function resumeBattle()` |

---

### 8. Missing Cleanup Functions

| Priority | Effort | File | Issue | Fix |
|----------|--------|------|-------|-----|
| 🟡 | M | engine.js | No `destroy()` function | Add `VNEngine.destroy()` to remove all listeners |
| 🟡 | S | battle-ui.js | `cleanup()` added | ✅ Already done |
| 🟡 | S | qte.js | Countdown cleanup | ✅ Already fixed |

---

### 9. Input Validation

| Priority | Effort | File | Function | Add Validation |
|----------|--------|------|----------|----------------|
| 🟡 | S | battle-core.js | `startBattle()` | ✅ Already added (config, win_target, lose_target) |
| 🟡 | S | engine.js | `loadScene()` | Validate sceneId exists in story |
| 🟢 | S | qte.js | `start*QTE()` | Validate callback is function |

---

### Implementation Order (Recommended)

| Phase | Tasks | Effort | Impact |
|-------|-------|--------|--------|
| **Phase 1** | Magic numbers → TUNING (high-impact values) | M | High |
| **Phase 2** | Extract large functions in battle-core.js | M | Medium |
| **Phase 3** | `var` → `const`/`let` in small modules (password.js, utils.js) | S | Medium |
| **Phase 4** | Reduce nesting with early returns | S | Medium |
| **Phase 5** | Extract shared utilities (dependency check, element cache) | M | Low |
| **Phase 6** | `var` → `const`/`let` in large modules (engine.js) | L | Medium |
| **Phase 7** | Async/await for callback chains | M | Low |

---

### Already Completed (v0.7.4+)

| Task | File | Status |
|------|------|--------|
| QTE countdown cleanup | qte.js | ✅ Fixed |
| Remove `pendingTimeouts` dead code | qte.js | ✅ Removed |
| Add `BattleUI.cleanup()` | battle-ui.js | ✅ Added |
| Extract `emitEvent()` helper | battle-core.js | ✅ Done (9 replacements) |
| Remove unused `createDefaultPlayerState()` | battle-core.js | ✅ Removed |
| Add `startBattle()` validation | battle-core.js | ✅ Added |
| Optimize O(n²) item lookup | battle-core.js | ✅ Now O(n) with map |

### Completed (v0.7.5 - Code Quality Refactor)

| Task | File | Status |
|------|------|--------|
| Extract magic numbers to TUNING | tuning.js, engine.js | ✅ hintTypewriterSpeed, tarotCardRevealDelay, tarotCardFlipDuration, battleLogPadding, battleLogRowGap |
| Extract large functions | battle-core.js | ✅ `initializePlayerState()`, `initializeEnemyState()`, `resetAuxiliaryState()` |
| Modernize password.js | password.js | ✅ All `var` → `const`/`let` (25+ changes) |
| Reduce nesting | engine.js, qte.js | ✅ Already had early returns in key places |

**Test Results:** 178 battle + 77 QTE = 255 tests passing
