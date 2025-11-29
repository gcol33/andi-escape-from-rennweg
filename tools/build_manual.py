#!/usr/bin/env python3
"""
build_manual.py - Generates an old-school 90s-style contributor manual for Andi VN

Creates an HTML manual with:
- Annotated screenshot of the editor (biology textbook style)
- Authentic 90s aesthetic (Windows 3.1 / early Mac)
- Step-by-step guide for contributors

Run: python tools/build_manual.py
Output: docs/CONTRIBUTOR_MANUAL.html
"""

import os
import base64
from pathlib import Path
from datetime import datetime

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUTPUT_DIR = PROJECT_ROOT / "docs"
SCREENSHOT_PATH = OUTPUT_DIR / "editor_screenshot.png"


def get_screenshot_base64():
    """Load the editor screenshot and return as base64."""
    if SCREENSHOT_PATH.exists():
        with open(SCREENSHOT_PATH, "rb") as f:
            return base64.b64encode(f.read()).decode("utf-8")
    return None


def get_introduction():
    """Generate the introduction explaining the basic concept."""
    return '''
<div class="win-window intro-window">
    <div class="win-titlebar">
        <span class="win-title">🎬 How to Make a Scene</span>
        <div class="win-buttons"><span>−</span><span>□</span><span>×</span></div>
    </div>
    <div class="win-content">
        <p>For Andy's farewell we're making a <strong>visual novel</strong> (VN). It's an interactive story where players read text and make choices that affect what happens next.</p>

        <div class="concept-diagram">
            <div class="concept-box">
                <div class="concept-icon">📖</div>
                <div class="concept-label">Your Story</div>
                <div class="concept-desc">A moment, a scene, some dialogue</div>
            </div>
            <div class="concept-arrow">+</div>
            <div class="concept-box">
                <div class="concept-icon">🖼️</div>
                <div class="concept-label">A Background</div>
                <div class="concept-desc">Photo of a location (JPG)</div>
            </div>
            <div class="concept-arrow">+</div>
            <div class="concept-box">
                <div class="concept-icon">👤</div>
                <div class="concept-label">Characters</div>
                <div class="concept-desc">Optional sprite images (PNG/SVG)</div>
            </div>
            <div class="concept-arrow">=</div>
            <div class="concept-box concept-result">
                <div class="concept-icon">🎬</div>
                <div class="concept-label">A Scene!</div>
                <div class="concept-desc">One part of the game</div>
            </div>
        </div>

        <p>The game is made of <strong>scenes</strong> linked together by <strong>choices</strong>. Each scene is a simple text file.</p>

        <div class="how-it-works">
            <div class="how-title">HOW THE BUILD WORKS:</div>
            <div class="build-diagram">
                <div class="build-step">
                    <div class="build-icon">📝</div>
                    <div class="build-label">.md files</div>
                    <div class="build-desc">Your scene files<br>(easy to edit)</div>
                </div>
                <div class="build-arrow">→</div>
                <div class="build-step">
                    <div class="build-icon">⚙️</div>
                    <div class="build-label">Build Script</div>
                    <div class="build-desc">Combines all scenes<br>into one file</div>
                </div>
                <div class="build-arrow">→</div>
                <div class="build-step">
                    <div class="build-icon">🎮</div>
                    <div class="build-label">story.js</div>
                    <div class="build-desc">The game loads<br>this to play</div>
                </div>
            </div>
            <p class="build-why"><strong>Why not just make a huge HTML salad?</strong> Separate .md files are easier to write, easier to review, and let multiple people work on different scenes without conflicts. The build script validates everything and catches errors before the game breaks.</p>
        </div>

        <div class="workflow-box">
            <div class="workflow-title">YOUR WORKFLOW:</div>
            <div class="workflow-steps">
                <div class="workflow-step">
                    <span class="workflow-num">1</span>
                    <span>Write your story text</span>
                </div>
                <div class="workflow-step">
                    <span class="workflow-num">2</span>
                    <span>Pick a background image</span>
                </div>
                <div class="workflow-step">
                    <span class="workflow-num">3</span>
                    <span>Add character sprites (optional)</span>
                </div>
                <div class="workflow-step">
                    <span class="workflow-num">4</span>
                    <span>Define player choices</span>
                </div>
                <div class="workflow-step">
                    <span class="workflow-num">5</span>
                    <span>Save &amp; run the build script</span>
                </div>
            </div>
        </div>

        <div class="two-options">
            <div class="option-intro">
                <div class="option-header">TWO WAYS TO CREATE SCENES:</div>
                <div class="option-cards">
                    <div class="option-card">
                        <div class="option-card-title">Option A: Visual Editor</div>
                        <div class="option-card-desc">Point-and-click interface with live preview and story graph. Outputs .md files.</div>
                        <div class="option-card-link">See <strong>Figure 1</strong> below</div>
                    </div>
                    <div class="option-card">
                        <div class="option-card-title">Option B: Edit Text Files</div>
                        <div class="option-card-desc">Write .md files directly in any text editor. More control, same result.</div>
                        <div class="option-card-link">See <strong>Figure 2</strong> below</div>
                    </div>
                </div>
            </div>
        </div>

        <p>Both methods produce the same <code>.md</code> scene files. Pick whichever you prefer!</p>
    </div>
</div>
'''


