import { chromium } from "playwright";
import fs from "fs";

const VK_ARTICLE_URLS = [
  "https://vk.ru/@science_geeks-raid-massivy-prostymi-slovami-kak-obedinit-diski-dlya-skor",
  "https://vk.ru/@science_geeks-kak-avtomatizaciya-pomogaet-sistemnym-administratoram-ot-ruc",
  "https://vk.ru/@science_geeks-novosti-kitaya-14-iulya-tovarooborot-rf-i-knr-za-polgoda-vy",
  "https://vk.ru/@science_geeks-top-10-kitaiskih-innovacionnyh-kompanii-za-kotorymi-stoit-sl",
  "https://vk.ru/@science_geeks-pochemu-rezervnoe-kopirovanie-spasaet-biznes",
  "https://vk.ru/@science_geeks-kak-posmotret-parol-ot-svoego-wi-fi-na-telefone-komputere-i",
  "https://vk.ru/@science_geeks-obzor-kasperskyos-community-edition",
  "https://vk.ru/@science_geeks-xiaomi-vypustila-mimo-code-besplatnogo-ii-agenta-dlya-progr",
  "https://vk.ru/@science_geeks-finansovaya-gramotnost-za-5-minut-pochemu-vashi-dengi-rabot",
  "https://vk.ru/@science_geeks-ozvucheno-po-versii-kurazh-bambei-denis-kolesnikov-rasskazal",
];

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

function cleanContent(raw) {
  let text = raw.replace(/^1x\s*/, "");
  text = text.replace(/Наука и Техника\s*𖤍\s*Q➆[\s\S]*?Дуплей\s*/m, "");
  text = text.replace(/\s+/g, " ").trim();
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
  console.log(`Extracting ${VK_ARTICLE_URLS.length} VK articles...\n`);
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    locale: "ru-RU",
  });
  const page = await ctx.newPage();
  const results = [];

  for (const url of VK_ARTICLE_URLS) {
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
        title: data.title.replace(/[^\w\s\-а-яА-Яa-zA-Z(),.:!?🔥💻📃✦]/g, "").trim().slice(0, 200),
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
  fs.writeFileSync("scripts/vk-articles.json", JSON.stringify(results, null, 2), "utf-8");
  console.log(`\nSaved ${results.length} articles to scripts/vk-articles.json`);
}

main().catch(console.error);
