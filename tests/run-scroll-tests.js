/**
 * Battle Log Scroll/Shift Detection Tests
 *
 * These tests detect visual shifting of battle log rows during text rendering.
 * The key invariant: row1 and row2 should NEVER move vertically during or after typing.
 */

const puppeteer = require('puppeteer');
const path = require('path');

const TEST_URL = 'file://' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');

// Helper for delays (puppeteer v20+ removed waitForTimeout)
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runScrollTests() {
    console.log('========================================');
    console.log('BATTLE LOG SCROLL/SHIFT DETECTION TESTS');
    console.log('========================================\n');

    const browser = await puppeteer.launch({
        headless: false,  // Show browser for visual debugging
        slowMo: 50,       // Slow down for observation
        args: ['--window-size=1280,720']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    let passed = 0;
    let failed = 0;

    try {
        // Navigate to game
        console.log('Loading game...');
        await page.goto(TEST_URL, { waitUntil: 'networkidle0', timeout: 30000 });
        await page.waitForSelector('#vn-container', { timeout: 10000 });

        // Enable dev mode (q+w+e+r+t)
        console.log('Enabling dev mode...');
        await page.keyboard.down('q');
        await page.keyboard.down('w');
        await page.keyboard.down('e');
        await page.keyboard.down('r');
        await page.keyboard.down('t');
        await delay(500);
        await page.keyboard.up('q');
        await page.keyboard.up('w');
        await page.keyboard.up('e');
        await page.keyboard.up('r');
        await page.keyboard.up('t');
        await delay(500);

        // Create a mock battle log panel for testing
        console.log('Creating mock battle log for testing...');
        await page.evaluate(() => {
            // Create battle log structure
            const container = document.getElementById('vn-container');
            if (!container) return;

            // Create battle log panel
            const panel = document.createElement('div');
            panel.className = 'battle-log-panel anchor anchor--bottom-flush';
            panel.innerHTML = `
                <div class="battle-log-content">
                    <div id="battle-log-row-1" class="battle-log-row"></div>
                    <div id="battle-log-row-2" class="battle-log-row"></div>
                </div>
                <div class="battle-choices">
                    <button class="choice-button" data-action="attack">Attack</button>
                    <button class="choice-button" data-action="skill">Skills</button>
                    <button class="choice-button" data-action="defend">Defend</button>
                    <button class="choice-button" data-action="item">Items</button>
                </div>
            `;
            container.appendChild(panel);
        });
        await delay(500);

        // Verify panel exists
        const panelExists = await page.evaluate(() => !!document.querySelector('.battle-log-panel'));
        if (!panelExists) {
            throw new Error('Could not create mock battle log panel');
        }
        console.log('Mock battle log created!\n');

        // === TEST 1: Monitor row positions during idle ===
        console.log('TEST 1: Checking initial row positions...');
        const initialPositions = await page.evaluate(() => {
            const row1 = document.getElementById('battle-log-row-1');
            const row2 = document.getElementById('battle-log-row-2');
            if (!row1 || !row2) return null;

            const rect1 = row1.getBoundingClientRect();
            const rect2 = row2.getBoundingClientRect();

            return {
                row1: { top: rect1.top, height: rect1.height },
                row2: { top: rect2.top, height: rect2.height }
            };
        });

        if (initialPositions) {
            console.log(`  Row1: top=${initialPositions.row1.top.toFixed(2)}, height=${initialPositions.row1.height.toFixed(2)}`);
            console.log(`  Row2: top=${initialPositions.row2.top.toFixed(2)}, height=${initialPositions.row2.height.toFixed(2)}`);
            passed++;
        } else {
            console.log('  FAIL: Could not find battle log rows');
            failed++;
        }

        // === TEST 2: Simulate typing with styled elements ===
        console.log('\nTEST 2: Simulating typing with styled elements (HIT, DAMAGE)...');

        // Set up position monitoring
        await page.evaluate(() => {
            window._scrollTestData = {
                shifts: [],
                lastRow1Top: null,
                lastRow2Top: null,
                monitoring: true
            };

            const monitor = () => {
                if (!window._scrollTestData.monitoring) return;

                const row1 = document.getElementById('battle-log-row-1');
                const row2 = document.getElementById('battle-log-row-2');
                if (!row1 || !row2) {
                    requestAnimationFrame(monitor);
                    return;
                }

                const rect1 = row1.getBoundingClientRect();
                const rect2 = row2.getBoundingClientRect();

                if (window._scrollTestData.lastRow1Top !== null) {
                    const shift1 = Math.abs(rect1.top - window._scrollTestData.lastRow1Top);
                    const shift2 = Math.abs(rect2.top - window._scrollTestData.lastRow2Top);

                    // Detect shifts greater than 0.5px
                    if (shift1 > 0.5 || shift2 > 0.5) {
                        window._scrollTestData.shifts.push({
                            time: Date.now(),
                            row1Shift: shift1,
                            row2Shift: shift2,
                            row1Content: row1.textContent.substring(0, 50),
                            row2Content: row2.textContent.substring(0, 50)
                        });
                    }
                }

                window._scrollTestData.lastRow1Top = rect1.top;
                window._scrollTestData.lastRow2Top = rect2.top;

                requestAnimationFrame(monitor);
            };

            requestAnimationFrame(monitor);
        });

        // Simulate typewriter effect with styled elements
        console.log('  Typing "Andy rolled 18 " character by character...');
        await page.evaluate(() => {
            return new Promise(resolve => {
                const row2 = document.getElementById('battle-log-row-2');
                const text = 'Andy rolled 18 ';
                let i = 0;

                const typeChar = () => {
                    if (i < text.length) {
                        row2.appendChild(document.createTextNode(text[i]));
                        i++;
                        setTimeout(typeChar, 30);
                    } else {
                        resolve();
                    }
                };
                typeChar();
            });
        });

        console.log('  Adding styled "HIT" span...');
        await page.evaluate(() => {
            const row2 = document.getElementById('battle-log-row-2');
            const hitSpan = document.createElement('span');
            hitSpan.className = 'roll-hit-normal';
            hitSpan.textContent = 'HIT';
            row2.appendChild(hitSpan);
        });
        await delay(100);

        console.log('  Typing ", 4 " character by character...');
        await page.evaluate(() => {
            return new Promise(resolve => {
                const row2 = document.getElementById('battle-log-row-2');
                const text = ', 4 ';
                let i = 0;

                const typeChar = () => {
                    if (i < text.length) {
                        row2.appendChild(document.createTextNode(text[i]));
                        i++;
                        setTimeout(typeChar, 30);
                    } else {
                        resolve();
                    }
                };
                typeChar();
            });
        });

        console.log('  Adding styled "DAMAGE" span...');
        await page.evaluate(() => {
            const row2 = document.getElementById('battle-log-row-2');
            const damageSpan = document.createElement('span');
            damageSpan.className = 'roll-damage-normal';
            damageSpan.textContent = 'DAMAGE';
            row2.appendChild(damageSpan);
        });
        await delay(500);

        // Stop monitoring and collect results
        const shiftData = await page.evaluate(() => {
            window._scrollTestData.monitoring = false;
            return window._scrollTestData.shifts;
        });

        if (shiftData.length === 0) {
            console.log('  PASS: No row shifts detected during typing');
            passed++;
        } else {
            console.log(`  FAIL: Detected ${shiftData.length} row shift(s):`);
            shiftData.forEach((shift, i) => {
                console.log(`    Shift ${i + 1}: row1=${shift.row1Shift.toFixed(2)}px, row2=${shift.row2Shift.toFixed(2)}px`);
                console.log(`      Row1 content: "${shift.row1Content}"`);
                console.log(`      Row2 content: "${shift.row2Content}"`);
            });
            failed++;
        }

        // === TEST 3: Row shift (simulating message promotion) ===
        console.log('\nTEST 3: Testing row shift (row2 -> row1 promotion)...');

        // Get positions before shift
        const beforeShift = await page.evaluate(() => {
            const row1 = document.getElementById('battle-log-row-1');
            const row2 = document.getElementById('battle-log-row-2');
            return {
                row1Top: row1.getBoundingClientRect().top,
                row2Top: row2.getBoundingClientRect().top,
                row2Content: row2.innerHTML
            };
        });

        // Start monitoring again
        await page.evaluate(() => {
            window._scrollTestData = {
                shifts: [],
                lastRow1Top: null,
                lastRow2Top: null,
                monitoring: true
            };

            const monitor = () => {
                if (!window._scrollTestData.monitoring) return;
                const row1 = document.getElementById('battle-log-row-1');
                const row2 = document.getElementById('battle-log-row-2');
                if (!row1 || !row2) {
                    requestAnimationFrame(monitor);
                    return;
                }

                const rect1 = row1.getBoundingClientRect();
                const rect2 = row2.getBoundingClientRect();

                if (window._scrollTestData.lastRow1Top !== null) {
                    const shift1 = Math.abs(rect1.top - window._scrollTestData.lastRow1Top);
                    const shift2 = Math.abs(rect2.top - window._scrollTestData.lastRow2Top);
                    if (shift1 > 0.5 || shift2 > 0.5) {
                        window._scrollTestData.shifts.push({
                            row1Shift: shift1,
                            row2Shift: shift2,
                            row1Content: row1.textContent,
                            row2Content: row2.textContent
                        });
                    }
                }

                window._scrollTestData.lastRow1Top = rect1.top;
                window._scrollTestData.lastRow2Top = rect2.top;
                requestAnimationFrame(monitor);
            };
            requestAnimationFrame(monitor);
        });

        // Perform the shift (like BattleUtils.shiftBattleLogRows does)
        console.log('  Performing row shift...');
        await page.evaluate(() => {
            const row1 = document.getElementById('battle-log-row-1');
            const row2 = document.getElementById('battle-log-row-2');
            row1.innerHTML = row2.innerHTML;
            row2.innerHTML = '';
        });
        await delay(200);

        // Check for shifts during the operation
        const shiftDuringPromotion = await page.evaluate(() => {
            window._scrollTestData.monitoring = false;
            return window._scrollTestData.shifts;
        });

        // Check positions after shift
        const afterShift = await page.evaluate(() => {
            const row1 = document.getElementById('battle-log-row-1');
            const row2 = document.getElementById('battle-log-row-2');
            return {
                row1Top: row1.getBoundingClientRect().top,
                row2Top: row2.getBoundingClientRect().top
            };
        });

        const positionDrift = Math.abs(afterShift.row1Top - beforeShift.row1Top);
        console.log(`  Row1 position drift after shift: ${positionDrift.toFixed(2)}px`);

        if (shiftDuringPromotion.length > 0) {
            console.log(`  FAIL: Detected ${shiftDuringPromotion.length} visual shift(s) during promotion:`);
            shiftDuringPromotion.forEach((s, i) => {
                console.log(`    ${i + 1}. row1=${s.row1Shift.toFixed(2)}px, row2=${s.row2Shift.toFixed(2)}px`);
            });
            failed++;
        } else if (positionDrift > 1) {
            console.log('  FAIL: Row positions drifted after shift');
            failed++;
        } else {
            console.log('  PASS: No visual shift during promotion');
            passed++;
        }

        // === TEST 4: Multiple shifts to detect cumulative drift ===
        console.log('\nTEST 4: Testing multiple shifts for cumulative drift...');

        const basePositions = await page.evaluate(() => {
            const row1 = document.getElementById('battle-log-row-1');
            const row2 = document.getElementById('battle-log-row-2');
            return {
                row1Top: row1.getBoundingClientRect().top,
                row2Top: row2.getBoundingClientRect().top
            };
        });

        // Simulate 5 message cycles
        for (let i = 0; i < 5; i++) {
            await page.evaluate((msgNum) => {
                const row1 = document.getElementById('battle-log-row-1');
                const row2 = document.getElementById('battle-log-row-2');

                // Shift: row2 -> row1
                row1.innerHTML = row2.innerHTML;
                row2.innerHTML = '';

                // Type new message
                row2.textContent = `Message ${msgNum + 1}: Andy rolled 15 `;
                const span = document.createElement('span');
                span.className = 'roll-hit-normal';
                span.textContent = 'HIT';
                row2.appendChild(span);
            }, i);
            await delay(100);
        }

        const afterMultiplePositions = await page.evaluate(() => {
            const row1 = document.getElementById('battle-log-row-1');
            const row2 = document.getElementById('battle-log-row-2');
            return {
                row1Top: row1.getBoundingClientRect().top,
                row2Top: row2.getBoundingClientRect().top
            };
        });

        const totalDrift1 = Math.abs(afterMultiplePositions.row1Top - basePositions.row1Top);
        const totalDrift2 = Math.abs(afterMultiplePositions.row2Top - basePositions.row2Top);

        console.log(`  Total row1 drift after 5 shifts: ${totalDrift1.toFixed(2)}px`);
        console.log(`  Total row2 drift after 5 shifts: ${totalDrift2.toFixed(2)}px`);

        if (totalDrift1 < 2 && totalDrift2 < 2) {
            console.log('  PASS: No cumulative drift');
            passed++;
        } else {
            console.log('  FAIL: Cumulative drift detected');
            failed++;
        }

    } catch (error) {
        console.error('Test error:', error.message);
        failed++;
    }

    // Summary
    console.log('\n========================================');
    console.log(`RESULTS: ${passed} passed, ${failed} failed`);
    console.log('========================================');

    // Keep browser open for manual inspection
    console.log('\nBrowser kept open for inspection. Press Ctrl+C to exit.');

    // Wait indefinitely (user will Ctrl+C)
    await new Promise(() => {});
}

runScrollTests().catch(console.error);
