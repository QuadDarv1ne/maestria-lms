import fs from "fs";
import path from "node:path";
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL || "file:./prisma/data.db";
let adapter;
if (databaseUrl.startsWith("postgresql") || databaseUrl.startsWith("postgres")) {
  adapter = new PrismaPg({ connectionString: databaseUrl });
} else {
  const filePath = databaseUrl.replace(/^file:/, "") || "./prisma/data.db";
  adapter = new PrismaBetterSqlite3({ url: path.resolve(filePath) });
}
const prisma = new PrismaClient({ adapter });

// Local storage for downloaded VK images
const UPLOADS_ROOT = path.resolve("public/uploads/vk");

/**
 * Sleep helper for rate limiting.
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build fallback URL variants for a VK image (in case the max size 404s).
 */
function buildImageVariants(url) {
  const variants = [url];
  // Try cs=1080x0 (auto height) if the exact size is missing
  variants.push(url.replace(/([?&]|&amp;)cs=\d+x\d+/, "$1cs=1080x0"));
  // Try without cs at all (original image)
  variants.push(url.replace(/([?&]|&amp;)cs=\d+x\d+/, ""));
  return [...new Set(variants)];
}

/**
 * Download a single image with retries (VK CDN rate-limits aggressively).
 * Returns the public path on success, or null on failure.
 */
async function downloadImage(url, destDir, fileName) {
  const destPath = path.join(destDir, fileName);
  // Skip if already downloaded
  if (fs.existsSync(destPath) && fs.statSync(destPath).size > 0) {
    return `/uploads/vk/${path.basename(destDir)}/${fileName}`;
  }

  const variants = buildImageVariants(url);
  const maxAttemptsPerVariant = 3;

  for (const variant of variants) {
    const requestUrl = variant.replace(/&amp;/g, "&");
    for (let attempt = 1; attempt <= maxAttemptsPerVariant; attempt++) {
      try {
        const res = await fetch(requestUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            Referer: "https://vk.com/",
            Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          },
        });
        if (res.status === 429) {
          // Rate limited — back off and retry the same variant
          await sleep(4000 * attempt);
          continue;
        }
        if (res.status === 404) {
          // This size doesn't exist — move to the next variant
          break;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.startsWith("image/")) throw new Error(`Unexpected content-type: ${contentType}`);
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length === 0) throw new Error("Empty body");
        fs.writeFileSync(destPath, buffer);
        return `/uploads/vk/${path.basename(destDir)}/${fileName}`;
      } catch (err) {
        if (attempt === maxAttemptsPerVariant) break;
        await sleep(2500 * attempt);
      }
    }
  }

  console.warn(`    ! image failed (${url.slice(-70)})`);
  return null;
}

/**
 * Download all VK images referenced in the HTML and rewrite URLs to local paths.
 * Returns the rewritten HTML.
 */
async function localizeImages(html, slug) {
  if (!html) return html;
  const destDir = path.join(UPLOADS_ROOT, slug);
  fs.mkdirSync(destDir, { recursive: true });

  // Collect unique image URLs (HTML-encoded ampersands included)
  const urlRegex = /https?:\/\/sun[^"'\s]+?vkuserphoto[^"'\s]*?\.(?:jpg|jpeg|png|webp)\?[^"'\s]*/gi;
  const urls = [...new Set(html.match(urlRegex) || [])];
  if (urls.length === 0) return html;

  const mapping = new Map();
  let index = 0;
  for (const rawUrl of urls) {
    index++;
    const url = rawUrl.replace(/&amp;/g, "&");
    const ext = (url.match(/\.(jpg|jpeg|png|webp)\?/i)?.[1] || "jpg").toLowerCase();
    const fileName = `${String(index).padStart(2, "0")}.${ext}`;
    const localPath = await downloadImage(url, destDir, fileName);
    if (localPath) {
      mapping.set(rawUrl, localPath);
    }
    // Be polite to the CDN between downloads (VK rate-limits aggressively)
    await sleep(1200);
  }

  let result = html;
  for (const [rawUrl, localPath] of mapping.entries()) {
    result = result.split(rawUrl).join(localPath);
  }
  return result;
}


/**
 * Clean text content (remove footer, promo, etc.)
 */
