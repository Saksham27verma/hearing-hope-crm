/**
 * Renders HTML to a PDF buffer (A4).
 *
 * - **macOS / Windows (local dev):** full `puppeteer` with its bundled Chromium (same as a desktop browser).
 * - **Linux (Vercel, Docker, many servers):** `puppeteer-core` + `@sparticuz/chromium` — the default bundled
 *   Chromium from `puppeteer` often **does not run** in serverless/glibc environments, which caused silent
 *   failures and the API fell back to the tiny pdf-lib receipt even when the correct Firestore template was chosen.
 *
 * Override: set `PDF_USE_PUPPETEER_FULL=1` to force the full `puppeteer` package on Linux (e.g. Docker with deps installed).
 */

function shouldUseSparticuzChromium(): boolean {
  if (process.env.PDF_USE_PUPPETEER_FULL === '1') return false;
  if (process.env.PDF_USE_SPARTICUZ === '1') return true;
  // Vercel and most cloud Node run Linux; local Mac/Windows dev uses full puppeteer.
  return process.platform === 'linux';
}

async function renderWithSparticuz(html: string): Promise<Buffer> {
  const puppeteer = await import('puppeteer-core');
  const chromium = (await import('@sparticuz/chromium')).default;

  const executablePath = await chromium.executablePath();

  const browser = await puppeteer.default.launch({
    args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: chromium.headless,
  });

  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60_000);
    page.setDefaultTimeout(60_000);
    await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    );
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

async function renderWithFullPuppeteer(html: string): Promise<Buffer> {
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
    page.setDefaultNavigationTimeout(60_000);
    page.setDefaultTimeout(60_000);
    await page.setContent(html, { waitUntil: 'load', timeout: 60_000 });
    await page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    );
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

export async function renderHtmlToPdfBuffer(html: string): Promise<Buffer> {
  if (shouldUseSparticuzChromium()) {
    try {
      return await renderWithSparticuz(html);
    } catch (first) {
      console.warn(
        'renderHtmlToPdfBuffer: @sparticuz/chromium failed, retrying with full puppeteer if available:',
        first
      );
      try {
        return await renderWithFullPuppeteer(html);
      } catch (second) {
        throw second;
      }
    }
  }
  return renderWithFullPuppeteer(html);
}
