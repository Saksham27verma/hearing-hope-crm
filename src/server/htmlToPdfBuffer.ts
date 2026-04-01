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

/**
 * `@sparticuz/chromium` only extracts `al2023.tar.br` (bundled `libnss3.so`, etc.) and prepends `LD_LIBRARY_PATH`
 * when it thinks it is on **AWS Lambda** (`AWS_EXECUTION_ENV`). **Vercel does not set that**, so Chromium was
 * launched without NSS libs → `libnss3.so: cannot open shared object file`. Spoof Lambda detection on Vercel
 * before the first `import('@sparticuz/chromium')` (module top-level runs `setupLambdaEnvironment`).
 *
 * @see https://github.com/Sparticuz/chromium/issues/254
 */
if (process.env.VERCEL === '1' && process.platform === 'linux' && !process.env.AWS_EXECUTION_ENV?.trim()) {
  const major = Number(process.versions.node.split('.')[0] || '20');
  process.env.AWS_EXECUTION_ENV = major >= 22 ? 'AWS_Lambda_nodejs22.x' : 'AWS_Lambda_nodejs20.x';
}

/** If a prior run extracted only `chromium.br` (no al2023 NSS libs), `/tmp/chromium` exists and `executablePath()` skips re-extract — unlink once so the next extract includes al2023. */
let vercelClearedStaleChromiumBinary = false;

function shouldUseSparticuzChromium(): boolean {
  if (process.env.PDF_USE_PUPPETEER_FULL === '1') return false;
  if (process.env.PDF_USE_SPARTICUZ === '1') return true;
  // Vercel and most cloud Node run Linux; local Mac/Windows dev uses full puppeteer.
  return process.platform === 'linux';
}

async function renderWithSparticuz(html: string): Promise<Buffer> {
  if (process.env.VERCEL === '1' && !vercelClearedStaleChromiumBinary) {
    vercelClearedStaleChromiumBinary = true;
    try {
      const { existsSync, unlinkSync } = await import('node:fs');
      if (existsSync('/tmp/chromium')) {
        unlinkSync('/tmp/chromium');
      }
    } catch {
      /* ignore */
    }
  }

  const puppeteer = await import('puppeteer-core');
  const chromium = (await import('@sparticuz/chromium')).default;

  // Serverless PDF: skip WebGL/swiftshader extract — faster cold start, fewer failure modes (see @sparticuz/chromium README).
  chromium.setGraphicsMode = false;

  const executablePath = await chromium.executablePath();

  const browser = await puppeteer.default.launch({
    args: [
      ...chromium.args,
      '--hide-scrollbars',
      '--disable-web-security',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
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
      const msg = first instanceof Error ? first.message : String(first);
      console.error(
        'renderHtmlToPdfBuffer: @sparticuz/chromium failed:',
        msg,
        first instanceof Error ? first.stack : ''
      );
      // On Vercel there is no Chrome for full `puppeteer` — retry only wastes time and log noise.
      if (process.env.VERCEL === '1') {
        throw first instanceof Error ? first : new Error(msg);
      }
      try {
        return await renderWithFullPuppeteer(html);
      } catch (second) {
        const msg2 = second instanceof Error ? second.message : String(second);
        console.error(
          'renderHtmlToPdfBuffer: full puppeteer also failed on Linux:',
          msg2,
          second instanceof Error ? second.stack : ''
        );
        throw second;
      }
    }
  }
  return renderWithFullPuppeteer(html);
}
