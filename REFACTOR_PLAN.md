# Battle System Modularization & Code Improvements Plan

## Overview

This plan refactors the monolithic `battle.js` (~4600 lines) into a modular, extensible architecture that supports multiple battle styles (D&D, Pokemon, Expedition 33, etc.) while adding robustness improvements across the codebase.

---

## Phase 1: Core Infrastructure

### 1.1 Create EventEmitter System (`js/events.js`)

A simple pub/sub system for loose coupling between modules.

```javascript
var EventEmitter = (function() {
    var listeners = {};

    return {
        on: function(event, callback) { ... },
        off: function(event, callback) { ... },
        emit: function(event, data) { ... },
        once: function(event, callback) { ... }
    };
})();
```

**Events to implement:**
- `battle:start`, `battle:end`, `battle:turn-start`, `battle:turn-end`
- `player:action`, `player:damaged`, `player:healed`
- `enemy:action`, `enemy:damaged`, `enemy:defeated`
- `qte:start`, `qte:complete`
- `scene:load`, `scene:transition`
- `asset:load-error`

### 1.2 Create Animation Manager (`js/animation-manager.js`)

Centralized RAF tracking to properly cancel animations on scene transitions.

```javascript
var AnimationManager = (function() {
    var activeAnimations = {};  // id -> rafHandle

    return {
        register: function(id, rafHandle) { ... },
        cancel: function(id) { ... },
        cancelAll: function() { ... },  // Called on scene transition
        isActive: function(id) { ... }
    };
})();
```

---

## Phase 2: Battle System Modularization

### 2.1 New File Structure

```
js/
├── battle/
│   ├── battle-core.js      # Shared battle logic, state, flow
│   ├── battle-dnd.js       # D&D style (d20, AC, crits) - current system
│   ├── battle-pokemon.js   # Pokemon style (type chart, PP, abilities)
│   ├── battle-exp33.js     # Expedition 33 style (timeline, QTE-heavy)
│   └── battle-data.js      # Skills, status effects, items (extracted from battle.js)
├── battle-ui.js            # (existing, unchanged)
├── battle.js               # Facade that delegates to active style
```

### 2.2 BattleCore (`js/battle/battle-core.js`)

Shared functionality all styles use:

```javascript
var BattleCore = (function() {
    // === Shared State ===
    var state = {
        active: false,
        phase: 'player',
        turn: 0,
        player: { hp, maxHP, mana, statuses, ... },
        enemy: { hp, maxHP, statuses, ... },
        terrain: 'none',
        targets: { win, lose, flee }
    };

    // === Shared Systems ===
    return {
        // State management
        getState, setState, isActive,

        // HP/Mana management
        damagePlayer, healPlayer, damageEnemy, healEnemy,

        // Status effect system (shared)
        applyStatus, removeStatus, hasStatus, tickStatuses,

        // Stagger system (shared)
        addStagger, decayStagger,

        // Flow control
        startBattle, endBattle, checkBattleEnd,

        // Item system
        getAvailableItems, useItem,

        // Summon system
        createSummon, processSummonTurn,

        // Limit break system
        addLimitCharge, isLimitReady, executeLimitBreak,

        // Music transitions
        checkMusicTransitions, setMusicTracks,

        // Dialogue system
        triggerDialogue, showBattleDialogue
    };
})();
```

### 2.3 BattleStyleDnD (`js/battle/battle-dnd.js`)

Current D&D mechanics extracted:

```javascript
var BattleStyleDnD = (function() {
    return {
        name: 'dnd',

        // === D&D-Specific Mechanics ===
        rollD20: function() { ... },
        rollDamage: function(diceStr) { ... },

        // Attack resolution with AC
        resolveAttack: function(attacker, defender, move) {
            // d20 + bonus vs AC
            // Nat 20 = crit, nat 1 = fumble
        },

        // Player actions
        playerAttack: function(move) { ... },
        playerSkill: function(skillId) { ... },
        playerDefend: function() { ... },  // +4 AC, mana regen
        playerFlee: function() { ... },    // d20 >= 10

        // Enemy AI
        selectEnemyMove: function() { ... },
        enemyTurn: function() { ... },

        // Passive system
        getPassiveBonuses: function(target) { ... }
    };
})();
```

