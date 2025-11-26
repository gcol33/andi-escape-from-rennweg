# Andi – Escape from Rennweg (VN Project)

This is a small, Markdown-driven visual novel (VN) built as a static site for Andi’s PhD goodbye.  
The idea is to make it easy for everyone to contribute scenes, jokes, and endings without touching JavaScript.

---

## 🎯 Goal

- Tell a branching, replayable farewell story about Andi escaping Rennweg.
- Keep the technical side simple: pure HTML, CSS, and JavaScript.
- Let non-programmers write scenes as `.md` files.
- Use a static site generator to turn Markdown scenes into `story.js` that the VN engine can read.

---

## 🧱 Planned Project Structure

```text
andi-espace-from-rennweg/
│
├─ index.html              # Single-page VN shell
│
├─ css/
│   └─ style.css           # Layout, text box, buttons, etc.
│
├─ js/
│   ├─ engine.js           # Generic VN engine logic
│   └─ story.js            # Generated from scenes/*.md
│
├─ scenes/
│   └─ *.md                # One file per scene (source of truth for the story)
│
├─ assets/
│   ├─ bg/                 # Background images (office photos, etc.)
│   ├─ char/               # Character overlays / sprites
│   └─ sfx/                # Optional sound effects
│
├─ tools/
│   └─ build_story_from_md.py   # Static site generator for story.js
│
└─ claude.md               # Project rules, architecture, and prompts for AI refactors
```

---

## 📝 Scene Format (Concept)

Each scene will be written as a Markdown file in `scenes/`:

- **Frontmatter** (YAML-like) for:
  - `id`: unique scene id
  - `bg`: background image id
  - `chars`: list of character sprite ids
  - `set_flags`: flags to set when entering/leaving the scene
  - `require_flags`: flags required to access this scene
  - `actions`: optional special actions (e.g. dice rolls)

- **Text blocks** separated by `---`  
  Each block is one “continue” click in the VN.

- **Choices** section at the end:

  ```markdown
  ### Choices
  - Option label → target_scene_id
  - Another label → other_scene_id
  ```

Special behavior (like dice rolls) is expressed via `actions` in frontmatter, and the engine maps these to handlers in `engine.js`. No raw JS is written in Markdown.

---

## 🔧 Static Site Generator

The script in `tools/build_story_from_md.py` will:

1. Scan all `.md` files in `scenes/`.
2. Parse:
   - frontmatter (metadata)
   - text blocks (`---` separators)
   - choices (`### Choices` list)
   - actions (if any)
3. Validate that all `target_scene_id` references exist.
4. Generate `js/story.js` with a big `story` object that the engine consumes.

Writers only touch `scenes/*.md`; the generator and engine handle the rest.

---

## 🚀 Development Workflow (Planned)

1. Clone the repo.
2. Edit or add `.md` files in `scenes/` and/or images in `assets/`.
3. Run the build script to regenerate `js/story.js`:
   ```bash
   python tools/build_story_from_md.py
   ```
4. Open `index.html` in a browser to test.
5. Commit changes to:
   - `scenes/`
   - `assets/`
   - `js/story.js`
   - and any updates to `css/`, `js/engine.js`, or `claude.md`.

---

## 🤝 Collaboration

- The repo is private; collaborators are added by invite.
- Writers mainly work in `scenes/`.
- Devs maintain `engine.js`, `build_story_from_md.py`, and overall structure.
- `claude.md` documents the architecture and the rules we expect AI tools (and humans) to follow.

