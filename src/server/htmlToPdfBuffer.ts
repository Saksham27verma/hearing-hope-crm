/**
 * Renders HTML to a PDF buffer (A4). Uses Puppeteer/Chromium — required for parity with CRM HTML templates.
 *
 * Note: `networkidle0` often never resolves (fonts, images, analytics), which caused timeouts and a fallback
 * to the minimal pdf-lib receipt. We use `load` so the CRM HTML template actually renders in the PDF.
 */
export async function renderHtmlToPdfBuffer(html: string): Promise<Buffer> {
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-background-networking',
    ],
  });
  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(45_000);
    page.setDefaultTimeout(45_000);
    await page.setContent(html, { waitUntil: 'load', timeout: 45_000 });
    // Let webfonts / late layout settle without waiting for full network idle
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const buf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '12mm', left: '10mm', right: '10mm' },
    });
    return Buffer.from(buf);
  } finally {
    await browser.close();
  }
}