function cleanTextContent(raw) {
  let text = raw;
  // Remove group header
  text = text.replace(/Наука и Техника\s*𖤍\s*Q➆[\s\S]*?Дуплей\s*/m, "");
  // Collapse multiple whitespace/newlines into single spaces
  text = text.replace(/\s+/g, " ").trim();
  text = text.replace(/^1x\s*/i, "");
  // Remove trailing promo
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
 * Upgrade a single VK image URL: use the largest size from `as=` parameter as `cs=`.
 * Handles both plain `&` and HTML-encoded `&amp;` separators.
 */
function upgradeVkImageUrl(url) {
  const asMatch = url.match(/(?:[?&]|&amp;)as=([^&"']+)/);
  if (!asMatch) return url;
  const sizes = asMatch[1].split(",");
  let maxW = 0;
  let maxSize = "";
  for (const size of sizes) {
    const w = Number.parseInt(size.split("x")[0], 10);
    if (Number.isFinite(w) && w > maxW) {
      maxW = w;
      maxSize = size;
    }
  }
  if (!maxSize) return url;
  return url.replace(/([?&]|&amp;)cs=\d+x\d+/, `$1cs=${maxSize}`);
}

/**
 * Clean HTML content — preserve formatting but remove VK-specific UI
 */
function cleanHtmlContent(html) {
  if (!html) return "";
  let cleaned = html;
  // Remove script/style tags
  cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, "");
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, "");
  // Remove VK-specific UI elements
  cleaned = cleaned.replace(/<div[^>]*class="[^"]*(?:article_share|article_react|article_info)[^"]*"[\s\S]*?<\/div>/gi, "");
  // Remove VK-specific data attributes
  cleaned = cleaned.replace(/\sdata-[a-z-]+="[^"]*"/gi, "");
  // Remove style attributes
  cleaned = cleaned.replace(/\sstyle="[^"]*"/gi, "");
  // Remove VK-specific class attributes (our styles target plain tags)
  cleaned = cleaned.replace(/\sclass="[^"]*"/gi, "");
  // Remove non-standard attributes
  cleaned = cleaned.replace(/\s(?:theme|theme_type|data-mode|data-done|aria-hidden)="[^"]*"/gi, "");
  // Upgrade VK image sizes: use the largest size from as= parameter
  cleaned = cleaned.replace(/https?:\/\/sun[^"'\s]+?vkuserphoto[^"'\s]*?\.(?:jpg|jpeg|png|webp)\?[^"'\s]*/gi, (url) =>
    upgradeVkImageUrl(url)
  );
  return cleaned.trim();
}

function cleanExcerpt(raw, title) {
  let text = raw.replace(/\s+/g, " ").trim();
  // Skip past the title
  const titleWords = title.split(/\s+/).slice(0, 4).join("\s+");
  try {
    const re = new RegExp(titleWords, "i");
    const m = re.exec(text);
    if (m) text = text.slice(m.index + m[0].length);
  } catch {}
  text = text.replace(/^[^а-яА-Яa-zA-Z]*/, "").trim();
  // Get first 2 sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (sentences && sentences.length >= 2) {
    return sentences.slice(0, 2).join("").trim().slice(0, 500);
  }
  return text.slice(0, 400).trim();
}

function mapCategory(title, content) {
  const t = (title + " " + content).toLowerCase();
  if (/raid|диск|сервер|хран|ssd|hdd|nas|backup|резерв|копир|бэкап/.test(t)) return "databases";
  if (/автоматиз|admin|администратор|скрипт|bash|powershell|ansible|terraform|ci\/cd|devops/.test(t)) return "devops";
  if (/wi-fi|wifi|пароль|сеть|network|kaspersky|antivirus|антивирус|безопасн|os\b.*community/.test(t)) return "security";
  if (/xiaomi|ии|ai\b|ml\b|агент|agent|mimo|нейросет|машинн/.test(t)) return "ai";
  if (/финанс|деньг|банк|инвест|грамотност/.test(t)) return "career";
  if (/китай|китайск|innovation|компани|топ-?\d+/.test(t)) return "development";
  if (/тест|test|qa/.test(t)) return "testing";
  if (/3d|моделиров|blender|3ds/.test(t)) return "3d-modeling";
  return "development";
}

function estimateReadTime(text) {
  return Math.max(1, Math.ceil(text.split(/\s+/).length / 200));
}

/**
 * Build attachments section HTML from extracted attachments
 */
function buildAttachmentsHtml(attachments) {
  if (!attachments || attachments.length === 0) return "";
  const items = attachments.map((att) => {
    const name = att.name || "Файл";
    const url = att.url || "";
    return `<li><a href="${url}" target="_blank" rel="noopener noreferrer">📎 ${name}</a></li>`;
  }).join("\n");
  return `\n\n<div class="article-attachments"><h3>📎 Вложения</h3><ul>${items}</ul></div>`;
}

async function main() {
  const raw = fs.readFileSync("scripts/vk-articles-extracted.json", "utf-8");
  const articles = JSON.parse(raw);

  const okArticles = articles.filter((a) => a.status !== "error");
  console.log(`Importing ${okArticles.length} articles...\n`);

  // Find system user
  let user = await prisma.user.findFirst({ where: { role: "admin" } });
  if (!user) user = await prisma.user.findFirst({ where: { role: "teacher" } });
  if (!user) {
    console.error("No admin/teacher user found. Create one first.");
    process.exit(1);
  }
  console.log(`Author: ${user.name || user.email} (${user.id})\n`);

  let imported = 0;
  let updated = 0;
  let skipped = 0;

  for (const art of okArticles) {
    const slug = (art.slug || "").replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 80);
    if (!slug) {
      console.log(`SKIP (no slug): ${art.title?.slice(0, 60)}`);
      skipped++;
      continue;
    }

    // Determine content to save — prefer HTML for rich formatting
    let contentToSave = "";
    const htmlContent = cleanHtmlContent(art.contentHtml || "");
    const mdContent = art.contentMd || "";
    const textContent = cleanTextContent(art.content || "");

    // Priority: HTML > Markdown > plain text
    if (htmlContent && htmlContent.length > 100) {
      contentToSave = htmlContent;
    } else if (mdContent && mdContent.length > 100) {
      contentToSave = mdContent;
    } else if (textContent && textContent.length > 100) {
      contentToSave = textContent;
    }

    if (!contentToSave || contentToSave.length < 100) {
      console.log(`SKIP (short): ${art.title?.slice(0, 60)}`);
      skipped++;
      continue;
    }

    // Download images locally so the article does not depend on VK CDN
    if (htmlContent && contentToSave === htmlContent) {
      contentToSave = await localizeImages(contentToSave, slug);
    }

    // Append attachments
    if (art.attachments && art.attachments.length > 0) {
      contentToSave += buildAttachmentsHtml(art.attachments);
    }

    const category = art.category || mapCategory(art.title || "", textContent || contentToSave);
    const readTime = art.readTime || estimateReadTime(textContent || contentToSave);
    const excerpt = art.excerpt || cleanExcerpt(textContent || contentToSave, art.title || "");

    // Get cover image — prefer locally downloaded first image if present
    let coverImage = art.image || (art.images && art.images.length > 0 ? art.images[0] : null);
    const localDir = path.join(UPLOADS_ROOT, slug);
    if (fs.existsSync(localDir)) {
      const firstImage = fs
        .readdirSync(localDir, { withFileTypes: true })
        .find((e) => e.isFile() && /^01\./.test(e.name));
      if (firstImage) coverImage = `/uploads/vk/${slug}/${firstImage.name}`;
    }

    // Check if already exists
    const existing = await prisma.article.findUnique({ where: { slug } });

    if (existing) {
      // Update existing article with rich content
      await prisma.article.update({
        where: { slug },
        data: {
          content: contentToSave,
          excerpt: excerpt.slice(0, 500),
          image: coverImage,
          category,
          readTime,
        },
      });
      console.log(`UPDATE: "${art.title?.slice(0, 60)}" -> /blog/${slug}`);
      updated++;
      continue;
    }

    try {
      const created = await prisma.article.create({
        data: {
          title: (art.title || "").replace(/[<>]/g, "").trim().slice(0, 200),
          slug,
          content: contentToSave,
          excerpt: excerpt.slice(0, 500),
          image: coverImage,
          category,
          tags: "VK, импорт",
          readTime,
          isPublished: true,
          isFeatured: false,
          authorId: user.id,
        },
      });
      console.log(`OK: "${created.title.slice(0, 60)}" -> /blog/${slug} (${category}, ${readTime}min)`);
      imported++;
    } catch (err) {
      console.error(`ERROR: ${art.title?.slice(0, 60)}: ${err.message}`);
    }
  }

  console.log(`\nDone! Imported: ${imported}, Updated: ${updated}, Skipped: ${skipped}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
