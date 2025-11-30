#!/usr/bin/env python3
"""
Andi VN - Story Builder

Parses Markdown scene files from scenes/ and generates js/story.js
Also reads theme.md to determine which theme CSS to use.

Usage:
    python tools/build_story_from_md.py

Each .md file in scenes/ should have:
- YAML frontmatter with at least 'id' field
- Text blocks separated by '---'
- Optional '### Choices' section at the end

Theme configuration in theme.md:
- theme_name [ ] - Available but not selected
- theme_name [x] - Selected theme
"""

import os
import re
import json
import sys
from pathlib import Path

# Determine project root (parent of tools/)
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
SCENES_DIR = PROJECT_ROOT / "scenes"
ENEMIES_DIR = PROJECT_ROOT / "enemies"
OUTPUT_FILE = PROJECT_ROOT / "js" / "story.js"
ENEMIES_OUTPUT_FILE = PROJECT_ROOT / "js" / "enemies.js"
THEME_FILE = PROJECT_ROOT / "theme.md"
THEME_OUTPUT_FILE = PROJECT_ROOT / "js" / "theme.js"
THEMES_DIR = PROJECT_ROOT / "css" / "themes"


def parse_frontmatter(content):
    """Extract YAML frontmatter from content."""
    if not content.startswith('---'):
        return {}, content

    # Find the closing ---
    end_match = re.search(r'\n---\n', content[3:])
    if not end_match:
        return {}, content

    frontmatter_text = content[3:3 + end_match.start()]
    body = content[3 + end_match.end():]

    # YAML parser that handles nested objects and lists
    frontmatter = {}
    current_key = None
    current_list = None
    current_action = None
    current_nested = None  # For nested objects like enemy:
    current_nested_key = None
    current_char = None  # For positioned sprite format
    actions_list = []
    chars_list = []

    def get_indent(line):
        """Get number of leading spaces."""
        return len(line) - len(line.lstrip())

    for line in frontmatter_text.split('\n'):
        stripped = line.strip()
        if not stripped:
            continue

        indent = get_indent(line)

        # Check for list item in actions (2 spaces = action list item)
        if current_key == 'actions' and stripped.startswith('- type:'):
            # Save previous action
            if current_action:
                if current_nested and current_nested_key:
                    current_action[current_nested_key] = current_nested
                actions_list.append(current_action)
            current_action = {'type': stripped[7:].strip()}
            current_nested = None
            current_nested_key = None
            current_char = None
            continue

        # Check for positioned char format: - file: filename.svg
        if current_key == 'chars' and stripped.startswith('- file:'):
            if current_char:
                chars_list.append(current_char)
            current_char = {'file': stripped[7:].strip()}
            current_action = None
            current_nested = None
            continue

        # Check for nested object properties (6 spaces = nested under nested key like enemy:)
        if current_nested is not None and indent >= 6 and ':' in stripped:
            key, _, value = stripped.partition(':')
            key = key.strip()
            value = value.strip()
            # Try to parse as number
            if value.isdigit():
                value = int(value)
            current_nested[key] = value
            continue

        # Check for action properties or nested object start (4 spaces = action property)
        if current_action is not None and indent >= 4 and ':' in stripped:
            key, _, value = stripped.partition(':')
            key = key.strip()
            value = value.strip()

            # Check if this starts a nested object (value is empty)
            if value == '':
                # Save current nested if any
                if current_nested and current_nested_key:
                    current_action[current_nested_key] = current_nested
                current_nested = {}
                current_nested_key = key
                continue

            # Regular action property
            # Try to parse as number
            if value.isdigit():
                value = int(value)
            current_action[key] = value
            continue

        # Check for char properties (x, y under - file:)
        if current_char is not None and indent >= 4 and ':' in stripped:
            key, _, value = stripped.partition(':')
            key = key.strip()
            value = value.strip()
            # Parse as float for x/y coordinates
            try:
                value = float(value)
                if value == int(value):
                    value = int(value)
            except ValueError:
                pass
            current_char[key] = value
            continue

        # Check for simple list item (old format chars or other lists)
        if stripped.startswith('- '):
            item = stripped[2:].strip()
            if current_key == 'chars' and current_char is None:
                # Old format: simple filename
                chars_list.append(item)
            elif current_list is not None:
                current_list.append(item)
            continue

        # Check for key: value (top-level, indent 0)
        if indent == 0 and ':' in stripped:
            key, _, value = stripped.partition(':')
            key = key.strip()
            value = value.strip()

            # Finish previous action/char if we hit a new top-level key
            if current_action:
                if current_nested and current_nested_key:
                    current_action[current_nested_key] = current_nested
                actions_list.append(current_action)
                current_action = None
                current_nested = None
                current_nested_key = None
            if current_char:
                chars_list.append(current_char)
                current_char = None

            # Check if this starts a list
            if value == '':
                if key == 'actions':
                    current_key = 'actions'
                    current_list = None
                elif key == 'chars':
                    current_key = 'chars'
                    current_list = None
                    chars_list = []
                else:
                    current_list = []
                    frontmatter[key] = current_list
                    current_key = key
            else:
                current_list = None
                current_key = key
                # Try to parse as number
                if value.isdigit():
                    value = int(value)
                frontmatter[key] = value

    # Finish any remaining action or char
    if current_action:
        if current_nested and current_nested_key:
            current_action[current_nested_key] = current_nested
        actions_list.append(current_action)
    if current_char:
        chars_list.append(current_char)

    if actions_list:
        frontmatter['actions'] = actions_list
    if chars_list:
        frontmatter['chars'] = chars_list

    return frontmatter, body


