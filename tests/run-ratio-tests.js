/**
 * Text Box Ratio Tests
 *
 * Measures text box height as a proportion of container height
 * at different window sizes to verify proportional scaling.
 *
 * Usage: node tests/run-ratio-tests.js
 *
 * Requires: npm install puppeteer
 */

const puppeteer = require('puppeteer');
const path = require('path');

const TEST_SIZES = [
    // 16:9 Landscape - standard VN aspect ratio
    // Note: Containers below ~667px width hit minimum font-size (8px) for readability
    // These are intentionally excluded as they have different scaling behavior
    { width: 1280, height: 720, name: 'Medium 16:9' },
    { width: 1920, height: 1080, name: 'Large 16:9' },
    { width: 2560, height: 1440, name: 'XL 16:9' },
    { width: 3840, height: 2160, name: '4K 16:9' },
    // Various landscape aspect ratios
    { width: 1200, height: 600, name: 'Narrow Landscape' },  // ~50% height of 16:9
    { width: 2000, height: 800, name: 'Wide Landscape' },    // Ultra-wide
    { width: 1600, height: 1000, name: '16:10 Landscape' },
    // Note: Portrait modes intentionally excluded - they have different layout goals
];

const TOLERANCE = 3.5; // Allow 3.5% variance in ratio (accounts for rounding at small sizes)

async function measureRatios() {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const results = [];

    for (const size of TEST_SIZES) {
        const page = await browser.newPage();

        // Disable cache to ensure fresh CSS
        await page.setCacheEnabled(false);

        await page.setViewport({ width: size.width, height: size.height });

        // Use proper Windows path format with ?dev to skip password screen
        // Add cache-busting timestamp
        const cacheBust = Date.now();
        await page.goto(`file:///C:/Users/Gilles%20Colling/Documents/DevGames/Andi/index.html?dev&t=${cacheBust}`, { waitUntil: 'networkidle0' });

        // Wait for engine to be ready
        await page.waitForSelector('#text-box.engine-ready', { timeout: 5000 }).catch(() => {
            // If engine-ready class doesn't appear, continue anyway
        });

        // Wait for JS to set container font-size (check for inline style)
        await page.waitForFunction(() => {
            const container = document.getElementById('vn-container');
            return container && container.style.fontSize;
        }, { timeout: 5000 }).catch(() => {
            console.log('  Warning: JS font-size not set for ' + size.name);
        });

        // Small delay for layout to settle
        await new Promise(r => setTimeout(r, 300));

        // Measure dimensions
        const measurements = await page.evaluate(() => {
            const container = document.getElementById('vn-container');
            const textBox = document.getElementById('text-box');
            const header = document.getElementById('text-box-header');
            const storyOutput = document.getElementById('story-output');
            const buttonArea = document.getElementById('button-area');

            if (!container || !textBox) {
                return { error: 'Elements not found' };
            }

            const containerRect = container.getBoundingClientRect();
            const textBoxRect = textBox.getBoundingClientRect();
            const computedStyle = window.getComputedStyle(container);
            const textBoxStyle = window.getComputedStyle(textBox);

            // Get individual component heights
            const headerHeight = header ? header.getBoundingClientRect().height : 0;
            const storyHeight = storyOutput ? storyOutput.getBoundingClientRect().height : 0;
            const buttonHeight = buttonArea ? buttonArea.getBoundingClientRect().height : 0;

            // Get padding
            const paddingTop = parseFloat(textBoxStyle.paddingTop);
            const paddingBottom = parseFloat(textBoxStyle.paddingBottom);
            const paddingLeft = parseFloat(textBoxStyle.paddingLeft);
            const paddingRight = parseFloat(textBoxStyle.paddingRight);
            const borderTop = parseFloat(textBoxStyle.borderTopWidth);

            // Get header gap
            const headerGap = header ? parseFloat(window.getComputedStyle(header).marginBottom) : 0;
            const storyGap = storyOutput ? parseFloat(window.getComputedStyle(storyOutput).marginBottom) : 0;
            const buttonGap = parseFloat(window.getComputedStyle(buttonArea).marginTop);

            // Get story-output padding
            const storyStyle = storyOutput ? window.getComputedStyle(storyOutput) : {};
            const storyPaddingTop = parseFloat(storyStyle.paddingTop || 0);
            const storyPaddingBottom = parseFloat(storyStyle.paddingBottom || 0);

            // Get speed button dimensions for debug
            const speedBtn = document.querySelector('.speed-btn');
            const speedBtnStyle = speedBtn ? window.getComputedStyle(speedBtn) : {};
            const speedBtnHeight = speedBtn ? speedBtn.getBoundingClientRect().height : 0;
            const speedBtnFontSize = parseFloat(speedBtnStyle.fontSize || 0);
            const speedBtnPadding = speedBtnStyle.padding || 'N/A';

            // Get header padding for debug
            const headerStyle = header ? window.getComputedStyle(header) : {};
            const headerPaddingTop = parseFloat(headerStyle.paddingTop || 0);
            const headerPaddingBottom = parseFloat(headerStyle.paddingBottom || 0);

            // Get mute button dimensions
            const muteBtn = document.querySelector('.mute-btn');
            const muteBtnHeight = muteBtn ? muteBtn.getBoundingClientRect().height : 0;

            // Get line-height info
            const headerLineHeight = headerStyle.lineHeight || 'normal';

            // Get choice button dimensions for debug
            const choiceBtn = document.querySelector('.choice-button') || document.querySelector('.continue-button');
            const choiceBtnStyle = choiceBtn ? window.getComputedStyle(choiceBtn) : {};
            const choiceBtnHeight = choiceBtn ? choiceBtn.getBoundingClientRect().height : 0;
            const choiceBtnFontSize = choiceBtnStyle.fontSize || 'N/A';
            const choiceBtnPadding = choiceBtnStyle.padding || 'N/A';

            return {
                containerWidth: containerRect.width,
                containerHeight: containerRect.height,
                textBoxHeight: textBoxRect.height,
                fontSize: computedStyle.fontSize,
                ratio: (textBoxRect.height / containerRect.height) * 100,
                // Detailed breakdown
                headerHeight,
                storyHeight,
                buttonHeight,
                paddingTop,
                paddingBottom,
                // Check for non-em values
                buttonAreaStyle: buttonArea ? window.getComputedStyle(buttonArea).height : 'N/A',
                paddingLeft,
                paddingRight,
                borderTop,
                headerGap,
                storyGap,
                buttonGap,
                storyPaddingTop,
                storyPaddingBottom,
                speedBtnHeight,
                speedBtnFontSize,
                speedBtnPadding,
                headerPaddingTop,
                headerPaddingBottom,
                muteBtnHeight,
                headerLineHeight,
                choiceBtnHeight,
                choiceBtnFontSize,
                choiceBtnPadding,
                // Computed totals (padding is included in textBoxRect due to border-box)
                expectedTotal: headerHeight + storyHeight + buttonHeight + borderTop + buttonGap,
                actualTotal: textBoxRect.height,
                // Gap includes padding + any unexplained space
                gap: textBoxRect.height - headerHeight - storyHeight - buttonHeight - borderTop - buttonGap
            };
        });

        if (measurements.error) {
            console.error(`Error at ${size.name}: ${measurements.error}`);
            continue;
        }

        results.push({
            size: size.name,
            ...measurements
        });

        await page.close();
    }

    await browser.close();
    return results;
}

