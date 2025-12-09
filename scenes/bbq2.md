---
id: bbq2
bg: rooftop.jpg
---

You pull out the Flora Book (Franz's own tome that you earned through hard-won botanical trials) and the Magnifying Glass that Michi entrusted to you. Crouching down by the terracotta pot, you examine the rosette-shaped succulent with the careful attention of someone who has learned, painfully, that "hübsch" is not a valid botanical term.

---

"Ah yes, this is clearly..." you squint through the glass, matching the fleshy leaves and purple-tipped edges to the illustration in the book, "...Sempervivum tectorum. The common houseleek. Also known as 'Hen and Chicks' in English, or Dach-Hauswurz in German." You wisely avoid mentioning that it's very pretty. Everyone looks impressed. Especially Franz, who nods approvingly from across the terrace with something approaching respect in his eyes.

---

"Now then," someone says, breaking the moment, "who's handling the grill?" The ancient charcoal grill stands waiting, cold and empty. All eyes turn to you again. Of course they do. This calls for more than botanical knowledge. This calls for proper supplies.

### Choices

- Look at the empty grill (requires: !has_charcoal) → ending_bbq_nocharcoal
- Realize you forgot a lighter (require_items: Charcoal, requires: !has_lighter) → ending_bbq_charcoal_nolighter
- Set up without refreshments (require_items: Charcoal, require_items: Lighter, requires: !has_beer) → ending_bbq_charcoal_lighter_nobeer
- Fire up the grill properly (require_items: Charcoal, require_items: Lighter, require_items: Beer) → bbq3