def parse_choices(text):
    """Parse the ### Choices section into structured choices."""
    choices = []

    for line in text.strip().split('\n'):
        line = line.strip()
        if not line or not line.startswith('-'):
            continue

        # Remove leading -
        line = line[1:].strip()

        # Parse: Label text → target_id
        # Or: Label text (requires: flag) → target_id
        # Or: Label text (sets: flag) → target_id
        # Or: Label text (uses: Item Name) → target_id
        # Or: Label text (heals: 5) → target_id
        # Or: Label text (battle: attack) → target_id

        choice = {
            'label': '',
            'target': '',
            'require_flags': [],
            'set_flags': [],
            'require_items': [],
            'uses': [],
            'sfx': None,
            'heals': None,
            'battle_action': None
        }

        # Split by arrow
        if '→' in line:
            parts = line.split('→')
            label_part = parts[0].strip()
            choice['target'] = parts[1].strip()
        elif '->' in line:
            parts = line.split('->')
            label_part = parts[0].strip()
            choice['target'] = parts[1].strip()
        else:
            continue

        # Parse flags from label
        # (requires: flag_name)
        requires_match = re.search(r'\(requires:\s*([^)]+)\)', label_part)
        if requires_match:
            flags = [f.strip() for f in requires_match.group(1).split(',')]
            choice['require_flags'] = flags
            label_part = re.sub(r'\(requires:\s*[^)]+\)', '', label_part).strip()

        # (sets: flag_name)
        sets_match = re.search(r'\(sets:\s*([^)]+)\)', label_part)
        if sets_match:
            flags = [f.strip() for f in sets_match.group(1).split(',')]
            choice['set_flags'] = flags
            label_part = re.sub(r'\(sets:\s*[^)]+\)', '', label_part).strip()

        # (require_items: Item Name, Another Item)
        require_items_match = re.search(r'\(require_items:\s*([^)]+)\)', label_part)
        if require_items_match:
            items = [i.strip() for i in require_items_match.group(1).split(',')]
            choice['require_items'] = items
            label_part = re.sub(r'\(require_items:\s*[^)]+\)', '', label_part).strip()

        # (heals: 5) - heals player HP when choice is selected
        # Parse heals FIRST since it may appear inside uses: parentheses
        heals_match = re.search(r'heals:\s*(\d+)', label_part)
        if heals_match:
            choice['heals'] = int(heals_match.group(1))
            # Remove from label if it was standalone (heals: 5)
            label_part = re.sub(r'\(heals:\s*\d+\)', '', label_part).strip()

        # (uses: Item Name) - consumes item when choice is selected
        # Handle "uses: Item, heals: 5" format by stripping heals first
        uses_match = re.search(r'\(uses:\s*([^)]+)\)', label_part)
        if uses_match:
            uses_content = uses_match.group(1)
            # Remove heals from uses content if present
            uses_content = re.sub(r',?\s*heals:\s*\d+', '', uses_content).strip()
            uses_content = re.sub(r'heals:\s*\d+,?\s*', '', uses_content).strip()
            items = [i.strip() for i in uses_content.split(',') if i.strip()]
            choice['uses'] = items
            label_part = re.sub(r'\(uses:\s*[^)]+\)', '', label_part).strip()

        # (battle: attack|defend|flee|item) - battle action type
        battle_match = re.search(r'\(battle:\s*([^)]+)\)', label_part)
        if battle_match:
            choice['battle_action'] = battle_match.group(1).strip()
            label_part = re.sub(r'\(battle:\s*[^)]+\)', '', label_part).strip()

        # [sfx: filename.ogg]
        sfx_match = re.search(r'\[sfx:\s*([^\]]+)\]', label_part)
        if sfx_match:
            choice['sfx'] = sfx_match.group(1).strip()
            label_part = re.sub(r'\[sfx:\s*[^\]]+\]', '', label_part).strip()

        choice['label'] = label_part

        # Clean up empty arrays to reduce output size
        if not choice['require_flags']:
            del choice['require_flags']
        if not choice['set_flags']:
            del choice['set_flags']
        if not choice['require_items']:
            del choice['require_items']
        if not choice['uses']:
            del choice['uses']
        if choice['heals'] is None:
            del choice['heals']
        if choice['battle_action'] is None:
            del choice['battle_action']
        if choice['sfx'] is None:
            del choice['sfx']

        choices.append(choice)

    return choices


