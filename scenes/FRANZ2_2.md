---
id: FRANZ2_2
bg: office_corridor.jpg
set_flags:
  - met_franz
---

Franz emerges from around a corner, almost as if he was waiting for you. He's examining a pressed flower specimen held between aged fingers—no doubt something with a Latin name three syllables longer than necessary.

---

"Your path continues," he observes, not looking up from the dried petals. "But are you prepared for what awaits? One does not simply attend a farewell. One must earn it."

### Choices

- "What about the party?" → FRANZ_hint_rooftop
- "What about knowledge?" → FRANZ_hint_knowledge
- "What about supplies?" → FRANZ_hint_supplies
- "I'm ready" (require_skills: Rooftop Discovery, Floristic Knowledge, Smile) (requires: has_flora_book, has_magnifying_glass, has_charcoal, has_lighter, has_beer) → FRANZ_impressed
- Leave → elevator0

