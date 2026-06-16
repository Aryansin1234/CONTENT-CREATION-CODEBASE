import puppeteer from "puppeteer";

export async function renderMermaidWithPuppeteer(
  mermaidCode: string
): Promise<{ pngBuffer: Buffer; pdfBuffer: Buffer }> {
  const browser = await puppeteer.launch({
    // When PUPPETEER_EXECUTABLE_PATH is set (Docker), use system Chromium.
    // Falls back to Puppeteer's bundled browser in local dev.
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",   // avoids /dev/shm size issues in containers
      "--disable-gpu",
    ],
  });
  const page = await browser.newPage();

  await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
      <style>
        body {
          margin: 0;
          background: #0f172a;
          display: flex;
          justify-content: center;
          padding: 40px;
        }
        .mermaid { max-width: 900px; }
        .mermaid svg {
          background: #1e293b !important;
          border-radius: 12px;
          padding: 24px;
        }
      </style>
    </head>
    <body>
      <div class="mermaid">${mermaidCode}</div>
      <script>
        mermaid.initialize({
          theme: 'dark',
          themeVariables: {
            primaryColor: '#6366f1',
            primaryTextColor: '#e2e8f0',
            lineColor: '#94a3b8',
            secondaryColor: '#1e293b',
            tertiaryColor: '#0f172a'
          }
        });
      </script>
    </body>
    </html>
  `);

  await page.waitForSelector(".mermaid svg", { timeout: 15000 });

  const screenshotData = await page.screenshot({ type: "png", fullPage: false });
  const pngBuffer = Buffer.isBuffer(screenshotData) ? screenshotData : Buffer.from(screenshotData);
  const pdfData = await page.pdf({ format: "A4", printBackground: true });
  const pdfBuffer = Buffer.isBuffer(pdfData) ? pdfData : Buffer.from(pdfData);

  await browser.close();
  return { pngBuffer, pdfBuffer };
}