function analyzeResults(results) {
    console.log('\n========================================');
    console.log('   TEXT BOX RATIO TEST RESULTS');
    console.log('========================================\n');

    if (results.length === 0) {
        console.log('No results to analyze');
        return { passed: false, results: [] };
    }

    // Print measurements
    console.log('--- Measurements ---\n');
    console.log('Size                  | Container    | TextBox H | Font    | Ratio');
    console.log('----------------------|--------------|-----------|---------|-------');

    for (const r of results) {
        const sizeStr = r.size.padEnd(21);
        const containerStr = `${Math.round(r.containerWidth)}x${Math.round(r.containerHeight)}`.padEnd(12);
        const textBoxStr = `${Math.round(r.textBoxHeight)}px`.padEnd(9);
        const fontStr = r.fontSize.padEnd(7);
        const ratioStr = `${r.ratio.toFixed(1)}%`;
        console.log(`${sizeStr} | ${containerStr} | ${textBoxStr} | ${fontStr} | ${ratioStr}`);
    }

    // Print detailed breakdown
    console.log('\n--- Component Breakdown ---\n');
    console.log('Size                  | Header | Story  | Button | Border| BtnMT | Expected| Actual | Gap');
    console.log('----------------------|--------|--------|--------|-------|-------|---------|--------|------');

    for (const r of results) {
        const sizeStr = r.size.padEnd(21);
        const headerStr = `${r.headerHeight.toFixed(1)}`.padEnd(6);
        const storyStr = `${r.storyHeight.toFixed(1)}`.padEnd(6);
        const buttonStr = `${r.buttonHeight.toFixed(1)}`.padEnd(6);
        const borderStr = `${r.borderTop.toFixed(1)}`.padEnd(5);
        const btnMTStr = `${r.buttonGap.toFixed(1)}`.padEnd(5);
        const expectedStr = `${r.expectedTotal.toFixed(0)}`.padEnd(7);
        const actualStr = `${r.actualTotal.toFixed(0)}`.padEnd(6);
        const gapStr = `${r.gap.toFixed(1)}`;
        console.log(`${sizeStr} | ${headerStr} | ${storyStr} | ${buttonStr} | ${borderStr} | ${btnMTStr} | ${expectedStr} | ${actualStr} | ${gapStr}`);
    }

    // Debug: Show padding details
    console.log('\n--- Padding Debug ---\n');
    console.log('Size                  | Font   | TxtBoxPad T | TxtBoxPad B | Gap/em | Header/em');
    console.log('----------------------|--------|-------------|-------------|--------|----------');
    for (const r of results) {
        const sizeStr = r.size.padEnd(21);
        const fontSize = parseFloat(r.fontSize);
        const gapEm = r.gap / fontSize;
        const headerEm = r.headerHeight / fontSize;
        console.log(`${sizeStr} | ${fontSize.toFixed(1).padEnd(6)} | ${r.paddingTop.toFixed(1).padEnd(11)} | ${r.paddingBottom.toFixed(1).padEnd(11)} | ${gapEm.toFixed(2).padEnd(6)} | ${headerEm.toFixed(2)}`);
    }

    // Speed button debug
    console.log('\n--- Header Analysis ---\n');
    console.log('Size                  | HdrH   | SpeedH | MuteH  | HdrPad | Expected | HdrLH');
    console.log('----------------------|--------|--------|--------|--------|----------|------');
    for (const r of results) {
        const sizeStr = r.size.padEnd(21);
        const contFont = parseFloat(r.fontSize);
        const hdrPadTotal = r.headerPaddingTop + r.headerPaddingBottom;
        const maxBtnH = Math.max(r.speedBtnHeight, r.muteBtnHeight);
        const expectedHdr = maxBtnH + hdrPadTotal;
        console.log(`${sizeStr} | ${r.headerHeight.toFixed(1).padEnd(6)} | ${r.speedBtnHeight.toFixed(1).padEnd(6)} | ${r.muteBtnHeight.toFixed(1).padEnd(6)} | ${hdrPadTotal.toFixed(1).padEnd(6)} | ${expectedHdr.toFixed(1).padEnd(8)} | ${r.headerLineHeight}`);
    }

    // Choice button analysis
    console.log('\n--- Choice Button Analysis ---\n');
    console.log('Size                  | BtnH   | FontSz | Padding');
    console.log('----------------------|--------|--------|--------');
    for (const r of results) {
        const sizeStr = r.size.padEnd(21);
        const btnH = r.choiceBtnHeight ? r.choiceBtnHeight.toFixed(1) : 'N/A';
        console.log(`${sizeStr} | ${btnH.padEnd(6)} | ${(r.choiceBtnFontSize || 'N/A').toString().padEnd(6)} | ${r.choiceBtnPadding || 'N/A'}`);
    }

    // Calculate variance
    const ratios = results.map(r => r.ratio);
    const avgRatio = ratios.reduce((a, b) => a + b, 0) / ratios.length;
    const minRatio = Math.min(...ratios);
    const maxRatio = Math.max(...ratios);
    const variance = maxRatio - minRatio;

    console.log('\n--- Analysis ---\n');
    console.log(`Average ratio: ${avgRatio.toFixed(2)}%`);
    console.log(`Min ratio:     ${minRatio.toFixed(2)}%`);
    console.log(`Max ratio:     ${maxRatio.toFixed(2)}%`);
    console.log(`Variance:      ${variance.toFixed(2)}% (tolerance: ${TOLERANCE}%)`);

    const passed = variance <= TOLERANCE;

    console.log('\n--- Result ---\n');
    if (passed) {
        console.log('\x1b[32mPASS:\x1b[0m Text box ratio is consistent across sizes');
    } else {
        console.log('\x1b[31mFAIL:\x1b[0m Text box ratio varies too much');
        console.log('\nProblem areas to check:');

        // Identify which sizes have outlier ratios
        for (const r of results) {
            const diff = Math.abs(r.ratio - avgRatio);
            if (diff > TOLERANCE / 2) {
                console.log(`  - ${r.size}: ratio ${r.ratio.toFixed(1)}% differs from avg by ${diff.toFixed(1)}%`);
            }
        }
    }

    return { passed, results, avgRatio, variance };
}

async function main() {
    console.log('Launching browser to measure text box ratios...\n');

    try {
        const results = await measureRatios();
        const analysis = analyzeResults(results);

        // Return detailed info for iteration
        if (!analysis.passed) {
            console.log('\n--- CSS Properties to Check ---\n');
            console.log('Elements affecting text box height:');
            console.log('  - #text-box padding (should use em)');
            console.log('  - #text-box-header padding/height (should use em)');
            console.log('  - #story-output padding (should use em)');
            console.log('  - #button-area height/padding (should use em)');
            console.log('  - .choice-button padding/font-size (should use em)');
            console.log('  - Any min-height/max-height with px values');
        }

        process.exit(analysis.passed ? 0 : 1);
    } catch (err) {
        console.error('Test failed with error:', err.message);
        if (err.message.includes('Cannot find module')) {
            console.log('\nPlease install puppeteer: npm install puppeteer');
        }
        process.exit(1);
    }
}

main();