def get_annotated_screenshot():
    """Generate the annotated screenshot section with SVG overlays."""
    screenshot_b64 = get_screenshot_base64()

    if not screenshot_b64:
        return '''
<div class="win-window">
    <div class="win-titlebar">
        <span class="win-title">⚠️ Screenshot Not Found</span>
    </div>
    <div class="win-content">
        <p>Run <code>node tools/screenshot_editor.js</code> first to generate the screenshot.</p>
    </div>
</div>
'''

    # SVG annotations positioned over the screenshot
    # Based on the actual editor layout from the screenshot (showing demo_battle scene with battle config)
    return f'''
<div class="figure-box">
    <div class="figure-title">Figure 1: Visual Editor (Option A)</div>
    <p class="figure-intro">The editor is a helper tool that creates <code>.md</code> files for you. It includes a <strong>live preview</strong> of how your scene will look and a <strong>graph view</strong> showing how scenes connect together. Open <a href="https://gillescolling.com/andi-escape-from-rennweg/editor/index.html" target="_blank">the editor</a> in your browser to use it.</p>
    <div class="annotated-image">
        <img src="data:image/png;base64,{screenshot_b64}" alt="Editor Screenshot" class="screenshot">
        <svg class="annotations" viewBox="0 0 1400 900" preserveAspectRatio="xMidYMid meet">
            <!-- Annotation lines and labels -->

            <!-- Definitions for 90s-style callouts -->
            <defs>
                <!-- Beveled box filter for that classic look -->
                <filter id="bevel" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="1" dy="1" stdDeviation="0" flood-color="white" flood-opacity="1"/>
                    <feDropShadow dx="-1" dy="-1" stdDeviation="0" flood-color="#808080" flood-opacity="1"/>
                </filter>
            </defs>

            <!-- 1. Scene List (left sidebar) - box far left, line points right to sidebar -->
            <line x1="38" y1="350" x2="120" y2="350" class="annotation-line"/>
            <rect x="2" y="332" width="36" height="36" class="annotation-box"/>
            <rect x="4" y="334" width="32" height="32" class="annotation-box-inner"/>
            <text x="20" y="357" class="annotation-number">1</text>

            <!-- 2. New Scene Button - box top-left corner, line points down to button -->
            <line x1="165" y1="70" x2="165" y2="32" class="annotation-line"/>
            <rect x="147" y="70" width="36" height="36" class="annotation-box"/>
            <rect x="149" y="72" width="32" height="32" class="annotation-box-inner"/>
            <text x="165" y="95" class="annotation-number">2</text>

            <!-- 3. Canvas Preview - box top center, line points down to canvas -->
            <line x1="640" y1="100" x2="640" y2="140" class="annotation-line"/>
            <rect x="622" y="64" width="36" height="36" class="annotation-box"/>
            <rect x="624" y="66" width="32" height="32" class="annotation-box-inner"/>
            <text x="640" y="89" class="annotation-number">3</text>

            <!-- 4. Text Block Area - box left of text area, line points right -->
            <line x1="250" y1="490" x2="290" y2="490" class="annotation-line"/>
            <rect x="214" y="472" width="36" height="36" class="annotation-box"/>
            <rect x="216" y="474" width="32" height="32" class="annotation-box-inner"/>
            <text x="232" y="497" class="annotation-number">4</text>

            <!-- 5. Block Navigation - box above block controls, line points down -->
            <line x1="360" y1="395" x2="360" y2="420" class="annotation-line"/>
            <rect x="342" y="359" width="36" height="36" class="annotation-box"/>
            <rect x="344" y="361" width="32" height="32" class="annotation-box-inner"/>
            <text x="360" y="384" class="annotation-number">5</text>

            <!-- 6. Scene Flow - box below graph, line points up -->
            <line x1="640" y1="735" x2="640" y2="680" class="annotation-line"/>
            <rect x="622" y="735" width="36" height="36" class="annotation-box"/>
            <rect x="624" y="737" width="32" height="32" class="annotation-box-inner"/>
            <text x="640" y="760" class="annotation-number">6</text>

            <!-- 7. Sprite Palette - box bottom left of sprites, line points right -->
            <line x1="250" y1="810" x2="290" y2="810" class="annotation-line"/>
            <rect x="214" y="792" width="36" height="36" class="annotation-box"/>
            <rect x="216" y="794" width="32" height="32" class="annotation-box-inner"/>
            <text x="232" y="817" class="annotation-number">7</text>

            <!-- 8. Scene Info - box far right, pointing to Input (Coming From) section -->
            <line x1="1360" y1="70" x2="1200" y2="70" class="annotation-line"/>
            <rect x="1360" y="52" width="36" height="36" class="annotation-box"/>
            <rect x="1362" y="54" width="32" height="32" class="annotation-box-inner"/>
            <text x="1378" y="77" class="annotation-number">8</text>

            <!-- 9. Flags & Items - box far right, pointing to Set Flags / Add Items area -->
            <line x1="1360" y1="220" x2="1200" y2="220" class="annotation-line"/>
            <rect x="1360" y="202" width="36" height="36" class="annotation-box"/>
            <rect x="1362" y="204" width="32" height="32" class="annotation-box-inner"/>
            <text x="1378" y="227" class="annotation-number">9</text>

            <!-- 10. Actions - box far right, pointing to the Battle config panel -->
            <line x1="1360" y1="520" x2="1220" y2="520" class="annotation-line"/>
            <rect x="1360" y="502" width="46" height="36" class="annotation-box"/>
            <rect x="1362" y="504" width="42" height="32" class="annotation-box-inner"/>
            <text x="1383" y="527" class="annotation-number">10</text>

            <!-- 11. Action Buttons - box far right, pointing to + Dice Roll / + Battle buttons -->
            <line x1="1360" y1="760" x2="1220" y2="760" class="annotation-line"/>
            <rect x="1360" y="742" width="46" height="36" class="annotation-box"/>
            <rect x="1362" y="744" width="42" height="32" class="annotation-box-inner"/>
            <text x="1383" y="767" class="annotation-number">11</text>

            <!-- 12. Toolbar - box top right of toolbar, line points left down to buttons -->
            <line x1="1000" y1="32" x2="960" y2="32" class="annotation-line"/>
            <rect x="1000" y="14" width="46" height="36" class="annotation-box"/>
            <rect x="1002" y="16" width="42" height="32" class="annotation-box-inner"/>
            <text x="1023" y="39" class="annotation-number">12</text>
        </svg>
    </div>

    <div class="figure-legend">
        <table class="legend-table">
            <tr>
                <td><span class="legend-num">1</span></td>
                <td><strong>Scene List</strong> — All your scenes. Click to edit. Yellow dot = unsaved changes.</td>
            </tr>
            <tr>
                <td><span class="legend-num">2</span></td>
                <td><strong>+ New Scene</strong> — Click to create a brand new scene.</td>
            </tr>
            <tr>
                <td><span class="legend-num">3</span></td>
                <td><strong>Canvas Preview</strong> — See how your scene looks! Background fills the area, characters appear in center.</td>
            </tr>
            <tr>
                <td><span class="legend-num">4</span></td>
                <td><strong>Text Block</strong> — Write your story here. This is what players read!</td>
            </tr>
            <tr>
                <td><span class="legend-num">5</span></td>
                <td><strong>Block Navigation</strong> — Use ← → to move between text blocks. Each block = one "Continue" click.</td>
            </tr>
            <tr>
                <td><span class="legend-num">6</span></td>
                <td><strong>Scene Flow</strong> — Shows which scenes connect to this one (incoming) and where choices lead (outgoing).</td>
            </tr>
            <tr>
                <td><span class="legend-num">7</span></td>
                <td><strong>Sprite Palette</strong> — Drag character sprites onto the canvas to add them.</td>
            </tr>
            <tr>
                <td><span class="legend-num">8</span></td>
                <td><strong>Scene Info</strong> — Shows incoming connections and lets you set background/music (scroll up).</td>
            </tr>
            <tr>
                <td><span class="legend-num">9</span></td>
                <td><strong>Flags & Items</strong> — Set/require flags, add/remove items when entering this scene.</td>
            </tr>
            <tr>
                <td><span class="legend-num">10</span></td>
                <td><strong>Actions</strong> — Configure dice rolls or battles! Shows enemy stats, targets for victory/defeat/flee.</td>
            </tr>
            <tr>
                <td><span class="legend-num">11</span></td>
                <td><strong>Action Buttons</strong> — Click "+ Dice Roll" or "+ Battle" to add game mechanics to your scene.</td>
            </tr>
            <tr>
                <td><span class="legend-num">12</span></td>
                <td><strong>Toolbar</strong> — Graph view, Preview in game, Save, Download, Export All.</td>
            </tr>
        </table>
    </div>
</div>
'''


