# UI Refactor v0.5.0 - Migration Guide

## Overview

This document tracks the migration from the old px-based, ad-hoc positioning system to the new rem-based, component-based layout system.

---

## Completed Work

### New CSS Architecture

| File | Status | Description |
|------|--------|-------------|
| `css/main.css` | ✅ Done | Single entry point with @import structure |
| `css/layout-system.css` | ✅ Done | Design tokens, scale tiers, layout primitives |

### Component CSS Files (`css/components/`)

| Component | Status | Description |
|-----------|--------|-------------|
| `stat-bar.css` | ✅ Done | HP, MP, Limit, Stagger bars |
| `character-panel.css` | ✅ Done | Player/enemy stats panels |
| `action-button.css` | ✅ Done | Battle actions, choices, buttons |
| `battle-log.css` | ✅ Done | Combat messages and action grid |
| `summon-display.css` | ✅ Done | Summoned creature display |
| `title-banner.css` | ✅ Done | Headers, scene titles, banners |
| `modal-overlay.css` | ✅ Done | Full-screen overlays, dialogs |
| `notification.css` | ✅ Done | Toasts, item pickups, alerts |
| `dice-roll.css` | ✅ Done | D20 and damage dice display |
| `floating-number.css` | ✅ Done | WoW-style floating numbers |

### Screen CSS Files (`css/screens/`)

| Screen | Status | Description |
|--------|--------|-------------|
| `battle.css` | ✅ Done | Battle screen layout composition |
| `dialogue.css` | ✅ Done | VN text box, choices, controls |
| `password.css` | ✅ Done | Password entry overlay |
| `qte.css` | ✅ Done | Quick Time Event timing bar |
| `menu.css` | ✅ Done | Main menu, settings, dev panel |

---

## Remaining Work

### Phase 1: CSS Cleanup

#### 1.1 Refactor `shared.css` (5306 lines)

**Strategy:** Create a new slimmed-down version keeping only:
- Color variables (roll colors, emphasis colors)
- Theme variables (button colors, panel colors)
- Roll type/emphasis classes
- Legacy compatibility mappings

**Remove (now in layout-system.css or components):**
- Z-index scale (duplicated)
- Spacing variables (duplicated)
- Typography variables (duplicated)
- Password sizing variables
- UI positioning variables
- All positioning rules
- All media queries for positioning

**Files to create:**
- `css/shared-colors.css` - Color system only
- `css/shared-legacy.css` - Backward compatibility (temporary)

#### 1.2 Refactor `style.css`

**Strategy:** Migrate all px values to rem using tokens:
- `px` → `var(--space-*)` for spacing
- `px` → `var(--text-*)` for font sizes
- Keep `1px` borders as `var(--border-thin)`

#### 1.3 Update Theme Files (20 files)

**Strategy:** Strip layout rules, keep only:
- Color overrides
- Font family declarations
- Custom decorations (borders, patterns)
- Theme-specific animations

**Do NOT keep:**
- Positioning rules
- Size values
- Media queries for layout

---

### Phase 2: JavaScript Rewrites

#### 2.1 `battle-ui.js` (2079 lines) - FULL REWRITE

**Current pattern:**
```javascript
var element = document.createElement('div');
element.className = 'battle-stats-panel';
element.style.left = pixels + 'px';
```

**New pattern:**
```javascript
var BattleUI = {
    components: {
        playerPanel: null,
        enemyPanel: null,
        battleLog: null
    },

    create: function(container) {
        this.components.playerPanel = this.createCharacterPanel('player');
        this.components.enemyPanel = this.createCharacterPanel('enemy');
        // ... use CSS classes for positioning
    },

    createCharacterPanel: function(type) {
        var panel = createElement('div', 'character-panel character-panel--' + type);
        // Build using component classes, no inline styles
        return panel;
    }
};
```

**Key changes:**
- Use component CSS classes instead of inline styles
- Use anchor classes for positioning (`.anchor--bottom-left`)
- Remove all `element.style.*` for positioning
- Use `classList.add/remove` for state changes

#### 2.2 `battle-dice-ui.js` (1743 lines)

**Key changes:**
- Use `.dice-number` and `.dice-roll` component classes
- Use `.dice-number--damage`, `.dice-number--crit` variants
- Remove inline style positioning
- Use CSS animations from `dice-roll.css`

#### 2.3 `battle-facade.js` (3846 lines)

**Key changes:**
- Use `.battle-intro`, `.battle-result` overlay classes
- Use `.battle-screen--shake` for screen shake
- Use `.battle-dialogue` for enemy taunts
- Remove inline style positioning

#### 2.4 `floating-number.js` (410 lines)

**Key changes:**
- Use `.floating-number` and variant classes
- Position via CSS custom properties: `--float-x`, `--float-y`
- Use CSS animations from `floating-number.css`

#### 2.5 `qte-ui.js` (1800+ lines)

