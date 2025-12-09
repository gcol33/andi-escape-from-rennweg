"""
Generate a PDF listing photos needed for Andi VN
All current assets are placeholders - we need real photos of everything!
"""
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import cm

# Output path
output_path = r"c:\Users\Gilles Colling\Documents\DevGames\Andi\PHOTO_LIST.pdf"

doc = SimpleDocTemplate(output_path, pagesize=A4,
                        leftMargin=1.5*cm, rightMargin=1.5*cm,
                        topMargin=1.5*cm, bottomMargin=1.5*cm)

styles = getSampleStyleSheet()
title_style = ParagraphStyle('CustomTitle', parent=styles['Title'], fontSize=22, spaceAfter=20)
heading_style = ParagraphStyle('CustomHeading', parent=styles['Heading1'], fontSize=14, spaceBefore=15, spaceAfter=8, textColor=colors.darkblue)
normal_style = ParagraphStyle('CustomNormal', parent=styles['Normal'], fontSize=10)
cell_style = ParagraphStyle('CellStyle', parent=styles['Normal'], fontSize=9)

story = []

# Title
story.append(Paragraph("Andi VN - Photo Shooting List", title_style))
story.append(Spacer(1, 15))

# =============================================================================
# SECTION 1: CHARACTER PHOTOS
# =============================================================================
story.append(Paragraph("Section 1: People Photos", heading_style))
story.append(Spacer(1, 8))

characters = [
    ("Adrian", "neutral, smiling/teaching, explaining gesture"),
    ("Agnes", "neutral, happy, angry, blocking/defensive, surprised, victorious"),
    ("Anna", "neutral, mysterious, offering tea, trippy/psychedelic expression"),
    ("Didi", "neutral, excited (TV fan), typing/email pose"),
    ("Emma", "neutral, nervous/anxious, driving pose (hands on wheel)"),
    ("Franz", "neutral, skeptical eyebrow, impressed, oracle-like mysterious"),
    ("Jacqueline", "neutral, helpful smile, carrying boxes pose"),
    ("Jen", "neutral, excited/enthusiastic, badge reveal (undercover cop)"),
    ("Johannes", "neutral, friendly"),
    ("Joni", "neutral, desperate/stressed, forced toxic-positivity smile"),
    ("Karl", "neutral, friendly"),
    ("Lisa", "neutral, startled (mouse!), chasing/running pose"),
    ("Michi", "neutral, confrontational/blocking, defeated, whiteboard pose"),
    ("Moritz", "neutral, excited about plants, quiz master pose"),
    ("Siegrun", "neutral, expedition leader pose, eating from tube"),
    ("Stefan", "neutral, server room tech pose, dramatic Hercules reveal"),
    ("Wolfgang", "neutral, explaining FloraWiki, spooky ghost story pose"),
]

# Build character table
char_data = [["Name", "Expressions/Poses Needed"]]
for char, expressions in characters:
    char_data.append([char, Paragraph(expressions, cell_style)])

char_table = Table(char_data, colWidths=[3.5*cm, 13*cm])
char_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, 0), 10),
    ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
    ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
    ('TOPPADDING', (0, 0), (-1, 0), 8),
    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ('TOPPADDING', (0, 1), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.Color(0.95, 0.95, 0.95)]),
]))
story.append(char_table)

story.append(Spacer(1, 15))
story.append(Paragraph("Group Shots", heading_style))
story.append(Spacer(1, 8))

groups = [
    ("DnD basement", "Group shot of D&D players in basement setting"),
    ("Smokers corner", "Group at outdoor smoking area"),
    ("Billa exterior", "Billa supermarket storefront from outside"),
]

group_data = [["Location", "Description"]]
for loc, desc in groups:
    group_data.append([loc, desc])

group_table = Table(group_data, colWidths=[4*cm, 12.5*cm])
group_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, 0), 10),
    ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
    ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
    ('TOPPADDING', (0, 0), (-1, 0), 8),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ('TOPPADDING', (0, 1), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.Color(0.95, 0.95, 0.95)]),
]))
story.append(group_table)