def parse_text_blocks(body):
    """Split body into text blocks and extract choices."""
    # Check for ### Choices section
    choices_match = re.search(r'###\s*Choices\s*\n', body)

    if choices_match:
        text_part = body[:choices_match.start()]
        choices_part = body[choices_match.end():]
        choices = parse_choices(choices_part)
    else:
        text_part = body
        choices = []

    # Split by horizontal rule (---)
    # But we need to be careful not to match frontmatter separators
    blocks = re.split(r'\n---\n', text_part)

    # Clean up blocks
    text_blocks = []
    for block in blocks:
        block = block.strip()
        if block:
            text_blocks.append(block)

    return text_blocks, choices


def parse_scene_file(filepath):
    """Parse a single scene .md file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    frontmatter, body = parse_frontmatter(content)
    text_blocks, choices = parse_text_blocks(body)

    # Build scene object
    scene = {
        'id': frontmatter.get('id', filepath.stem),
        'bg': frontmatter.get('bg', None),
        'music': frontmatter.get('music', None),
        'chars': frontmatter.get('chars', []),
        'set_flags': frontmatter.get('set_flags', []),
        'require_flags': frontmatter.get('require_flags', []),
        'add_items': frontmatter.get('add_items', []),
        'remove_items': frontmatter.get('remove_items', []),
        'actions': frontmatter.get('actions', []),
        'textBlocks': text_blocks,
        'choices': choices
    }

    # Clean up empty arrays to reduce output size
    if not scene['set_flags']:
        del scene['set_flags']
    if not scene['require_flags']:
        del scene['require_flags']
    if not scene['add_items']:
        del scene['add_items']
    if not scene['remove_items']:
        del scene['remove_items']
    if not scene['actions']:
        del scene['actions']
    if not scene['chars']:
        del scene['chars']
    if scene['bg'] is None:
        del scene['bg']
    if scene['music'] is None:
        del scene['music']

    return scene


def parse_theme_file():
    """Parse theme.md to find selected theme and available themes."""
    themes = []
    selected_theme = None

    if not THEME_FILE.exists():
        print(f"  Warning: {THEME_FILE} not found, using default theme")
        return 'prototype', ['prototype']

    with open(THEME_FILE, 'r', encoding='utf-8') as f:
        content = f.read()

    # Parse lines like: theme_name [x] or theme_name [ ]
    for line in content.split('\n'):
        line = line.strip()
        # Skip comments and empty lines
        if not line or line.startswith('#'):
            continue

        # Match pattern: theme_name [x] or theme_name [ ]
        match = re.match(r'^(\w+)\s*\[(x| |X)?\]', line)
        if match:
            theme_name = match.group(1)
            is_selected = match.group(2) and match.group(2).lower() == 'x'
            themes.append(theme_name)
            if is_selected:
                if selected_theme:
                    print(f"  Warning: Multiple themes selected, using first: {selected_theme}")
                else:
                    selected_theme = theme_name

    if not themes:
        print(f"  Warning: No themes found in {THEME_FILE}, using default")
        return 'prototype', ['prototype']

    if not selected_theme:
        selected_theme = themes[0]
        print(f"  Warning: No theme selected in {THEME_FILE}, using: {selected_theme}")

    return selected_theme, themes


def validate_themes(selected_theme, themes):
    """Validate that theme CSS files exist."""
    errors = []
    warnings = []

    for theme in themes:
        theme_css = THEMES_DIR / f"{theme}.css"
        if not theme_css.exists():
            if theme == selected_theme:
                errors.append(f"Selected theme CSS not found: {theme_css}")
            else:
                warnings.append(f"Theme CSS not found: {theme_css}")

    return errors, warnings


def generate_theme_js(selected_theme, themes):
    """Generate the JavaScript theme configuration file."""
    theme_config = {
        'selected': selected_theme,
        'available': themes
    }

    lines = [
        '/**',
        ' * Andi VN - Theme Configuration',
        ' * ',
        ' * AUTO-GENERATED FILE - DO NOT EDIT MANUALLY',
        ' * Generated by tools/build_story_from_md.py',
        ' * ',
        ' * Edit theme.md to change the selected theme.',
        ' */',
        '',
        'const themeConfig = ' + json.dumps(theme_config, indent=2) + ';',
        '',
        '// Export for use by engine',
        'if (typeof module !== "undefined" && module.exports) {',
        '    module.exports = { themeConfig };',
        '}',
        ''
    ]

    return '\n'.join(lines)


def validate_scenes(scenes):
    """Validate that all target references exist."""
    errors = []
    warnings = []
    scene_ids = set(s['id'] for s in scenes)
    referenced_ids = set()

    for scene in scenes:
        # Check choice targets
        for choice in scene['choices']:
            target = choice['target']
            # _roll and _battle are special targets handled by the engine
            if target not in ('_roll', '_battle'):
                referenced_ids.add(target)
                if target not in scene_ids:
                    errors.append(f"Scene '{scene['id']}': choice target '{target}' does not exist")

        # Check action targets
        for action in scene.get('actions', []):
            if action.get('type') == 'roll_dice':
                for key in ['success_target', 'failure_target']:
                    target = action.get(key)
                    if target:
                        referenced_ids.add(target)
                        if target not in scene_ids:
                            errors.append(f"Scene '{scene['id']}': action {key} '{target}' does not exist")
            elif action.get('type') == 'start_battle':
                for key in ['victory_target', 'defeat_target', 'flee_target']:
                    target = action.get(key)
                    if target:
                        referenced_ids.add(target)
                        if target not in scene_ids:
                            errors.append(f"Scene '{scene['id']}': action {key} '{target}' does not exist")

    # Check for unreachable scenes (except 'start')
    unreachable = scene_ids - referenced_ids - {'start'}
    for scene_id in unreachable:
        warnings.append(f"Scene '{scene_id}' is never referenced (unreachable)")

    return errors, warnings


def parse_enemy_frontmatter(content):
    """Parse enemy file YAML frontmatter with support for nested dialogue and moves."""
    if not content.startswith('---'):
        return {}, content

    # Find the closing ---
    end_match = re.search(r'\n---\n', content[3:])
    if not end_match:
        return {}, content

    frontmatter_text = content[3:3 + end_match.start()]
    body = content[3 + end_match.end():]

    # Use a simple YAML-like parser that handles our specific format
    result = {}
    current_section = None
    current_subsection = None
    current_move = None
    current_summon = None
    dialogue = {}
    moves = []
    summons = []

    lines = frontmatter_text.split('\n')
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if not stripped or stripped.startswith('#'):
            i += 1
            continue

        indent = len(line) - len(line.lstrip())

        # Top-level key: value
        if indent == 0 and ':' in stripped:
            key, _, value = stripped.partition(':')
            key = key.strip()
            value = value.strip()

            # Save previous move/summon
            if current_move:
                moves.append(current_move)
                current_move = None
            if current_summon:
                summons.append(current_summon)
                current_summon = None

            if key == 'dialogue':
                current_section = 'dialogue'
                current_subsection = None
            elif key == 'moves':
                current_section = 'moves'
            elif key == 'summons':
                current_section = 'summons'
            elif value:
                # Simple key: value
                # Try to parse as number or float
                if value.isdigit():
                    value = int(value)
                else:
                    try:
                        value = float(value)
                        if value == int(value):
                            value = int(value)
                    except ValueError:
                        # Keep as string, handle booleans
                        if value.lower() == 'true':
                            value = True
                        elif value.lower() == 'false':
                            value = False
                result[key] = value
            else:
                current_section = key
            i += 1
            continue

        # Dialogue subsection (2 spaces)
        if current_section == 'dialogue' and indent == 2 and ':' in stripped:
            key, _, value = stripped.partition(':')
            key = key.strip()
            current_subsection = key
            dialogue[key] = []
            i += 1
            continue

        # Dialogue list item (4 spaces)
        if current_section == 'dialogue' and current_subsection and indent >= 4 and stripped.startswith('- '):
            item = stripped[2:].strip().strip('"').strip("'")
            dialogue[current_subsection].append(item)
            i += 1
            continue

        # Move list item (2 spaces, starts with - name:)
        if current_section == 'moves' and indent == 2 and stripped.startswith('- name:'):
            # Save previous move
            if current_move:
                moves.append(current_move)
            current_move = {'name': stripped[7:].strip()}
            i += 1
            continue

        # Move property (4 spaces)
        if current_section == 'moves' and current_move and indent >= 4:
            if ':' in stripped:
                key, _, value = stripped.partition(':')
                key = key.strip()
                value = value.strip()

                # Handle nested statusEffect
                if key == 'statusEffect' and value == '':
                    current_move['statusEffect'] = {}
                    i += 1
                    # Read nested properties
                    while i < len(lines):
                        nested_line = lines[i]
                        nested_stripped = nested_line.strip()
                        nested_indent = len(nested_line) - len(nested_line.lstrip())
                        if nested_indent < 6 or not nested_stripped:
                            break
                        if ':' in nested_stripped:
                            nk, _, nv = nested_stripped.partition(':')
                            nk = nk.strip()
                            nv = nv.strip()
                            # Parse value
                            if nv.isdigit():
                                nv = int(nv)
                            else:
                                try:
                                    nv = float(nv)
                                except ValueError:
                                    pass
                            current_move['statusEffect'][nk] = nv
                        i += 1
                    continue

                # Parse value
                if value.isdigit():
                    value = int(value)
                elif value.lower() == 'true':
                    value = True
                elif value.lower() == 'false':
                    value = False
                else:
                    try:
                        value = float(value)
                        if value == int(value):
                            value = int(value)
                    except ValueError:
                        pass
                current_move[key] = value
            i += 1
            continue

        # Summon list item (2 spaces, starts with - id:)
        if current_section == 'summons' and indent == 2 and stripped.startswith('- id:'):
            if current_summon:
                summons.append(current_summon)
            current_summon = {'id': stripped[5:].strip()}
            i += 1
            continue

        # Summon property (4 spaces)
        if current_section == 'summons' and current_summon and indent >= 4:
            if ':' in stripped:
                key, _, value = stripped.partition(':')
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                # Parse value
                if value.isdigit():
                    value = int(value)
                else:
                    try:
                        value = float(value)
                        if value == int(value):
                            value = int(value)
                    except ValueError:
                        pass
                current_summon[key] = value
            i += 1
            continue

        i += 1

    # Save final move/summon
    if current_move:
        moves.append(current_move)
    if current_summon:
        summons.append(current_summon)

    if dialogue:
        result['dialogue'] = dialogue
    if moves:
        result['moves'] = moves
    if summons:
        result['summons'] = summons

    return result, body


def parse_enemy_file(filepath):
    """Parse a single enemy .md file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    frontmatter, body = parse_enemy_frontmatter(content)

    # The body is the enemy description (optional flavor text)
    description = body.strip()
    if description:
        frontmatter['description'] = description

    return frontmatter


