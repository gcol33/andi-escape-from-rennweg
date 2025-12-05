# UI Refactor v0.5.0 - Implementation Plan

## Overview

Transform the UI from ad-hoc pixel-based positioning to a resolution-independent, component-based layout system using rem units and layout primitives.

---

## Phase 1: Groundwork

### 1.1 Current State Audit

#### Screens to Document
- [ ] Main menu / Start screen
- [ ] Visual novel dialogue screen
- [ ] Battle screen (priority - pilot)
- [ ] Password screen
- [ ] Settings/Dev mode overlay

#### Current Issues to Catalog
- [ ] List all `px` usages in CSS (except 1px borders)
- [ ] List all absolute positioning (`top`, `left`, `right`, `bottom` with px/%)
- [ ] List all orientation-specific hacks (`@media orientation`)
- [ ] List all device-specific breakpoints

### 1.2 Design Tokens Definition

```css
:root {
    /* ==========================================================================
       DESIGN TOKENS - v0.5.0
       All sizes in rem. 1rem = 16px at default browser settings.
       ========================================================================== */

    /* --- Typography Scale --- */
    --text-xs: 0.75rem;      /* 12px - tiny labels */
    --text-sm: 0.875rem;     /* 14px - small text */
    --text-md: 1rem;         /* 16px - body text */
    --text-lg: 1.25rem;      /* 20px - large text */
    --text-xl: 1.5rem;       /* 24px - headings */
    --text-2xl: 2rem;        /* 32px - titles */
    --text-3xl: 2.5rem;      /* 40px - large titles */

    /* --- Spacing Scale --- */
    --space-xs: 0.25rem;     /* 4px */
    --space-sm: 0.5rem;      /* 8px */
    --space-md: 0.75rem;     /* 12px */
    --space-lg: 1rem;        /* 16px */
    --space-xl: 1.5rem;      /* 24px */
    --space-2xl: 2rem;       /* 32px */
    --space-3xl: 3rem;       /* 48px */

    /* --- Component Dimensions --- */
    --btn-height: 3rem;      /* 48px - touch-friendly */
    --btn-min-width: 6rem;   /* 96px */
    --btn-padding-x: 1rem;
    --btn-padding-y: 0.5rem;
    --btn-radius: 0.25rem;

    --panel-padding: 1rem;
    --panel-radius: 0.5rem;
    --panel-gap: var(--space-md);

    --bar-height: 1rem;      /* HP/MP bars */
    --bar-radius: 0.25rem;

    --icon-sm: 1.5rem;
    --icon-md: 2rem;
    --icon-lg: 3rem;

    /* --- Layout Dimensions --- */
    --header-height: 3rem;
    --footer-height: auto;
    --sidebar-width: 20rem;

    /* --- Grid --- */
    --grid-gap: var(--space-md);
    --grid-columns: 2;       /* Default for action buttons */

    /* --- Z-Index Scale --- */
    --z-base: 0;
    --z-content: 10;
    --z-overlay: 100;
    --z-modal: 1000;
    --z-toast: 2000;
}
```

### 1.3 Scale Tiers Definition

```css
/* ==========================================================================
   SCALE TIERS
   Orientation/device size only changes the root font-size.
   All rem-based layouts scale automatically.
   ========================================================================== */

/* TIER: Normal (landscape, larger devices) */
:root {
    font-size: 16px;
}

/* TIER: Comfort (portrait, smaller devices) */
@media (orientation: portrait) {
    :root {
        font-size: 14px; /* Slightly smaller to fit more content */
    }
}

/* TIER: Compact (very small screens) */
@media (max-width: 480px) {
    :root {
        font-size: 12px;
    }
}

/* TIER: Large (big screens, accessibility) */
@media (min-width: 1920px) {
    :root {
        font-size: 18px;
    }
}
```

### 1.4 Layout Primitives CSS Classes

