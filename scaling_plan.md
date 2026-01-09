# Continuous Scaling Architecture Plan

## Goal

Transform the CSS architecture to scale **continuously and linearly** from 480px to 16K, with no breakpoints, no layout reflows, and identical visual composition at all sizes.

---

## Current State Analysis

### Problems Identified

1. **Mixed unit systems**: px, rem, em, vw, vh, clamp() used inconsistently
2. **85 media query occurrences** across 33 files creating discrete breakpoints
3. **36 files use position: absolute** with px/rem offsets that don't scale proportionally
4. **Separate portrait mode logic** in `portrait-mode.css` (314 lines of overrides)
5. **Font sizes defined in 5+ different ways**: rem, vw, clamp(), px, em
6. **`container-type: inline-size`** breaks absolute positioning (your recent bug)

### Observable Symptom

- **Game container scales with viewport** (background grows/shrinks) ✅
- **Text box and battle UI stay fixed size** ❌
- Result: At larger screens, UI elements look tiny relative to the game area; at smaller screens, they dominate
- **Goal**: UI should maintain constant proportions relative to game container at ALL sizes

### Key Insight

The game container has a **fixed 16:9 aspect ratio**. This means:
- Width and height have a constant relationship
- Only ONE dimension needs to drive scaling
- All proportions can be expressed as percentages of container width

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  VIEWPORT (any size: 480px → 16K)                               │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  #vn-container                                              ││
│  │  - aspect-ratio: 16/9 (landscape) or 9/16 (portrait)        ││
│  │  - width: 100% of available space                           ││
│  │  - ALL children use % or em (relative to container)         ││
│  │                                                             ││
│  │  font-size: 1.2cqw  ← SINGLE SCALE REFERENCE               ││
│  │                                                             ││
│  │  All sizes derive from this:                                ││
│  │  - Typography: em multiples (1em, 0.8em, 1.5em)            ││
│  │  - Spacing: em multiples (0.5em, 1em, 2em)                 ││
│  │  - Dimensions: % of container (30%, 15cqw, etc.)           ││
│  │                                                             ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### Why Container Queries (cqw)?

- `vw` scales with viewport, not game container
- Game container may be letterboxed within viewport
- `cqw` (container query width) scales with actual game dimensions
- BUT: `container-type` breaks absolute positioning

### Solution: Hybrid Approach

1. Use `cqw` for font-size on #vn-container (safe)
2. Use `em` for all child sizing (inherits from container font-size)
3. Use `%` for layout positioning (relative to container)
4. Avoid `container-type: inline-size` initially (add later with flex/grid migration)

---

## Implementation Phases

### Phase 0: Foundation (Non-Breaking Prep)
**Goal**: Establish variables and test infrastructure without changing visuals.

### Phase 1: Typography Unification
**Goal**: All text scales from single reference.

### Phase 2: Spacing Normalization
**Goal**: All spacing uses em-based scale.

### Phase 3: Component Dimensions
**Goal**: Panels, buttons, bars use proportional sizing.

### Phase 4: Layout Migration
**Goal**: Convert absolute positioning to flex/grid.

### Phase 5: Breakpoint Elimination
**Goal**: Remove all @media queries except orientation.

### Phase 6: Portrait Mode Integration
**Goal**: Single layout that adapts via CSS properties, not breakpoints.

---

## Phase 0: Foundation

### Step 0.1: Create scale reference in variables.css

**File**: `css/shared/variables.css`

**Changes**:
```css
#vn-container {
    /* Scale reference - all em units cascade from this */
    --scale: 1;
    font-size: calc(1.2vw * var(--scale));

    /* Fallback for very small viewports */
    font-size: max(10px, calc(1.2vw * var(--scale)));
}
```

**Test**:
- [ ] Open game at 480px, 1080px, 4K
- [ ] Verify text is readable at all sizes
- [ ] Verify no visual changes to current layout

### Step 0.2: Add scaling debug mode

**File**: `css/layout-system.css` (add to debug section)

