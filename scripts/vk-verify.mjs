// Проверка рендеринга и загрузки изображений статьи
import { chromium } from "playwright";

const urls = process.argv.slice(2);
if (urls.length === 0) {
  console.log("Usage: node scripts/vk-verify.mjs <url1> [url2] ...");
  process.exit(1);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

for (const url of urls) {
  console.log(`\n=== ${url} ===`);
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    const info = await page.evaluate(() => {
      const content = document.querySelector(".article-content");
      if (!content) return { found: false };
      const imgs = Array.from(content.querySelectorAll("img")).map((img) => ({
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        complete: img.complete,
      }));
      return {
        found: true,
        strong: content.querySelectorAll("strong, b").length,
        h1: content.querySelectorAll("h1").length,
        h2: content.querySelectorAll("h2").length,
        h3: content.querySelectorAll("h3").length,
        p: content.querySelectorAll("p").length,
        img: imgs.length,
        figure: content.querySelectorAll("figure").length,
        table: content.querySelectorAll("table").length,
        ul: content.querySelectorAll("ul").length,
        ol: content.querySelectorAll("ol").length,
        li: content.querySelectorAll("li").length,
        blockquote: content.querySelectorAll("blockquote").length,
        imgs,
        hasError: content.textContent.includes("TypeError") || content.textContent.includes("sanitize"),
      };
    });
    console.log(JSON.stringify(info, null, 2));
  } catch (err) {
    console.log(`ERROR: ${err.message}`);
  }
}

await browser.close();