```css
/* ==========================================================================
   LAYOUT PRIMITIVES
   ========================================================================== */

/* --- App Frame --- */
.app-frame {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    overflow: hidden;
}

.app-frame__header {
    flex-shrink: 0;
    height: var(--header-height);
}

.app-frame__main {
    flex: 1;
    overflow: auto;
    position: relative;
}

.app-frame__footer {
    flex-shrink: 0;
}

/* --- Vertical Stack --- */
.stack {
    display: flex;
    flex-direction: column;
    gap: var(--stack-gap, var(--space-md));
}

.stack--center { align-items: center; }
.stack--stretch { align-items: stretch; }
.stack--gap-sm { --stack-gap: var(--space-sm); }
.stack--gap-lg { --stack-gap: var(--space-lg); }
.stack--gap-xl { --stack-gap: var(--space-xl); }

/* --- Horizontal Row --- */
.row {
    display: flex;
    flex-direction: row;
    gap: var(--row-gap, var(--space-md));
    align-items: center;
}

.row--between { justify-content: space-between; }
.row--center { justify-content: center; }
.row--end { justify-content: flex-end; }
.row--wrap { flex-wrap: wrap; }
.row--gap-sm { --row-gap: var(--space-sm); }
.row--gap-lg { --row-gap: var(--space-lg); }

/* --- Grid --- */
.grid {
    display: grid;
    grid-template-columns: repeat(var(--grid-cols, 2), 1fr);
    gap: var(--grid-gap, var(--space-md));
}

.grid--cols-1 { --grid-cols: 1; }
.grid--cols-2 { --grid-cols: 2; }
.grid--cols-3 { --grid-cols: 3; }
.grid--cols-4 { --grid-cols: 4; }

/* --- Overlay / Anchor --- */
.overlay {
    position: absolute;
    z-index: var(--z-overlay);
}

.anchor--top-left { top: var(--space-md); left: var(--space-md); }
.anchor--top-right { top: var(--space-md); right: var(--space-md); }
.anchor--top-center { top: var(--space-md); left: 50%; transform: translateX(-50%); }
.anchor--bottom-left { bottom: var(--space-md); left: var(--space-md); }
.anchor--bottom-right { bottom: var(--space-md); right: var(--space-md); }
.anchor--bottom-center { bottom: var(--space-md); left: 50%; transform: translateX(-50%); }
.anchor--center { top: 50%; left: 50%; transform: translate(-50%, -50%); }
.anchor--full { top: 0; left: 0; right: 0; bottom: 0; }

/* Safe area support */
.anchor--top-left,
.anchor--top-right,
.anchor--top-center {
    top: max(var(--space-md), env(safe-area-inset-top));
}

.anchor--bottom-left,
.anchor--bottom-right,
.anchor--bottom-center {
    bottom: max(var(--space-md), env(safe-area-inset-bottom));
}
```

---

## Phase 2: Pilot Screen Refactor (Battle Screen)

### 2.1 Battle Screen Structure Analysis

Current structure:
```
vn-container (viewport)
├── background-layer
├── sprite-layer
│   ├── character sprites
│   └── summon containers (POSITIONING ISSUE)
├── battle-stats-panel.enemy-stats (TOP-RIGHT)
├── battle-stats-panel.player-stats (BOTTOM-LEFT)
├── battle-log-panel (BOTTOM-CENTER)
│   ├── battle log messages
│   └── action buttons (Attack, Skills, Defend, Item)
├── enemy-intent-indicator (TOP, above enemy)
└── overlays (dev mode, reset button)
```

### 2.2 New Battle Screen Structure

```
.app-frame
├── .app-frame__main (relative container)
│   ├── .battle-background (full-screen background)
│   ├── .battle-sprites (character display area)
│   │   ├── .sprite--enemy
│   │   ├── .sprite--player (if visible)
│   │   └── .summon-container (managed by layout system)
│   │
│   ├── .overlay.anchor--top-right
│   │   └── CharacterPanel (enemy stats)
│   │
│   ├── .overlay.anchor--bottom-left
│   │   └── CharacterPanel (player stats)
│   │
│   ├── .overlay.anchor--bottom-center
│   │   └── BattleLogPanel
│   │       ├── .stack (log messages)
│   │       └── .grid--cols-2 (action buttons)
│   │
│   ├── .overlay.anchor--top-center
│   │   └── IntentIndicator (enemy intent)
│   │
│   └── .overlay.anchor--top-left
│       └── SystemButtons (dev mode, reset)
```

### 2.3 Component Specifications

#### CharacterPanel
```
Purpose: Display HP, MP, Limit, AC for a character
Props:
  - name: string
  - hp: { current, max }
  - mp: { current, max }
  - limit: { current, max }
  - ac: number
  - isPlayer: boolean
Events: none (display only)
Layout: .stack with internal rows for each stat
```

#### ActionButton
```
Purpose: Battle action button (Attack, Skills, etc.)
Props:
  - label: string
  - icon: string (optional)
  - disabled: boolean
  - hotkey: string (optional)
Events:
  - onClick: () => void
Layout: Self-contained, respects parent grid cell
```

#### BattleLogPanel
```
Purpose: Display battle messages and action buttons
Props:
  - messages: string[]
  - actions: ActionButton[]
  - phase: 'player' | 'enemy' | 'animation'
Events:
  - onAction: (actionId) => void
Layout: .stack containing message area + action grid
```

