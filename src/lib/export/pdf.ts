import { chromium } from "playwright-core";

const CHROMIUM_PATH = process.env.PLAYWRIGHT_CHROMIUM_PATH ?? "/opt/pw-browsers/chromium";

/**
 * HTML -> PDF via the pre-installed headless Chromium. Chosen over pdf-lib's
 * manual text layout because pdf-lib's standard fonts have no Cyrillic
 * glyphs (embedding a TTF + fontkit would be needed instead) - a real
 * browser renders Cyrillic, page breaks and table headers correctly for free.
 */
export async function renderHtmlToPdf(html: string): Promise<Buffer> {
  const browser = await chromium.launch({ executablePath: CHROMIUM_PATH });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "16mm", bottom: "16mm", left: "14mm", right: "14mm" },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