### 2.4 BattleStylePokemon (`js/battle/battle-pokemon.js`)

Pokemon-style mechanics:

```javascript
var BattleStylePokemon = (function() {
    return {
        name: 'pokemon',

        // === Pokemon-Specific ===
        // No AC - always hits (with accuracy modifier)
        resolveAttack: function(attacker, defender, move) {
            // Accuracy check (percentage based)
            // Type effectiveness (2x, 0.5x, 0x)
            // STAB bonus (+50% if move type matches user type)
        },

        // PP system instead of mana
        usePP: function(moveId) { ... },

        // Four-move limit
        getMoves: function() { ... },  // Max 4 moves

        // Abilities (passive effects)
        checkAbility: function(trigger) { ... },

        // Status: paralysis, burn, freeze, sleep, poison, confusion
        tickPokemonStatuses: function() { ... },

        // Weather effects
        setWeather: function(type) { ... },
        tickWeather: function() { ... }
    };
})();
```

### 2.5 BattleStyleExpedition33 (`js/battle/battle-exp33.js`)

Expedition 33 mechanics (QTE-heavy, timeline):

```javascript
var BattleStyleExpedition33 = (function() {
    return {
        name: 'expedition33',

        // === Expedition 33-Specific ===
        // No turns - real-time with cooldowns
        timeline: [],

        // All attacks require QTE
        resolveAttack: function(attacker, defender, move, qteResult) {
            // Damage purely based on QTE result
            // Perfect = full damage + bonus
            // Miss = no damage
        },

        // Chain system
        startChain: function() { ... },
        addToChain: function(attack) { ... },
        finishChain: function() { ... },

        // Focus system (like limit break but per-action)
        gainFocus: function(amount) { ... },
        useFocus: function(action) { ... },

        // Dodge is always QTE-based
        processIncomingDamage: function(damage, qteResult) { ... }
    };
})();
```

### 2.6 BattleData (`js/battle/battle-data.js`)

Extract all data definitions from battle.js:

```javascript
var BattleData = (function() {
    return {
        // Type chart
        typeChart: { fire: { ice: 2, fire: 0.5 }, ... },

        // Status effects
        statusEffects: { burn: {...}, poison: {...}, ... },

        // Skills
        skills: { power_strike: {...}, fireball: {...}, ... },

        // Terrain types
        terrainTypes: { lava: {...}, ice: {...}, ... },

        // Battle items
        battleItems: { health_potion: {...}, ... },

        // Summon types
        summonTypes: { fire_sprite: {...}, ... },

        // Passive abilities
        passiveTypes: { resilience: {...}, ... },

        // Limit breaks
        limitBreaks: { overdrive: {...}, ... },

        // Dialogue triggers
        dialogueTriggers: { player_crit: [...], ... },

        // Sound cues
        soundCues: { battle_start: 'alert.ogg', ... }
    };
})();
```

### 2.7 Updated BattleEngine Facade (`js/battle.js`)

The existing file becomes a thin facade:

```javascript
var BattleEngine = (function() {
    var activeStyle = null;  // Current battle style module

    return {
        // Style selection
        setStyle: function(styleName) {
            switch(styleName) {
                case 'dnd': activeStyle = BattleStyleDnD; break;
                case 'pokemon': activeStyle = BattleStylePokemon; break;
                case 'expedition33': activeStyle = BattleStyleExpedition33; break;
            }
        },

        // Delegate to core + style
        init: function(engine) {
            BattleCore.init(engine);
            // Default to D&D style
            this.setStyle('dnd');
        },

        start: function(config, sceneId) {
            // Set style from config if specified
            if (config.battle_style) {
                this.setStyle(config.battle_style);
            }
            return BattleCore.startBattle(config, sceneId, activeStyle);
        },

        executeAction: function(action, params, callback) {
            return activeStyle.executeAction(action, params, callback);
        },

        // ... delegate other methods
    };
})();
```

