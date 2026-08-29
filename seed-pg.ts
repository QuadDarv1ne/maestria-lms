import { PrismaClient } from './src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const databaseUrl = process.env.DATABASE_URL || 'postgresql://maestria:Stalkerqwe1007@localhost:5432/maestria_lms';

const adapter = new PrismaPg({ connectionString: databaseUrl });
const db = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // Clean existing data
  console.log('Cleaning existing data...');
  await db.assignmentSubmission.deleteMany();
  await db.progress.deleteMany();
  await db.enrollment.deleteMany();
  await db.review.deleteMany();
  await db.payment.deleteMany();
  await db.certificate.deleteMany();
  await db.notification.deleteMany();
  await db.article.deleteMany();
  await db.lesson.deleteMany();
  await db.module.deleteMany();
  await db.course.deleteMany();
  await db.category.deleteMany();
  await db.account.deleteMany();
  await db.session.deleteMany();

  // Demo user
  const demoPassword = await bcrypt.hash('demo123', 10);
  const user = await db.user.upsert({
    where: { email: 'demo@maestria.lms' },
    update: {},
    create: {
      email: 'demo@maestria.lms',
      name: 'Demo Teacher',
      passwordHash: demoPassword,
      role: 'teacher',
      bio: 'Преподаватель Maestria LMS',
    },
  });
  console.log('Created demo user');

  // Categories
  const categories = await Promise.all([
    db.category.upsert({
      where: { name: 'Разработка' },
      update: {},
      create: { name: 'Разработка', slug: 'development' },
    }),
    db.category.upsert({
      where: { name: 'Тестирование' },
      update: {},
      create: { name: 'Тестирование', slug: 'testing' },
    }),
    db.category.upsert({
      where: { name: 'Базы данных' },
      update: {},
      create: { name: 'Базы данных', slug: 'databases' },
    }),
  ]);
  console.log('Created categories');

  // Articles
  const articles = await Promise.all([
    db.article.create({
      data: {
        title: 'Как начать изучать JavaScript',
        slug: 'how-to-start-learning-javascript',
        content: '# Как начать изучать JavaScript\n\nJavaScript — один из самых популярных языков программирования...',
        excerpt: 'Пошаговое руководство по изучению JavaScript с нуля',
        category: 'development',
        readTime: 10,
        views: 0,
        isPublished: true,
        isFeatured: true,
        author: { connect: { id: user.id } },
      },
    }),
    db.article.create({
      data: {
        title: 'Основы работы с базами данных',
        slug: 'basics-of-databases',
        content: '# Основы работы с базами данных\n\nБазы данных — это...',
        excerpt: 'Всё, что нужно знать о базах данных',
        category: 'databases',
        readTime: 15,
        views: 0,
        isPublished: true,
        isFeatured: false,
        author: { connect: { id: user.id } },
      },
    }),
    db.article.create({
      data: {
        title: 'Тестирование веб-приложений',
        slug: 'web-app-testing',
        content: '# Тестирование веб-приложений\n\nТестирование — это...',
        excerpt: 'Методы и инструменты тестирования',
        category: 'testing',
        readTime: 12,
        views: 0,
        isPublished: true,
        isFeatured: false,
        author: { connect: { id: user.id } },
      },
    }),
  ]);
  console.log('Created articles');

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
