/**
 * generate_pdf.js - Generates a PDF from the contributor manual
 *
 * Run: node tools/generate_pdf.js
 * Output: docs/CONTRIBUTOR_MANUAL.pdf
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function generatePDF() {
    const htmlPath = path.join(__dirname, '..', 'docs', 'CONTRIBUTOR_MANUAL.html');
    const pdfPath = path.join(__dirname, '..', 'docs', 'CONTRIBUTOR_MANUAL.pdf');

    // Check if HTML exists
    if (!fs.existsSync(htmlPath)) {
        console.error('❌ HTML manual not found. Run "python tools/build_manual.py" first.');
        process.exit(1);
    }

    console.log('Launching browser...');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    console.log('Loading manual...');
    await page.goto(`file://${htmlPath}`, {
        waitUntil: 'networkidle0'
    });

    // Wait for images to load
    await new Promise(r => setTimeout(r, 1000));

    console.log('Generating PDF...');
    await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: {
            top: '15mm',
            right: '15mm',
            bottom: '15mm',
            left: '15mm'
        },
        displayHeaderFooter: true,
        headerTemplate: `
            <div style="font-size: 9px; font-family: 'MS Sans Serif', Tahoma, sans-serif; color: #808080; width: 100%; text-align: center; padding: 5px 0;">
                ANDI VN - Contributor Manual
            </div>
        `,
        footerTemplate: `
            <div style="font-size: 9px; font-family: 'MS Sans Serif', Tahoma, sans-serif; color: #808080; width: 100%; text-align: center; padding: 5px 0;">
                Page <span class="pageNumber"></span> of <span class="totalPages"></span>
            </div>
        `
    });

    await browser.close();

    console.log(`✅ PDF generated: ${pdfPath}`);
}

generatePDF().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