def generate_enemies_js(enemies):
    """Generate the JavaScript enemies file content."""
    # Build the enemies object
    enemies_dict = {}
    for enemy in enemies:
        enemies_dict[enemy['id']] = enemy

    # Generate JavaScript
    lines = [
        '/**',
        ' * Andi VN - Enemy Data',
        ' * ',
        ' * AUTO-GENERATED FILE - DO NOT EDIT MANUALLY',
        ' * Generated by tools/build_story_from_md.py',
        ' * ',
        ' * Edit enemy files in enemies/*.md instead.',
        ' */',
        '',
        'const enemies = ' + json.dumps(enemies_dict, indent=2) + ';',
        '',
        '// Export for use by engine',
        'if (typeof module !== "undefined" && module.exports) {',
        '    module.exports = { enemies };',
        '}',
        ''
    ]

    return '\n'.join(lines)


def generate_story_js(scenes):
    """Generate the JavaScript story file content."""
    # Build the story object
    story_dict = {}
    for scene in scenes:
        story_dict[scene['id']] = scene

    # Generate JavaScript
    lines = [
        '/**',
        ' * Andi VN - Story Data',
        ' * ',
        ' * AUTO-GENERATED FILE - DO NOT EDIT MANUALLY',
        ' * Generated by tools/build_story_from_md.py',
        ' * ',
        ' * Edit scene files in scenes/*.md instead.',
        ' */',
        '',
        'const story = ' + json.dumps(story_dict, indent=2) + ';',
        '',
        '// Export for use by engine',
        'if (typeof module !== "undefined" && module.exports) {',
        '    module.exports = { story };',
        '}',
        ''
    ]

    return '\n'.join(lines)


