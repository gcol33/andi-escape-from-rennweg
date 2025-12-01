# Module Dependency Outline

This document shows how modules are organized and depend on each other.
Reference this when creating new modules to maintain clean architecture.

## Core Principle: Separation of Logic and UI

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TUNING LAYER                                   │
│                            (js/tuning.js)                                   │
│                                                                             │
│   All magic numbers: speeds, delays, balance, thresholds, zone sizes        │
│   ► Every module reads from here, none write to it                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Module Hierarchy (Simplified)

```
                         engine.js (main)
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
       ▼                      ▼                      ▼
  battle-facade.js      overworld.js           password.js
       │                      │
       ├─► battle-core.js     └─► overworld-ui.js
       ├─► battle-data.js
       ├─► battle-dnd.js
       ├─► battle-pokemon.js
       ├─► battle-exp33.js
       ├─► battle-ui.js
       └─► qte.js
              │
              └─► qte-ui.js
```

## Module Pairs: Logic + UI

Each major system follows this pattern:

```
┌─────────────────────────────────────────────────────────────────┐
│                         LOGIC MODULE                            │
│                    (no DOM manipulation)                        │
│                                                                 │
│  • State management                                             │
│  • Game rules & calculations                                    │
│  • Callbacks to notify UI                                       │
│  • Exposes public API                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ calls
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          UI MODULE                              │
│                    (no game logic)                              │
│                                                                 │
│  • DOM creation & manipulation                                  │
│  • CSS class toggles (no inline styles)                         │
│  • Animation triggers                                           │
│  • Event listeners → call back to logic                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ styled by
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         CSS THEMES                              │
│                    (css/themes/*.css)                           │
│                                                                 │
│  • Colors via CSS variables                                     │
│  • Layout & positioning                                         │
│  • Animations & transitions                                     │
│  • Theme-specific overrides                                     │
└─────────────────────────────────────────────────────────────────┘
```

## Current Module Map (Detailed)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              index.html                                     │
│                         (loads all scripts)                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
      ┌─────────────────────────────┼─────────────────────────────┐
      │                             │                             │
      ▼                             ▼                             ▼
┌───────────┐               ┌───────────┐               ┌───────────────┐
│ theme.js  │               │ story.js  │               │  tuning.js    │
│(generated)│               │(generated)│               │ (constants)   │
└───────────┘               └───────────┘               └───────────────┘
                                                              │
                            reads from ───────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              engine.js                                      │
│                        Exports: VNEngine                                    │
│                                                                             │
│  • Orchestrates everything (scene loading, flags, audio, inventory)         │
│  • Calls into sub-modules via action handlers                               │
│  • Public API: init, loadScene, getFlag, setFlag, addItem, getHP, etc.     │
└─────────────────────────────────────────────────────────────────────────────┘
          │                   │                         │
          │ start_battle      │ start_overworld         │ password check
          ▼                   ▼                         ▼
┌──────────────────┐   ┌──────────────────┐      ┌─────────────┐
│  battle-facade   │   │   overworld.js   │      │ password.js │
│   (BattleEngine) │   │(OverworldEngine) │      │(PasswordScr)│
└────────┬─────────┘   └────────┬─────────┘      └─────────────┘
         │                      │
         │                      │ display updates
         │                      ▼
         │               ┌──────────────────┐
         │               │  overworld-ui.js │
         │               │  (OverworldUI)   │
         │               │                  │
         │               │ • Canvas render  │
         │               │ • Sprite anim    │
         │               │ • Camera follow  │
         │               │ • Tile drawing   │
         │               └──────────────────┘
         │
         ├─────────────────────────────────────────────┐
         │                                             │
         ▼                                             ▼
