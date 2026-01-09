/**
 * Battle Log Shift Diagnosis Test
 *
 * Simulates EXACTLY what happens during a battle roll:
 * "Andy rolled 18 HIT, 4 DAMAGE"
 *
 * Monitors for sub-pixel shifts at every step.
 */

const puppeteer = require('puppeteer');
const path = require('path');

const TEST_URL = 'file://' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runShiftDiagnosis() {
    console.log('=====================================');
    console.log('BATTLE LOG SHIFT DIAGNOSIS');
    console.log('=====================================\n');

    const browser = await puppeteer.launch({
        headless: false,
        args: ['--window-size=1280,720']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    try {
        await page.goto(TEST_URL, { waitUntil: 'networkidle0', timeout: 30000 });
        await page.waitForSelector('#vn-container', { timeout: 10000 });
        console.log('Page loaded.\n');

        // Create battle log structure exactly like the real game
        console.log('Creating battle log structure...');
        await page.evaluate(() => {
            const container = document.getElementById('vn-container');

            // Hide story UI
            const storyBox = document.querySelector('.text-box');
            if (storyBox) storyBox.style.display = 'none';

            // Create battle log panel matching real structure
            const panel = document.createElement('div');
            panel.className = 'battle-log-panel anchor anchor--bottom-flush';
            panel.innerHTML = `
                <div id="battle-log-content" class="battle-log-content">
                    <div id="battle-log-row-1" class="battle-log-row"></div>
                    <div id="battle-log-row-2" class="battle-log-row"></div>
                </div>
                <div class="battle-choices">
                    <button class="choice-button">Attack</button>
                    <button class="choice-button">Skills</button>
                    <button class="choice-button">Defend</button>
                    <button class="choice-button">Items</button>
                </div>
            `;
            container.appendChild(panel);
        });
        await delay(500);

        // Inject shift monitoring
        console.log('Injecting shift monitor...\n');
        await page.evaluate(() => {
            window._shifts = [];
            window._basePositions = null;

            window.recordPosition = function(label) {
                const row1 = document.getElementById('battle-log-row-1');
                const row2 = document.getElementById('battle-log-row-2');
                const content = document.getElementById('battle-log-content');

                const rect1 = row1.getBoundingClientRect();
                const rect2 = row2.getBoundingClientRect();

                const pos = {
                    label: label,
                    row1Top: rect1.top,
                    row1Bottom: rect1.bottom,
                    row1Height: rect1.height,
                    row2Top: rect2.top,
                    row2Bottom: rect2.bottom,
                    row2Height: rect2.height,
                    contentScrollTop: content.scrollTop,
                    row1Text: row1.textContent,
                    row2Text: row2.textContent
                };

                if (!window._basePositions) {
                    window._basePositions = pos;
                    pos.shift1 = 0;
                    pos.shift2 = 0;
                } else {
                    pos.shift1 = pos.row1Top - window._basePositions.row1Top;
                    pos.shift2 = pos.row2Top - window._basePositions.row2Top;
                }

                window._shifts.push(pos);
                return pos;
            };
        });

        // Record initial position
        console.log('Recording positions at each step...\n');
        await page.evaluate(() => window.recordPosition('INITIAL (empty)'));

        // Step 1: Type "Andy rolled " into row2
        console.log('Step 1: Typing "Andy rolled " into row2...');
        await page.evaluate(() => {
            const row2 = document.getElementById('battle-log-row-2');
            row2.textContent = 'Andy rolled ';
            window.recordPosition('After "Andy rolled "');
        });
        await delay(100);

        // Step 2: Add dice number span
        console.log('Step 2: Adding dice number "18"...');
        await page.evaluate(() => {
            const row2 = document.getElementById('battle-log-row-2');
            const num = document.createElement('strong');
            num.className = 'dice-number roll-hit-normal';
            num.textContent = '18';
            row2.appendChild(num);
            window.recordPosition('After dice "18"');
        });
        await delay(100);

        // Step 3: Add space
        console.log('Step 3: Adding space...');
        await page.evaluate(() => {
            const row2 = document.getElementById('battle-log-row-2');
            row2.appendChild(document.createTextNode(' '));
            window.recordPosition('After space');
        });
        await delay(100);

        // Step 4: Add HIT span (character by character like typewriter)
        console.log('Step 4: Adding "HIT" span...');
        await page.evaluate(() => {
            const row2 = document.getElementById('battle-log-row-2');
            const hit = document.createElement('span');
            hit.className = 'roll-hit-normal';
            row2.appendChild(hit);
            window.recordPosition('After HIT span created (empty)');

            // Type H
            hit.textContent = 'H';
            window.recordPosition('After "H"');
        });
        await delay(50);

        await page.evaluate(() => {
            const hit = document.querySelector('.roll-hit-normal:last-of-type');
            hit.textContent = 'HI';
            window.recordPosition('After "HI"');
        });
        await delay(50);

        await page.evaluate(() => {
            const hit = document.querySelector('.roll-hit-normal:last-of-type');
            hit.textContent = 'HIT';
            window.recordPosition('After "HIT"');
        });
        await delay(100);

        // Step 5: Add ", "
        console.log('Step 5: Adding ", "...');
        await page.evaluate(() => {
            const row2 = document.getElementById('battle-log-row-2');
            row2.appendChild(document.createTextNode(', '));
            window.recordPosition('After ", "');
        });
        await delay(100);

        // Step 6: Add damage number
        console.log('Step 6: Adding damage number "4"...');
        await page.evaluate(() => {
            const row2 = document.getElementById('battle-log-row-2');
            const dmgNum = document.createElement('strong');
            dmgNum.className = 'dice-number roll-damage-normal';
            dmgNum.textContent = '4';
            row2.appendChild(dmgNum);
            window.recordPosition('After damage "4"');
        });
        await delay(100);

        // Step 7: Add space
        console.log('Step 7: Adding space before DAMAGE...');
        await page.evaluate(() => {
            const row2 = document.getElementById('battle-log-row-2');
            row2.appendChild(document.createTextNode(' '));
            window.recordPosition('After space before DAMAGE');
        });
        await delay(100);

        // Step 8: Add DAMAGE span (character by character)
        console.log('Step 8: Adding "DAMAGE" span character by character...');
        await page.evaluate(() => {
            const row2 = document.getElementById('battle-log-row-2');
            const dmg = document.createElement('span');
            dmg.className = 'damage-text roll-type-damage';
            row2.appendChild(dmg);
            window.recordPosition('After DAMAGE span created (empty)');
        });

        const damageChars = ['D', 'DA', 'DAM', 'DAMA', 'DAMAG', 'DAMAGE'];
        for (const text of damageChars) {
            await page.evaluate((t) => {
                const dmg = document.querySelector('.damage-text');
                dmg.textContent = t;
                window.recordPosition(`After "${t}"`);
            }, text);
            await delay(30);
        }

        // Step 9: Simulate what happens when typing "finishes"
        console.log('\nStep 9: Simulating "line finished" - what onTextComplete might do...');
        await page.evaluate(() => {
            window.recordPosition('Before any "finish" actions');

            // This is what might happen when line finishes:
            // 1. Nothing special
            window.recordPosition('After line complete (no action)');
        });
        await delay(200);

        // Now get all recorded shifts
        const shifts = await page.evaluate(() => window._shifts);

        console.log('\n=====================================');
        console.log('POSITION LOG');
        console.log('=====================================\n');

        let foundShift = false;
        shifts.forEach((pos, i) => {
            const hasShift = Math.abs(pos.shift1) > 0.1 || Math.abs(pos.shift2) > 0.1;
            const marker = hasShift ? '>>> SHIFT! <<<' : '';

            if (hasShift) foundShift = true;

            console.log(`[${i}] ${pos.label}`);
            console.log(`    row1: top=${pos.row1Top.toFixed(2)}, height=${pos.row1Height.toFixed(2)}, shift=${pos.shift1.toFixed(2)}px`);
            console.log(`    row2: top=${pos.row2Top.toFixed(2)}, height=${pos.row2Height.toFixed(2)}, shift=${pos.shift2.toFixed(2)}px`);
            console.log(`    scrollTop=${pos.contentScrollTop}`);
            if (hasShift) console.log(`    ${marker}`);
            console.log('');
        });

        console.log('=====================================');
        if (foundShift) {
            console.log('RESULT: SHIFTS DETECTED - see >>> markers above');
        } else {
            console.log('RESULT: NO SHIFTS DETECTED');
            console.log('(The issue might be in real game code, not CSS)');
        }
        console.log('=====================================\n');

        console.log('Browser open for inspection. Press Ctrl+C to exit.');
        await new Promise(() => {});

    } catch (error) {
        console.error('Error:', error.message);
    }
}

runShiftDiagnosis().catch(console.error);
