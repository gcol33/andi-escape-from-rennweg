#!/usr/bin/env python3
"""
Generate centered password fonts from existing fonts.

This script extracts A-Z and 0-9 characters from pixel/display fonts,
centers each glyph horizontally within a uniform advance width,
and saves new font files optimized for password input fields.

Requirements:
    pip install fonttools

Usage:
    python generate_password_fonts.py
"""

import os
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.t2CharStringPen import T2CharStringPen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.subset import Subsetter, Options
from fontTools.ttLib.tables._g_l_y_f import GlyphCoordinates
import copy


# Configuration: fonts to process and their output names
FONTS_TO_PROCESS = [
    {
        'input': 'Press_Start_2P/PressStart2P-Regular.ttf',
        'output': 'PressStart2P-Password.ttf',
        'family_name': 'Press Start 2P Password',
    },
    {
        'input': 'VT323/VT323-Regular.ttf',
        'output': 'VT323-Password.ttf',
        'family_name': 'VT323 Password',
    },
    {
        'input': 'Share_Tech_Mono/ShareTechMono-Regular.ttf',
        'output': 'ShareTechMono-Password.ttf',
        'family_name': 'Share Tech Mono Password',
    },
]

# Characters to include in password font
PASSWORD_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'


def get_glyph_bounds(font, glyph_name):
    """Get the actual bounding box of a glyph."""
    glyf_table = font.get('glyf')
    if glyf_table and glyph_name in glyf_table:
        glyph = glyf_table[glyph_name]
        if hasattr(glyph, 'xMin') and glyph.numberOfContours > 0:
            return glyph.xMin, glyph.yMin, glyph.xMax, glyph.yMax
    return None


def center_glyphs(font, target_width=None):
    """
    Center all glyphs horizontally within their advance width.

    For each glyph:
    1. Calculate the actual drawn width (xMax - xMin)
    2. Calculate the offset needed to center it
    3. Shift all contour points by that offset
    """
    glyf_table = font.get('glyf')
    hmtx_table = font.get('hmtx')

    if not glyf_table or not hmtx_table:
        print("  Warning: Missing glyf or hmtx table, skipping centering")
        return

    # Find the maximum glyph width to use as uniform width if not specified
    if target_width is None:
        max_width = 0
        for char in PASSWORD_CHARS:
            glyph_name = font.getBestCmap().get(ord(char))
            if glyph_name and glyph_name in glyf_table:
                bounds = get_glyph_bounds(font, glyph_name)
                if bounds:
                    width = bounds[2] - bounds[0]
                    max_width = max(max_width, width)
        # Use max width + some padding as the uniform advance width
        target_width = max_width + int(max_width * 0.4)
        print(f"  Using calculated target width: {target_width}")

    cmap = font.getBestCmap()

    for char in PASSWORD_CHARS:
        glyph_name = cmap.get(ord(char))
        if not glyph_name or glyph_name not in glyf_table:
            print(f"  Warning: Glyph for '{char}' not found")
            continue

        glyph = glyf_table[glyph_name]

        # Skip empty glyphs
        if not hasattr(glyph, 'xMin') or glyph.numberOfContours <= 0:
            continue

        # Get current metrics
        advance_width, lsb = hmtx_table[glyph_name]

        # Calculate actual glyph width
        glyph_width = glyph.xMax - glyph.xMin

        # Calculate the new left side bearing to center the glyph
        new_lsb = int((target_width - glyph_width) / 2)

        # Calculate how much to shift the glyph
        shift = new_lsb - glyph.xMin

        if shift != 0:
            # Shift all coordinates in the glyph using proper GlyphCoordinates
            if hasattr(glyph, 'coordinates') and glyph.coordinates is not None:
                coords = glyph.coordinates
                # Create new coordinates with shift applied
                new_coords = [(x + shift, y) for x, y in coords]
                # Convert back to GlyphCoordinates
                glyph.coordinates = GlyphCoordinates(new_coords)

            # Update the bounds
            glyph.xMin += shift
            glyph.xMax += shift

        # Update the horizontal metrics
        hmtx_table[glyph_name] = (target_width, new_lsb)

        print(f"  '{char}': width={glyph_width}, advance={advance_width}->{target_width}, lsb={lsb}->{new_lsb}")


def subset_font(font, chars):
    """Subset font to only include specified characters."""
    options = Options()
    options.layout_features = ['*']  # Keep all layout features
    options.name_IDs = ['*']  # Keep all name records
    options.notdef_outline = True
    options.recommended_glyphs = True

    subsetter = Subsetter(options=options)
    subsetter.populate(text=chars)
    subsetter.subset(font)


def update_font_names(font, family_name):
    """Update the font's name table with new family name."""
    name_table = font['name']

    # Name IDs to update:
    # 1 = Font Family name
    # 4 = Full font name
    # 6 = PostScript name
    # 16 = Typographic Family name

    for record in name_table.names:
        if record.nameID == 1:  # Family name
            record.string = family_name
        elif record.nameID == 4:  # Full name
            record.string = family_name
        elif record.nameID == 6:  # PostScript name
            record.string = family_name.replace(' ', '')
        elif record.nameID == 16:  # Typographic Family name
            record.string = family_name


def process_font(input_path, output_path, family_name):
    """Process a single font file."""
    print(f"\nProcessing: {input_path}")

    if not os.path.exists(input_path):
        print(f"  Error: Input file not found: {input_path}")
        return False

    try:
        # Load the font
        font = TTFont(input_path)

        # Subset to password characters only
        print("  Subsetting font...")
        subset_font(font, PASSWORD_CHARS + PASSWORD_CHARS.lower())

        # Center all glyphs
        print("  Centering glyphs...")
        center_glyphs(font)

        # Update font names
        print("  Updating font names...")
        update_font_names(font, family_name)

        # Save the modified font
        print(f"  Saving to: {output_path}")
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        font.save(output_path)

        font.close()
        print("  Done!")
        return True

    except Exception as e:
        print(f"  Error processing font: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    # Get paths
    script_dir = Path(__file__).parent
    fonts_dir = script_dir.parent / 'assets' / 'fonts'
    output_dir = fonts_dir / 'password'

    print("=" * 60)
    print("Password Font Generator")
    print("=" * 60)
    print(f"Fonts directory: {fonts_dir}")
    print(f"Output directory: {output_dir}")
    print(f"Characters: {PASSWORD_CHARS}")

    # Process each font
    success_count = 0
    for font_config in FONTS_TO_PROCESS:
        input_path = fonts_dir / font_config['input']
        output_path = output_dir / font_config['output']

        if process_font(str(input_path), str(output_path), font_config['family_name']):
            success_count += 1

    print("\n" + "=" * 60)
    print(f"Completed: {success_count}/{len(FONTS_TO_PROCESS)} fonts processed")
    print("=" * 60)

    if success_count > 0:
        print("\nNext steps:")
        print("1. Add @font-face declarations for the new fonts in your CSS")
        print("2. Update .password-char to use the new font families")
        print("\nExample CSS:")
        print("""
@font-face {
    font-family: 'Press Start 2P Password';
    src: url('../../assets/fonts/password/PressStart2P-Password.ttf') format('truetype');
}

.password-char {
    font-family: 'Press Start 2P Password', monospace;
}
""")


if __name__ == '__main__':
    main()
