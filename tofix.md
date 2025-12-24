# Playtest Issues - To Fix

## Text Display

- [x] **Text splits too early** - May not react correctly to window resizing
  - Fixed: Changed `paginateText()` to use `clientWidth` instead of `offsetWidth` for consistent measurement
  - Fixed: Added re-pagination on window resize to recalculate text pages dynamically
- [ ] **Word splitting** - Text should not break mid-word; if splitting is needed, redistribute lines equally
  - Consider adding configurable split percentage in `js/tuning.js`

## UI Layout

- [ ] **"Play again" button margin** - Slight margin issue on the play again button
- [ ] **Battle UI too large** - Keyboard gets cut off (possibly Mac screen/resolution issue?)
- [ ] **Battle UI scroll bug** - Scroll issue has returned

## Battle/Overlay

- [ ] **Overlay persists after defeat/win** - Overlay doesn't disappear after battle ends
- [ ] **HP display stuck** - HP shows 8 (pre-final-hit value) instead of updating to final state
