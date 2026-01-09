/**
 * Real Dice UI Shift Test
 *
 * Uses the ACTUAL game code (BattleDiceUI.showAttackRoll) to detect shifts.
 * This will catch any shifts caused by the real implementation.
 */

const puppeteer = require('puppeteer');
const path = require('path');

const TEST_URL = 'file://' + path.resolve(__dirname, '../index.html').replace(/\\/g, '/');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runRealDiceTest() {
    console.log('=====================================');
    console.log('REAL DICE UI SHIFT TEST');
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

        // Handle password screen - type the password
        console.log('Checking for password screen...');
        const passwordScreen = await page.$('#password-screen');
        if (passwordScreen) {
            console.log('Password screen detected, entering password...');
            // Type "ANDI" (the password)
            await page.keyboard.type('ANDI');
            await delay(500);
            // Press Enter or click submit
            await page.keyboard.press('Enter');
            await delay(1000);
        }
        console.log('Password handled.\n');

        // Create battle UI using the real game's createBattleUI
        console.log('Creating battle UI using real game code...');
        const hasUI = await page.evaluate(() => {
            if (typeof BattleUI === 'undefined') {
                return false;
            }

            // Hide story UI
            const storyBox = document.querySelector('.text-box');
            if (storyBox) storyBox.style.display = 'none';

            // Create mock player and enemy for battle UI
            const mockPlayer = {
                name: 'Andy',
                hp: 50,
                maxHp: 50,
                mana: 20,
                maxMana: 20,
                ac: 12,
                limitBreak: 0,
                maxLimitBreak: 100,
                statusEffects: []
            };

            const mockEnemy = {
                name: 'Coffee Machine',
                hp: 30,
                maxHp: 30,
                ac: 10,
                statusEffects: [],
                sprite: null
            };

            // Initialize battle UI
            BattleUI.init(mockPlayer, mockEnemy);
            return true;
        });

        if (!hasUI) {
            console.log('ERROR: BattleUI not available');
            return;
        }

        await delay(500);
        console.log('Battle UI created.\n');

        // Set up continuous position monitoring
        console.log('Setting up continuous position monitoring...');
        await page.evaluate(() => {
            window._shiftLog = [];
            window._basePos = null;
            window._monitoring = true;
            window._frameNum = 0;

            function monitor() {
                if (!window._monitoring) return;
                window._frameNum++;

                const row1 = document.getElementById('battle-log-row-1');
                const row2 = document.getElementById('battle-log-row-2');

                if (!row1 || !row2) {
                    requestAnimationFrame(monitor);
                    return;
                }

                const rect1 = row1.getBoundingClientRect();
                const rect2 = row2.getBoundingClientRect();

                if (!window._basePos) {
                    window._basePos = { row1Top: rect1.top, row2Top: rect2.top };
                }

                const shift1 = rect1.top - window._basePos.row1Top;
                const shift2 = rect2.top - window._basePos.row2Top;

                // Log any shift > 0.1px
                if (Math.abs(shift1) > 0.1 || Math.abs(shift2) > 0.1) {
                    window._shiftLog.push({
                        frame: window._frameNum,
                        shift1: shift1,
                        shift2: shift2,
                        row1Top: rect1.top,
                        row2Top: rect2.top,
                        row1Text: row1.textContent.substring(0, 50),
                        row2Text: row2.textContent.substring(0, 50),
                        row2HTML: row2.innerHTML.substring(0, 150)
                    });
                    // Reset base to track cumulative shifts
                    window._basePos = { row1Top: rect1.top, row2Top: rect2.top };
                }

                requestAnimationFrame(monitor);
            }

            requestAnimationFrame(monitor);
        });

        console.log('Monitoring active.\n');

        // Now trigger the REAL showAttackRoll
        console.log('Triggering BattleDiceUI.showAttackRoll...\n');
        await page.evaluate(() => {
            return new Promise((resolve) => {
                if (typeof BattleDiceUI === 'undefined') {
                    console.error('BattleDiceUI not available');
                    resolve();
                    return;
                }

                // Get the row2 container
                const row2 = document.getElementById('battle-log-row-2');
                if (!row2) {
                    console.error('battle-log-row-2 not found');
                    resolve();
                    return;
                }

                // Clear row2 first
                row2.innerHTML = '';

                // Simulate a successful attack roll
                BattleDiceUI.showAttackRoll({
                    container: row2,  // Required!
                    attacker: 'Andy',
                    rollResult: {
                        roll: 18,
                        total: 20,
                        isCrit: false,
                        isFumble: false,
                        modifiers: [{ value: 2, source: 'ATK' }]
                    },
                    hit: true,
                    defenderAC: 12,
                    damage: 4,
                    damageRoll: 4,
                    attackTotal: 20,
                    onTextComplete: function() {
                        console.log('onTextComplete called');
                    }
                }, function() {
                    console.log('Attack roll animation complete');
                    resolve();
                });
            });
        });

        // Wait for animation to complete
        console.log('Waiting for animation to complete...');
        await delay(5000);

        // Stop monitoring and get results
        const shifts = await page.evaluate(() => {
            window._monitoring = false;
            return window._shiftLog;
        });

        console.log('\n=====================================');
        console.log('SHIFT LOG');
        console.log('=====================================\n');

        if (shifts.length === 0) {
            console.log('✓ NO SHIFTS DETECTED!');
        } else {
            console.log(`✗ DETECTED ${shifts.length} SHIFT(S):\n`);
            shifts.forEach((s, i) => {
                console.log(`[${i}] Frame ${s.frame}:`);
                console.log(`    Row1 shift: ${s.shift1.toFixed(2)}px (now at ${s.row1Top.toFixed(2)})`);
                console.log(`    Row2 shift: ${s.shift2.toFixed(2)}px (now at ${s.row2Top.toFixed(2)})`);
                console.log(`    Row1 text: "${s.row1Text}"`);
                console.log(`    Row2 text: "${s.row2Text}"`);
                console.log(`    Row2 HTML: ${s.row2HTML}`);
                console.log('');
            });
        }

        console.log('=====================================');
        console.log('Browser open for inspection. Press Ctrl+C to exit.');
        await new Promise(() => {});

    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }
}

runRealDiceTest().catch(console.error);
