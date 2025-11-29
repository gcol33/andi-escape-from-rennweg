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

    // Click on "demo_battle" scene to show battle features
    await page.evaluate(() => {
        // Find and click the demo_battle scene in the list
        const sceneItems = document.querySelectorAll('#scene-list .scene-item');
        for (const item of sceneItems) {
            if (item.textContent.includes('demo_battle') && !item.textContent.includes('avoided') && !item.textContent.includes('intro') && !item.textContent.includes('talk')) {
                item.click();
                break;
            }
        }
    });

    // Wait for scene to load
    await new Promise(r => setTimeout(r, 800));

    // Expand the Advanced section to show actions
    await page.evaluate(() => {
        const advancedHeader = document.querySelector('.collapsible-header');
        if (advancedHeader) {
            advancedHeader.click();
        }
    });

    // Wait for section to expand
    await new Promise(r => setTimeout(r, 300));

    // Scroll the properties panel to show the Advanced section with battle config
    await page.evaluate(() => {
        const propertiesPanel = document.querySelector('#properties-panel');
        if (propertiesPanel) {
            // Scroll to show the actions container
            const actionsContainer = document.querySelector('#actions-container');
            if (actionsContainer) {
                actionsContainer.scrollIntoView({ block: 'center' });
            }
        }
    });

    // Wait for scroll
    await new Promise(r => setTimeout(r, 200));

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