# =============================================================================
# SECTION 2: BACKGROUND PHOTOS
# =============================================================================
story.append(PageBreak())
story.append(Paragraph("Section 2: Backgrounds at Rennweg", heading_style))
story.append(Spacer(1, 5))
story.append(Paragraph("<b>Format:</b> LANDSCAPE orientation preferred (16:9 aspect ratio). Take multiple shots of each location from different angles - more is better!", normal_style))
story.append(Spacer(1, 8))

backgrounds = [
    # Offices & Desks
    ("Andi's office - wide shot", "Full desk with multiple monitors, messy papers, cold lighting"),
    ("Andi's office - detail", "Close-up of desk clutter, coffee cups, sticky notes"),
    ("Generic office - bright", "First floor office with natural light, papers and books"),
    ("Generic office - dim", "Same office with blinds closed, monitor glow only"),

    # Corridors & Hallways
    ("Corridor - main", "First floor corridor with office doors, overhead lights"),
    ("Corridor - perspective", "Long shot down hallway, vanishing point composition"),
    ("Corridor - corner", "Hallway intersection or corner area"),
    ("Hallway - 4th floor", "Upper floor hallway, different decor if applicable"),

    # Stairwells
    ("Stairwell - landing", "Main stairwell landing with window light"),
    ("Stairwell - looking up", "View looking up the staircase spiral"),
    ("Stairwell - looking down", "View looking down, slightly ominous"),
    ("Back stairs - dim", "Darker back stairwell near basement access"),

    # Special Rooms
    ("Kitchen - wide", "Full break room with coffee machine, table, chairs"),
    ("Kitchen - coffee machine", "Close-up of coffee machine area"),
    ("Meeting room - whiteboard", "Room with whiteboard visible, meeting table"),
    ("Meeting room - empty", "Same room from different angle, chairs around table"),

    # Outdoor - Rennweg
    ("Street - building front", "Rennweg street view showing building entrance"),
    ("Street - tram passing", "Street scene with tram if possible, Vienna atmosphere"),
    ("Courtyard - exit", "Side exit courtyard, shaded area"),
    ("Courtyard - garden view", "View toward Botanical Garden from courtyard"),

    # Rooftop
    ("Rooftop - BBQ setup", "Rooftop terrace with grill, chairs, party setup"),
    ("Rooftop - city view", "View from rooftop over Vienna rooftops"),
    ("Rooftop - gathering", "Area where people would stand/mingle"),

    # Smokers Corner
    ("Smokers corner - day", "Outdoor smoking area in daylight"),
    ("Smokers corner - shade", "Same area but in shadow or evening light"),

    # Elevator
    ("Elevator - exterior", "Elevator doors from hallway, call button visible"),
    ("Elevator - interior", "Inside elevator with button panel, mirror if present"),
    ("Elevator - doors opening", "Moment of doors opening, dramatic potential"),

    # Basement
    ("Basement - corridor", "Basement hallway, pipes visible, industrial feel"),
    ("Basement - storage", "Storage area or cellar section"),
    ("Server room - racks", "Server equipment, blinking lights, cables"),
    ("Server room - terminal", "Workstation or terminal in server room"),

    # Misc Atmospheric
    ("Window - afternoon light", "Any window with nice afternoon sunlight streaming in"),
    ("Door - office nameplate", "Close-up of office door with nameplate"),
]

# Build background table
bg_data = [["Location", "Description"]]
for filename, desc in backgrounds:
    bg_data.append([filename, desc])

bg_table = Table(bg_data, colWidths=[5.5*cm, 11*cm])
bg_table.setStyle(TableStyle([
    ('BACKGROUND', (0, 0), (-1, 0), colors.darkblue),
    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
    ('FONTSIZE', (0, 0), (-1, 0), 10),
    ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
    ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
    ('TOPPADDING', (0, 0), (-1, 0), 8),
    ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
    ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ('TOPPADDING', (0, 1), (-1, -1), 4),
    ('BOTTOMPADDING', (0, 1), (-1, -1), 4),
    ('FONTNAME', (0, 1), (0, -1), 'Courier'),
    ('FONTSIZE', (0, 1), (0, -1), 8),
    ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.Color(0.95, 0.95, 0.95)]),
]))
story.append(bg_table)

# Build PDF
doc.build(story)
print(f"PDF generated: {output_path}")
