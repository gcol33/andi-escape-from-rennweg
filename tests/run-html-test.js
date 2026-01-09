const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
    const browser = await puppeteer.launch({ headless: false, args: ['--window-size=1400,800'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 800 });

    const url = 'file://' + path.resolve(__dirname, 'shift-test.html').replace(/\\/g, '/');
    await page.goto(url, { waitUntil: 'networkidle0' });

    // Click the Type Attack Roll button
    await page.click('button');

    // Wait for animation to complete
    await new Promise(r => setTimeout(r, 5000));

    // Get the log content
    const logContent = await page.evaluate(() => document.getElementById('position-log').innerText);
    console.log('=== POSITION LOG ===');
    console.log(logContent);

    // Check for shifts
    const hasShifts = logContent.includes('SHIFT!');
    console.log('\n=== RESULT ===');
    console.log(hasShifts ? 'SHIFTS DETECTED!' : 'No shifts detected');

    await browser.close();
})();
