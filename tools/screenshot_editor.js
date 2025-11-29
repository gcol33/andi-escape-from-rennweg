/**
 * screenshot_editor.js - Takes a screenshot of the editor for the manual
 *
 * Run: node tools/screenshot_editor.js
 * Output: docs/editor_screenshot.png
 */

const puppeteer = require('puppeteer');
const path = require('path');

async function takeScreenshot() {
    const editorPath = path.join(__dirname, '..', 'editor', 'index.html');
    const outputPath = path.join(__dirname, '..', 'docs', 'editor_screenshot.png');

    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Set a nice wide viewport for the editor
    await page.setViewport({
        width: 1400,
        height: 900,
        deviceScaleFactor: 1
    });

    console.log('Loading editor...');
    await page.goto(`file://${editorPath}`, {
        waitUntil: 'networkidle0'
    });

    // Wait a bit for any animations/rendering
    await new Promise(r => setTimeout(r, 500));

    // Click on "start" scene to show something interesting
    await page.evaluate(() => {
        // Find and click the start scene in the list
        const sceneItems = document.querySelectorAll('#scene-list .scene-item');
        for (const item of sceneItems) {
            if (item.textContent.includes('start')) {
                item.click();
                break;
            }
        }
    });

    // Wait for scene to load
    await new Promise(r => setTimeout(r, 800));

    console.log('Taking screenshot...');
    await page.screenshot({
        path: outputPath,
        fullPage: false
    });

    await browser.close();

    console.log(`✅ Screenshot saved: ${outputPath}`);
}

takeScreenshot().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