def get_scene_file_diagram():
    """Generate an annotated example of a scene markdown file - clearer layout."""
    return '''
<div class="figure-box">
    <div class="figure-title">Figure 2: Text File Format (Option B)</div>

    <p class="figure-intro">Each scene is a simple <code>.md</code> text file you can edit in any text editor (Notepad, VS Code, etc.). Here's what each part does:</p>

    <div class="code-explained">
        <div class="code-section">
            <div class="code-section-label">
                <span class="section-num">1</span>
                <strong>FRONTMATTER</strong> Scene settings (between <code>---</code> marks)
            </div>
            <pre class="retro-code"><span class="kw">---</span>
<span class="key">id:</span> <span class="val">kitchen_scene</span>        <span class="comment">← Unique name for this scene</span>
<span class="key">bg:</span> <span class="val">office_kitchen.jpg</span>   <span class="comment">← Background image file</span>
<span class="key">music:</span> <span class="val">coffee.mp3</span>         <span class="comment">← Background music (optional)</span>
<span class="key">chars:</span>                      <span class="comment">← Characters to show (optional)</span>
  <span class="val">- agnes_happy.svg</span>
<span class="kw">---</span></pre>
        </div>

        <div class="code-section">
            <div class="code-section-label">
                <span class="section-num">2</span>
                <strong>TEXT BLOCKS</strong> What the player reads (separated by <code>---</code>)
            </div>
            <pre class="retro-code"><span class="txt">You walk into the kitchen. The smell of</span>
<span class="txt">fresh coffee fills the air.</span>

<span class="sep">---</span>                             <span class="comment">← Player clicks "Continue"</span>

<span class="txt">Agnes waves at you from the coffee machine.</span>
<span class="txt">"Good morning!" she says cheerfully.</span></pre>
        </div>

        <div class="code-section">
            <div class="code-section-label">
                <span class="section-num">3</span>
                <strong>CHOICES</strong> What the player can do next
            </div>
            <pre class="retro-code"><span class="hdr">### Choices</span>

<span class="cho">- Wave back and chat</span> <span class="arr">→</span> <span class="tgt">talk_agnes</span>           <span class="comment">← Goes to scene "talk_agnes"</span>
<span class="cho">- Leave quietly</span> <span class="sfx">[sfx: door.ogg]</span> <span class="arr">→</span> <span class="tgt">hallway</span>   <span class="comment">← With sound effect!</span></pre>
        </div>

        <div class="code-section">
            <div class="code-section-label">
                <span class="section-num">4</span>
                <strong>FLAGS</strong> Remember player choices (optional but useful!)
            </div>
            <pre class="retro-code"><span class="comment">In frontmatter, SET a flag when something happens:</span>
<span class="key">set_flags:</span>
  <span class="val">- talked_to_agnes</span>

<span class="comment">In choices, REQUIRE a flag to show an option:</span>
<span class="cho">- Ask about the secret</span> <span class="flag">(requires: talked_to_agnes)</span> <span class="arr">→</span> <span class="tgt">secret_info</span></pre>
        </div>
    </div>

    <div class="sprite-placement-box">
        <div class="sprite-placement-title">🎭 SPRITE PLACEMENT</div>
        <p>Two ways to place character sprites:</p>
        <div class="sprite-methods">
            <div class="sprite-method">
                <div class="sprite-method-title">Simple (auto-centered)</div>
                <pre class="retro-code-small"><span class="key">chars:</span>
  <span class="val">- agnes_happy.svg</span>
  <span class="val">- fabio_friendly.svg</span></pre>
                <p class="sprite-method-desc">Sprites placed side-by-side, centered, evenly spaced</p>
            </div>
            <div class="sprite-method">
                <div class="sprite-method-title">With position</div>
                <pre class="retro-code-small"><span class="key">chars:</span>
  <span class="val">- file:</span> agnes_happy.svg
    <span class="val">x:</span> 200
    <span class="val">y:</span> 100
    <span class="val">scale:</span> 1.2</pre>
                <p class="sprite-method-desc">x/y = position, scale = size (1.0 = normal)</p>
            </div>
        </div>
        <div class="tip-box">
            <span class="tip-icon">💡</span>
            <span>Easier method: Use the <strong>Visual Editor</strong> to drag sprites where you want them!</span>
        </div>
    </div>

    <div class="anatomy-key">
        <div class="key-title">QUICK REFERENCE:</div>
        <div class="key-items">
            <span><code class="key">id:</code> Scene name (lowercase_underscores)</span>
            <span><code class="key">bg:</code> Background image</span>
            <span><code class="key">music:</code> Music track</span>
            <span><code class="key">chars:</code> Character sprites</span>
            <span><code class="sep">---</code> Separates text blocks</span>
            <span><code class="arr">→</code> Points to next scene</span>
            <span><code class="sfx">[sfx: ...]</code> Sound effect</span>
            <span><code class="flag">(requires: ...)</code> Need this flag</span>
        </div>
    </div>
</div>
'''


def get_step_by_step_guide():
    """Generate the step-by-step contributor guide in 90s style."""
    return '''
<div class="win-window">
    <div class="win-titlebar">
        <span class="win-title">📖 Step-by-Step: Adding Your Story</span>
        <div class="win-buttons"><span>−</span><span>□</span><span>×</span></div>
    </div>
    <div class="win-content">

        <div class="step-card">
            <div class="step-num">STEP 1</div>
            <div class="step-body">
                <h3>📦 Gather Your Materials</h3>
                <p>Before you start, you'll need:</p>
                <ul class="material-list">
                    <li>Your story idea (what happens in this scene?)</li>
                    <li>A background image (JPG)</li>
                    <li>Character sprite if needed (PNG or SVG)</li>
                </ul>

                <div class="where-to-get">
                    <div class="where-title">WHERE TO GET ASSETS:</div>
                    <div class="where-grid">
                        <div class="where-box">
                            <h4>🖼️ Backgrounds</h4>
                            <ul>
                                <li><strong>Use existing:</strong> Check <code>assets/bg/</code> folder</li>
                                <li><strong>Unsplash.com:</strong> Free high-quality photos</li>
                                <li><strong>Take a photo:</strong> Of a real location!</li>
                                <li><strong>Apply a filter:</strong> (optional) Add blur, color grade, etc.</li>
                            </ul>
                            <p class="where-hint">Save as JPG, ~1920×1080 recommended</p>
                        </div>
                        <div class="where-box">
                            <h4>👤 Character Sprites</h4>
                            <ul>
                                <li><strong>Use existing:</strong> Check <code>assets/char/</code> folder</li>
                                <li><strong>Photo cutout:</strong> Remove background from a photo (use remove.bg or similar)</li>
                                <li><strong>AI generators:</strong> Generate character art</li>
                                <li><strong>Draw your own:</strong> Inkscape, Photoshop, etc.</li>
                            </ul>
                            <p class="where-hint">Save as PNG (with transparency) or SVG, ~400×800 suggested</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="step-card">
            <div class="step-num">STEP 2</div>
            <div class="step-body">
                <h3>🖼️ Choose Your Background</h3>
                <p>Either use an existing background from <code>assets/bg/</code> or add your own image to that folder.</p>
                <div class="path-box">📁 assets/bg/your_image.jpg</div>
                <div class="tip-box">
                    <span class="tip-icon">💡</span>
                    <span>Adding a new image? Use lowercase with underscores, e.g. <code>office_kitchen.jpg</code></span>
                </div>
            </div>
        </div>

        <div class="step-card">
            <div class="step-num">STEP 3</div>
            <div class="step-body">
                <h3>📝 Create Your Scene</h3>
                <p>Choose your method:</p>

                <div class="method-grid">
                    <div class="method-box method-a">
                        <h4>🖱️ Option A: Visual Editor</h4>
                        <ol>
                            <li>Open <a href="https://gillescolling.com/andi-escape-from-rennweg/editor/index.html" target="_blank">the editor</a></li>
                            <li>Click "+ New Scene"</li>
                            <li>Fill in the fields</li>
                            <li>Click "Download"</li>
                            <li>Put file in <code>scenes/</code></li>
                        </ol>
                    </div>
                    <div class="method-box method-b">
                        <h4>⌨️ Option B: Text Editor</h4>
                        <ol>
                            <li>Create <code>scenes/my_scene.md</code></li>
                            <li>Copy template (see below)</li>
                            <li>Edit the content</li>
                            <li>Save the file</li>
                        </ol>
                    </div>
                </div>
            </div>
        </div>

        <div class="step-card">
            <div class="step-num">STEP 4</div>
            <div class="step-body">
                <h3>✍️ Write Your Story</h3>
                <p>Keep text blocks short! Each <code>---</code> = one "Continue" click.</p>

                <div class="compare-grid">
                    <div class="compare-box good">
                        <h4>✅ GOOD</h4>
                        <pre>The door creaks open.

---

A shadowy figure stands
in the doorway.

---

"Hello, Andy..."</pre>
                    </div>
                    <div class="compare-box bad">
                        <h4>❌ AVOID</h4>
                        <pre>The door creaks open and
a shadowy figure stands
in the doorway and they
say "Hello, Andy" in a
creepy voice and you
feel scared and...</pre>
                    </div>
                </div>
            </div>
        </div>

        <div class="step-card">
            <div class="step-num">STEP 5</div>
            <div class="step-body">
                <h3>🔀 Add Player Choices</h3>
                <p>At the end of your scene, add choices:</p>
                <pre class="code-box">### Choices

- Run away → escape_scene
- Stand your ground → confrontation
- Hide under the desk → hiding_spot</pre>
                <div class="tip-box">
                    <span class="tip-icon">💡</span>
                    <span>No choices = ending scene (shows "Play Again")</span>
                </div>
            </div>
        </div>

        <div class="step-card">
            <div class="step-num">STEP 6</div>
            <div class="step-body">
                <h3>🔨 Save &amp; Share!</h3>
                <p>Two ways to get your scene into the game:</p>

                <div class="option-box">
                    <div class="option-title">Option A: Push to Git (recommended)</div>
                    <p>Save your <code>.md</code> file to the <code>scenes/</code> folder and push to the repository. The build happens automatically!</p>
                    <div class="command-box">
                        <span class="prompt">$</span> git add scenes/my_scene.md<br>
                        <span class="prompt">$</span> git commit -m "Add my scene"<br>
                        <span class="prompt">$</span> git push
                    </div>
                    <div class="tip-box">
                        <span class="tip-icon">✨</span>
                        <span>GitHub automatically runs the build script when you push!</span>
                    </div>
                </div>

                <div class="option-box">
                    <div class="option-title">Option B: Build locally (if you have Python)</div>
                    <div class="command-box">
                        <span class="prompt">$</span> python tools/build_story_from_md.py
                    </div>
                    <p>Then open <code>index.html</code> in your browser to test.</p>
                </div>
            </div>
        </div>

        <div class="step-card">
            <div class="step-num">GIT<br>BASICS</div>
            <div class="step-body">
                <h3>📦 New to Git? Here's the quick version:</h3>
                <p><strong>Git</strong> tracks changes to files. <strong>GitHub</strong> hosts the project online so we can all work together.</p>

                <div class="git-steps">
                    <div class="git-step">
                        <span class="git-num">1</span>
                        <div>
                            <strong>Clone</strong> (one time only)<br>
                            <code>git clone https://github.com/[repo-url]</code><br>
                            <span class="git-hint">Downloads the project to your computer</span>
                        </div>
                    </div>
                    <div class="git-step">
                        <span class="git-num">2</span>
                        <div>
                            <strong>Pull</strong> (before you start working)<br>
                            <code>git pull</code><br>
                            <span class="git-hint">Gets the latest changes from others</span>
                        </div>
                    </div>
                    <div class="git-step">
                        <span class="git-num">3</span>
                        <div>
                            <strong>Add + Commit</strong> (after making changes)<br>
                            <code>git add . && git commit -m "description"</code><br>
                            <span class="git-hint">Saves your changes locally</span>
                        </div>
                    </div>
                    <div class="git-step">
                        <span class="git-num">4</span>
                        <div>
                            <strong>Push</strong> (share with everyone)<br>
                            <code>git push</code><br>
                            <span class="git-hint">Uploads your changes to GitHub</span>
                        </div>
                    </div>
                </div>

                <div class="tip-box">
                    <span class="tip-icon">💡</span>
                    <span>Stuck? Ask for help! You can also edit files directly on GitHub.com</span>
                </div>
            </div>
        </div>

    </div>
</div>
'''