def main():
    """Main entry point."""
    print("Andi VN Story Builder")
    print("=" * 40)

    # === Process Theme Configuration ===
    print("\nProcessing theme configuration...")
    selected_theme, themes = parse_theme_file()
    print(f"  Selected theme: {selected_theme}")
    print(f"  Available themes: {', '.join(themes)}")

    # Validate themes
    theme_errors, theme_warnings = validate_themes(selected_theme, themes)

    for warning in theme_warnings:
        print(f"  Warning: {warning}")

    if theme_errors:
        print("\nTheme errors found:")
        for error in theme_errors:
            print(f"  Error: {error}")
        sys.exit(1)

    # Generate theme.js
    print(f"\nGenerating {THEME_OUTPUT_FILE}...")
    theme_content = generate_theme_js(selected_theme, themes)

    THEME_OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    with open(THEME_OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(theme_content)

    # === Process Scenes ===
    print("\n" + "=" * 40)
    print("Processing scenes...")

    # Check scenes directory exists
    if not SCENES_DIR.exists():
        print(f"Error: Scenes directory not found: {SCENES_DIR}")
        sys.exit(1)

    # Find all .md files
    md_files = list(SCENES_DIR.glob('*.md'))
    if not md_files:
        print(f"Error: No .md files found in {SCENES_DIR}")
        sys.exit(1)

    print(f"Found {len(md_files)} scene files")

    # Parse all scenes
    scenes = []
    for filepath in md_files:
        print(f"  Parsing: {filepath.name}")
        try:
            scene = parse_scene_file(filepath)
            scenes.append(scene)
        except Exception as e:
            print(f"    Error: {e}")
            sys.exit(1)

    # Check for duplicate IDs
    ids = [s['id'] for s in scenes]
    duplicates = [id for id in ids if ids.count(id) > 1]
    if duplicates:
        print(f"\nError: Duplicate scene IDs found: {set(duplicates)}")
        sys.exit(1)

    # Validate references
    print("\nValidating scene references...")
    errors, warnings = validate_scenes(scenes)

    for warning in warnings:
        print(f"  Warning: {warning}")

    if errors:
        print("\nErrors found:")
        for error in errors:
            print(f"  Error: {error}")
        sys.exit(1)

    # Generate output
    print(f"\nGenerating {OUTPUT_FILE}...")
    content = generate_story_js(scenes)

    # Ensure output directory exists
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        f.write(content)

    # === Process Enemies ===
    print("\n" + "=" * 40)
    print("Processing enemies...")

    enemies = []
    if ENEMIES_DIR.exists():
        enemy_files = list(ENEMIES_DIR.glob('*.md'))
        if enemy_files:
            print(f"Found {len(enemy_files)} enemy files")

            for filepath in enemy_files:
                print(f"  Parsing: {filepath.name}")
                try:
                    enemy = parse_enemy_file(filepath)
                    if 'id' not in enemy:
                        print(f"    Warning: No 'id' field, using filename: {filepath.stem}")
                        enemy['id'] = filepath.stem
                    enemies.append(enemy)
                except Exception as e:
                    print(f"    Error: {e}")
                    sys.exit(1)

            # Check for duplicate enemy IDs
            enemy_ids = [e['id'] for e in enemies]
            enemy_duplicates = [id for id in enemy_ids if enemy_ids.count(id) > 1]
            if enemy_duplicates:
                print(f"\nError: Duplicate enemy IDs found: {set(enemy_duplicates)}")
                sys.exit(1)

            # Generate enemies.js
            print(f"\nGenerating {ENEMIES_OUTPUT_FILE}...")
            enemies_content = generate_enemies_js(enemies)

            with open(ENEMIES_OUTPUT_FILE, 'w', encoding='utf-8') as f:
                f.write(enemies_content)
        else:
            print("  No enemy files found (optional)")
    else:
        print(f"  No enemies/ directory found (optional)")

    print(f"\nSuccess!")
    print(f"  Theme: {selected_theme} (from {len(themes)} available)")
    print(f"  Story: {len(scenes)} scenes")
    if enemies:
        print(f"  Enemies: {len(enemies)} enemies")
    print(f"  Output: {OUTPUT_FILE}")
    if enemies:
        print(f"  Enemies: {ENEMIES_OUTPUT_FILE}")
    print(f"  Theme config: {THEME_OUTPUT_FILE}")


if __name__ == '__main__':
    main()
