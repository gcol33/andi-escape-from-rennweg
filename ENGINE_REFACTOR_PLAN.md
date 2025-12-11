# Engine.js Refactoring Plan

## Overview

Split the monolithic `engine.js` (4,863 lines) into focused, single-responsibility modules while maintaining backward compatibility through the existing `VNEngine` API.

**Philosophy**: Extract concerns into standalone modules that `VNEngine` delegates to, keeping the public API intact.

---

## Current Structure Analysis

| Section | Lines | Functions | Description |
|---------|-------|-----------|-------------|
| Configuration & State | 1-141 | 2 | Config objects, state management |
| Action Handlers | 143-889 | 10+ | Dice rolls, battle start, quiz, etc. |
| Battle System | 890-1665 | 20+ | Battle UI, rendering, skill/item menus |
| DOM & Initialization | 1666-2801 | 30+ | Setup, dev mode, theme selector |
| Scene Loading | 2802-2997 | 5 | Load, preprocess text |
| Rendering | 2998-3481 | 15+ | Scenes, text, choices |
| Asset Management | 3508-3689 | 10+ | Backgrounds, sprites |
| Audio Management | 3759-3953 | 10 | Music, SFX, ducking |
| Flag Management | 3954-3999 | 5 | Flags, key flags |
| Inventory Management | 4000-4375 | 25+ | Items, consumables, skills |
| HP Management | 4376-4475 | 8 | HP init, heal, damage |
| Save/Load System | 4476-4687 | 6 | Save, load, validate, reset |
| Game Reset | 4688-4776 | 5 | Reset functions |
| Public API | 4777-4863 | - | Exposed API + DOMContentLoaded |

---

## Proposed Module Split

### Part 1: `js/engine-audio.js` (~200 lines)
**Responsibility**: All audio playback and management

**Extract**:
- `setMusic(filename)`
- `tryPlayMusic()`
- `stopMusic()`
- `playSfx(filename, callback)`
- `playSfxWithDucking(filename, callback)`
- `toggleMute()`
- `updateMuteButtonIcon(muted)`
- `setVolume(volume)`
- `updateVolumeSliderFill()`
- Audio portion of `state.audio`

**Dependencies**:
- `config.assetPaths.sfx`, `config.assetPaths.music`
- `config.sfxPreDelay`, `config.sfxPostDelay`, etc.
- DOM elements: `#music-player`, `#sfx-player`, `#mute-btn`

**API**:
```javascript
var AudioManager = (function() {
    return {
        init: function(config) {},
        setMusic: function(filename) {},
        stopMusic: function() {},
        playSfx: function(filename, callback) {},
        playSfxWithDucking: function(filename, callback) {},
        toggleMute: function() {},
        setVolume: function(volume) {},
        isMuted: function() {},
        getVolume: function() {},
        getCurrentMusic: function() {}
    };
})();
```

---

### Part 2: `js/engine-inventory.js` (~400 lines)
**Responsibility**: All inventory operations and display

**Extract**:
- `addKeyItem(item)`, `removeKeyItem(item)`, `hasKeyItem(item)`
- `addConsumable(item, count)`, `removeConsumable(item, count)`, `hasConsumable(item, count)`
- `addItems(items)`, `removeItems(items)`
- `addSkill(skill)`, `hasSkill(skill)`, `hasSkills(skills)`
- `hasItem(item)`, `hasItems(items)`, `hasAnyItems()`
- `getConsumableCount(item)`
- `clearInventory()`
- `showItemNotification(item, action, itemType)`
- `toggleInventory()`, `updateInventoryDisplay()`
- Inventory portion of state

**Dependencies**:
- DOM elements: `#inventory-panel`, `#inventory-toggle`
- State sync with VNEngine for saving

**API**:
```javascript
var InventoryManager = (function() {
    return {
        init: function(config) {},
        // Key Items
        addKeyItem: function(item) {},
        removeKeyItem: function(item) {},
        hasKeyItem: function(item) {},
        // Consumables
        addConsumable: function(item, count) {},
        removeConsumable: function(item, count) {},
        hasConsumable: function(item, count) {},
        getConsumableCount: function(item) {},
        // Skills
        addSkill: function(skill) {},
        hasSkill: function(skill) {},
        hasSkills: function(skills) {},
        // Generic
        addItems: function(items) {},
        removeItems: function(items) {},
        hasItem: function(item) {},
        hasItems: function(items) {},
        hasAnyItems: function() {},
        // State
        clear: function() {},
        getState: function() {},
        setState: function(state) {},
        // UI
        toggle: function() {},
        updateDisplay: function() {},
        showNotification: function(item, action, type) {}
    };
})();
```

---

### Part 3: `js/engine-saves.js` (~250 lines)
**Responsibility**: Save/load state to localStorage

**Extract**:
- `isValidSaveData(saveData)`
- `saveState()`
- `loadSavedState()`
- `clearSavedState()`
- History management for undo

**Dependencies**:
- `config.saveKey`, `config.themeKey`
- Access to VNEngine state (via callback or reference)

**API**:
```javascript
var SaveManager = (function() {
    return {
        init: function(config) {},
        save: function(state) {},
        load: function() {},
        clear: function() {},
        isValid: function(data) {},
        // History for undo
        pushHistory: function(entry) {},
        popHistory: function() {},
        getHistory: function() {},
        clearHistory: function() {}
    };
})();
```

---

### Part 4: `js/engine-ui.js` (~500 lines)
**Responsibility**: UI setup, dev mode, theme management