def get_template_section():
    """Generate the copy-paste template section."""
    return '''
<div class="win-window">
    <div class="win-titlebar">
        <span class="win-title">📋 Template - Copy This!</span>
        <div class="win-buttons"><span>−</span><span>□</span><span>×</span></div>
    </div>
    <div class="win-content template-window">
        <p>Copy this into a new file: <code>scenes/your_scene.md</code></p>

        <pre class="template-code" id="template">---
id: my_new_scene
bg: hallway_fluorescent.jpg
music: default.mp3
---

Write your first text block here.
This is what the player sees first.

---

Second text block. Shown after
clicking "Continue".

---

Third block. Add as many as you need!

### Choices

- First choice → target_scene_one
- Second choice → target_scene_two
- With sound [sfx: click.ogg] → target_scene_three</pre>

        <button class="retro-btn" onclick="copyTemplate()">📋 COPY TO CLIPBOARD</button>
    </div>
</div>
'''


def get_available_assets():
    """Generate lists of available backgrounds, sprites, and music."""

    # Scan directories
    bg_dir = PROJECT_ROOT / "assets" / "bg"
    char_dir = PROJECT_ROOT / "assets" / "char"
    music_dir = PROJECT_ROOT / "assets" / "music"
    sfx_dir = PROJECT_ROOT / "assets" / "sfx"

    backgrounds = sorted([f.name for f in bg_dir.glob("*.jpg")]) if bg_dir.exists() else []
    sprites_svg = [f.name for f in char_dir.glob("*.svg")] if char_dir.exists() else []
    sprites_png = [f.name for f in char_dir.glob("*.png")] if char_dir.exists() else []
    sprites = sorted(sprites_svg + sprites_png)
    music = sorted([f.name for f in music_dir.glob("*.mp3")]) if music_dir.exists() else []
    sfx = sorted([f.name for f in sfx_dir.glob("*.ogg")]) if sfx_dir.exists() else []

    bg_list = "".join(f'<li>{bg}</li>' for bg in backgrounds) if backgrounds else '<li class="empty">(Add your own .jpg files here)</li>'
    sprite_list = "".join(f'<li>{sp}</li>' for sp in sprites) if sprites else '<li class="empty">(Add your own .png or .svg files here)</li>'
    music_list = "".join(f'<li>{m}</li>' for m in music) if music else '<li class="empty">(Add your own .mp3 files here)</li>'
    sfx_list = "".join(f'<li>{s}</li>' for s in sfx) if sfx else '<li class="empty">(Add your own .ogg files here)</li>'

    return f'''
<div class="win-window">
    <div class="win-titlebar">
        <span class="win-title">🎨 Asset Folders</span>
        <div class="win-buttons"><span>−</span><span>□</span><span>×</span></div>
    </div>
    <div class="win-content">
        <p>Put your files in these folders, then use the filename in your scene file:</p>

        <div class="asset-grid">
            <div class="asset-box">
                <h4>🖼️ Backgrounds</h4>
                <div class="asset-path">📁 assets/bg/</div>
                <p class="asset-hint">Add JPG images here. Use in scenes with <code>bg: filename.jpg</code></p>
                <ul class="asset-list">
                    {bg_list}
                </ul>
            </div>

            <div class="asset-box">
                <h4>👤 Sprites</h4>
                <div class="asset-path">📁 assets/char/</div>
                <p class="asset-hint">Add PNG or SVG files here. Use in scenes with <code>chars:</code></p>
                <ul class="asset-list">
                    {sprite_list}
                </ul>
            </div>

            <div class="asset-box">
                <h4>🎵 Music</h4>
                <div class="asset-path">📁 assets/music/</div>
                <p class="asset-hint">Add MP3 files here. Use in scenes with <code>music: filename.mp3</code></p>
                <ul class="asset-list">
                    {music_list}
                </ul>
            </div>

            <div class="asset-box">
                <h4>🔊 Sound FX</h4>
                <div class="asset-path">📁 assets/sfx/</div>
                <p class="asset-hint">Add OGG files here. Use in choices with <code>[sfx: filename.ogg]</code></p>
                <ul class="asset-list">
                    {sfx_list}
                </ul>
            </div>
        </div>
    </div>
</div>
'''


