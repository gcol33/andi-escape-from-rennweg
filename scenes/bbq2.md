---
id: bbq2
bg: rooftop_bbq.png
---

You pull out the Flora Book and the Magnifying Glass. Crouching by the terracotta pot, you examine the rosette-shaped succulent with the careful attention of someone who has learned, painfully, that "hübsch" is not a valid botanical term.

---

"Ah yes, this is clearly..." you squint through the glass, matching the fleshy leaves and purple-tipped edges to the illustration, "...Sempervivum tectorum. The common houseleek." You wisely avoid mentioning that it's very pretty. Franz nods approvingly from across the terrace.

---

"Now then," someone says, "who's handling the grill?" The ancient charcoal grill stands waiting, cold and empty. All eyes turn to you again. Of course they do.

### Choices

- Look at the empty grill (require_items: !Charcoal) → ending_bbq_nocharcoal
- Realize you forgot a lighter (require_items: Charcoal, !Lighter) → ending_bbq_charcoal_nolighter
- Set up without refreshments (require_items: Charcoal, Lighter, !Beer) → ending_bbq_charcoal_lighter_nobeer
- Fire up the grill properly (require_items: Charcoal, Lighter, Beer) → bbq3