┌─────────────────────────────┐               ┌──────────────────┐
│     Battle Sub-Modules      │               │     qte.js       │
├─────────────────────────────┤               │   (QTEEngine)    │
│ battle-core.js (BattleCore) │               │                  │
│  • State management         │               │ • Timing calc    │
│  • Status effects           │               │ • Zone detect    │
│  • Turn flow                │               │ • 5 QTE types    │
├─────────────────────────────┤               │ • Combo system   │
│ battle-data.js (BattleData) │               └────────┬─────────┘
│  • Skills, status effects   │                        │
│  • Type chart, terrain      │                        ▼
│  • Items, summons           │               ┌──────────────────┐
├─────────────────────────────┤               │    qte-ui.js     │
│ battle-barrier.js           │               │     (QTEUI)      │
│  • Enemy shields/barriers   │               │                  │
│  • Stack-based absorption   │               │ • Timing bar     │
├─────────────────────────────┤               │ • Marker anim    │
│ battle-intent.js            │               │ • Zone colors    │
│  • Enemy action telegraphs  │               │ • Result text    │
│  • AI intent generation     │               └──────────────────┘
├─────────────────────────────┤
│ battle-dnd.js (default)     │
│  • D20 rolls, crits         │
│  • Advantage/disadvantage   │
│  • Barrier & intent support │
├─────────────────────────────┤
│ battle-pokemon.js           │
│  • Accuracy %, type dmg     │
├─────────────────────────────┤
│ battle-exp33.js             │
│  • AP, chains, momentum     │
├─────────────────────────────┤
│ battle-ui.js (BattleUI)     │
│  • HP/MP bars               │
│  • Damage numbers           │
│  • Status icons             │
│  • Skill menu               │
└─────────────────────────────┘
```

## Module Ownership Rules

```
╔═══════════════════════════════════════════════════════════════════════════════════════╗
║  MODULE              │  EXPORTS           │  OWNS                     │  CALLS INTO   ║
╠═══════════════════════════════════════════════════════════════════════════════════════╣
║  engine.js           │  VNEngine          │  VN state, scenes,        │  BattleEngine ║
║                      │                    │  flags, audio, inventory  │  OverworldEng ║
║                      │                    │                           │  PasswordScr  ║
╠═══════════════════════════════════════════════════════════════════════════════════════╣
║  battle-facade.js    │  BattleEngine      │  Battle orchestration,    │  BattleCore   ║
║                      │                    │  style switching          │  BattleUI     ║
║                      │                    │                           │  QTEEngine    ║
╠═══════════════════════════════════════════════════════════════════════════════════════╣
║  battle-core.js      │  BattleCore        │  Battle state, HP/MP,     │  BattleData   ║
║                      │  (internal)        │  status effects, turns    │  Style module ║
╠═══════════════════════════════════════════════════════════════════════════════════════╣
║  battle-data.js      │  BattleData        │  Skills, statuses, types  │  (nothing)    ║
║                      │  (internal)        │  terrain, items, summons  │               ║
╠═══════════════════════════════════════════════════════════════════════════════════════╣
║  battle-barrier.js   │  BattleBarrier     │  Enemy shield stacks      │  (nothing)    ║
║  battle-intent.js    │  BattleIntent      │  Enemy action telegraphs  │  BattleData   ║
╠═══════════════════════════════════════════════════════════════════════════════════════╣
║  battle-dnd.js       │  BattleStyleDnD    │  D20 attack resolution,   │  BattleBarrier║
║                      │                    │  advantage/disadvantage   │  BattleIntent ║
║  battle-pokemon.js   │  BattleStylePoke   │  Accuracy-based combat    │  (nothing)    ║
║  battle-exp33.js     │  BattleStyleExp33  │  AP/chain combat          │               ║
╠═══════════════════════════════════════════════════════════════════════════════════════╣
║  overworld.js        │  OverworldEngine   │  Player position, map     │  OverworldUI  ║
║                      │                    │  state, collision, warps  │               ║
╠═══════════════════════════════════════════════════════════════════════════════════════╣
║  qte.js              │  QTEEngine         │  QTE state, timing,       │  QTEUI        ║
║                      │                    │  zone calculation, combos │               ║
╠═══════════════════════════════════════════════════════════════════════════════════════╣
║  overworld-ui.js     │  OverworldUI       │  Canvas, sprites, camera  │  (leaf node)  ║
╠═══════════════════════════════════════════════════════════════════════════════════════╣
║  battle-ui.js        │  BattleUI          │  Battle DOM elements      │  (leaf node)  ║
╠═══════════════════════════════════════════════════════════════════════════════════════╣
║  qte-ui.js           │  QTEUI             │  QTE DOM elements         │  (leaf node)  ║
╠═══════════════════════════════════════════════════════════════════════════════════════╣
║  password.js         │  PasswordScreen    │  Password DOM, lockout    │  (leaf node)  ║
╠═══════════════════════════════════════════════════════════════════════════════════════╣
║  maps.js             │  MAPS              │  Map tile data, entities  │  (data only)  ║
╠═══════════════════════════════════════════════════════════════════════════════════════╣
║  tuning.js           │  TUNING            │  All game constants       │  (data only)  ║
╚═══════════════════════════════════════════════════════════════════════════════════════╝

RULE: Arrows only point DOWN. Lower modules never call up to higher modules.
      They use callbacks instead.