def get_advanced_section():
    """Generate the advanced features section."""
    return '''
<div class="win-window">
    <div class="win-titlebar">
        <span class="win-title">🚀 Advanced Features</span>
        <div class="win-buttons"><span>−</span><span>□</span><span>×</span></div>
    </div>
    <div class="win-content">
        <p>Once you're comfortable with the basics, try these!</p>

        <div class="advanced-box">
            <h4>🎲 Dice Rolls</h4>
            <p>Add randomness! Player rolls, result determines the next scene:</p>
            <pre class="code-box">---
id: risky_escape
bg: stairwell_landing.jpg
actions:
  - type: roll_dice
    dice: d20
    threshold: 13
    skill: Stealth
    modifier: advantage
    crit_text: "You're invisible!"
    fumble_text: "You trip on a banana peel!"
    success_target: escape_success
    failure_target: escape_failure
---

You try to sneak past the guard...

### Choices

- Roll for stealth! [sfx: dice_roll.ogg] → _roll</pre>
            <div class="tip-box">
                <span class="tip-icon">🎲</span>
                <span>Available dice: d4, d6, d8, d10, d12, d20, d100</span>
            </div>
            <p><strong>Dice Roll Options:</strong></p>
            <ul>
                <li><code>modifier: advantage</code> — Roll 2d20, take the higher result</li>
                <li><code>modifier: disadvantage</code> — Roll 2d20, take the lower result</li>
                <li><code>skill: Stealth</code> — Shows "Stealth Check" above the roll</li>
                <li><code>crit_text: "..."</code> — Special message on natural 20</li>
                <li><code>fumble_text: "..."</code> — Special message on natural 1</li>
            </ul>
            <div class="tip-box">
                <span class="tip-icon">💡</span>
                <span>Use <code>→ _roll</code> as the choice target to trigger the dice roll!</span>
            </div>
        </div>

        <div class="advanced-box">
            <h4>🎒 Inventory System</h4>
            <p>Give players items they can collect and use!</p>
            <pre class="code-box">---
id: find_key
bg: office_corridor.jpg
add_items:
  - Secret Key
  - Coffee
---

You found a key and some coffee!

### Choices

- Use the key (require_items: Secret Key) → locked_door
- Drink coffee (uses: Coffee) (heals: 5) → energized</pre>
            <p><strong>Frontmatter:</strong></p>
            <ul>
                <li><code>add_items:</code> — Items given when entering the scene</li>
                <li><code>remove_items:</code> — Items removed when entering</li>
            </ul>
            <p><strong>Choice Modifiers:</strong></p>
            <ul>
                <li><code>(require_items: Item Name)</code> — Choice only visible if player has item</li>
                <li><code>(uses: Item Name)</code> — Consumes item when choice is selected</li>
                <li><code>(heals: 5)</code> — Heals player HP (used in battles)</li>
            </ul>
        </div>

        <div class="advanced-box">
            <h4>⚔️ Battle System</h4>
            <p>Turn-based combat! Player can attack, defend, flee, or use items:</p>
            <pre class="code-box">---
id: boss_fight
bg: office_corridor.jpg
chars:
  - agnes_angry.svg
actions:
  - type: start_battle
    enemy_name: Agnes
    enemy_hp: 30
    enemy_max_hp: 30
    enemy_attack: 6
    enemy_defense: 12
    player_attack: 4
    player_defense: 10
    victory_target: you_win
    defeat_target: game_over
    flee_target: escaped
---

Agnes is ready to fight!

### Choices

- Attack! [sfx: thud.ogg] (battle: attack) → _battle
- Defend [sfx: click.ogg] (battle: defend) → _battle
- Try to Flee (battle: flee) → _battle
- Use Coffee (uses: Coffee) (heals: 5) (battle: item) → _battle</pre>
            <p><strong>Battle Actions:</strong></p>
            <ul>
                <li><code>(battle: attack)</code> — Roll d20 + attack bonus vs enemy defense</li>
                <li><code>(battle: defend)</code> — Reduce damage, guaranteed counter-attack</li>
                <li><code>(battle: flee)</code> — 50% chance to escape the battle</li>
                <li><code>(battle: item)</code> — Use item (combine with <code>uses:</code> and <code>heals:</code>)</li>
            </ul>
            <div class="tip-box">
                <span class="tip-icon">💡</span>
                <span>Use <code>→ _battle</code> as target to stay in the battle loop!</span>
            </div>
        </div>

        <div class="advanced-box">
            <h4>👤 Making Character Sprites</h4>
            <p>Sprites can be <strong>PNG</strong> (with transparency) or <strong>SVG</strong> files.</p>
            <p><strong>Suggested size:</strong> around 400×800 pixels (or any tall portrait ratio). The engine scales them automatically.</p>
            <p>Ways to create sprites:</p>
            <ul>
                <li>Use a photo with background removed (PNG cutout)</li>
                <li>Draw in Inkscape, Photoshop, etc.</li>
                <li>Use AI image generators</li>
                <li>Ask the team for help!</li>
            </ul>
            <p>Save as: <code>assets/char/name_emotion.png</code> or <code>.svg</code></p>
            <p>Example: <code>agnes_happy.png</code>, <code>agnes_angry.svg</code></p>
        </div>

    </div>
</div>
'''


