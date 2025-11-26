# Contributing to Andi's Farewell VN

Welcome! This is a small project made by friends, so don't worry about being too formal. Here's how to add your own scenes, jokes, and endings.

---

## Quick Start

1. Clone the repo
2. Edit or add files in `scenes/`
3. Run `python tools/build_story_from_md.py`
4. Open `index.html` in a browser to test
5. Commit and push

That's it. The story is entirely in Markdown files - no JavaScript knowledge required.

---

## Adding a New Scene

Create a new `.md` file in the `scenes/` folder. Use lowercase with underscores: `my_new_scene.md`

Every scene needs at least an `id` and some text:

```markdown
---
id: my_new_scene
bg: office_corridor.jpg
---

Your scene text goes here. Write whatever you want.

### Choices

- Go somewhere -> other_scene_id
- Do something else -> another_scene_id
```

The `id` must be unique and match what other scenes use to link to it.

---

## Linking Scenes Together

To make your scene reachable, another scene needs to link to it. Find an existing scene and add a choice:

```markdown
### Choices

- Existing choice -> existing_target
- Your new option -> my_new_scene
```

Or you can create a whole new branch from the start or any other scene.

---

## Scene Checklist

Before committing, make sure:

- [ ] Your scene has a unique `id`
- [ ] The `id` matches what other scenes link to (if any)
- [ ] All your choice targets exist (the build script will warn you if they don't)
- [ ] You ran `python tools/build_story_from_md.py` and it succeeded
- [ ] You tested in the browser and everything works

---

## Story Structure

The current flow looks roughly like this:

```
start
  ├── main_stairs (Agnes encounter)
  │     ├── document_signed -> lost_to_HR
  │     ├── document_refusal -> lost_to_HR
  │     └── attempt_pass (dice roll)
  │           ├── d20_success -> exit_lobby (WIN)
  │           └── d20_failure -> lost_to_coffee
  │
  ├── back_stairs (Joni/Norbert PhD trap)
  │     ├── lost_to_PhD
  │     ├── colleague_plea
  │     │     ├── lost_to_PhD
  │     │     └── corridor_delayed
  │     │           ├── fourth_floor_elevator -> exit_lobby (WIN)
  │     │           └── corridor_safe -> exit_lobby (WIN)
  │     └── corridor_safe -> exit_lobby (WIN)
  │
  └── coffee_kitchen -> lost_to_coffee
```

Feel free to add new branches, new endings, or extend existing paths.

---

## Types of Scenes

### Regular scene (with choices)

Most scenes. Player reads text, then picks from options.

```markdown
---
id: regular_scene
bg: some_background.jpg
---

Text here.

### Choices

- Option A -> scene_a
- Option B -> scene_b
```

### Ending (no choices)

If there's no `### Choices` section, it's an ending. The game shows "Play Again".

```markdown
---
id: bad_ending
bg: dark_office.jpg
---

You got trapped. Game over.

**You lost the game.**
```

### Dice roll scene

For random outcomes. The player clicks to roll, and fate decides.

```markdown
---
id: risky_action
bg: hallway.jpg
actions:
  - type: roll_dice
    dice: d20
    threshold: 13
    success_target: you_made_it
    failure_target: you_failed
---

You need to roll 13 or lower to succeed!

### Choices

- ROLL D20... -> _roll
```

---

## Adding Characters

If you want to add a new character sprite:

1. Create an SVG file in `assets/char/`
2. Use 200x400 viewBox
3. Name it `charactername_emotion.svg`
4. Reference it in your scene:

```markdown
---
id: my_scene
chars:
  - newcharacter_happy.svg
---
```

Easiest way: copy an existing sprite and modify it.

---

## Adding Backgrounds

1. Drop a `.jpg` in `assets/bg/`
2. Use lowercase with underscores
3. Recommended size: 1280x720 (or similar 16:9)
4. Reference in your scene:

```markdown
---
id: my_scene
bg: new_background.jpg
---
```

---

## Adding Music

1. Drop an `.mp3` in `assets/music/`
2. Reference in your scene (optional - `default.mp3` plays if not specified):

```markdown
---
id: tense_scene
music: dramatic_track.mp3
---
```

---

## Text Formatting

- **Bold** with `**double asterisks**`
- Paragraphs separated by blank lines
- Use `---` between text blocks for "Continue" clicks

Example:

```markdown
---
id: example
---

First paragraph.

Second paragraph with **bold text**.

---

This appears after clicking Continue.

### Choices

- Next -> somewhere
```

---

## Testing

1. Run the build script:
   ```bash
   python tools/build_story_from_md.py
   ```

2. Check for errors - the script validates that all scene references exist

3. Open `index.html` in your browser

4. Play through your new content

5. Use the reset button (bottom right) to start over if needed

---

## Common Mistakes

**"Scene not found" error**
- Check that the target scene's `id` exactly matches what you wrote in the choice
- Make sure you created the `.md` file for that scene
- Run the build script again

**Text not showing up**
- Make sure there's a blank line after the frontmatter `---`
- Check for typos in the frontmatter

**Choices not appearing**
- The section must be exactly `### Choices` (with a space)
- Each choice needs the format `- Label -> target`

**Background/sprite not loading**
- Check the filename matches exactly (case-sensitive on some systems)
- Make sure the file is in the right folder

---

## Questions?

Just ask in the group chat. We're all figuring this out together.
