/**
 * Real-time Battle Log Shift Detection Test
 *
 * This test runs in the actual game and monitors row positions
 * during a real attack roll to find exactly when/why shifts occur.
 */

const puppeteer = require('puppeteer');
const path = require('path');

const TEST_URL = 'file://' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runRealtimeShiftTest() {
    console.log('==========================================');
    console.log('REAL-TIME BATTLE LOG SHIFT DETECTION TEST');
    console.log('==========================================\n');

    const browser = await puppeteer.launch({
        headless: false,
        slowMo: 0,
        args: ['--window-size=1280,720']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

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

        // Navigate to a battle scene using dev tools
        console.log('Starting battle via dev scene jump...');

        // Click through to get to a battle, or use scene selector
        // First, let's try to find and click on a battle scene in dev tools
        const devPanel = await page.$('#dev-panel');
        if (devPanel) {
            // Look for scene selector
            const sceneSelect = await page.$('#dev-scene-select');
            if (sceneSelect) {
                // Find a battle scene
                const options = await page.$$eval('#dev-scene-select option', opts =>
                    opts.map(o => ({ value: o.value, text: o.textContent }))
                );
                const battleScene = options.find(o => o.value.includes('battle') || o.value.includes('fight'));
                if (battleScene) {
                    await page.select('#dev-scene-select', battleScene.value);
                    await delay(1000);
                }
            }
        }

        // Wait for battle UI to appear
        console.log('Waiting for battle UI...');
        try {
            await page.waitForSelector('#battle-log-row-1', { timeout: 5000 });
            await page.waitForSelector('#battle-log-row-2', { timeout: 5000 });
        } catch (e) {
            console.log('Battle UI not found via scene jump. Clicking through story...');
            // Click through story to reach battle
            for (let i = 0; i < 20; i++) {
                const continueBtn = await page.$('#continue-btn');
                if (continueBtn) {
                    await continueBtn.click();
                    await delay(300);
                }
                // Check if battle started
                const battleRow = await page.$('#battle-log-row-1');
                if (battleRow) {
                    console.log('Battle started!');
                    break;
                }
            }
        }

        // Verify battle is active
        const battleActive = await page.$('#battle-log-row-1');
        if (!battleActive) {
            console.log('ERROR: Could not start battle. Manual intervention needed.');
            console.log('Please navigate to a battle manually, then press Enter in the console.');
            await delay(30000);
        }

        console.log('\nSetting up position monitoring...\n');

        // Inject monitoring code that logs EVERY position change with timestamp and stack trace
        await page.evaluate(() => {
            window._shiftLog = [];
            window._lastPositions = { row1: null, row2: null, content: null };
            window._monitoringActive = true;
            window._frameCount = 0;

            // Monitor function
            function monitor() {
                if (!window._monitoringActive) return;
                window._frameCount++;

                const row1 = document.getElementById('battle-log-row-1');
                const row2 = document.getElementById('battle-log-row-2');
                const content = document.getElementById('battle-log-content');

                if (!row1 || !row2) {
                    requestAnimationFrame(monitor);
                    return;
                }

                const rect1 = row1.getBoundingClientRect();
                const rect2 = row2.getBoundingClientRect();
                const rectContent = content ? content.getBoundingClientRect() : null;

                const pos = {
                    row1Top: rect1.top,
                    row1Height: rect1.height,
                    row2Top: rect2.top,
                    row2Height: rect2.height,
                    contentTop: rectContent ? rectContent.top : null,
                    contentScrollTop: content ? content.scrollTop : null,
                    row1Text: row1.textContent.substring(0, 40),
                    row2Text: row2.textContent.substring(0, 40)
                };

                // Check for ANY change
                if (window._lastPositions.row1 !== null) {
                    const shift1 = Math.abs(pos.row1Top - window._lastPositions.row1);
                    const shift2 = Math.abs(pos.row2Top - window._lastPositions.row2);
                    const heightChange1 = Math.abs(pos.row1Height - window._lastPositions.row1Height);
                    const heightChange2 = Math.abs(pos.row2Height - window._lastPositions.row2Height);
                    const scrollChange = window._lastPositions.contentScrollTop !== null &&
                                        pos.contentScrollTop !== window._lastPositions.contentScrollTop;

                    if (shift1 > 0.1 || shift2 > 0.1 || heightChange1 > 0.1 || heightChange2 > 0.1 || scrollChange) {
                        window._shiftLog.push({
                            frame: window._frameCount,
                            time: Date.now(),
                            shift1: shift1,
                            shift2: shift2,
                            heightChange1: heightChange1,
                            heightChange2: heightChange2,
                            scrollChange: scrollChange,
                            before: {
                                row1Top: window._lastPositions.row1,
                                row2Top: window._lastPositions.row2,
                                scrollTop: window._lastPositions.contentScrollTop
                            },
                            after: pos,
                            row1HTML: row1.innerHTML.substring(0, 100),
                            row2HTML: row2.innerHTML.substring(0, 100)
                        });
                    }
                }

                window._lastPositions = {
                    row1: pos.row1Top,
                    row2: pos.row2Top,
                    row1Height: pos.row1Height,
                    row2Height: pos.row2Height,
                    contentScrollTop: pos.contentScrollTop
                };

                requestAnimationFrame(monitor);
            }

            requestAnimationFrame(monitor);
            console.log('Position monitoring active');
        });

        console.log('Position monitoring injected.\n');
        console.log('Now click ATTACK in the game to trigger a roll...\n');
        console.log('Waiting 15 seconds for you to trigger an attack...\n');

        // Wait for user to trigger attack
        await delay(15000);

        // Collect results
        const shiftLog = await page.evaluate(() => {
            window._monitoringActive = false;
            return window._shiftLog;
        });

        console.log('\n==========================================');
        console.log('SHIFT DETECTION RESULTS');
        console.log('==========================================\n');

        if (shiftLog.length === 0) {
            console.log('✓ NO SHIFTS DETECTED!');
        } else {
            console.log(`✗ DETECTED ${shiftLog.length} SHIFT(S):\n`);

            shiftLog.forEach((entry, i) => {
                console.log(`--- Shift ${i + 1} (frame ${entry.frame}) ---`);
                console.log(`  Row1 shift: ${entry.shift1.toFixed(2)}px`);
                console.log(`  Row2 shift: ${entry.shift2.toFixed(2)}px`);
                console.log(`  Row1 height change: ${entry.heightChange1.toFixed(2)}px`);
                console.log(`  Row2 height change: ${entry.heightChange2.toFixed(2)}px`);
                console.log(`  Scroll changed: ${entry.scrollChange}`);
                console.log(`  Before: row1Top=${entry.before.row1Top?.toFixed(2)}, row2Top=${entry.before.row2Top?.toFixed(2)}, scrollTop=${entry.before.scrollTop}`);
                console.log(`  After:  row1Top=${entry.after.row1Top?.toFixed(2)}, row2Top=${entry.after.row2Top?.toFixed(2)}, scrollTop=${entry.after.contentScrollTop}`);
                console.log(`  Row1 content: "${entry.after.row1Text}"`);
                console.log(`  Row2 content: "${entry.after.row2Text}"`);
                console.log(`  Row2 HTML: ${entry.row2HTML}`);
                console.log('');
            });

            // Analyze patterns
            console.log('--- ANALYSIS ---');
            const scrollShifts = shiftLog.filter(e => e.scrollChange);
            const heightShifts = shiftLog.filter(e => e.heightChange1 > 0.1 || e.heightChange2 > 0.1);
            const positionShifts = shiftLog.filter(e => e.shift1 > 0.1 || e.shift2 > 0.1);

            console.log(`  Shifts caused by scrollTop change: ${scrollShifts.length}`);
            console.log(`  Shifts caused by height change: ${heightShifts.length}`);
            console.log(`  Pure position shifts: ${positionShifts.length}`);
        }

        console.log('\n==========================================');
        console.log('Browser kept open for inspection. Press Ctrl+C to exit.');
        console.log('==========================================');

        // Keep browser open
        await new Promise(() => {});

    } catch (error) {
        console.error('Test error:', error.message);
    }
}

runRealtimeShiftTest().catch(console.error);
