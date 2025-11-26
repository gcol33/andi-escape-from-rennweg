# Andi - Escape from Rennweg

A silly visual novel made by five friends for Andi's PhD farewell.

The premise: it's Andi's last day at the institute. All he has to do is walk out the front door. How hard can it be?

---

## What is this?

We wanted to make something fun and personal for Andi's goodbye, so we built a little branching story game where you try to escape the office without getting trapped by colleagues, HR paperwork, or one last cup of coffee.

The whole thing runs in a browser - no installs, no servers, just open `index.html` and play.

---

## How to add scenes

Scenes live in `scenes/` as Markdown files. Each file is one "screen" of the game.

Basic structure:

```markdown
---
id: scene_name
bg: background_image.jpg
chars:
  - character.svg
---

The text that appears on screen.

### Choices

- First option -> next_scene_id
- Second option -> other_scene_id
```

If you want multiple "continue" clicks before showing choices, separate text blocks with `---`.

After editing, run the build script to regenerate the story data:

```bash
python tools/build_story_from_md.py
```

Then refresh the browser.

---

## Project structure

```
Andi/
  index.html          - the game page
  css/style.css       - styling
  js/engine.js        - the VN engine (don't touch unless you know what you're doing)
  js/story.js         - generated from scenes/*.md (don't edit directly)
  scenes/*.md         - the actual story content (edit these!)
  assets/bg/          - background images
  assets/char/        - character sprites (SVG)
  assets/music/       - background music
  tools/              - build script
```

---

## Who made this

A few people from the office who wanted to give Andi a proper sendoff. You know who you are.