```

## Public API Summary

### VNEngine (engine.js)
```javascript
init()                          // Initialize the engine
loadScene(sceneId)              // Load a specific scene
getFlag(flag) / setFlag(flag)   // Flag management
addItem(item) / hasItem(item)   // Inventory management
getHP() / heal(amount)          // HP management
reset()                         // Reset game
registerActionHandler(type, fn) // Custom actions
```

### BattleEngine (battle-facade.js)
```javascript
init(vnEngine)                  // Initialize with parent engine
start(config, sceneId)          // Start a battle
end(result)                     // End battle
executeAction(action, params, cb) // Player action
isActive() / getState()         // State queries
setStyle(name)                  // Switch combat style ('dnd'/'pokemon'/'exp33')
getPlayerStats() / getPlayerSkills() // Player info
healPlayer(amount) / restoreMana(amount) // Recovery
applyStatusTo(target, type, stacks) // Status effects
```

### OverworldEngine (overworld.js)
```javascript
init(callbacks)                 // Initialize with event handlers
loadMap(mapData)                // Load map from MAPS.get()
move(direction)                 // Move player (up/down/left/right)
interact()                      // Interact with entity in front
getState()                      // Get player position/facing
setPosition(x, y, facing)       // Teleport player
```

### QTEEngine (qte.js)
```javascript
init(battleEngine)              // Initialize
startAccuracyQTE(params, cb)    // Player attack timing
startDodgeQTE(params, cb)       // Enemy dodge timing
startParryQTE(params, cb)       // Counter timing (tight)
startGuardBreakQTE(params, cb)  // Guard break QTE
startChainComboQTE(params, cb)  // Multi-hit sequence
isActive() / getType()          // State queries
cancel()                        // Abort active QTE
```

## Data Flow

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   scenes/    │     │   enemies/   │     │   theme.md   │
│    *.md      │     │    *.md      │     │              │
└──────┬───────┘     └──────┬───────┘     └──────┬───────┘
       │                    │                    │
       └────────────────────┼────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │ build_story_from_md.py  │
              │                         │
              │  Parses markdown        │
              │  Validates references   │
              │  Generates JS files     │
              └───────────┬─────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│   story.js    │ │  enemies.js   │ │   theme.js    │
│               │ │               │ │               │
│ DO NOT EDIT   │ │ DO NOT EDIT   │ │ DO NOT EDIT   │
└───────────────┘ └───────────────┘ └───────────────┘
```

## Adding a New Module

When creating a new feature (e.g., "inventory", "dialogue", "minigame"):

### 1. Create Logic Module (`js/feature.js`)

```javascript
var FeatureEngine = (function() {
    'use strict';

    // Private state
    var state = { /* ... */ };

    // Read tuning values
    var config = typeof TUNING !== 'undefined' ? TUNING.feature : {};

    // Private functions (game logic only, no DOM)
    function calculate() { /* ... */ }

    // Public API
    return {
        init: function(callbacks) { /* ... */ },
        start: function() { /* ... */ },
        getState: function() { /* ... */ }
    };
})();
```

### 2. Create UI Module (`js/feature-ui.js`)

```javascript
var FeatureUI = (function() {
    'use strict';

    // DOM element cache
    var elements = {};

    // Create UI (CSS classes only, no inline styles)
    function createUI() {
        var container = document.createElement('div');
        container.className = 'feature-container';
        // ...
    }

    // Public API
    return {
        init: function(parentElement) { /* ... */ },
        show: function() { /* ... */ },
        hide: function() { /* ... */ },
        update: function(state) { /* ... */ },
        destroy: function() { /* ... */ }
    };
})();
```

### 3. Add Tuning Values (`js/tuning.js`)

```javascript
var TUNING = {
    // ... existing ...

    feature: {
        speed: 1.0,
        duration: 2000,
        threshold: 50
        // All magic numbers here
    }
};
```

### 4. Add CSS (`css/shared.css` or theme files)

```css
/* Base styles in shared.css */
.feature-container {
    /* Use CSS variables for theme-ability */
    background: var(--feature-bg, rgba(0, 0, 0, 0.8));
    border: 1px solid var(--feature-border, #fff);
}

/* Theme overrides in css/themes/*.css */
.theme-cyberpunk .feature-container {
    --feature-bg: rgba(0, 255, 255, 0.2);
    --feature-border: #0ff;
}
```

### 5. Wire to Engine (`js/engine.js`)

```javascript
// In action handlers or appropriate location
if (typeof FeatureEngine !== 'undefined') {
    FeatureEngine.init({
        onComplete: handleFeatureComplete,
        playSfx: playSfx
    });
}
```

## Checklist for New Modules

```
□ Logic module has no document.* or DOM references
□ UI module has no game calculations or state logic
□ All numbers are in tuning.js, not hardcoded
□ UI uses CSS classes, not inline styles
□ Colors use CSS variables for theme support
□ Module exposes clean public API
□ Callbacks connect logic → UI (not the reverse)
□ Added to tests if applicable
```

## Anti-Patterns to Avoid

```
╔═══════════════════════════════════════════════════════════════════╗
║  ✗ DON'T                          ✓ DO                            ║
╠═══════════════════════════════════════════════════════════════════╣
║  Logic module manipulates DOM  →  Logic calls UI module methods   ║
║  UI module calculates damage   →  UI receives values from logic   ║
║  Hardcoded delay: 500          →  TUNING.feature.delay            ║
║  element.style.color = 'red'   →  element.classList.add('error')  ║
║  if (hp < 20)                  →  if (hp < TUNING.battle.lowHP)   ║
║  Import CSS in JS              →  CSS variables in theme files    ║
╚═══════════════════════════════════════════════════════════════════╝
```