def get_css():
    """Return the 90s-style CSS."""
    return '''
/* ============================================
   90s MANUAL STYLESHEET
   Windows 3.1 / Early Mac Aesthetic
   ============================================ */

@font-face {
    font-family: 'MS Sans Serif';
    src: local('MS Sans Serif'), local('Segoe UI'), local('Tahoma');
}

:root {
    --win-bg: #c0c0c0;
    --win-dark: #808080;
    --win-light: #ffffff;
    --win-darkest: #000000;
    --win-blue: #000080;
    --win-cyan: #008080;
    --text-color: #000000;
    --page-bg: #008080;
}

* {
    box-sizing: border-box;
}

body {
    font-family: 'MS Sans Serif', 'Segoe UI', Tahoma, sans-serif;
    font-size: 14px;
    background: var(--page-bg);
    color: var(--text-color);
    margin: 0;
    padding: 20px;
    min-height: 100vh;
}

/* ============================================
   MANUAL CONTAINER
   ============================================ */

.manual-container {
    max-width: 900px;
    margin: 0 auto;
}

/* ============================================
   HEADER
   ============================================ */

.manual-header {
    background: var(--win-bg);
    border: 2px solid;
    border-color: var(--win-light) var(--win-dark) var(--win-dark) var(--win-light);
    padding: 20px;
    text-align: center;
    margin-bottom: 20px;
}

.manual-header h1 {
    font-size: 28px;
    margin: 0;
    color: var(--win-blue);
    text-shadow: 1px 1px 0 var(--win-light);
}

.manual-header .subtitle {
    font-size: 18px;
    margin-top: 5px;
    font-weight: bold;
}

.manual-header .version {
    font-size: 12px;
    margin-top: 15px;
    color: var(--win-dark);
}

.manual-header .logo {
    font-size: 48px;
    margin-bottom: 10px;
}

/* ============================================
   WINDOWS-STYLE PANELS
   ============================================ */

.win-window {
    background: var(--win-bg);
    border: 2px solid;
    border-color: var(--win-light) var(--win-dark) var(--win-dark) var(--win-light);
    margin-bottom: 20px;
}

.win-titlebar {
    background: linear-gradient(90deg, var(--win-blue), var(--win-cyan));
    color: white;
    padding: 3px 5px;
    font-weight: bold;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.win-title {
    font-size: 13px;
}

.win-buttons {
    display: flex;
    gap: 2px;
}

.win-buttons span {
    background: var(--win-bg);
    border: 2px solid;
    border-color: var(--win-light) var(--win-dark) var(--win-dark) var(--win-light);
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: black;
    cursor: default;
}

.win-content {
    padding: 15px;
}

/* ============================================
   FIGURE BOX (for annotated images)
   ============================================ */

.figure-box {
    background: var(--win-bg);
    border: 2px solid;
    border-color: var(--win-light) var(--win-dark) var(--win-dark) var(--win-light);
    margin-bottom: 20px;
    padding: 15px;
}

.figure-title {
    background: var(--win-blue);
    color: white;
    padding: 5px 10px;
    font-weight: bold;
    margin: -15px -15px 15px -15px;
}

/* ============================================
   ANNOTATED SCREENSHOT
   ============================================ */

.annotated-image {
    position: relative;
    border: 2px inset var(--win-dark);
    background: #000;
}

.annotated-image .screenshot {
    display: block;
    width: 100%;
    height: auto;
}

.annotated-image .annotations {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}

.annotation-line {
    stroke: #000000;
    stroke-width: 2;
}

.annotation-box {
    fill: #000000;
}

.annotation-box-inner {
    fill: #c0c0c0;
    stroke: #ffffff;
    stroke-width: 1;
}

.annotation-number {
    fill: #000000;
    font-size: 16px;
    font-weight: bold;
    text-anchor: middle;
    font-family: 'MS Sans Serif', Arial, sans-serif;
}

/* ============================================
   FIGURE LEGEND
   ============================================ */

.figure-legend {
    margin-top: 15px;
    border: 2px inset var(--win-dark);
    background: #ffffcc;
    padding: 10px;
}

.legend-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
}

.legend-table td {
    padding: 4px 8px;
    vertical-align: top;
    border-bottom: 1px dotted #999;
}

.legend-table td:first-child {
    width: 30px;
    text-align: center;
}

.legend-num {
    display: inline-block;
    background: #c0c0c0;
    color: #000000;
    width: 22px;
    height: 22px;
    text-align: center;
    line-height: 22px;
    font-weight: bold;
    font-size: 12px;
    border: 2px solid;
    border-color: #ffffff #808080 #808080 #ffffff;
}

/* ============================================
   CODE ANATOMY (Scene File) - NEW LAYOUT
   ============================================ */

.figure-intro {
    margin: 0 0 15px 0;
    font-size: 13px;
}

.code-explained {
    display: flex;
    flex-direction: column;
    gap: 15px;
}

.code-section {
    background: #e8e8e8;
    border: 2px solid;
    border-color: var(--win-light) var(--win-dark) var(--win-dark) var(--win-light);
    padding: 10px;
}

.code-section-label {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
    font-size: 13px;
}

.section-num {
    display: inline-block;
    background: var(--win-blue);
    color: white;
    width: 22px;
    height: 22px;
    text-align: center;
    line-height: 22px;
    font-weight: bold;
    font-size: 12px;
}

.code-section .retro-code {
    font-family: 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.6;
    margin: 0;
    background: #000;
    padding: 10px;
    border: 2px inset var(--win-dark);
}

.retro-code {
    font-family: 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.5;
    margin: 0;
    color: #ffffff;
}

.retro-code .ln { color: #666; }
.retro-code .kw { color: #ffff00; }
.retro-code .key { color: #ffff00; }
.retro-code .val { color: #00ffff; }
.retro-code .txt { color: #ffffff; }
.retro-code .sep { color: #ffff00; font-weight: bold; }
.retro-code .hdr { color: #ff00ff; font-weight: bold; }
.retro-code .cho { color: #ffffff; }
.retro-code .arr { color: #ffff00; }
.retro-code .tgt { color: #00ffff; }
.retro-code .sfx { color: #ff00ff; }
.retro-code .comment { color: #888888; font-style: italic; }
.retro-code .flag { color: #ff00ff; }

/* Sprite Placement Box */
.sprite-placement-box {
    margin-top: 15px;
    background: #e8d4e8;
    border: 2px solid;
    border-color: var(--win-light) var(--win-dark) var(--win-dark) var(--win-light);
    padding: 12px;
}

.sprite-placement-title {
    font-weight: bold;
    color: #660066;
    margin-bottom: 8px;
    font-size: 13px;
}

.sprite-placement-box > p {
    margin: 0 0 10px 0;
    font-size: 12px;
}

.sprite-methods {
    display: flex;
    gap: 15px;
    margin-bottom: 10px;
}

.sprite-method {
    flex: 1;
    background: white;
    border: 1px solid #999;
    padding: 10px;
}

.sprite-method-title {
    font-weight: bold;
    font-size: 11px;
    margin-bottom: 6px;
    color: #660066;
}

.retro-code-small {
    font-family: 'Courier New', monospace;
    font-size: 10px;
    line-height: 1.4;
    margin: 0;
    background: #000;
    padding: 6px;
    color: #ffffff;
}

.retro-code-small .key { color: #ffff00; }
.retro-code-small .val { color: #00ffff; }

.sprite-method-desc {
    font-size: 10px;
    color: #666;
    margin: 6px 0 0 0;
    font-style: italic;
}

.anatomy-key {
    margin-top: 15px;
    background: #e0e0e0;
    border: 2px inset var(--win-dark);
    padding: 10px;
}

.key-title {
    font-weight: bold;
    margin-bottom: 8px;
}

.key-items {
    display: flex;
    flex-wrap: wrap;
    gap: 10px 20px;
    font-size: 12px;
}

.key-items code {
    background: #ffffcc;
    padding: 1px 4px;
    font-family: 'Courier New', monospace;
}

.key-items code.key { color: #806000; }
.key-items code.sep { color: #cc0000; }
.key-items code.arr { color: #cc0000; }
.key-items code.sfx { color: #800080; }

/* ============================================
   STEPS
   ============================================ */

.step-card {
    display: flex;
    gap: 15px;
    margin: 15px 0;
    padding: 15px;
    background: #e8e8e8;
    border: 2px solid;
    border-color: var(--win-light) var(--win-dark) var(--win-dark) var(--win-light);
}

.step-num {
    flex-shrink: 0;
    min-width: 60px;
    padding: 0 10px;
    height: 60px;
    background: var(--win-blue);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 12px;
    text-align: center;
    border: 2px solid;
    border-color: var(--win-light) var(--win-dark) var(--win-dark) var(--win-light);
}

.step-body {
    flex: 1;
}

.step-body h3 {
    margin: 0 0 10px 0;
    font-size: 16px;
}

/* ============================================
   MATERIAL LISTS
   ============================================ */

.material-list {
    background: white;
    border: 2px inset var(--win-dark);
    padding: 10px 10px 10px 30px;
    margin: 10px 0;
}

.material-list li {
    margin: 5px 0;
}

/* ============================================
   WHERE TO GET ASSETS
   ============================================ */

.where-to-get {
    margin-top: 15px;
    background: #d4e8d4;
    border: 2px solid;
    border-color: var(--win-light) var(--win-dark) var(--win-dark) var(--win-light);
    padding: 12px;
}

.where-title {
    font-weight: bold;
    color: #006400;
    margin-bottom: 10px;
    font-size: 12px;
}

.where-grid {
    display: flex;
    gap: 12px;
}

.where-box {
    flex: 1;
    background: white;
    border: 1px solid #999;
    padding: 10px;
}

.where-box h4 {
    margin: 0 0 8px 0;
    font-size: 12px;
}

.where-box ul {
    margin: 0;
    padding-left: 18px;
    font-size: 11px;
}

.where-box li {
    margin: 4px 0;
}

.where-hint {
    margin: 8px 0 0 0;
    font-size: 10px;
    color: #666;
    font-style: italic;
    background: #ffffcc;
    padding: 4px 6px;
    border: 1px solid #cc9900;
}

/* ============================================
   TIP BOXES
   ============================================ */

.tip-box {
    background: #ffffcc;
    border: 1px solid #cc9900;
    padding: 8px 12px;
    margin: 10px 0;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
}

.tip-icon {
    font-size: 16px;
}

/* ============================================
   PATH & COMMAND BOXES
   ============================================ */

.path-box {
    background: white;
    border: 2px inset var(--win-dark);
    padding: 8px 12px;
    font-family: 'Courier New', monospace;
    font-size: 13px;
    margin: 10px 0;
}

.command-box {
    background: #000;
    color: #c0c0c0;
    border: 2px inset var(--win-dark);
    padding: 10px 12px;
    font-family: 'Courier New', monospace;
    font-size: 13px;
    margin: 10px 0;
}

.command-box .prompt {
    color: #ffff00;
}

/* ============================================
   OPTION BOXES (Step 6)
   ============================================ */

.option-box {
    background: #e8e8e8;
    border: 2px solid;
    border-color: var(--win-light) var(--win-dark) var(--win-dark) var(--win-light);
    padding: 12px;
    margin: 10px 0;
}

.option-title {
    font-weight: bold;
    color: var(--win-blue);
    margin-bottom: 8px;
    font-size: 13px;
}

.option-box p {
    margin: 8px 0;
    font-size: 12px;
}

.option-box .command-box {
    margin: 8px 0;
}

/* ============================================
   GIT BASICS
   ============================================ */

.git-steps {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 15px 0;
}

.git-step {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    background: white;
    border: 1px solid #999;
    padding: 10px;
}

.git-num {
    background: var(--win-blue);
    color: white;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 14px;
    flex-shrink: 0;
}

.git-step code {
    background: #000;
    color: #ffff00;
    padding: 2px 6px;
    font-family: 'Courier New', monospace;
    font-size: 11px;
}

.git-hint {
    font-size: 11px;
    color: #666;
    font-style: italic;
}

/* ============================================
   METHOD GRID
   ============================================ */

.method-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
    margin: 10px 0;
}

.method-box {
    background: white;
    border: 2px solid;
    border-color: var(--win-light) var(--win-dark) var(--win-dark) var(--win-light);
    padding: 10px;
}

.method-box h4 {
    margin: 0 0 10px 0;
    font-size: 13px;
    color: var(--win-blue);
}

.method-box ol {
    margin: 0;
    padding-left: 20px;
    font-size: 12px;
}

.method-box li {
    margin: 5px 0;
}

/* ============================================
   COMPARE GRID (Good/Bad)
   ============================================ */

.compare-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 15px;
    margin: 10px 0;
}

.compare-box {
    border: 2px solid;
    padding: 10px;
}

.compare-box.good {
    background: #ccffcc;
    border-color: #00aa00;
}

.compare-box.bad {
    background: #ffcccc;
    border-color: #aa0000;
}

.compare-box h4 {
    margin: 0 0 10px 0;
    font-size: 14px;
}

.compare-box pre {
    background: white;
    border: 1px solid #999;
    padding: 8px;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    margin: 0;
    white-space: pre-wrap;
}

/* ============================================
   CODE BOXES
   ============================================ */

.code-box {
    background: #000;
    color: #ffffff;
    border: 2px inset var(--win-dark);
    padding: 10px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    margin: 10px 0;
    white-space: pre;
    overflow-x: auto;
}

/* ============================================
   TEMPLATE
   ============================================ */

.template-window .template-code {
    background: #000;
    color: #ffffff;
    border: 3px double #ffff00;
    padding: 15px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    margin: 15px 0;
    white-space: pre;
    overflow-x: auto;
}

.retro-btn {
    background: var(--win-bg);
    border: 2px solid;
    border-color: var(--win-light) var(--win-dark) var(--win-dark) var(--win-light);
    padding: 8px 20px;
    font-family: 'MS Sans Serif', Tahoma, sans-serif;
    font-size: 14px;
    cursor: pointer;
}

.retro-btn:active {
    border-color: var(--win-dark) var(--win-light) var(--win-light) var(--win-dark);
}

/* ============================================
   ASSET GRID
   ============================================ */

.asset-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
}

.asset-box {
    background: white;
    border: 2px inset var(--win-dark);
    padding: 10px;
}

.asset-box h4 {
    margin: 0 0 5px 0;
    font-size: 13px;
}

.asset-path {
    font-size: 11px;
    color: #666;
    margin-bottom: 8px;
}

.asset-list {
    list-style: none;
    padding: 0;
    margin: 0;
    max-height: 150px;
    overflow-y: auto;
    font-family: 'Courier New', monospace;
    font-size: 11px;
}

.asset-list li {
    padding: 2px 0;
    border-bottom: 1px dotted #ccc;
}

.asset-list li.empty {
    color: #888;
    font-style: italic;
}

.asset-hint {
    font-size: 11px;
    color: #444;
    margin: 5px 0;
    background: #ffffcc;
    padding: 4px 8px;
}

/* ============================================
   ADVANCED BOXES
   ============================================ */

.advanced-box {
    background: #e8e8e8;
    border: 2px solid;
    border-color: var(--win-light) var(--win-dark) var(--win-dark) var(--win-light);
    padding: 15px;
    margin: 15px 0;
}

.advanced-box h4 {
    margin: 0 0 10px 0;
    color: var(--win-blue);
}

.advanced-box ul {
    margin: 10px 0;
    padding-left: 20px;
}

/* ============================================
   TABLE OF CONTENTS
   ============================================ */

.toc-window {
    background: #ffffcc;
}

.toc-window ul {
    list-style: none;
    padding: 0;
    margin: 0;
    columns: 2;
}

.toc-window li {
    margin: 5px 0;
}

.toc-window a {
    color: var(--win-blue);
    text-decoration: underline;
}

.toc-window a:hover {
    background: var(--win-blue);
    color: white;
}

/* ============================================
   INTRODUCTION / CONCEPT DIAGRAM
   ============================================ */

.intro-window .win-content > p {
    margin: 0 0 15px 0;
}

.concept-diagram {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    margin: 20px 0;
    flex-wrap: wrap;
}

.concept-box {
    background: white;
    border: 2px solid;
    border-color: var(--win-light) var(--win-dark) var(--win-dark) var(--win-light);
    padding: 10px;
    text-align: center;
    min-width: 100px;
}

.concept-box.concept-result {
    background: #ffffcc;
    border-color: #cc9900;
}

.concept-icon {
    font-size: 28px;
    margin-bottom: 5px;
}

.concept-label {
    font-weight: bold;
    font-size: 12px;
}

.concept-desc {
    font-size: 10px;
    color: #666;
    margin-top: 3px;
}

.concept-arrow {
    font-size: 24px;
    font-weight: bold;
    color: var(--win-blue);
}

/* How It Works / Build Diagram */
.how-it-works {
    background: #d4e8d4;
    border: 2px solid;
    border-color: var(--win-light) var(--win-dark) var(--win-dark) var(--win-light);
    padding: 15px;
    margin: 20px 0;
}

.how-title {
    font-weight: bold;
    color: #006400;
    margin-bottom: 12px;
    font-size: 13px;
}

.build-diagram {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 15px;
    margin: 15px 0;
    flex-wrap: wrap;
}

.build-step {
    background: white;
    border: 2px solid;
    border-color: var(--win-light) var(--win-dark) var(--win-dark) var(--win-light);
    padding: 12px;
    text-align: center;
    min-width: 100px;
}

.build-icon {
    font-size: 24px;
    margin-bottom: 5px;
}

.build-label {
    font-weight: bold;
    font-size: 12px;
    font-family: 'Courier New', monospace;
}

.build-desc {
    font-size: 10px;
    color: #666;
    margin-top: 5px;
}

.build-arrow {
    font-size: 24px;
    font-weight: bold;
    color: #006400;
}

.build-why {
    font-size: 11px;
    margin: 10px 0 0 0;
    padding: 8px;
    background: white;
    border: 1px solid #999;
}

/* Two Options Cards */
.two-options {
    margin: 20px 0;
}

.option-intro {
    background: #e8e8e8;
    border: 2px solid;
    border-color: var(--win-light) var(--win-dark) var(--win-dark) var(--win-light);
    padding: 15px;
}

.option-header {
    font-weight: bold;
    color: var(--win-blue);
    margin-bottom: 12px;
    font-size: 13px;
}

.option-cards {
    display: flex;
    gap: 15px;
}

.option-card {
    flex: 1;
    background: white;
    border: 2px solid;
    border-color: var(--win-light) var(--win-dark) var(--win-dark) var(--win-light);
    padding: 12px;
}

.option-card-title {
    font-weight: bold;
    font-size: 13px;
    margin-bottom: 6px;
    color: #000;
}

.option-card-desc {
    font-size: 11px;
    color: #444;
    margin-bottom: 8px;
}

.option-card-link {
    font-size: 11px;
    color: var(--win-blue);
}

.workflow-box {
    background: #e8e8e8;
    border: 2px solid;
    border-color: var(--win-light) var(--win-dark) var(--win-dark) var(--win-light);
    padding: 15px;
    margin: 20px 0;
}

.workflow-title {
    font-weight: bold;
    margin-bottom: 10px;
    color: var(--win-blue);
}

.workflow-steps {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
}

.workflow-step {
    display: flex;
    align-items: center;
    gap: 8px;
    background: white;
    padding: 5px 10px;
    border: 1px solid #999;
    font-size: 12px;
}

.workflow-num {
    background: var(--win-blue);
    color: white;
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    font-weight: bold;
}

/* ============================================
   FLOATING NAV TOOLBAR
   ============================================ */

.floating-nav {
    position: fixed;
    top: 0;
    left: 50%;
    transform: translateX(-50%) translateY(-100%);
    width: 900px;
    max-width: calc(100% - 40px);
    background: var(--win-bg);
    border: 2px solid;
    border-color: var(--win-light) var(--win-dark) var(--win-dark) var(--win-light);
    border-top: none;
    padding: 8px 12px;
    z-index: 1000;
    display: flex;
    gap: 6px;
    justify-content: center;
    transition: transform 0.3s ease;
}

.floating-nav.visible {
    transform: translateX(-50%) translateY(0);
}

.floating-nav a {
    display: block;
    background: var(--win-bg);
    border: 2px solid;
    border-color: var(--win-light) var(--win-dark) var(--win-dark) var(--win-light);
    padding: 6px 10px;
    text-decoration: none;
    font-size: 14px;
    color: black;
}

.floating-nav a:hover {
    background: var(--win-blue);
    color: white;
}

.floating-nav a:active {
    border-color: var(--win-dark) var(--win-light) var(--win-light) var(--win-dark);
}

/* ============================================
   SECTION HEADERS
   ============================================ */

.section-header {
    background: var(--win-blue);
    color: white;
    padding: 15px 20px;
    margin: 30px 0 20px 0;
    border: 2px solid;
    border-color: var(--win-light) var(--win-dark) var(--win-dark) var(--win-light);
}

.section-header h2 {
    margin: 0 0 5px 0;
    font-size: 20px;
}

.section-header p {
    margin: 0;
    font-size: 13px;
    opacity: 0.9;
}

/* ============================================
   FOOTER
   ============================================ */

.manual-footer {
    background: var(--win-bg);
    border: 2px solid;
    border-color: var(--win-light) var(--win-dark) var(--win-dark) var(--win-light);
    padding: 15px;
    text-align: center;
    font-size: 12px;
}

/* ============================================
   RESPONSIVE
   ============================================ */

@media (max-width: 700px) {
    .method-grid,
    .compare-grid,
    .asset-grid {
        grid-template-columns: 1fr;
    }

    .code-anatomy {
        flex-direction: column;
    }

    .anatomy-labels {
        position: static;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .anatomy-bracket {
        position: static;
    }

    .bracket-line {
        display: none;
    }
}

/* ============================================
   PRINT
   ============================================ */

@media print {
    body {
        background: white;
    }

    .win-window {
        break-inside: avoid;
    }
}
'''


