#!/usr/bin/env python3
"""
Generate a scene flow graph from Markdown scene files.
Outputs both text representation and Mermaid diagram.
"""

import os
import re
from pathlib import Path
from collections import defaultdict

SCENES_DIR = Path(__file__).parent.parent / "scenes"

def parse_scene(filepath):
    """Extract scene ID and target scenes from a markdown file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract scene ID from frontmatter
    id_match = re.search(r'^id:\s*(\S+)', content, re.MULTILINE)
    if not id_match:
        return None, []

    scene_id = id_match.group(1)
    targets = []

    # Find choices section and extract targets
    # Pattern: - Text → target_scene or - Text -> target_scene
    choice_pattern = re.compile(r'^-\s+.+?[→\->]+\s*(\S+)\s*$', re.MULTILINE)
    targets.extend(choice_pattern.findall(content))

    # Find action targets (success_target, failure_target, next, etc.)
    action_targets = re.findall(r'(?:success_target|failure_target|next|target):\s*(\S+)', content)
    targets.extend(action_targets)

    # Remove duplicates while preserving order
    seen = set()
    unique_targets = []
    for t in targets:
        if t not in seen:
            seen.add(t)
            unique_targets.append(t)

    return scene_id, unique_targets

def build_graph():
    """Build a graph of all scene connections."""
    graph = {}
    all_targets = set()

    for md_file in SCENES_DIR.glob("*.md"):
        scene_id, targets = parse_scene(md_file)
        if scene_id:
            graph[scene_id] = targets
            all_targets.update(targets)

    return graph, all_targets

def find_roots(graph, all_targets):
    """Find scenes that are not targeted by any other scene (entry points)."""
    all_sources = set(graph.keys())
    roots = all_sources - all_targets
    # 'start' should always be a root if it exists
    if 'start' in all_sources:
        roots.add('start')
    return roots

def find_endings(graph):
    """Find scenes with no outgoing connections (endings)."""
    return [s for s, targets in graph.items() if not targets]

def categorize_scenes(graph):
    """Categorize scenes by type based on naming conventions."""
    categories = {
        'start': [],
        'character': [],
        'battle': [],
        'victory': [],
        'defeat': [],
        'ending': [],
        'navigation': [],
        'other': []
    }

    for scene_id in graph.keys():
        lower_id = scene_id.lower()
        if scene_id == 'start':
            categories['start'].append(scene_id)
        elif 'ending' in lower_id or 'win_screen' in lower_id:
            categories['ending'].append(scene_id)
        elif 'victory' in lower_id:
            categories['victory'].append(scene_id)
        elif 'defeat' in lower_id:
            categories['defeat'].append(scene_id)
        elif 'battle' in lower_id or 'rematch' in lower_id:
            categories['battle'].append(scene_id)
        elif any(x in lower_id for x in ['floor', 'stairs', 'office', 'kitchen', 'cellar', 'rooftop', 'out', 'smoking', 'bbq', 'jk_r']):
            categories['navigation'].append(scene_id)
        elif scene_id.isupper() or scene_id.split('_')[0].isupper():
            categories['character'].append(scene_id)
        else:
            categories['other'].append(scene_id)

    return categories

def generate_mermaid(graph, categories):
    """Generate a Mermaid flowchart diagram."""
    lines = ["flowchart TD"]
    lines.append("    %% Style definitions")
    lines.append("    classDef startNode fill:#4CAF50,stroke:#2E7D32,color:#fff")
    lines.append("    classDef endNode fill:#f44336,stroke:#c62828,color:#fff")
    lines.append("    classDef battleNode fill:#FF9800,stroke:#EF6C00,color:#fff")
    lines.append("    classDef charNode fill:#2196F3,stroke:#1565C0,color:#fff")
    lines.append("    classDef navNode fill:#9E9E9E,stroke:#616161,color:#fff")
    lines.append("")

    # Add subgraphs for organization
    lines.append("    subgraph START [\"🏁 Start\"]")
    for s in categories['start']:
        lines.append(f"        {s}[{s}]")
    lines.append("    end")
    lines.append("")

    if categories['character']:
        lines.append("    subgraph CHARACTERS [\"👤 Characters\"]")
        for s in sorted(categories['character']):
            lines.append(f"        {s}[{s}]")
        lines.append("    end")
        lines.append("")

    if categories['battle']:
        lines.append("    subgraph BATTLES [\"⚔️ Battles\"]")
        for s in sorted(categories['battle']):
            lines.append(f"        {s}[{s}]")
        lines.append("    end")
        lines.append("")

    if categories['ending'] or categories['victory'] or categories['defeat']:
        lines.append("    subgraph ENDINGS [\"🎬 Endings\"]")
        for s in sorted(categories['ending'] + categories['victory'] + categories['defeat']):
            lines.append(f"        {s}[{s}]")
        lines.append("    end")
        lines.append("")

    # Add connections
    lines.append("    %% Connections")
    for source, targets in sorted(graph.items()):
        for target in targets:
            if target in graph:  # Only add edge if target exists
                lines.append(f"    {source} --> {target}")

    lines.append("")
    lines.append("    %% Apply styles")
    if categories['start']:
        lines.append(f"    class {','.join(categories['start'])} startNode")
    endings = categories['ending'] + categories['victory'] + categories['defeat']
    if endings:
        lines.append(f"    class {','.join(endings)} endNode")
    if categories['battle']:
        lines.append(f"    class {','.join(categories['battle'])} battleNode")
    if categories['character']:
        lines.append(f"    class {','.join(categories['character'])} charNode")

    return '\n'.join(lines)

def generate_simple_tree(graph):
    """Generate a simplified text tree showing main flow."""
    # Trace from start
    visited = set()

    def trace(scene_id, depth=0):
        if scene_id in visited or scene_id not in graph:
            return []
        visited.add(scene_id)

        indent = "    " * depth
        branch = "├── " if depth > 0 else ""
        lines = [f"{indent}{branch}{scene_id}"]

        targets = graph.get(scene_id, [])
        for i, target in enumerate(targets):
            if target in graph:
                is_last = (i == len(targets) - 1)
                sub_lines = trace(target, depth + 1)
                lines.extend(sub_lines)

        return lines

    return '\n'.join(trace('start'))

def main():
    print("Parsing scene files...")
    graph, all_targets = build_graph()
    categories = categorize_scenes(graph)

    print(f"\nFound {len(graph)} scenes")
    print(f"Entry points (roots): {find_roots(graph, all_targets)}")
    print(f"Endings (no exits): {find_endings(graph)}")

    print("\n" + "="*60)
    print("SCENE CATEGORIES")
    print("="*60)
    for cat, scenes in categories.items():
        if scenes:
            print(f"\n{cat.upper()} ({len(scenes)}):")
            for s in sorted(scenes):
                targets = graph.get(s, [])
                target_str = " → " + ", ".join(targets) if targets else " (end)"
                print(f"  • {s}{target_str}")

    # Generate Mermaid diagram
    mermaid = generate_mermaid(graph, categories)

    output_path = Path(__file__).parent.parent / "docs" / "scene_graph.md"
    output_path.parent.mkdir(exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        f.write("# Scene Flow Graph\n\n")
        f.write("This diagram shows how scenes connect in the game.\n\n")
        f.write("## Legend\n")
        f.write("- 🟢 **Green**: Start scene\n")
        f.write("- 🔴 **Red**: Endings (victory/defeat/ending scenes)\n")
        f.write("- 🟠 **Orange**: Battle scenes\n")
        f.write("- 🔵 **Blue**: Character encounter scenes\n")
        f.write("- ⬜ **Gray**: Navigation scenes\n\n")
        f.write("## Flow Diagram\n\n")
        f.write("```mermaid\n")
        f.write(mermaid)
        f.write("\n```\n")

    print(f"\n\nMermaid diagram saved to: {output_path}")
    print("\nYou can view this at: https://mermaid.live/")

    # Also print the mermaid code
    print("\n" + "="*60)
    print("MERMAID DIAGRAM CODE")
    print("="*60)
    print(mermaid)

if __name__ == "__main__":
    main()