#### SummonDisplay
```
Purpose: Show summoned creature with HP/duration
Props:
  - name: string
  - sprite: string
  - hp: { current, max }
  - duration: number
  - side: 'player' | 'enemy'
Events:
  - onClick: () => void (for targeting)
Layout: Uses anchor system based on side
Anchor:
  - player summon: anchor--bottom-right (portrait) or calculated (landscape)
  - enemy summon: anchor--top-left (portrait) or calculated (landscape)
```

### 2.4 Battle Screen Implementation Steps

1. [ ] Create new CSS file: `css/layout-system.css`
   - Design tokens
   - Scale tiers
   - Layout primitives

2. [ ] Create new CSS file: `css/components/character-panel.css`
   - CharacterPanel styles using tokens

3. [ ] Create new CSS file: `css/components/action-button.css`
   - ActionButton styles using tokens

4. [ ] Create new CSS file: `css/components/battle-log.css`
   - BattleLogPanel styles using tokens

5. [ ] Create new CSS file: `css/components/summon-display.css`
   - SummonDisplay styles using tokens and anchors

6. [ ] Refactor `battle-ui.js`:
   - Generate HTML using layout primitives
   - Apply component classes
   - Remove direct style manipulation for positioning

7. [ ] Test all orientations and scale tiers

---

## Phase 3: Component Extraction

### 3.1 Components to Extract

| Component | Source | Priority |
|-----------|--------|----------|
| CharacterPanel | battle-stats-panel | High |
| ActionButton | battle choice buttons | High |
| BattleLogPanel | battle-log-panel | High |
| SummonDisplay | summon-container | High |
| StatBar | HP/MP/Limit bars | Medium |
| TitleBanner | text-box-header | Medium |
| SystemButton | reset-btn, dev-mode | Medium |
| ModalOverlay | password screen | Low |
| NotificationToast | item notifications | Low |

### 3.2 Component File Structure

```
css/
├── layout-system.css      # Tokens + primitives
├── components/
│   ├── character-panel.css
│   ├── action-button.css
│   ├── battle-log.css
│   ├── summon-display.css
│   ├── stat-bar.css
│   ├── title-banner.css
│   ├── system-button.css
│   ├── modal-overlay.css
│   └── notification.css
├── screens/
│   ├── battle.css         # Battle screen composition
│   ├── dialogue.css       # VN dialogue screen
│   └── menu.css           # Main menu
└── themes/                # Theme overrides (colors only)
```

---

## Phase 4: Rollout to Remaining Screens

### 4.1 Screen Migration Order

1. **Battle Screen** (Phase 2 - pilot)
2. **Dialogue Screen** - Similar structure, mostly text box + buttons
3. **Password Screen** - Simple overlay with input grid
4. **QTE Overlay** - Timing bar + result display
5. **Main Menu** - If exists

### 4.2 Per-Screen Checklist

For each screen:
- [ ] Map to app-frame regions
- [ ] Identify layout primitives needed
- [ ] List components used
- [ ] Remove all px except 1px borders
- [ ] Remove orientation-specific positioning hacks
- [ ] Test portrait + landscape
- [ ] Test scale tiers (zoom in/out browser)

---

## Phase 5: Cleanup & Guardrails

### 5.1 Code to Remove

- [ ] Old positioning media queries in shared.css
- [ ] Duplicate `:root` variable definitions
- [ ] Unused CSS classes
- [ ] Dead JavaScript positioning code

### 5.2 Code Review Checklist

Before merging any UI changes:
- [ ] No new `px` values (except 1px borders)
- [ ] All sizes use design tokens
- [ ] Components are position-agnostic
- [ ] Layout uses primitives (stack/row/grid/anchor)
- [ ] No direct style manipulation for positioning in JS
- [ ] Works in both orientations without special cases

### 5.3 Debug Tools

- [ ] Add CSS debug mode toggle (outlines all layout containers)
- [ ] Add scale test buttons (0.5x, 1x, 1.5x, 2x root font-size)

---

## Definition of Done

- [ ] All screens use app-frame + layout primitives
- [ ] All components are reusable and position-agnostic
- [ ] All sizes use rem-based design tokens
- [ ] Orientation handled by scale tiers only
- [ ] No per-screen positioning hacks
- [ ] Adding new screens only requires wiring components
- [ ] Documentation complete for all components

---

## File Changes Summary

### New Files
- `css/layout-system.css`
- `css/components/*.css` (8-10 files)
- `css/screens/*.css` (3-4 files)
- `docs/COMPONENTS.md` (component documentation)

### Modified Files
- `css/shared.css` - Remove positioning, keep theme variables
- `js/battle/battle-ui.js` - Use layout system
- `index.html` - Link new CSS files

### Deleted/Deprecated
- Inline positioning styles
- Orientation-specific hacks
- Duplicate variable definitions