def get_javascript():
    """Return the JavaScript for the manual."""
    return '''
function copyTemplate() {
    const template = document.getElementById('template').textContent;
    navigator.clipboard.writeText(template).then(() => {
        const btn = document.querySelector('.retro-btn');
        const originalText = btn.textContent;
        btn.textContent = '✓ COPIED!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    }).catch(() => {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = document.getElementById('template').textContent;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);

        const btn = document.querySelector('.retro-btn');
        const originalText = btn.textContent;
        btn.textContent = '✓ COPIED!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    });
}

// Floating nav - show on scroll up, hide on scroll down
(function() {
    const nav = document.querySelector('.floating-nav');
    let lastScrollY = window.scrollY;
    let ticking = false;

    function updateNav() {
        const currentScrollY = window.scrollY;

        // Only show if scrolled down a bit and scrolling up
        if (currentScrollY > 200 && currentScrollY < lastScrollY) {
            nav.classList.add('visible');
        } else {
            nav.classList.remove('visible');
        }

        lastScrollY = currentScrollY;
        ticking = false;
    }

    window.addEventListener('scroll', function() {
        if (!ticking) {
            requestAnimationFrame(updateNav);
            ticking = true;
        }
    });
})();
'''


def build_manual():
    """Build the complete HTML manual."""

    # Ensure output directory exists
    OUTPUT_DIR.mkdir(exist_ok=True)

    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Andi VN - Contributor Manual</title>
    <style>
{get_css()}
    </style>
