// Use the generated Prisma client with the correct adapter
const { PrismaClient } = require('./src/generated/prisma/client/rust');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const { Database } = require('better-sqlite3');

const adapter = new PrismaBetterSqlite3({ url: 'file:./prisma/data.db' });
const db = new PrismaClient({ adapter });

async function check() {
  try {
    console.log('=== DATABASE CHECK ===\n');

    const courses = await db.course.findMany({ take: 20 });
    console.log('Courses count:', courses.length);
    courses.forEach(c => console.log(`  - [${c.isPublished ? 'published' : 'draft'}] ${c.title}`));

    const categories = await db.category.findMany();
    console.log('\nCategories count:', categories.length);
    categories.forEach(c => console.log(`  - ${c.name} (${c.slug})`));

    const users = await db.user.findMany({ take: 10 });
    console.log('\nUsers count:', users.length);
    users.forEach(u => console.log(`  - ${u.name} (${u.role})`));

    const articles = await db.article.findMany({ take: 20 });
    console.log('\nArticles count:', articles.length);
    articles.forEach(a => console.log(`  - [${a.isPublished ? 'published' : 'draft'}] ${a.title}`));

    const enrollments = await db.enrollment.count();
    console.log('\nTotal enrollments:', enrollments);

    const payments = await db.payment.count();
    console.log('Total payments:', payments);

  } catch(e) {
    console.error('Error:', e.message);
  } finally {
    await db.$disconnect();
  }
}

check();