**Changes**:
```css
/* Debug: Show current scale factor */
.debug-scale #vn-container::before {
    content: "Scale: " attr(data-scale) " | Width: " attr(data-width);
    position: absolute;
    top: 0;
    left: 0;
    background: rgba(0,0,0,0.8);
    color: #0f0;
    font-size: 12px;
    padding: 4px 8px;
    z-index: 9999;
}
```

**JS addition** (engine.js or dev-panel.js):
```javascript
// Add to resize handler
const container = document.getElementById('vn-container');
container.dataset.width = container.offsetWidth + 'px';
container.dataset.scale = (container.offsetWidth / 1920).toFixed(2);
```

**Test**:
- [ ] Enable debug mode
- [ ] Verify scale factor displays correctly
- [ ] Verify scale factor changes smoothly on resize

---

## Phase 1: Typography Unification

### Step 1.1: Map current font sizes to scale

**Audit current values**:
| Variable | Current Value | New Value (em) |
|----------|---------------|----------------|
| --story-font-size | 1.15vw | 1em |
| --base-font-size | clamp(1.2rem, 1.7vw, 1.8rem) | 1.2em |
| --choice-font-size | 0.7rem | 0.7em |
| --continue-font-size | 0.7rem | 0.7em |
| --button-font-size | 0.76rem | 0.65em |
| --small-font-size | 0.75rem | 0.6em |
| --label-font-size | 0.72rem | 0.6em |
| --battle-text-size | 0.95rem | 0.8em |
| --battle-panel-font-size | 0.55rem | 0.45em |

**File**: `css/shared/variables.css`

**Changes**:
```css
#vn-container {
    /* Typography scale - all relative to container font-size */
    --text-xs: 0.5em;
    --text-sm: 0.65em;
    --text-md: 0.8em;
    --text-base: 1em;
    --text-lg: 1.2em;
    --text-xl: 1.5em;
    --text-2xl: 2em;

    /* Map legacy variables */
    --story-font-size: var(--text-base);
    --choice-font-size: var(--text-sm);
    --continue-font-size: var(--text-sm);
    --button-font-size: var(--text-sm);
    --battle-text-size: var(--text-md);
    --battle-panel-font-size: var(--text-xs);
}
```

**Test**:
- [ ] Story text readable at 480px (min ~12px actual)
- [ ] Story text readable at 4K (not excessively large)
- [ ] Battle UI text proportional to story text
- [ ] Buttons legible at all sizes

### Step 1.2: Update story-output font-size

**File**: `css/shared/ui-layout.css`

**Changes**:
```css
#story-output {
    font-size: var(--story-font-size) !important;
    /* Remove fallback - handled in variables.css */
}
```

**Test**:
- [ ] Story text displays correctly
- [ ] Line wrapping consistent across sizes

### Step 1.3: Update battle text sizes

**File**: `css/shared/battle-ui.css`

**Changes**: Search for `font-size:` and update to use new scale variables.

**Test**:
- [ ] Battle log readable
- [ ] Dice numbers proportional
- [ ] Skill menu readable

---

## Phase 2: Spacing Normalization

### Step 2.1: Define spacing scale

**File**: `css/shared/variables.css`

**Changes**:
```css
#vn-container {
    /* Spacing scale - em-based for proportional scaling */
    --space-xs: 0.25em;
    --space-sm: 0.5em;
    --space-md: 0.75em;
    --space-lg: 1em;
    --space-xl: 1.5em;
    --space-2xl: 2em;

    /* Legacy mappings */
    --spacing-xs: var(--space-xs);
    --spacing-sm: var(--space-sm);
    --spacing-md: var(--space-md);
    --spacing-lg: var(--space-lg);
    --spacing-xl: var(--space-xl);
}
```

**Test**:
- [ ] Existing layouts unchanged (legacy mappings work)

### Step 2.2: Update padding/margin in components

