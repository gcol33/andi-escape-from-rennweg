#!/usr/bin/env python3
"""
Convert px units to rem in CSS files.

Conversion: 1rem = 16px (standard browser default)

Usage:
    python tools/px_to_rem.py css/themes/70s.css
    python tools/px_to_rem.py --themes  # Convert all theme files
"""

import re
import sys
from pathlib import Path

BASE_FONT_SIZE = 16

def px_to_rem(px_value):
    """Convert a px value to rem."""
    if px_value == 0:
        return "0"
    rem_value = px_value / BASE_FONT_SIZE
    if rem_value == int(rem_value):
        return f"{int(rem_value)}rem"
    formatted = f"{rem_value:.4f}".rstrip('0').rstrip('.')
    return f"{formatted}rem"

def convert_px_in_content(content):
    """Convert all px values in CSS content to rem."""
    def replace_px(match):
        number = match.group(1)
        is_negative = number.startswith('-')
        if is_negative:
            number = number[1:]
        try:
            px_val = float(number)
        except ValueError:
            return match.group(0)
        rem = px_to_rem(abs(px_val))
        if rem == "0":
            return "0"
        if is_negative:
            return f"-{rem}"
        return rem

    px_pattern = r'(-?\d*\.?\d+)px\b'
    return re.sub(px_pattern, replace_px, content)

def process_file(filepath):
    """Process a single CSS file."""
    print(f"Processing: {filepath}")
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    px_count_before = len(re.findall(r'\d+px', content))
    converted = convert_px_in_content(content)
    px_count_after = len(re.findall(r'\d+px', converted))
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(converted)
    print(f"  Converted {px_count_before - px_count_after} px values")
    return px_count_before - px_count_after

def main():
    if len(sys.argv) < 2:
        print("Usage: python px_to_rem.py <file.css> | --themes")
        sys.exit(1)

    script_dir = Path(__file__).parent
    project_root = script_dir.parent

    if sys.argv[1] == "--themes":
        css_files = list(project_root.glob("css/themes/*.css"))
    else:
        css_files = [Path(sys.argv[1])]

    total = 0
    for f in sorted(css_files):
        if f.exists():
            total += process_file(f)
    print(f"\nTotal: {total} px values converted")

if __name__ == "__main__":
    main()
