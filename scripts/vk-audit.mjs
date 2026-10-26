// Аудит импортированных статей: проверка форматирования и изображений
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

const articles = await prisma.article.findMany({
  where: { tags: { contains: "VK" } },
  select: { slug: true, title: true, content: true, image: true },
  orderBy: { createdAt: "desc" },
});

console.log(`Auditing ${articles.length} VK articles...\n`);

let totalVkImages = 0;
let totalLocalImages = 0;

for (const art of articles) {
  const content = art.content || "";
  const vkImages = (content.match(/vkuserphoto/g) || []).length;
  const localImages = (content.match(/\/uploads\/vk\//g) || []).length;
  totalVkImages += vkImages;
  totalLocalImages += localImages;

  const strong = (content.match(/<strong/gi) || []).length;
  const h1 = (content.match(/<h1/gi) || []).length;
  const h2 = (content.match(/<h2/gi) || []).length;
  const h3 = (content.match(/<h3/gi) || []).length;
  const p = (content.match(/<p[\s>]/gi) || []).length;
  const table = (content.match(/<table/gi) || []).length;
  const ul = (content.match(/<ul/gi) || []).length;
  const ol = (content.match(/<ol/gi) || []).length;
  const blockquote = (content.match(/<blockquote/gi) || []).length;

  const status = vkImages === 0 ? "OK " : "WARN";
  console.log(
    `[${status}] ${art.slug.slice(0, 50).padEnd(50)} | local:${localImages} vk:${vkImages} | strong:${strong} h:${h1 + h2 + h3} p:${p} tbl:${table} ul:${ul} ol:${ol} bq:${blockquote}`
  );
}

console.log(`\nTotals: local images=${totalLocalImages}, VK CDN images=${totalVkImages}`);

await prisma.$disconnect();
