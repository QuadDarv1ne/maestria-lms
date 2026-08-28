import { PrismaClient } from './src/generated/prisma/client.js';

const prisma = new PrismaClient();

try {
  console.log('Tables check...');
  const articles = await prisma.article.findMany({
    select: { id: true, title: true, slug: true, isPublished: true },
    take: 5,
  });
  console.log('Articles found:', articles.length);
  console.log('Articles:', JSON.stringify(articles, null, 2));
} catch (err) {
  console.error('Error:', err.message);
} finally {
  await prisma.$disconnect();
}
