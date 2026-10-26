import { chromium } from "playwright";

const url = process.argv[2];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });

const info = await page.evaluate(() => {
  const content = document.querySelector(".article-content");
  if (!content) return { found: false };
  const text = content.textContent;
  const typeErrorIdx = text.indexOf("TypeError");
  const sanitizeIdx = text.indexOf("sanitize");
  return {
    typeErrorIdx,
    sanitizeIdx,
    typeErrorContext: typeErrorIdx >= 0 ? text.slice(Math.max(0, typeErrorIdx - 100), typeErrorIdx + 200) : null,
    sanitizeContext: sanitizeIdx >= 0 ? text.slice(Math.max(0, sanitizeIdx - 100), sanitizeIdx + 200) : null,
  };
});

console.log(JSON.stringify(info, null, 2));
await browser.close();
