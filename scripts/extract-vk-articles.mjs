import { chromium } from "playwright";
import fs from "fs";

const GROUP_URL = "https://vk.ru/@science_geeks";
const DEFAULT_LIMIT = 20;

const CATEGORIES = {
  "raid-massivy": "databases",
  "avtomatizaciya": "devops",
  "novosti-kitaya": "development",
  "top-10-kitaiskih": "development",
  "rezervnoe-kopirovanie": "devops",
  "parol-ot-svoego-wi-fi": "security",
  "kasperskyos": "security",
  "xiaomi-mimo": "ai",
  "finansovaya-gramotnost": "career",
  "kurazh-bambei": "career",
};

async function extractArticle(page, url) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);

  return page.evaluate(() => {
    const h1 = document.querySelector("h1");
    const title = h1 ? h1.textContent.trim() : document.title.replace(/\s*\|\s*VK.*/, "").trim();
    const articleLayer = document.querySelector(".article_layer") || document.querySelector("[class*='article_layer']");
    if (!articleLayer) return { title, content: "", images: [] };

    const clone = articleLayer.cloneNode(true);
    clone.querySelectorAll("script, style, noscript, button[class*='close'], [class*='overlay']").forEach(el => el.remove());
    const content = clone.innerText;

    const imgs = articleLayer.querySelectorAll("img");
    const images = Array.from(imgs)
      .map(img => img.src || "")
      .filter(src => src && src.includes("vkuserphoto") && !src.includes("ava=1"));

    return { title, content, images };
  });
}

async function discoverArticleUrls(page, limit) {
  await page.goto(GROUP_URL, { waitUntil: "networkidle", timeout: 30000 });
  return page.evaluate((maxArticles) => {
    const urls = Array.from(document.querySelectorAll("a[href]"))
      .map((anchor) => anchor.href)
      .filter((href) => /^https:\/\/vk\.ru\/@science_geeks-/.test(href));
    return [...new Set(urls)].slice(0, maxArticles);
  }, limit);
}

function cleanContent(raw) {
  let text = raw;
  text = text.replace(/Наука и Техника\s*𖤍\s*Q➆[\s\S]*?Дуплей\s*/m, "");
  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(/^1x\s*/i, "");
  const cutMarkers = [
    "Смотри курсы по программированию", "Читай статьи по IT",
    "Попробуй себя в профессии", "https://school-maestro7it.ru",
    "✦ Источники информации:", "❂ Наши ресурсы:",
  ];
  for (const marker of cutMarkers) {
    const idx = text.indexOf(marker);
    if (idx > 200) text = text.slice(0, idx).trim();
  }
  text = text.replace(/#[а-яА-Яa-zA-Z0-9_]+(\s+#[а-яА-Яa-zA-Z0-9_]+)*\s*$/, "").trim();
  text = text.replace(/\d+\s*(?:просмотр|views)\s*$/i, "").trim();
  return text;
}

function makeExcerpt(content, title) {
  let text = content;
  const titleWords = title.split(/\s+/).slice(0, 4).join("\\s+");
  try {
    const m = new RegExp(titleWords, "i").exec(text);
    if (m) text = text.slice(m.index + m[0].length);
  } catch {}
  text = text.replace(/^[^а-яА-Яa-zA-Z]*/, "").trim();
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length >= 2) return sentences.slice(0, 2).join("").trim().slice(0, 500);
  return text.slice(0, 400).trim();
}

async function main() {
  const explicitUrls = process.argv.slice(2).filter((arg) => arg.startsWith("http"));
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const limit = Number.parseInt(limitArg?.split("=")[1] || String(DEFAULT_LIMIT), 10);
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    locale: "ru-RU",
  });
  const page = await ctx.newPage();
  const results = [];
  const articleUrls = explicitUrls.length > 0
    ? explicitUrls
    : await discoverArticleUrls(page, Number.isFinite(limit) ? limit : DEFAULT_LIMIT);

  console.log(`Extracting ${articleUrls.length} VK articles...\n`);

  for (const url of articleUrls) {
    try {
      const slugPart = url.split("@science_geeks-")[1];
      console.log(`Fetching: ${slugPart}`);
      const data = await extractArticle(page, url);
      const content = cleanContent(data.content);
      if (content.length < 100) { console.log("  SKIP: too short"); continue; }

      const category = Object.entries(CATEGORIES).find(([k]) => slugPart.startsWith(k))?.[1] || "development";
      const readTime = Math.max(1, Math.ceil(content.split(/\s+/).length / 200));
      const excerpt = makeExcerpt(content, data.title);

      results.push({
        status: "ok",
        sourceUrl: url,
        title: data.title.replace(/[<>]/g, "").trim().slice(0, 200),
        slug: slugPart,
        content,
        excerpt: excerpt.slice(0, 500),
        category,
        readTime,
        image: data.images[0] || null,
      });
      console.log(`  OK: ${data.title.slice(0, 60)} (${category}, ${readTime}min)\n`);
    } catch (err) {
      console.error(`  ERROR: ${err.message}\n`);
    }
  }

  await browser.close();
  fs.writeFileSync("scripts/vk-articles-extracted.json", JSON.stringify(results, null, 2), "utf-8");
  console.log(`\nSaved ${results.length} articles to scripts/vk-articles-extracted.json`);
}

main().catch(console.error);
