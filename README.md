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

### Basic scene

```markdown
---
id: my_scene
bg: office_corridor.jpg
---

This is the text that appears on screen. You can write multiple paragraphs.

The player reads this, then sees the choices below.

### Choices

- Go left -> left_scene
- Go right -> right_scene
```

### Frontmatter fields

The stuff between the `---` at the top is called frontmatter. Here's what you can put there:

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Unique name for this scene (used in choice targets) |
| `bg` | no | Background image filename (from `assets/bg/`) |
| `chars` | no | List of character sprites to show (from `assets/char/`) |
| `music` | no | Music file to play (from `assets/music/`). If not set, uses `default.mp3` |

Example with all fields:

```markdown
---
id: meeting_room
bg: meeting_room_whiteboard.jpg
music: tense_music.mp3
chars:
  - michi_whiteboard.svg
  - gilles_explaining.svg
---
```

### Multiple text blocks (continue clicks)

If you want the player to click "Continue" before seeing more text, separate blocks with `---`:

```markdown
---
id: long_scene
bg: hallway.jpg
---

You walk down the hallway. Something feels off.

---

Suddenly, you hear footsteps behind you.

---

You turn around and see... nobody. Just your imagination.

### Choices

- Keep walking -> next_scene
```

Each block becomes one screen. The choices only appear after the last block.

### Endings (no choices)

If a scene has no `### Choices` section, it's treated as an ending. The game will show a "Play Again" button.

```markdown
---
id: bad_ending
bg: dark_office.jpg
---

You are trapped forever. The end.
```

### Dice rolls

For random outcomes (like the Agnes chase scene), use actions in the frontmatter:

```markdown
---
id: chase_scene
bg: hallway.jpg
actions:
  - type: roll_dice
    dice: d20
    threshold: 13
    success_target: escaped
    failure_target: caught
---

You try to sprint past Agnes. Roll a d20 - you need 13 or lower to succeed.

### Choices

- ROLL D20... -> _roll
```

The special target `_roll` triggers the dice roll action. The result determines which scene loads next.

### Flags (for tracking choices)

You can set and check flags to remember what the player did:

```markdown
---
id: take_key
set_flags:
  - has_key
---

You pick up the key.

### Choices

- Continue -> next_room
```

Then in another scene, you can make choices conditional:

```markdown
### Choices

- Open the door (requires: has_key) -> secret_room
- Leave -> hallway
```

The first choice only appears if the player has the `has_key` flag.

---

## Adding assets

### Backgrounds

Background images go in `assets/bg/`. Use `.jpg` format, lowercase filenames with underscores.

Recommended size: 1280x720 or similar 16:9 aspect ratio. The image will fill the game container.

You can use photos, AI-generated images, or anything that fits the scene. Just make sure it's not too busy - the text box covers the bottom third.

Example filenames:
- `office_corridor.jpg`
- `meeting_room_whiteboard.jpg`
- `sunny_street_freedom.jpg`

### Character sprites

Character sprites go in `assets/char/`. Use SVG format with a 200x400 viewBox.

The easiest way to make a new sprite is to copy an existing one and modify it. Look at [agnes_neutral.svg](assets/char/agnes_neutral.svg) for a simple example.

Basic SVG structure:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 400" width="200" height="400">
  <!-- Head -->
  <ellipse cx="100" cy="80" rx="35" ry="45" fill="#f5d0c5"/>

  <!-- Body -->
  <path d="M70 150 Q60 200 55 300 L55 380 L145 380 L145 300 Q140 200 130 150 Z" fill="#3366cc"/>

  <!-- Eyes, mouth, hair, etc. -->
</svg>
```

Tips:
- Keep it simple - these are small on screen
- Use the same skin tone across sprites for consistency: `#f5d0c5`
- Name them `charactername_emotion.svg` (e.g., `agnes_angry.svg`, `joni_desperate.svg`)

### Music

Music files go in `assets/music/`. Use `.mp3` format.

There's a `default.mp3` that plays automatically on all scenes. If you want a different track for a specific scene (like a tense moment or the win screen), add the file and reference it in the scene's frontmatter:

```markdown
---
id: dramatic_scene
music: tense_drums.mp3
---
```

Tips:
- Keep file sizes reasonable (under 5MB ideally)
- Loopable tracks work best since music repeats
- The volume slider lets players adjust it, so don't worry too much about levels

### Writing text

The text in scenes supports basic formatting:

- **Bold text** using `**double asterisks**` - use for emphasis or game-over messages like `**YOU WIN**`
- Paragraphs are separated by blank lines
- Keep individual text blocks readable - if it's getting long, split it with `---` to add a continue click

Example:

```markdown
---
id: example
bg: hallway.jpg
---

You walk down the corridor. The fluorescent lights flicker overhead.

This is a second paragraph. Notice the blank line above.

If you want **bold text** for emphasis, use double asterisks.

---

This is a separate text block. The player has to click "Continue" to see this part.

### Choices

- Keep going -> next_scene
```

---

## Building

### Option 1: Just push (no Python needed)

If you edit any `.md` file in `scenes/` and push to GitHub, the build runs automatically. GitHub Actions will:

1. Install Python on the server
2. Run the build script
3. Commit the updated `js/story.js`
4. Deploy to GitHub Pages

You don't need Python installed locally. Just edit Markdown, push, and the site updates.

### Option 2: Build locally (for developers)

If you have Python installed and want to preview changes before pushing:

```bash
python tools/build_story_from_md.py
```

The script will warn you if you reference scenes that don't exist.

Then open `index.html` in a browser to see your changes.

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
