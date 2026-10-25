import { chromium } from "playwright";
import fs from "fs";
import { vkHtmlToMarkdown } from "./vk-html-to-md.mjs";

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

/**
 * Extract article from a VK article page.
 * Returns title, HTML content, Markdown content, images, and attachments.
 */
async function extractArticle(page, url) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(5000);

  const data = await page.evaluate(() => {
    // ─── Title ───
    const h1 = document.querySelector("h1");
    const title = h1
      ? h1.textContent.trim()
      : document.title.replace(/\s*\|\s*VK.*/, "").trim();

    // ─── Article content container ───
    // VK articles use .article_layer or [class*="article_layer"] or [class*="post__text"]
    const selectors = [
      ".article_layer",
      "[class*='article_layer']",
      ".post__text",
      "[class*='post__text']",
      ".typography",
      "[class*='typography']",
    ];

    let articleEl = null;
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && (el.innerHTML || "").length > 100) {
        articleEl = el;
        break;
      }
    }

    if (!articleEl) {
      // Fallback: try to find any element with substantial text content
      const allDivs = Array.from(document.querySelectorAll("div, article, main"));
      for (const div of allDivs) {
        const text = div.textContent || "";
        if (text.length > 500 && !div.querySelector("script")) {
          articleEl = div;
          break;
        }
      }
    }

    if (!articleEl) return { title, html: "", content: "", images: [], attachments: [] };

    // Clone to avoid modifying the DOM
    const clone = articleEl.cloneNode(true);

    // Remove interactive elements
    clone.querySelectorAll(
      "script, style, noscript, button, [onclick], iframe[src*='vk']",
      "link[rel='stylesheet']"
    ).forEach((el) => el.remove());

    // Get HTML content (preserves formatting!)
    let html = clone.innerHTML.trim();

    // Get plain text content (for fallback)
    const content = clone.textContent.trim();

    // ─── Extract images ───
    const imgs = Array.from(clone.querySelectorAll("img"));
    const images = imgs
      .map((img) => {
        const src = img.getAttribute("src") || img.src || "";
        const alt = img.getAttribute("alt") || "";
        // Prefer high-res images
        const dataSrc = img.getAttribute("data-src") || "";
        return {
          src: src && !src.startsWith("data:") ? src : (dataSrc && !dataSrc.startsWith("data:") ? dataSrc : src),
          alt,
        };
      })
      .filter((img) => img.src && !img.src.includes("ava="));

    // ─── Extract attachments (files) ───
    const attachments = Array.from(clone.querySelectorAll("a[href]"))
      .map((a) => {
        const href = a.getAttribute("href") || "";
        const text = a.textContent.trim() || "";
        const cls = (a.className || "").toString().toLowerCase();
        // Look for file download links
        if (
          href.includes(".pdf") ||
          href.includes(".doc") ||
          href.includes(".docx") ||
          href.includes(".xls") ||
          href.includes(".xlsx") ||
          href.includes(".zip") ||
          href.includes(".rar") ||
          href.includes(".7z") ||
          href.includes(".txt") ||
          cls.includes("doc") ||
          cls.includes("file") ||
          cls.includes("attach")
        ) {
          return { url: href, name: text || href.split("/").pop() || "file" };
        }
        return null;
      })
      .filter(Boolean);

    // ─── Extract embedded media (videos, maps, etc.) ───
    const embeddedMedia = Array.from(clone.querySelectorAll("iframe, embed"))
      .map((el) => ({
        type: el.tagName.toLowerCase(),
        src: el.getAttribute("src") || "",
      }))
      .filter((m) => m.src);

    return { title, html, content, images, attachments, embeddedMedia };
  });

  return data;
}

async function discoverArticleUrls(page, limit) {
  await page.goto(GROUP_URL, { waitUntil: "networkidle", timeout: 30000 });
  return page.evaluate((maxArticles) => {
    const urls = Array.from(document.querySelectorAll("a[href]"))
      .map((anchor) => anchor.href)
      .filter((href) => /^https?:\/\/vk\.ru\/@science_geeks-/.test(href));
    return [...new Set(urls)].slice(0, maxArticles);
  }, limit);
}

/**
 * Clean extracted text content (remove footer, promo, etc.)
 */