---

## Phase 3: Error Handling & Fallbacks

### 3.1 Asset Loading Fallbacks (`js/engine.js`)

```javascript
// Add to VNEngine
var FALLBACK_ASSETS = {
    bg: 'assets/bg/fallback.jpg',       // Create a simple gradient image
    char: 'assets/char/fallback.svg',   // Create a simple silhouette
    music: null,                         // Silence is fine
    sfx: null                            // Silence is fine
};

function loadAsset(type, filename, callback) {
    var path = config.assetPaths[type] + filename;
    var asset = new Image();  // or Audio()

    asset.onload = function() { callback(asset); };
    asset.onerror = function() {
        console.warn('VNEngine: Failed to load ' + type + ': ' + filename);
        EventEmitter.emit('asset:load-error', { type: type, filename: filename });

        // Use fallback
        if (FALLBACK_ASSETS[type]) {
            console.info('VNEngine: Using fallback for ' + type);
            asset.src = FALLBACK_ASSETS[type];
        } else {
            callback(null);  // No fallback available
        }
    };

    asset.src = path;
}
```

### 3.2 Scene Loading Error Messages (`js/engine.js`)

```javascript
function loadScene(sceneId) {
    var scene = story[sceneId];

    if (!scene) {
        showErrorScreen({
            title: 'Scene Not Found',
            message: 'Could not find scene: "' + sceneId + '"',
            suggestion: 'Check that the scene ID is correct in your story files.',
            canContinue: state.history.length > 0  // Can undo if history exists
        });
        return false;
    }

    // ... existing load logic
}

function showErrorScreen(options) {
    var overlay = document.createElement('div');
    overlay.className = 'error-overlay';
    overlay.innerHTML =
        '<div class="error-dialog">' +
            '<h2>' + options.title + '</h2>' +
            '<p>' + options.message + '</p>' +
            (options.suggestion ? '<p class="suggestion">' + options.suggestion + '</p>' : '') +
            (options.canContinue ? '<button onclick="VNEngine.undo()">Go Back</button>' : '') +
        '</div>';
    elements.container.appendChild(overlay);
}
```

### 3.3 Password Validation (`js/password.js`)

```javascript
const config = {
    password: 'STRAHD',
    minLength: 6,
    maxLength: 6,
    allowedChars: /^[A-Za-z0-9]$/,  // Alphanumeric only
    // ...
};

function validateInput(value) {
    if (value.length > 1) {
        return value.charAt(0);  // Only keep first char
    }
    if (!config.allowedChars.test(value)) {
        return '';  // Reject non-alphanumeric
    }
    return value.toUpperCase();  // Normalize to uppercase
}

// In input handler:
input.addEventListener('input', function(e) {
    var validated = validateInput(this.value);
    if (validated !== this.value) {
        this.value = validated;
    }
    // ... rest of handler
});
```

---

## Phase 4: CSS & Documentation Improvements

### 4.1 Z-Index CSS Custom Properties

Already exists in `shared.css` - just needs to be used consistently:

```css
/* Already defined in shared.css:
:root {
    --z-background: 1;
    --z-sprites: 2;
    --z-theme-deco: 10;
    --z-text-box: 20;
    --z-battle-ui: 30;
    --z-battle-effects: 40;
    --z-overlay: 100;
    --z-dev-tools: 500;
    --z-modal: 1000;
}
*/

/* Audit all z-index usages and replace with variables */
```

**Files to update:**
- Individual theme CSS files that have hardcoded z-index values
- Any inline z-index in JS files

