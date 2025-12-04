# Theme Consolidation Plan

## Implementation Status: COMPLETE

The theme system has been consolidated. Both game and editor now share theme management through `ThemeUtils`.

---

## Architecture

### Dual-Mode Theme System

The theme system supports two modes, automatically detected:

1. **CSS Link Mode** (Game)
   - Uses `<link id="theme-css" href="css/themes/*.css">`
   - Full theme CSS files in `css/themes/` directory
   - Themes include complete styling (backgrounds, fonts, animations, etc.)

2. **Body Class Mode** (Editor)
   - Uses `<body class="theme-*">`
   - Theme styles defined in `editor/editor.css` using `body.theme-*` selectors
   - Simpler styling focused on editor UI elements

### Why Two Modes?

- **Game themes** are complex (1000+ lines each) with full page layouts, animations, responsive designs
- **Editor themes** need simpler styling that doesn't override the editor layout
- Sharing a single `themes.css` file would require extensive CSS restructuring
- The dual-mode approach keeps both systems working correctly with shared storage

---

## File Structure

```
js/
  theme.js            # Theme config (available themes list, selected default)
  theme-utils.js      # NEW - Shared theme utilities (get/set/init)

css/
  themes/             # Game theme files (unchanged)
    90s.css
    vaporwave.css
    ... (19 total)

editor/
  editor.css          # Contains body.theme-* styles for editor
```

---

## Shared Components

### `js/theme-utils.js`

The central theme utility module providing:

```javascript
ThemeUtils = {
    STORAGE_KEY: 'andi_vn_theme',

    getAvailableThemes()    // Returns array from themeConfig
    getDefaultTheme()       // Returns themeConfig.selected
    getCurrentTheme()       // localStorage > default
    applyTheme(name)        // CSS link OR body class (auto-detected)
    setTheme(name)          // Apply + save to localStorage
    initTheme()             // Apply current theme on page load
    initThemeSelector(el)   // Populate a <select> element
}
```

### Shared localStorage Key

Both game and editor use `andi_vn_theme` - changing theme in one reflects in the other.

---

## Usage

### Game (index.html)

```html
<link id="theme-css" rel="stylesheet" href="css/themes/90s.css">
<script src="js/theme.js"></script>
<script src="js/theme-utils.js"></script>
```

Theme applied via CSS link href changes.

### Editor (editor/index.html)

```html
<script src="../js/theme.js"></script>
<script src="../js/theme-utils.js"></script>
<script>ThemeUtils.initTheme();</script>
```

Theme applied via body class (`theme-90s`, etc.).

---

## Migration Checklist

- [x] Create `js/theme-utils.js` shared utility
- [x] Update `index.html` to include theme-utils.js
- [x] Update `js/engine.js` to use ThemeUtils
- [x] Update `editor/index.html` to use ThemeUtils
- [x] Update `editor/editor.js` to use ThemeUtils
- [x] Test localStorage persistence between game and editor
- [ ] (Optional) Add more themes to editor/editor.css if needed

---

## Adding New Themes

1. Create `css/themes/newtheme.css` for the game
2. Add `body.theme-newtheme` styles to `editor/editor.css` for the editor
3. Add `"newtheme"` to `themeConfig.available` in `js/theme.js`

---

## Notes

- The Python conversion script (`tools/convert_themes.py`) was created but is not needed
  - Game theme CSS files are too complex for automated conversion
  - Editor themes remain manually defined with simpler styling
- No breaking changes to existing functionality
- localStorage key unchanged for backwards compatibility
