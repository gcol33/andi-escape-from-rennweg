---
id: bbq1
bg: rooftop.jpg
---

You smile. Genuinely. After everything today, the goodbyes, the unexpected challenges, you're actually happy to be here. Adrian gives you a thumbs up from across the terrace, grinning that infinite loop grin of his.

---

Then someone points at the rooftop garden, where a cluster of succulents sits in terracotta pots near the edge. "Andi! We're having a debate. What plant is that?" All eyes turn to you. A botanical test, of all things. For a computer scientist. You feel Franz's gaze from somewhere behind you. This feels like the final exam you never signed up for.

### Choices

- Wing it without the Flora Book (require_items: !Flora Book) → ending_bbq_noflora
- Check the Flora Book but guess (require_items: Flora Book) (require_skills: !Floristic Knowledge) → ending_bbq_flora_noknowledge
- Use knowledge but can't see clearly (require_items: Flora Book, !Magnifying Glass) (require_skills: Floristic Knowledge) → ending_bbq_flora_knowledge_nomagglass
- Identify with confidence (require_items: Flora Book, Magnifying Glass) (require_skills: Floristic Knowledge) → bbq2

