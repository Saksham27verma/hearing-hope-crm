/**
 * Renders HTML to a PDF buffer (A4). Uses Puppeteer/Chromium — required for parity with CRM HTML templates.
 */
export async function renderHtmlToPdfBuffer(html: string): Promise<Buffer> {
  const puppeteer = await import('puppeteer');
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 90_000 });
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