**Files to update** (one at a time):
1. `css/shared/battle-panels.css`
2. `css/shared/battle-ui.css`
3. `css/components/battle-log.css`
4. `css/style.css` (#text-box, #button-area)

**Pattern**: Replace `padding: 8px` with `padding: var(--space-sm)` etc.

**Test** (after each file):
- [ ] Component spacing looks proportional
- [ ] No overflow issues at small sizes

---

## Phase 3: Component Dimensions

### Step 3.1: Battle panels width

**File**: `css/shared/battle-panels.css`

**Current**:
```css
.battle-stats-panel {
    width: var(--battle-panel-width, 12rem);
}
```

**New**:
```css
.battle-stats-panel {
    width: 15%;  /* % of container width */
    min-width: 10em;  /* Readable minimum */
    max-width: 20em;  /* Reasonable maximum */
}
```

**Test**:
- [ ] Panel width scales with game container
- [ ] Panel remains readable at all sizes

### Step 3.2: Battle log height

**File**: `css/components/battle-log.css`

**Current**:
```css
.battle-log-panel {
    height: var(--battle-log-height, 12rem);
}
```

**New**:
```css
.battle-log-panel {
    height: 25%;  /* % of container height (fixed aspect ratio) */
}
```

**Test**:
- [ ] Log panel scales with game
- [ ] Text fits at all sizes

### Step 3.3: Button sizes

**File**: `css/style.css`

**Pattern**: Convert min-width: 120px to min-width: 8em

**Test**:
- [ ] Buttons scale proportionally
- [ ] Touch targets adequate at small sizes (min 44px equivalent)

---

## Phase 4: Layout Migration

### Step 4.1: Audit absolute positioning usage

**Files with absolute positioning**:
1. Battle stats panels (top-right, bottom-left corners)
2. Battle log panel (bottom, full width)
3. Sprite layer (bottom 40%)
4. Text box (bottom, full width)
5. Overlays (full screen)
6. Damage numbers (positioned over sprites)
7. Summon containers
8. Intent bubbles

**Strategy**:
- Keep absolute for overlays (they need full coverage)
- Convert corner panels to flex containers
- Keep percentage-based positioning

### Step 4.2: Convert battle panel positioning

**Current** (portrait-mode.css):
```css
.player-row {
    position: absolute;
    left: var(--ui-edge-margin);
    bottom: calc(var(--battle-log-height) + 0.5rem);
}
```

**New approach**: Use percentage positioning
```css
.player-row {
    position: absolute;
    left: 2%;
    bottom: 30%;  /* Above battle log (which is 25% height) */
}

.enemy-row {
    position: absolute;
    right: 2%;
    top: 2%;
}
```

**Test**:
- [ ] Panels stay in corners at all sizes
- [ ] Panels don't overlap content
- [ ] Works in both orientations

### Step 4.3: Remove pixel-based calc() expressions

**Pattern to find**: `calc(var(--something) + 10px)`

**Replace with**: `calc(var(--something) + var(--space-sm))`

**Test**:
- [ ] No remaining px values in calc expressions
- [ ] Layout stable at all sizes

---

## Phase 5: Breakpoint Elimination

### Step 5.1: Inventory all @media queries

**Count**: 85 occurrences across 33 files

**Categories**:
1. `@media (max-width: Xem)` - size breakpoints (REMOVE)
2. `@media (orientation: portrait)` - orientation (KEEP, but simplify)
3. `@media (orientation: landscape)` - orientation (KEEP)
4. `@supports` - feature detection (KEEP)

### Step 5.2: Remove size breakpoints from style.css

**File**: `css/style.css`

**Lines 607-657**: Remove `@media (max-width: 56.25em)` and `@media (max-width: 37.5em)`

**These rules currently**:
- Adjust text-box padding
- Adjust sprite-layer position
- Adjust choice-button min-width

**New approach**: These should scale proportionally, not step down at breakpoints.

**Test**:
- [ ] Resize from 480px to 4K smoothly
- [ ] No layout jumps
- [ ] All elements remain usable

### Step 5.3: Remove size breakpoints from ui-layout.css

**File**: `css/shared/ui-layout.css`

**Lines 109-125**: Remove password-char sizing breakpoints

**New approach**: Use em-based sizing that scales naturally.

**Test**:
- [ ] Password screen scales smoothly

### Step 5.4: Remove size breakpoints from theme files

**Each theme file** has ~3 media queries for password sizing.

**Pattern**: Remove and consolidate in shared CSS.

**Test**:
- [ ] All themes work at all sizes

---

## Phase 6: Portrait Mode Integration

### Step 6.1: Audit portrait-mode.css

**Current approach**: 314 lines of `!important` overrides

**Problems**:
- Duplicates logic from other files
- Uses absolute values (45vw, 0.5rem)
- Fights with theme CSS

### Step 6.2: Create unified orientation system

**File**: `css/shared/variables.css`

**Add orientation-aware variables**:
```css
#vn-container {
    /* Base values (landscape) */
    --aspect: 16 / 9;
    --panel-width: 15%;
    --log-height: 25%;
}

@media (orientation: portrait) {
    #vn-container {
        --aspect: 9 / 16;
        --panel-width: 45%;
        --log-height: 20%;
    }
}
```

**Philosophy**: Change variables, not layouts. Components use the same CSS, just with different variable values.

### Step 6.3: Simplify portrait-mode.css

**Target**: Reduce to <50 lines of variable overrides only.

**Remove**:
- All `!important` declarations
- All component-specific styles (should be in component files)
- All absolute values (should use variables)

**Test**:
- [ ] Portrait mode works
- [ ] No layout jumps when rotating
- [ ] All components scale correctly

---

## Phase 7: Final Validation

### Step 7.1: Cross-resolution testing

**Test at these widths**:
- [ ] 480px (mobile minimum)
- [ ] 768px (tablet)
- [ ] 1024px (small laptop)
- [ ] 1920px (1080p)
- [ ] 2560px (1440p)
- [ ] 3840px (4K)
- [ ] 7680px (8K simulation)

**Verify**:
- [ ] No layout jumps
- [ ] All text readable
- [ ] All touch targets adequate
- [ ] Proportions identical (screenshot overlay test)

### Step 7.2: Performance testing

- [ ] Measure CSS file sizes before/after
- [ ] Test resize performance (no jank)
- [ ] Test initial render time

### Step 7.3: Theme compatibility

- [ ] Test all 19 themes at 480px
- [ ] Test all 19 themes at 4K
- [ ] Verify no theme-specific breakpoints remain

---

## File Change Summary

| File | Changes |
|------|---------|
| `css/shared/variables.css` | Scale reference, typography scale, spacing scale |
| `css/shared/ui-layout.css` | Remove breakpoints, use scale variables |
| `css/style.css` | Remove 3 breakpoints, convert to em/% |
| `css/shared/portrait-mode.css` | Reduce to variable overrides only |
| `css/shared/battle-panels.css` | % widths, em spacing |
| `css/shared/battle-ui.css` | em typography, % positioning |
| `css/components/battle-log.css` | % height, em spacing |
| `css/layout-system.css` | Add debug mode |
| 19 theme files | Remove password breakpoints |

---

## Rollback Plan

Each phase is independently revertible:
1. Keep original files as `*.backup.css` during migration
2. Use git branches per phase
3. Test thoroughly before merging each phase

---

## Success Criteria

1. Zero `@media (max-width:)` or `@media (min-width:)` queries
2. Zero px values in positioning (only in borders/shadows)
3. All font-size values use em scale
4. All spacing uses em scale
5. Screenshot at 480px overlaid on 4K shows identical proportions
6. Smooth resize with no layout jumps
7. Portrait mode works without separate stylesheet logic

---

## Next Steps

Begin with **Phase 0, Step 0.1**: Add scale reference to variables.css

Command to start:
```
Read css/shared/variables.css and add the scale reference per Step 0.1
```