**Extract**:
- `setupFirstInteraction()`
- `setupContinueButton()`, `setupMuteButton()`, `setupSpeedControls()`
- `setupClickToSkip()`, `updateSkipButtonVisibility()`
- `makeDraggable(element, handle)`
- `showDevModeIndicator(show)`, `toggleDevPanelPortrait()`
- `addUndoButton()`, `removeUndoButton()`
- `createThemeSelector()` (the big 400+ line function)
- `getCurrentTheme()`, `setTheme(themeName)`
- `applyKenBurns(enabled)`
- `setupResetButton()`, `setupTapToHide()`
- `flashUndoError()`

**Dependencies**:
- DOM elements: various UI elements
- Theme CSS files
- State for devMode

**API**:
```javascript
var UIManager = (function() {
    return {
        init: function(config, callbacks) {},
        // Speed controls
        setTextSpeed: function(speed) {},
        getTextSpeed: function() {},
        // Dev mode
        showDevIndicator: function(show) {},
        toggleDevPanel: function() {},
        // Theme
        getCurrentTheme: function() {},
        setTheme: function(name) {},
        // Ken Burns
        applyKenBurns: function(enabled) {},
        // Undo
        showUndoButton: function() {},
        hideUndoButton: function() {},
        flashUndoError: function() {}
    };
})();
```

---

### Part 5: `js/engine.js` (Core - ~2500 lines remaining)
**Responsibility**: Core scene loading, rendering, typewriter, choices

**Keep**:
- Configuration (trimmed)
- State (trimmed, delegates to managers)
- Action Handlers (all - they need tight coupling)
- Battle System functions (all - complex integration)
- `init()`, `cacheElements()`
- Scene loading: `loadScene()`, `renderScene()`, `renderCurrentBlock()`
- Text: `startTypewriter()`, `parseHTMLSegments()`, `typeNextChar()`, etc.
- Rendering: `renderChoices()`, `renderBattleChoices()`
- Assets: `setBackground()`, `setCharacters()`, `clearBackground()`, `clearCharacters()`
- Flags: `setFlags()`, `checkFlags()`, `getFlag()`, etc.
- HP: `initPlayerHP()`, `healPlayer()`, `damagePlayer()`, etc.
- Game reset: `resetGame()`, `reset()`, `fullReset()`
- Public API (delegates to managers)

---

## Implementation Order

### Phase 1: Audio Module
1. Create `js/engine-audio.js` with AudioManager IIFE
2. Copy audio functions from engine.js
3. Add initialization with config
4. Update engine.js to delegate audio calls to AudioManager
5. Update index.html to load audio module
6. Test: music plays, SFX works, mute works

### Phase 2: Inventory Module
1. Create `js/engine-inventory.js` with InventoryManager IIFE
2. Copy inventory functions from engine.js
3. Add state getter/setter for save compatibility
4. Update engine.js to delegate inventory calls
5. Update index.html to load inventory module
6. Test: items add/remove, display updates, saves work

### Phase 3: Saves Module
1. Create `js/engine-saves.js` with SaveManager IIFE
2. Copy save/load functions from engine.js
3. Update validation to handle modular state
4. Update engine.js to use SaveManager
5. Update index.html to load saves module
6. Test: save/load works, undo works, reset works

### Phase 4: UI Module
1. Create `js/engine-ui.js` with UIManager IIFE
2. Copy UI setup functions from engine.js
3. Extract theme selector (biggest chunk)
4. Update engine.js to use UIManager
5. Update index.html to load UI module
6. Test: themes work, dev mode works, controls work

### Phase 5: Cleanup
1. Remove extracted code from engine.js
2. Verify all tests pass
3. Manual QA pass
4. Commit and tag

---

## Compatibility Strategy

**Backward Compatibility**: Keep `VNEngine` API exactly as-is. Internal implementation changes, external API stays identical.

```javascript
// Current (public API)
VNEngine.addItem('Key');
VNEngine.playSfx('click.ogg');

// After refactor (same API, delegates internally)
// VNEngine.addItem calls InventoryManager.addKeyItem internally
// VNEngine.playSfx calls AudioManager.playSfx internally
```

**Module Loading Order** (in index.html):
```html
<!-- Utilities (already exist) -->
<script src="js/logger.js"></script>
<script src="js/listener-manager.js"></script>
<script src="js/events.js"></script>

<!-- Engine modules (new) -->
<script src="js/engine-audio.js"></script>
<script src="js/engine-inventory.js"></script>
<script src="js/engine-saves.js"></script>
<script src="js/engine-ui.js"></script>

<!-- Core engine (modified) -->
<script src="js/engine.js"></script>
```

---

## Testing Checklist

After each phase:
- [ ] Battle system tests pass (178 tests)
- [ ] Theme tests pass (125 tests)
- [ ] Manual test: Start game, make choices
- [ ] Manual test: Save/load works
- [ ] Manual test: Battle works
- [ ] Manual test: Inventory works
- [ ] Manual test: Audio plays
- [ ] Manual test: Theme switching works
- [ ] Manual test: Dev mode works

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Breaking save compatibility | Keep exact same state structure, validate old saves |
| Audio timing bugs | Keep ducking logic identical, test SFX chains |
| Module loading order | Document in index.html, test on fresh load |
| Dev mode breakage | Test theme selector, undo, scene jump thoroughly |
| Battle integration | Battle module already separated, minimal risk |

---

## Success Criteria

1. `engine.js` reduced from 4,863 to ~2,500 lines
2. All existing functionality works identically
3. All tests pass
4. No console errors
5. Save files from v0.7.0 still load correctly
6. Code is more maintainable with single-responsibility modules