function cleanTextContent(raw) {
  let text = raw;
  // Remove group header
  text = text.replace(
    /Наука и Техника\s*𖤍\s*Q➆[\s\S]*?Дуплей\s*/m,
    ""
  );
  // Collapse whitespace
  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(/^1x\s*/i, "");

  const cutMarkers = [
    "Смотри курсы по программированию",
    "Читай статьи по IT",
    "Попробуй себя в профессии",
    "https://school-maestro7it.ru",
    "✦ Источники информации:",
    "❂ Наши ресурсы:",
    "✦ Источники информации",
    "❂ Наши ресурсы",
    "Наши ресурсы:",
    "Источники информации:",
  ];
  for (const marker of cutMarkers) {
    const idx = text.indexOf(marker);
    if (idx > 200) text = text.slice(0, idx).trim();
  }
  // Remove trailing hashtags
  text = text.replace(/#[а-яА-Яa-zA-Z0-9_]+(\s+#[а-яА-Яa-zA-Z0-9_]+)*\s*$/, "").trim();
  // Remove trailing "N views"
  text = text.replace(/\d+\s*(?:просмотр|views)\s*$/i, "").trim();
  return text;
}

/**
 * Create excerpt from content (first 2 sentences after title)
 */
function makeExcerpt(content, title) {
  let text = content;
  const titleWords = title.split(/\s+/).slice(0, 4).join("\s+");
  try {
    const m = new RegExp(titleWords, "i").exec(text);
    if (m) text = text.slice(m.index + m[0].length);
  } catch {}
  text = text.replace(/^[^а-яА-Яa-zA-Z]*/, "").trim();
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length >= 2)
    return sentences.slice(0, 2).join("").trim().slice(0, 500);
  return text.slice(0, 400).trim();
}

/**
 * Clean HTML content: remove VK-specific UI elements, fix URLs
 */
function cleanHtml(html) {
  if (!html) return "";

  // Remove VK-specific UI classes and elements
  let cleaned = html;

  // Remove any script/style tags that might have slipped through
  cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, "");
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, "");

  // Clean up excessive whitespace but preserve paragraph structure
  cleaned = cleaned.replace(/\s{3,}/g, " ");

  return cleaned.trim();
}

async function main() {
  const explicitUrls = process.argv.slice(2).filter((arg) => arg.startsWith("http"));
  const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
  const limit = Number.parseInt(limitArg?.split("=")[1] || String(DEFAULT_LIMIT), 10);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    locale: "ru-RU",
  });
  const page = await ctx.newPage();

  const results = [];
  const articleUrls =
    explicitUrls.length > 0
      ? explicitUrls
      : await discoverArticleUrls(page, Number.isFinite(limit) ? limit : DEFAULT_LIMIT);

  console.log(`Extracting ${articleUrls.length} VK articles...\n`);

  for (const url of articleUrls) {
    try {
      const slugPart = url.split("@science_geeks-")[1] || url.split("@science_geeks_")[1];
      console.log(`Fetching: ${slugPart?.slice(0, 60)}`);

      const data = await extractArticle(page, url);

      // Convert HTML to Markdown
      const content = cleanTextContent(data.content || "");
      const html = cleanHtml(data.html || "");
      const md = html ? vkHtmlToMarkdown(html) : content;

      if (!md && content.length < 100) {
        console.log("  SKIP: too short");
        results.push({ status: "error", sourceUrl: url, error: "too short" });
        continue;
      }

      const category =
        Object.entries(CATEGORIES).find(([k]) => slugPart?.startsWith(k))?.[1] || "development";
      const readTime = Math.max(1, Math.ceil(content.split(/\s+/).length / 200));
      const excerpt = makeExcerpt(content || md, data.title);

      // Get cover image (first high-res image)
      const coverImage =
        data.images.length > 0
          ? data.images[0].src.replace(/&as=[^&]*/, "") // Remove resize params
          : null;

      results.push({
        status: "ok",
        sourceUrl: url,
        title: data.title.replace(/[<>]/g, "").trim().slice(0, 200),
        slug: slugPart?.replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 80) || "",
        content: content,
        contentMd: md,
        contentHtml: html,
        excerpt: excerpt.slice(0, 500),
        category,
        readTime,
        image: coverImage,
        images: data.images.map((img) => img.src),
        attachments: data.attachments,
        embeddedMedia: data.embeddedMedia,
        // Keep raw HTML for debugging
        _htmlPreview: html.slice(0, 2000),
      });

      console.log(
        `  OK: "${data.title.slice(0, 60)}" (${category}, ${readTime}min, ${md.length} chars md)`
      );
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      results.push({
        status: "error",
        sourceUrl: url,
        error: err.message,
      });
    }
  }

  await browser.close();

  // Save results
  fs.writeFileSync(
    "scripts/vk-articles-extracted.json",
    JSON.stringify(results, null, 2),
    "utf-8"
  );

  const okCount = results.filter((r) => r.status === "ok").length;
  console.log(`\nSaved ${okCount} articles to scripts/vk-articles-extracted.json`);
}

main().catch(console.error);
