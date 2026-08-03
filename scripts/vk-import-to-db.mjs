import fs from "fs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL || "file:./prisma/data.db";
let adapter;
if (databaseUrl.startsWith("postgresql") || databaseUrl.startsWith("postgres")) {
  adapter = new PrismaPg({ connectionString: databaseUrl });
} else {
  const filePath = databaseUrl.replace(/^file:/, "");
  adapter = new PrismaBetterSqlite3({ url: filePath || "./prisma/data.db" });
}
const prisma = new PrismaClient({ adapter });

function cleanContent(raw) {
  let text = raw;
  // Remove leading "1x" and whitespace
  text = text.replace(/^1x\s*/, "");
  // Remove group header: "Наука и Техника ... Q➆ ... NNNN ... Максим Дуплей"
  text = text.replace(/Наука и Техника\s*𖤍\s*Q➆[\s\S]*?Дуплей\s*/m, "");
  // Collapse multiple whitespace/newlines into single spaces
  text = text.replace(/\s+/g, " ").trim();
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

function cleanExcerpt(raw, title) {
  let text = raw.replace(/\s+/g, " ").trim();
  // Skip past the title
  const titleWords = title.split(/\s+/).slice(0, 4).join("\\s+");
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

async function main() {
  const raw = fs.readFileSync("scripts/vk-articles-extracted.json", "utf-8");
  const articles = JSON.parse(raw);

  const okArticles = articles.filter((a) => a.status === "ok");
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
  let skipped = 0;

  for (const art of okArticles) {
    const content = cleanContent(art.content);
    if (content.length < 100) {
      console.log(`SKIP (short): ${art.title.slice(0, 60)}`);
      skipped++;
      continue;
    }

    const slug = art.slug.replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 80);
    const category = mapCategory(art.title, content);
    const readTime = estimateReadTime(content);
    const excerpt = cleanExcerpt(art.excerpt || content, art.title);
    const coverImage = art.images?.[0] || null;

    // Check if already exists
    const existing = await prisma.article.findUnique({ where: { slug } });
    if (existing) {
      console.log(`SKIP (exists): ${art.title.slice(0, 60)}`);
      skipped++;
      continue;
    }

    try {
      const created = await prisma.article.create({
        data: {
          title: art.title.replace(/[^\w\s\-а-яА-Яa-zA-Z(),.:!?]/g, "").trim().slice(0, 200),
          slug,
          content,
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
      console.error(`ERROR: ${art.title.slice(0, 60)}: ${err.message}`);
    }
  }

  console.log(`\nDone! Imported: ${imported}, Skipped: ${skipped}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