### 4.2 JSDoc for TUNING.js

```javascript
/**
 * @file Andi VN - Tuning Numbers
 * @description Centralized game feel constants for quick iteration.
 */

var TUNING = (function() {
    'use strict';

    return {
        /**
         * Text display settings
         * @type {Object}
         */
        text: {
            /**
             * Typewriter effect speeds (milliseconds per character)
             * @type {Object}
             * @property {number} normal - Default reading pace (18ms)
             * @property {number} fast - Noticeably faster but readable (10ms)
             * @property {number} auto - Same as normal, auto-advances when done
             * @property {number} skip - Instant, only for already-read blocks
             */
            speed: {
                normal: 18,
                fast: 10,
                auto: 18,
                skip: 0
            },

            /**
             * Delay before auto-advancing to next text block (ms)
             * @type {number}
             */
            autoAdvanceDelay: 1500,

            // ... etc
        },

        // ... continue for all sections
    };
})();
```

### 4.3 RAF Cleanup on Scene Transition

```javascript
// In AnimationManager
var AnimationManager = (function() {
    var animations = {};

    return {
        register: function(id, rafId) {
            animations[id] = rafId;
        },

        cancel: function(id) {
            if (animations[id]) {
                cancelAnimationFrame(animations[id]);
                delete animations[id];
            }
        },

        cancelAll: function() {
            for (var id in animations) {
                cancelAnimationFrame(animations[id]);
            }
            animations = {};
        }
    };
})();

// In VNEngine.loadScene()
function loadScene(sceneId) {
    // Cancel all active animations before transitioning
    AnimationManager.cancelAll();

    // ... rest of load logic
}

// Update QTEEngine to register its RAF
state.animationFrame = requestAnimationFrame(updateMarkerPosition);
AnimationManager.register('qte-marker', state.animationFrame);
```

---

## Implementation Order

1. **Phase 1.1**: Create `events.js` (EventEmitter) - Foundation for loose coupling
2. **Phase 1.2**: Create `animation-manager.js` - RAF cleanup infrastructure
3. **Phase 3.1-3.3**: Add error handling (quick wins, independent of refactor)
4. **Phase 4.1-4.2**: CSS variables audit + JSDoc (can be done in parallel)
5. **Phase 2.6**: Extract `battle-data.js` (pure data, no logic changes)
6. **Phase 2.2**: Create `battle-core.js` (shared systems)
7. **Phase 2.3**: Create `battle-dnd.js` (extract current logic)
8. **Phase 2.7**: Update `battle.js` facade
9. **Phase 2.4-2.5**: Add Pokemon/Exp33 styles (new features)

---

## Testing Strategy

1. After each phase, run existing battle tests: `node tests/run-tests.js`
2. Manual testing of a full battle flow
3. Check that themes still render correctly
4. Verify no console errors for missing assets

---

## Files Created/Modified

### New Files:
- `js/events.js` - EventEmitter
- `js/animation-manager.js` - RAF tracking
- `js/battle/battle-core.js` - Shared battle logic
- `js/battle/battle-dnd.js` - D&D style
- `js/battle/battle-pokemon.js` - Pokemon style
- `js/battle/battle-exp33.js` - Expedition 33 style
- `js/battle/battle-data.js` - Data definitions
- `assets/bg/fallback.jpg` - Fallback background
- `assets/char/fallback.svg` - Fallback character

### Modified Files:
- `js/battle.js` - Becomes facade
- `js/engine.js` - Add error handling, asset fallbacks
- `js/password.js` - Add input validation
- `js/tuning.js` - Add JSDoc
- `js/qte.js` - Register RAF with AnimationManager
- `index.html` - Add new script tags
- `css/themes/*.css` - Use z-index variables (audit)

---

## Rollback Strategy

All changes are additive until Phase 2.7. The original `battle.js` can be kept as `battle.js.backup` until the refactor is verified working.
