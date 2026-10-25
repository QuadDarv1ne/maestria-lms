// Временный скрипт для инспекции HTML-структуры статьи ВК
import { chromium } from "playwright";

const url = process.argv[2] || "https://vk.ru/@science_geeks-raid-massivy-prostymi-slovami-kak-obedinit-diski-dlya-skor";

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  locale: "ru-RU",
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.waitForTimeout(5000);

const info = await page.evaluate(() => {
  const layer = document.querySelector(".article_layer") || document.querySelector("[class*='article_layer']");
  if (!layer) {
    // ищем альтернативные контейнеры
    const candidates = Array.from(document.querySelectorAll("div[class]"))
      .filter((d) => /article|post__text|typography/i.test(d.className.baseVal || d.className))
      .map((d) => ({ cls: d.className, len: (d.innerHTML || "").length }))
      .sort((a, b) => b.len - a.len)
      .slice(0, 10);
    return { found: false, candidates, bodyClasses: document.body.className };
  }
  // Собираем статистику тегов внутри article_layer
  const tagStats = {};
  layer.querySelectorAll("*").forEach((el) => {
    const t = el.tagName.toLowerCase();
    tagStats[t] = (tagStats[t] || 0) + 1;
  });
  // Первые 3000 символов HTML
  const html = layer.innerHTML;
  // Структура прямых детей
  const children = Array.from(layer.children).slice(0, 40).map((c) => ({
    tag: c.tagName.toLowerCase(),
    cls: (typeof c.className === "string" ? c.className : "").slice(0, 80),
    textPreview: (c.textContent || "").trim().slice(0, 100),
  }));
  return {
    found: true,
    layerClass: typeof layer.className === "string" ? layer.className : "",
    tagStats,
    htmlLength: html.length,
    htmlPreview: html.slice(0, 4000),
    children,
  };
});

console.log(JSON.stringify(info, null, 2));
await browser.close();