</head>
<body>
    <div class="manual-container">

        <header class="manual-header">
            <div class="logo">📚💾</div>
            <h1>ANDI VN</h1>
            <div class="subtitle">Contributor Manual</div>
            <div class="version">Version 1.0 • {datetime.now().strftime("%B %Y")}</div>
        </header>

        <div class="win-window toc-window">
            <div class="win-titlebar">
                <span class="win-title">📑 Table of Contents</span>
                <div class="win-buttons"><span>−</span><span>□</span><span>×</span></div>
            </div>
            <div class="win-content">
                <ul>
                    <li><a href="#intro">1. How to Make a Scene</a></li>
                    <li><a href="#editor">2. Visual Editor</a></li>
                    <li><a href="#scene-file">3. Text File Format</a></li>
                    <li><a href="#guide">4. Step-by-Step Guide</a></li>
                    <li><a href="#template">5. Copy-Paste Template</a></li>
                    <li><a href="#assets">6. Asset Folders</a></li>
                    <li><a href="#advanced">7. Advanced Features</a></li>
                </ul>
            </div>
        </div>

        <section id="intro">
            {get_introduction()}
        </section>

        <div class="section-header" id="tools-section">
            <h2>📐 The Tools</h2>
            <p>Two ways to create scenes: a visual editor or plain text files. Both produce the same result.</p>
        </div>

        <section id="editor">
            {get_annotated_screenshot()}
        </section>

        <section id="scene-file">
            {get_scene_file_diagram()}
        </section>

        <div class="section-header">
            <h2>🛠️ Let's Build</h2>
            <p>Ready to create your first scene? Follow these steps.</p>
        </div>

        <section id="guide">
            {get_step_by_step_guide()}
        </section>

        <div class="section-header">
            <h2>⚡ Quick Start</h2>
            <p>Just want to jump in? Grab the template and go.</p>
        </div>

        <section id="template">
            {get_template_section()}
        </section>

        <section id="assets">
            {get_available_assets()}
        </section>

        <div class="section-header">
            <h2>🎲 Advanced</h2>
            <p>Dice rolls, custom sprites, and other fancy stuff.</p>
        </div>

        <section id="advanced">
            {get_advanced_section()}
        </section>

        <footer class="manual-footer">
            <p>🎮 <strong>ANDI VN</strong> — A Visual Novel for Andy's PhD Farewell</p>
            <p>Manual generated {datetime.now().strftime("%Y-%m-%d %H:%M")}</p>
        </footer>

    </div>

    <nav class="floating-nav">
        <a href="#">▲ Top</a>
        <a href="#tools-section">📐 Tools</a>
        <a href="#guide">🛠️ Build</a>
        <a href="#template">⚡ Template</a>
        <a href="#advanced">🎲 Advanced</a>
    </nav>

    <script>
{get_javascript()}
    </script>
</body>
</html>
'''

    output_path = OUTPUT_DIR / "CONTRIBUTOR_MANUAL.html"
    output_path.write_text(html, encoding="utf-8")

    print(f"✅ Manual generated: {output_path}")
    print(f"   Open in browser to view!")
    return output_path


if __name__ == "__main__":
    build_manual()
