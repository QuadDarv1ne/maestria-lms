const { PrismaClient } = require('./src/generated/prisma/client');

const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Checking articles in database...');
    const count = await prisma.article.count();
    console.log('Total articles:', count);
    
    const published = await prisma.article.count({
      where: { isPublished: true }
    });
    console.log('Published articles:', published);
    
    const articles = await prisma.article.findMany({
      select: { id: true, title: true, slug: true, isPublished: true },
      take: 5,
    });
    console.log('Sample articles:', JSON.stringify(articles, null, 2));
  } catch (err) {
    console.error('Error:', err.message);
    console.error(err.stack);
  } finally {
    await prisma.$disconnect();
  }
}

main();