**Key changes:**
- Use `.qte-overlay`, `.qte-bar`, `.qte-zone` classes
- Use `.qte-marker` with CSS for positioning
- Remove inline style positioning

#### 2.6 `password.js` (350+ lines)

**Key changes:**
- Use `.password-overlay`, `.password-container` classes
- Use `.password-char` variants for states
- Remove px sizing

#### 2.7 `engine.js` (3744 lines) - UI portions only

**Key changes:**
- Use `.vn-textbox`, `.vn-choice` classes
- Use `.vn-sprite` for character sprites
- Use `classList` for visibility states

---

### Phase 3: HTML Updates

#### 3.1 Update `index.html`

**Add:**
```html
<link rel="stylesheet" href="css/main.css">
```

**Consider removing (if fully migrated):**
```html
<link rel="stylesheet" href="css/style.css">
<link rel="stylesheet" href="css/shared.css">
```

**Update DOM structure to use new classes:**
```html
<div id="vn-container" class="vn-screen">
    <div id="background-layer" class="vn-background"></div>
    <div id="sprite-layer" class="vn-sprites"></div>
    <div id="text-box" class="vn-textbox">
        <!-- ... -->
    </div>
</div>
```

---

## Design Token Reference

### Spacing Scale
| Token | Value | Use for |
|-------|-------|---------|
| `--space-xs` | 0.25rem (4px) | Tight gaps |
| `--space-sm` | 0.5rem (8px) | Small gaps |
| `--space-md` | 0.75rem (12px) | Default gaps |
| `--space-lg` | 1rem (16px) | Medium gaps |
| `--space-xl` | 1.5rem (24px) | Large gaps |
| `--space-2xl` | 2rem (32px) | Section gaps |
| `--space-3xl` | 3rem (48px) | Major sections |

### Typography Scale
| Token | Value | Use for |
|-------|-------|---------|
| `--text-xs` | 0.75rem (12px) | Tiny labels |
| `--text-sm` | 0.875rem (14px) | Small text |
| `--text-md` | 1rem (16px) | Body text |
| `--text-lg` | 1.25rem (20px) | Large text |
| `--text-xl` | 1.5rem (24px) | Headings |
| `--text-2xl` | 2rem (32px) | Titles |
| `--text-3xl` | 2.5rem (40px) | Large titles |

### Layout Primitives
| Class | Description |
|-------|-------------|
| `.stack` | Vertical flex with gap |
| `.row` | Horizontal flex with gap |
| `.grid` | CSS grid with columns |
| `.overlay` | Absolute positioned layer |
| `.anchor--*` | Position anchors (top-left, bottom-center, etc.) |
| `.panel` | Padded container with border |

### Component Classes
| Component | Base Class | Variants |
|-----------|------------|----------|
| Stat Bar | `.stat-bar` | `--hp`, `--mp`, `--limit`, `--stagger` |
| Character Panel | `.character-panel` | `--player`, `--enemy`, `--compact` |
| Action Button | `.action-btn` | `--primary`, `--secondary`, `--ghost` |
| Battle Log | `.battle-log` | `--compact` |
| Dice Number | `.dice-number` | `--d20`, `--damage`, `--crit` |
| Floating Number | `.floating-number` | `--damage`, `--heal`, `--crit` |

---

## Testing Checklist

### Per-Screen Testing
- [ ] Battle screen - landscape
- [ ] Battle screen - portrait
- [ ] Dialogue screen - landscape
- [ ] Dialogue screen - portrait
- [ ] Password screen - landscape
- [ ] Password screen - portrait
- [ ] QTE overlay - landscape
- [ ] QTE overlay - portrait

### Scale Tier Testing
- [ ] Compact (480px width)
- [ ] Normal (16px root)
- [ ] Large (1920px+ width)

### Component Testing
- [ ] HP bar animations (damage, heal, critical)
- [ ] Character panel states (damage shake, heal glow)
- [ ] Action buttons (hover, active, disabled, cooldown)
- [ ] Dice roll animations
- [ ] Floating numbers (all types)
- [ ] Toast notifications
- [ ] Modal overlays

---

## Rollback Plan

If issues occur after migration:

1. **CSS Rollback:** Comment out `main.css` import, restore old CSS links
2. **JS Rollback:** Revert to backup copies of JS files
3. **Full Rollback:** Restore from backup created before refactor

---

## Session Progress Log

### Session 1 (Current)
- [x] Created migration plan document
- [x] Created `css/main.css`
- [x] Created `css/layout-system.css`
- [x] Created all 10 component CSS files
- [x] Created all 5 screen CSS files
- [x] Created this migration guide
- [ ] Started `shared.css` refactor (in progress)

### Session 2 (Planned)
- [ ] Complete `shared.css` refactor
- [ ] Start `battle-ui.js` rewrite

### Session 3 (Planned)
- [ ] Complete JS rewrites
- [ ] Update `index.html`
- [ ] Integration testing

### Session 4 (Planned)
- [ ] Theme file updates
- [ ] Final testing
- [ ] Cleanup old code
