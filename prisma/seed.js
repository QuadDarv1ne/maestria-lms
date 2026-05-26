const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const db = new PrismaClient();

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
  // Keep the demo user, don't delete

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

  console.log(`Created user: ${user.email} (password: demo123)`);

  // Categories
  const categories = await Promise.all([
    db.category.create({
      data: {
        name: 'Программирование на Python',
        slug: 'python',
        icon: '🐍',
        color: '#3776AB',
        description: 'Курсы по Python: от основ до продвинутых тем',
      },
    }),
    db.category.create({
      data: {
        name: 'Веб-разработка',
        slug: 'web-development',
        icon: '🌐',
        color: '#E34F26',
        description: 'HTML, CSS, JavaScript, фреймворки и всё для веба',
      },
    }),
    db.category.create({
      data: {
        name: 'Создание игр в Roblox',
        slug: 'roblox',
        icon: '🎮',
        color: '#E2231A',
        description: 'Разработка игр в Roblox Studio на Lua',
      },
    }),
    db.category.create({
      data: {
        name: 'C++/C#',
        slug: 'cpp-csharp',
        icon: '⚡',
        color: '#68217A',
        description: 'Программирование на C++ и C#',
      },
    }),
    db.category.create({
      data: {
        name: 'Data Science',
        slug: 'data-science',
        icon: '📊',
        color: '#FF6F00',
        description: 'Анализ данных, машинное обучение, визуализация',
      },
    }),
    db.category.create({
      data: {
        name: 'Мобильная разработка',
        slug: 'mobile-development',
        icon: '📱',
        color: '#3DDC84',
        description: 'Разработка мобильных приложений для iOS и Android',
      },
    }),
  ]);

  console.log(`Created ${categories.length} categories`);

  // Courses
  const courses = await Promise.all([
    db.course.create({
      data: {
        title: 'Python с нуля до Junior Developer',
        slug: 'python-zero-to-junior',
        description: 'Полный курс Python для начинающих. Изучите основы программирования, ООП, работу с библиотеками и создадите 5 проектов для портфолио.',
        shortDesc: 'Полный курс Python для начинающих',
        price: 4990,
        oldPrice: 9990,
        level: 'beginner',
        duration: '8 недель',
        isPublished: true,
        isFeatured: true,
        hasCertificate: true,
        rating: 4.8,
        studentCount: 156,
        tags: 'python,programming,beginner',
        categoryId: categories[0].id,
        teacherId: user.id,
        modules: {
          create: [
            {
              title: 'Введение в Python',
              description: 'Основы языка, установка, первая программа',
              sortOrder: 1,
              lessons: {
                create: [
                  { title: 'Что такое Python?', type: 'video', duration: 15, isFree: true, sortOrder: 1 },
                  { title: 'Установка Python и IDE', type: 'video', duration: 20, isFree: true, sortOrder: 2 },
                  { title: 'Hello World — первая программа', type: 'text', duration: 10, isFree: true, sortOrder: 3 },
                ],
              },
            },
            {
              title: 'Переменные и типы данных',
              description: 'Числа, строки, списки, словари',
              sortOrder: 2,
              lessons: {
                create: [
                  { title: 'Числовые типы', type: 'video', duration: 25, sortOrder: 1 },
                  { title: 'Строки и методы', type: 'video', duration: 30, sortOrder: 2 },
                  { title: 'Списки и кортежи', type: 'text', duration: 20, sortOrder: 3 },
                ],
              },
            },
            {
              title: 'Условные конструкции и циклы',
              description: 'if/else, for, while',
              sortOrder: 3,
              lessons: {
                create: [
                  { title: 'Оператор if/else', type: 'video', duration: 20, sortOrder: 1 },
                  { title: 'Цикл for', type: 'video', duration: 25, sortOrder: 2 },
                  { title: 'Цикл while', type: 'text', duration: 15, sortOrder: 3 },
                ],
              },
            },
          ],
        },
      },
    }),
    db.course.create({
      data: {
        title: 'React + Next.js: Fullstack разработка',
        slug: 'react-nextjs-fullstack',
        description: 'Научитесь создавать современные веб-приложения с React и Next.js. SSR, SSG, API routes, аутентификация и деплой.',
        shortDesc: 'Fullstack разработка на React и Next.js',
        price: 7990,
        oldPrice: 14990,
        level: 'intermediate',
        duration: '12 недель',
        isPublished: true,
        isFeatured: true,
        hasCertificate: true,
        rating: 4.9,
        studentCount: 89,
        tags: 'react,nextjs,frontend,fullstack',
        categoryId: categories[1].id,
        teacherId: user.id,
        modules: {
          create: [
            {
              title: 'Основы React',
              description: 'Компоненты, props, state, хуки',
              sortOrder: 1,
              lessons: {
                create: [
                  { title: 'Что такое React?', type: 'video', duration: 20, isFree: true, sortOrder: 1 },
                  { title: 'JSX и компоненты', type: 'video', duration: 25, sortOrder: 2 },
                  { title: 'Props и State', type: 'text', duration: 15, sortOrder: 3 },
                ],
              },
            },
            {
              title: 'Хуки React',
              description: 'useState, useEffect, useContext, useMemo',
              sortOrder: 2,
              lessons: {
                create: [
                  { title: 'useState и useEffect', type: 'video', duration: 30, sortOrder: 1 },
                  { title: 'useContext и useReducer', type: 'video', duration: 25, sortOrder: 2 },
                ],
              },
            },
          ],
        },
      },
    }),
    db.course.create({
      data: {
        title: 'Создание игр в Roblox Studio',
        slug: 'roblox-game-dev',
        description: 'Создавайте собственные игры в Roblox Studio с использованием Lua. От основ до публикации игры в каталоге Roblox.',
        shortDesc: 'Разработка игр в Roblox на Lua',
        price: 3990,
        level: 'beginner',
        duration: '6 недель',
        isPublished: true,
        hasCertificate: true,
        rating: 4.7,
        studentCount: 234,
        tags: 'roblox,lua,gamedev',
        categoryId: categories[2].id,
        teacherId: user.id,
        modules: {
          create: [
            {
              title: 'Знакомство с Roblox Studio',
              description: 'Установка, интерфейс, создание первого мира',
              sortOrder: 1,
              lessons: {
                create: [
                  { title: 'Установка Roblox Studio', type: 'video', duration: 15, isFree: true, sortOrder: 1 },
                  { title: 'Интерфейс и инструменты', type: 'video', duration: 20, sortOrder: 2 },
                ],
              },
            },
          ],
        },
      },
    }),
    db.course.create({
      data: {
        title: 'C++ для начинающих: основы программирования',
        slug: 'cpp-basics',
        description: 'Изучите C++ с нуля. Переменные, функции, ООП, STL, указатели и работа с памятью.',
        shortDesc: 'Основы программирования на C++',
        price: 5490,
        oldPrice: 8990,
        level: 'beginner',
        duration: '10 недель',
        isPublished: true,
        hasCertificate: true,
        rating: 4.6,
        studentCount: 67,
        tags: 'cpp,programming,beginner',
        categoryId: categories[3].id,
        teacherId: user.id,
        modules: {
          create: [
            {
              title: 'Введение в C++',
              description: 'Установка компилятора, первая программа',
              sortOrder: 1,
              lessons: {
                create: [
                  { title: 'Что такое C++?', type: 'video', duration: 18, isFree: true, sortOrder: 1 },
                  { title: 'Установка MinGW и VS Code', type: 'text', duration: 12, sortOrder: 2 },
                ],
              },
            },
          ],
        },
      },
    }),
    db.course.create({
      data: {
        title: 'Data Science с Python: анализ данных',
        slug: 'data-science-python',
        description: 'Pandas, NumPy, Matplotlib, Seaborn. Анализ и визуализация данных, статистика и основы машинного обучения.',
        shortDesc: 'Анализ данных и визуализация с Python',
        price: 6990,
        oldPrice: 12990,
        level: 'intermediate',
        duration: '10 недель',
        isPublished: true,
        isFeatured: true,
        hasCertificate: true,
        rating: 4.8,
        studentCount: 112,
        tags: 'python,data-science,pandas,ml',
        categoryId: categories[4].id,
        teacherId: user.id,
        modules: {
          create: [
            {
              title: 'Введение в Data Science',
              description: 'Что такое DS, инструменты, установка Anaconda',
              sortOrder: 1,
              lessons: {
                create: [
                  { title: 'Что такое Data Science?', type: 'video', duration: 20, isFree: true, sortOrder: 1 },
                  { title: 'Установка Anaconda и Jupyter', type: 'text', duration: 10, sortOrder: 2 },
                ],
              },
            },
          ],
        },
      },
    }),
    db.course.create({
      data: {
        title: 'React Native: мобильные приложения',
        slug: 'react-native-mobile',
        description: 'Создавайте кроссплатформенные мобильные приложения для iOS и Android с помощью React Native.',
        shortDesc: 'Кроссплатформенные приложения на React Native',
        price: 8490,
        level: 'advanced',
        duration: '14 недель',
        isPublished: true,
        hasCertificate: true,
        rating: 4.5,
        studentCount: 45,
        tags: 'react-native,mobile,ios,android',
        categoryId: categories[5].id,
        teacherId: user.id,
        modules: {
          create: [
            {
              title: 'Введение в React Native',
              description: 'Установка Expo, первый проект',
              sortOrder: 1,
              lessons: {
                create: [
                  { title: 'Что такое React Native?', type: 'video', duration: 15, isFree: true, sortOrder: 1 },
                  { title: 'Установка Expo CLI', type: 'text', duration: 10, sortOrder: 2 },
                ],
              },
            },
          ],
        },
      },
    }),
    // Free course
    db.course.create({
      data: {
        title: 'Основы HTML и CSS: бесплатный курс',
        slug: 'html-css-basics-free',
        description: 'Бесплатный курс по основам HTML и CSS. Научитесь создавать веб-страницы с нуля.',
        shortDesc: 'Бесплатный курс по HTML и CSS',
        price: 0,
        level: 'beginner',
        duration: '3 недели',
        isPublished: true,
        hasCertificate: false,
        rating: 4.3,
        studentCount: 512,
        tags: 'html,css,free,beginner',
        categoryId: categories[1].id,
        teacherId: user.id,
        modules: {
          create: [
            {
              title: 'Основы HTML',
              description: 'Теги, атрибуты, структура документа',
              sortOrder: 1,
              lessons: {
                create: [
                  { title: 'Что такое HTML?', type: 'video', duration: 10, isFree: true, sortOrder: 1 },
                  { title: 'Основные теги', type: 'text', duration: 15, isFree: true, sortOrder: 2 },
                ],
              },
            },
            {
              title: 'Основы CSS',
              description: 'Селекторы, свойства, flexbox',
              sortOrder: 2,
              lessons: {
                create: [
                  { title: 'CSS селекторы', type: 'video', duration: 20, isFree: true, sortOrder: 1 },
                  { title: 'Flexbox layout', type: 'video', duration: 25, isFree: true, sortOrder: 2 },
                ],
              },
            },
          ],
        },
      },
    }),
    // QA Manual Testing
    db.course.create({
      data: {
        title: 'QA-инженер: ручное тестирование с нуля',
        slug: 'qa-manual-testing-zero-to-hero',
        description: 'Научитесь тестировать веб-приложения, работать с API через Postman, писать SQL-запросы, оформлять баг-репорты в Яндекс Трекере и работать в Test IT. Исследовательское тестирование, тест-дизайн и анализ логов.',
        shortDesc: 'Ручное тестирование: Postman, SQL, API, Test IT',
        price: 4990,
        level: 'beginner',
        duration: '4 месяца',
        isPublished: true,
        isFeatured: true,
        hasCertificate: true,
        rating: 4.7,
        studentCount: 89,
        tags: 'qa,testing,manual,postman,sql,test-it',
        categoryId: categories[1].id,
        teacherId: user.id,
        modules: {
          create: [
            {
              title: 'Основы тестирования',
              description: 'Виды тестирования, тест-дизайн, классы эквивалентности',
              sortOrder: 1,
              lessons: {
                create: [
                  { title: 'Что такое QA?', type: 'video', duration: 15, isFree: true, sortOrder: 1 },
                  { title: 'Тест-дизайн на практике', type: 'text', duration: 20, isFree: true, sortOrder: 2 },
                ],
              },
            },
            {
              title: 'API и SQL тестирование',
              description: 'Postman, Swagger, SQL-запросы',
              sortOrder: 2,
              lessons: {
                create: [
                  { title: 'Тестирование API в Postman', type: 'video', duration: 25, sortOrder: 1 },
                  { title: 'SQL-запросы для QA', type: 'video', duration: 30, sortOrder: 2 },
                ],
              },
            },
            {
              title: 'Инструменты QA',
              description: 'Яндекс Трекер, Test IT, исследовательское тестирование',
              sortOrder: 3,
              lessons: {
                create: [
                  { title: 'Работа с баг-трекером', type: 'video', duration: 20, sortOrder: 1 },
                  { title: 'Test IT: управление тестами', type: 'text', duration: 15, sortOrder: 2 },
                ],
              },
            },
          ],
        },
      },
    }),
    // QA Automation
    db.course.create({
      data: {
        title: 'Python QA: автоматизация тестирования с Playwright',
        slug: 'python-qa-automation-playwright',
        description: 'Пишите автотесты на Python с Playwright и requests. Проектируйте тестовый фреймворк (Page Object, фикстуры, параметризация). Настраивайте CI/CD через GitHub Actions, работайте с Allure, Git и Docker.',
        shortDesc: 'Автотесты на Python: Playwright, CI/CD, Allure',
        price: 8990,
        oldPrice: 14990,
        level: 'intermediate',
        duration: '9 месяцев',
        isPublished: true,
        isFeatured: true,
        hasCertificate: true,
        rating: 4.9,
        studentCount: 67,
        tags: 'qa,python,playwright,automation,ci-cd,allure',
        categoryId: categories[0].id,
        teacherId: user.id,
        modules: {
          create: [
            {
              title: 'Python для автоматизации',
              description: 'Основы Python, pytest, работа с API',
              sortOrder: 1,
              lessons: {
                create: [
                  { title: 'Python для QA', type: 'video', duration: 20, isFree: true, sortOrder: 1 },
                  { title: 'Тестирование API с requests', type: 'video', duration: 25, sortOrder: 2 },
                ],
              },
            },
            {
              title: 'Playwright и Page Object',
              description: 'Автотесты UI, паттерн Page Object',
              sortOrder: 2,
              lessons: {
                create: [
                  { title: 'Введение в Playwright', type: 'video', duration: 30, sortOrder: 1 },
                  { title: 'Page Object паттерн', type: 'video', duration: 25, sortOrder: 2 },
                ],
              },
            },
            {
              title: 'CI/CD и отчёты',
              description: 'GitHub Actions, Allure, интеграция с Test IT',
              sortOrder: 3,
              lessons: {
                create: [
                  { title: 'Настройка GitHub Actions', type: 'video', duration: 20, sortOrder: 1 },
                  { title: 'Отчёты в Allure', type: 'text', duration: 15, sortOrder: 2 },
                ],
              },
            },
          ],
        },
      },
    }),
    // Python Pro
    db.course.create({
      data: {
        title: 'Python Pro: от Junior до Middle разработчика',
        slug: 'python-pro-junior-to-middle',
        description: 'Углублённое изучение Python: асинхронность, декораторы, генераторы, работа с БД, паттерны проектирования, тестирование и деплой.',
        shortDesc: 'Продвинутый Python: async, паттерны, деплой',
        price: 7490,
        oldPrice: 12990,
        level: 'intermediate',
        duration: '10 недель',
        isPublished: true,
        hasCertificate: true,
        rating: 4.8,
        studentCount: 54,
        tags: 'python,advanced,async,oop,patterns',
        categoryId: categories[0].id,
        teacherId: user.id,
        modules: {
          create: [
            {
              title: 'Продвинутый Python',
              description: 'Декораторы, генераторы, метаклассы',
              sortOrder: 1,
              lessons: {
                create: [
                  { title: 'Декораторы и замыкания', type: 'video', duration: 25, isFree: true, sortOrder: 1 },
                  { title: 'Генераторы и итераторы', type: 'video', duration: 20, sortOrder: 2 },
                ],
              },
            },
            {
              title: 'Асинхронность и паттерны',
              description: 'asyncio, asyncio.gather, паттерны проектирования',
              sortOrder: 2,
              lessons: {
                create: [
                  { title: 'Asyncio на практике', type: 'video', duration: 30, sortOrder: 1 },
                  { title: 'Паттерны GoF в Python', type: 'text', duration: 25, sortOrder: 2 },
                ],
              },
            },
          ],
        },
      },
    }),
    // FastAPI
    db.course.create({
      data: {
        title: 'FastAPI: создание REST API с нуля',
        slug: 'fastapi-rest-api-from-scratch',
        description: 'Создавайте современные API на FastAPI: маршруты, валидация Pydantic, асинхронные endpoints, SQLAlchemy, JWT аутентификация, Docker.',
        shortDesc: 'REST API на FastAPI: Pydantic, SQLAlchemy, JWT',
        price: 6990,
        level: 'intermediate',
        duration: '8 недель',
        isPublished: true,
        hasCertificate: true,
        rating: 4.7,
        studentCount: 78,
        tags: 'python,fastapi,api,backend,sqlalchemy',
        categoryId: categories[0].id,
        teacherId: user.id,
        modules: {
          create: [
            {
              title: 'Основы FastAPI',
              description: 'Маршруты, Pydantic, зависимости',
              sortOrder: 1,
              lessons: {
                create: [
                  { title: 'Первый endpoint на FastAPI', type: 'video', duration: 15, isFree: true, sortOrder: 1 },
                  { title: 'Валидация с Pydantic', type: 'video', duration: 20, sortOrder: 2 },
                ],
              },
            },
            {
              title: 'Базы данных и аутентификация',
              description: 'SQLAlchemy, JWT, защита API',
              sortOrder: 2,
              lessons: {
                create: [
                  { title: 'SQLAlchemy и миграции', type: 'video', duration: 25, sortOrder: 1 },
                  { title: 'JWT аутентификация', type: 'video', duration: 30, sortOrder: 2 },
                ],
              },
            },
          ],
        },
      },
    }),
    // Frontend Pro
    db.course.create({
      data: {
        title: 'Frontend Pro: React, TypeScript, Next.js',
        slug: 'frontend-pro-react-typescript-nextjs',
        description: 'Полный курс фронтенда: React 19, Server Components, TypeScript, Next.js App Router, Zustand, Tailwind, тестирование с Vitest.',
        shortDesc: 'React 19, TypeScript, Next.js, Server Components',
        price: 9990,
        oldPrice: 16990,
        level: 'advanced',
        duration: '14 недель',
        isPublished: true,
        isFeatured: true,
        hasCertificate: true,
        rating: 4.9,
        studentCount: 43,
        tags: 'react,typescript,nextjs,frontend,server-components',
        categoryId: categories[1].id,
        teacherId: user.id,
        modules: {
          create: [
            {
              title: 'React и TypeScript',
              description: 'Типизация компонентов, хуки, контекст',
              sortOrder: 1,
              lessons: {
                create: [
                  { title: 'TypeScript в React', type: 'video', duration: 20, isFree: true, sortOrder: 1 },
                  { title: 'Типизация хуков', type: 'video', duration: 25, sortOrder: 2 },
                ],
              },
            },
            {
              title: 'Next.js App Router',
              description: 'Server Components, маршрутизация, данные',
              sortOrder: 2,
              lessons: {
                create: [
                  { title: 'Server Components', type: 'video', duration: 30, sortOrder: 1 },
                  { title: 'Server Actions', type: 'video', duration: 25, sortOrder: 2 },
                ],
              },
            },
          ],
        },
      },
    }),
    // Fullstack TypeScript
    db.course.create({
      data: {
        title: 'Fullstack TypeScript: от идеи до продакшена',
        slug: 'fullstack-typescript-idea-to-production',
        description: 'Создайте полноценное приложение: Next.js + tRPC + Prisma + PostgreSQL. Аутентификация, платежи, деплой на Vercel, CI/CD.',
        shortDesc: 'Next.js + tRPC + Prisma + PostgreSQL',
        price: 11990,
        oldPrice: 19990,
        level: 'advanced',
        duration: '16 недель',
        isPublished: true,
        hasCertificate: true,
        rating: 4.8,
        studentCount: 31,
        tags: 'typescript,fullstack,nextjs,trpc,prisma,postgresql',
        categoryId: categories[1].id,
        teacherId: user.id,
        modules: {
          create: [
            {
              title: 'Архитектура приложения',
              description: 'tRPC, Prisma, структура проекта',
              sortOrder: 1,
              lessons: {
                create: [
                  { title: 'Введение в tRPC', type: 'video', duration: 20, isFree: true, sortOrder: 1 },
                  { title: 'Prisma схема и миграции', type: 'video', duration: 25, sortOrder: 2 },
                ],
              },
            },
            {
              title: 'Продакшен и деплой',
              description: 'Vercel, CI/CD, мониторинг',
              sortOrder: 2,
              lessons: {
                create: [
                  { title: 'Деплой на Vercel', type: 'video', duration: 15, sortOrder: 1 },
                  { title: 'CI/CD пайлайн', type: 'text', duration: 20, sortOrder: 2 },
                ],
              },
            },
          ],
        },
      },
    }),
    // Unity C#
    db.course.create({
      data: {
        title: 'Unity C#: создание 2D и 3D игр',
        slug: 'unity-csharp-2d-3d-games',
        description: 'Создавайте игры на Unity с C#: физика, анимации, UI, сохранение прогресса, публикация на itch.io.',
        shortDesc: 'Игры на Unity: физика, анимации, публикация',
        price: 5990,
        level: 'beginner',
        duration: '10 недель',
        isPublished: true,
        hasCertificate: true,
        rating: 4.6,
        studentCount: 123,
        tags: 'unity,csharp,gamedev,2d,3d',
        categoryId: categories[3].id,
        teacherId: user.id,
        modules: {
          create: [
            {
              title: 'Основы Unity',
              description: 'Интерфейс, GameObjects, компоненты',
              sortOrder: 1,
              lessons: {
                create: [
                  { title: 'Интерфейс Unity', type: 'video', duration: 15, isFree: true, sortOrder: 1 },
                  { title: 'Первый объект на сцене', type: 'video', duration: 20, sortOrder: 2 },
                ],
              },
            },
            {
              title: 'C# скрипты',
              description: 'Переменные, методы, физика, коллизии',
              sortOrder: 2,
              lessons: {
                create: [
                  { title: 'Основы C# для Unity', type: 'video', duration: 25, sortOrder: 1 },
                  { title: 'Физика и коллизии', type: 'video', duration: 30, sortOrder: 2 },
                ],
              },
            },
          ],
        },
      },
    }),
    // Unreal Engine 5
    db.course.create({
      data: {
        title: 'Unreal Engine 5: разработка игр на C++',
        slug: 'unreal-engine-5-cpp-game-dev',
        description: 'Создавайте AAA-игры на UE5: Blueprints + C++, система частиц, AI, мультиплеер, Nanite и Lumen.',
        shortDesc: 'AAA-игры на UE5: Blueprints, C++, Nanite, Lumen',
        price: 7990,
        oldPrice: 13990,
        level: 'intermediate',
        duration: '12 недель',
        isPublished: true,
        hasCertificate: true,
        rating: 4.8,
        studentCount: 56,
        tags: 'unreal-engine,cpp,gamedev,multiplayer,ue5',
        categoryId: categories[3].id,
        teacherId: user.id,
        modules: {
          create: [
            {
              title: 'Введение в UE5',
              description: 'Интерфейс, Nanite, Lumen, Blueprints',
              sortOrder: 1,
              lessons: {
                create: [
                  { title: 'Интерфейс Unreal Engine', type: 'video', duration: 20, isFree: true, sortOrder: 1 },
                  { title: 'Nanite и Lumen', type: 'video', duration: 25, sortOrder: 2 },
                ],
              },
            },
            {
              title: 'C++ в Unreal Engine',
              description: 'Актеры, компоненты, AI, мультиплеер',
              sortOrder: 2,
              lessons: {
                create: [
                  { title: 'C++ классы в UE', type: 'video', duration: 30, sortOrder: 1 },
                  { title: 'Основы мультиплеера', type: 'video', duration: 35, sortOrder: 2 },
                ],
              },
            },
          ],
        },
      },
    }),
    // Machine Learning
    db.course.create({
      data: {
        title: 'Machine Learning: от теории к практике',
        slug: 'machine-learning-theory-to-practice',
        description: 'Scikit-learn, TensorFlow, нейронные сети, компьютерное зрение, NLP. Реальные проекты с датасетами.',
        shortDesc: 'ML: Scikit-learn, TensorFlow, нейронные сети',
        price: 8490,
        oldPrice: 14990,
        level: 'intermediate',
        duration: '12 недель',
        isPublished: true,
        isFeatured: true,
        hasCertificate: true,
        rating: 4.7,
        studentCount: 67,
        tags: 'ml,tensorflow,scikit-learn,neural-networks,nlp',
        categoryId: categories[4].id,
        teacherId: user.id,
        modules: {
          create: [
            {
              title: 'Основы ML',
              description: 'Scikit-learn, регрессия, классификация',
              sortOrder: 1,
              lessons: {
                create: [
                  { title: 'Линейная регрессия', type: 'video', duration: 25, isFree: true, sortOrder: 1 },
                  { title: 'Классификация с SVM', type: 'video', duration: 30, sortOrder: 2 },
                ],
              },
            },
            {
              title: 'Нейронные сети',
              description: 'TensorFlow, CNN, NLP',
              sortOrder: 2,
              lessons: {
                create: [
                  { title: 'Введение в TensorFlow', type: 'video', duration: 20, sortOrder: 1 },
                  { title: 'Компьютерное зрение с CNN', type: 'video', duration: 35, sortOrder: 2 },
                ],
              },
            },
          ],
        },
      },
    }),
    // Data Analyst
    db.course.create({
      data: {
        title: 'Аналитик данных: Excel → SQL → Python',
        slug: 'data-analyst-excel-sql-python',
        description: 'Полный стек аналитика: продвинутый Excel, SQL-запросы, визуализация в Tableau/Power BI, Python (Pandas, Matplotlib).',
        shortDesc: 'Excel, SQL, Python, Tableau для аналитики',
        price: 5990,
        level: 'beginner',
        duration: '8 недель',
        isPublished: true,
        hasCertificate: true,
        rating: 4.5,
        studentCount: 145,
        tags: 'data-analysis,excel,sql,python,tableau',
        categoryId: categories[4].id,
        teacherId: user.id,
        modules: {
          create: [
            {
              title: 'Excel для аналитики',
              description: 'Сводные таблицы, формулы, графики',
              sortOrder: 1,
              lessons: {
                create: [
                  { title: 'Продвинутые формулы', type: 'video', duration: 20, isFree: true, sortOrder: 1 },
                  { title: 'Сводные таблицы', type: 'video', duration: 25, sortOrder: 2 },
                ],
              },
            },
            {
              title: 'SQL и Python',
              description: 'Запросы, Pandas, визуализация',
              sortOrder: 2,
              lessons: {
                create: [
                  { title: 'SQL для аналитиков', type: 'video', duration: 30, sortOrder: 1 },
                  { title: 'Pandas и Matplotlib', type: 'video', duration: 25, sortOrder: 2 },
                ],
              },
            },
          ],
        },
      },
    }),
    // DevOps
    db.course.create({
      data: {
        title: 'DevOps для разработчиков: Docker, CI/CD, Kubernetes',
        slug: 'devops-docker-ci-cd-kubernetes',
        description: 'Контейнеризация с Docker, оркестрация Kubernetes, CI/CD пайлайны (GitHub Actions, GitLab CI), мониторинг (Prometheus, Grafana).',
        shortDesc: 'Docker, Kubernetes, CI/CD, мониторинг',
        price: 7490,
        oldPrice: 12990,
        level: 'intermediate',
        duration: '8 недель',
        isPublished: true,
        hasCertificate: true,
        rating: 4.8,
        studentCount: 52,
        tags: 'devops,docker,kubernetes,ci-cd,monitoring',
        categoryId: categories[1].id,
        teacherId: user.id,
        modules: {
          create: [
            {
              title: 'Docker',
              description: 'Контейнеры, Dockerfile, docker-compose',
              sortOrder: 1,
              lessons: {
                create: [
                  { title: 'Первый Docker контейнер', type: 'video', duration: 15, isFree: true, sortOrder: 1 },
                  { title: 'Docker Compose', type: 'video', duration: 25, sortOrder: 2 },
                ],
              },
            },
            {
              title: 'Kubernetes и CI/CD',
              description: 'Оркестрация, GitHub Actions, мониторинг',
              sortOrder: 2,
              lessons: {
                create: [
                  { title: 'Основы Kubernetes', type: 'video', duration: 30, sortOrder: 1 },
                  { title: 'CI/CD пайлайн', type: 'video', duration: 20, sortOrder: 2 },
                ],
              },
            },
          ],
        },
      },
    }),
    // Linux Admin
    db.course.create({
      data: {
        title: 'Linux-администратор: от основ до продакшена',
        slug: 'linux-admin-basics-to-production',
        description: 'Установка Linux, командная строка, bash-скриптинг, настройка серверов (Nginx, Apache), безопасность, мониторинг.',
        shortDesc: 'Linux: CLI, bash, Nginx, безопасность',
        price: 4990,
        level: 'beginner',
        duration: '6 недель',
        isPublished: true,
        hasCertificate: true,
        rating: 4.6,
        studentCount: 89,
        tags: 'linux,sysadmin,bash,nginx,security',
        categoryId: categories[1].id,
        teacherId: user.id,
        modules: {
          create: [
            {
              title: 'Основы Linux',
              description: 'Установка, командная строка, файловая система',
              sortOrder: 1,
              lessons: {
                create: [
                  { title: 'Установка Ubuntu', type: 'video', duration: 15, isFree: true, sortOrder: 1 },
                  { title: 'Командная строка', type: 'video', duration: 20, sortOrder: 2 },
                ],
              },
            },
            {
              title: 'Администрирование',
              description: 'Bash, Nginx, безопасность',
              sortOrder: 2,
              lessons: {
                create: [
                  { title: 'Bash-скриптинг', type: 'video', duration: 25, sortOrder: 1 },
                  { title: 'Настройка Nginx', type: 'video', duration: 30, sortOrder: 2 },
                ],
              },
            },
          ],
        },
      },
    }),
    // UI/UX Design
    db.course.create({
      data: {
        title: 'UI/UX дизайнер: проектирование интерфейсов в Figma',
        slug: 'ui-ux-design-figma-interfaces',
        description: 'Принципы UX, прототипирование, дизайн-системы, компоненты в Figma, user research, usability-тестирование.',
        shortDesc: 'Figma, прототипирование, дизайн-системы, UX',
        price: 5490,
        level: 'beginner',
        duration: '8 недель',
        isPublished: true,
        hasCertificate: true,
        rating: 4.7,
        studentCount: 167,
        tags: 'ui-ux,figma,design,prototyping,ux-research',
        categoryId: categories[1].id,
        teacherId: user.id,
        modules: {
          create: [
            {
              title: 'Основы UX',
              description: 'Исследование пользователей, персонажи, CJM',
              sortOrder: 1,
              lessons: {
                create: [
                  { title: 'Что такое UX?', type: 'video', duration: 15, isFree: true, sortOrder: 1 },
                  { title: 'User Research методы', type: 'text', duration: 20, sortOrder: 2 },
                ],
              },
            },
            {
              title: 'Figma и прототипирование',
              description: 'Компоненты, авто-лейаут, интерактивные прототипы',
              sortOrder: 2,
              lessons: {
                create: [
                  { title: 'Компоненты в Figma', type: 'video', duration: 25, sortOrder: 1 },
                  { title: 'Интерактивный прототип', type: 'video', duration: 30, sortOrder: 2 },
                ],
              },
            },
          ],
        },
      },
    }),
    // Flutter
    db.course.create({
      data: {
        title: 'Flutter & Dart: кроссплатформенные мобильные приложения',
        slug: 'flutter-dart-cross-platform-mobile',
        description: 'Создавайте приложения для iOS и Android на Flutter: виджеты, навигация, работа с API, state management (Riverpod), публикация.',
        shortDesc: 'Flutter: виджеты, Riverpod, публикация в сторах',
        price: 7990,
        oldPrice: 13990,
        level: 'intermediate',
        duration: '12 недель',
        isPublished: true,
        hasCertificate: true,
        rating: 4.6,
        studentCount: 38,
        tags: 'flutter,dart,mobile,ios,android,riverpod',
        categoryId: categories[5].id,
        teacherId: user.id,
        modules: {
          create: [
            {
              title: 'Основы Dart и Flutter',
              description: 'Синтаксис Dart, виджеты, навигация',
              sortOrder: 1,
              lessons: {
                create: [
                  { title: 'Основы Dart', type: 'video', duration: 20, isFree: true, sortOrder: 1 },
                  { title: 'Виджеты Flutter', type: 'video', duration: 25, sortOrder: 2 },
                ],
              },
            },
            {
              title: 'State Management и API',
              description: 'Riverpod, HTTP запросы, публикация',
              sortOrder: 2,
              lessons: {
                create: [
                  { title: 'Riverpod на практике', type: 'video', duration: 30, sortOrder: 1 },
                  { title: 'Публикация в App Store', type: 'text', duration: 15, sortOrder: 2 },
                ],
              },
            },
          ],
        },
      },
    }),
    // Ethical Hacking
    db.course.create({
      data: {
        title: 'Этичный хакинг: основы информационной безопасности',
        slug: 'ethical-hacking-cybersecurity-basics',
        description: 'OWASP Top 10, пентест веб-приложений, Kali Linux, Burp Suite, сетевая безопасность, криптография.',
        shortDesc: 'Пентест: OWASP, Kali Linux, Burp Suite',
        price: 6990,
        level: 'intermediate',
        duration: '8 недель',
        isPublished: true,
        hasCertificate: true,
        rating: 4.8,
        studentCount: 72,
        tags: 'security,hacking,owasp,kali-linux,burp-suite',
        categoryId: categories[1].id,
        teacherId: user.id,
        modules: {
          create: [
            {
              title: 'Основы безопасности',
              description: 'OWASP Top 10, Kali Linux, разведка',
              sortOrder: 1,
              lessons: {
                create: [
                  { title: 'OWASP Top 10', type: 'video', duration: 20, isFree: true, sortOrder: 1 },
                  { title: 'Установка Kali Linux', type: 'text', duration: 15, sortOrder: 2 },
                ],
              },
            },
            {
              title: 'Пентест веб-приложений',
              description: 'Burp Suite, XSS, SQL-инъекции',
              sortOrder: 2,
              lessons: {
                create: [
                  { title: 'Burp Suite на практике', type: 'video', duration: 30, sortOrder: 1 },
                  { title: 'SQL-инъекции', type: 'video', duration: 25, sortOrder: 2 },
                ],
              },
            },
          ],
        },
      },
    }),
    // IT Freelance
    db.course.create({
      data: {
        title: 'IT-фриланс: как найти клиентов и зарабатывать удалённо',
        slug: 'it-freelance-find-clients-earn-remote',
        description: 'Биржи фриланса, создание портфолио, оценка проектов, переговоры, тайм-менеджмент, юридические аспекты.',
        shortDesc: 'Фриланс в IT: портфолио, клиенты, переговоры',
        price: 2990,
        level: 'beginner',
        duration: '3 недели',
        isPublished: true,
        hasCertificate: false,
        rating: 4.4,
        studentCount: 234,
        tags: 'freelance,career,portfolio,negotiation,remote',
        categoryId: categories[1].id,
        teacherId: user.id,
        modules: {
          create: [
            {
              title: 'Основы фриланса',
              description: 'Биржи, портфолио, профили',
              sortOrder: 1,
              lessons: {
                create: [
                  { title: 'Лучшие биржи фриланса', type: 'video', duration: 15, isFree: true, sortOrder: 1 },
                  { title: 'Создание портфолио', type: 'text', duration: 20, sortOrder: 2 },
                ],
              },
            },
            {
              title: 'Работа с клиентами',
              description: 'Переговоры, оценка, юридические аспекты',
              sortOrder: 2,
              lessons: {
                create: [
                  { title: 'Как оценивать проекты', type: 'video', duration: 20, sortOrder: 1 },
                  { title: 'Юридические аспекты', type: 'text', duration: 15, sortOrder: 2 },
                ],
              },
            },
          ],
        },
      },
    }),
  ]);

  console.log(`Created ${courses.length} courses`);

  // Demo Articles for Blog
  const articles = await Promise.all([
    db.article.create({
      data: {
        title: 'Введение в современную веб-разработку: что нужно знать в 2026 году',
        slug: 'modern-web-development-2026',
        excerpt: 'Обзор ключевых технологий и инструментов для веб-разработчиков в 2026 году: React, Next.js, TypeScript, Tailwind CSS и многое другое.',
        content: `# Введение в современную веб-разработку

Веб-разработка продолжает стремительно развиваться. В 2026 году от разработчиков ожидается владение множеством инструментов и подходов.

## Основные тенденции

- **Server Components** стали стандартом
- **TypeScript** — обязательный навык
- **AI-ассистенты** интегрированы в рабочий процесс
- **Edge computing** для глобальной производительности

## Стек разработчика

Современный стек веб-разработчика включает:
1. React/Next.js или аналоги
2. TypeScript
3. Tailwind CSS
4. Prisma или другие ORM
5. Docker для контейнеризации

## Заключение

Веб-разработка становится доступнее, но требования к качеству растут.`,
        category: 'development',
        tags: 'web,react,javascript,typescript,2026',
        readTime: 7,
        isPublished: true,
        isFeatured: true,
        authorId: user.id,
      },
    }),
    db.article.create({
      data: {
        title: 'Тестирование ПО: полное руководство для начинающих',
        slug: 'software-testing-beginners-guide',
        excerpt: 'Всё о тестировании программного обеспечения: виды тестов, методологии, инструменты и лучшие практики для начинающих QA-инженеров.',
        content: `# Тестирование ПО: полное руководство

Тестирование — критически важная часть разработки программного обеспечения.

## Виды тестирования

### Функциональное тестирование
- Unit-тесты
- Интеграционные тесты
- End-to-end тесты

### Нефункциональное тестирование
- Тестирование производительности
- Тестирование безопасности
- Usability-тестирование

## Популярные инструменты

- **Jest** — для JavaScript/TypeScript
- **PyTest** — для Python
- **Selenium** — для E2E
- **Postman** — для API

## Лучшие практики

1. Пишите тесты рано
2. Используйте TDD подход
3. Автоматизируйте CI/CD
4. Следите за покрытием кода`,
        category: 'testing',
        tags: 'testing,qa,jest,automation',
        readTime: 10,
        isPublished: true,
        isFeatured: false,
        authorId: user.id,
      },
    }),
    db.article.create({
      data: {
        title: 'SQL и NoSQL базы данных: когда что использовать',
        slug: 'sql-vs-nosql-databases',
        excerpt: 'Сравнение реляционных и нереляционных баз данных: PostgreSQL, MongoDB, Redis, ClickHouse. Практические рекомендации по выбору.',
        content: `# SQL vs NoSQL: выбор базы данных

Выбор правильной базы данных — ключевое решение для любого проекта.

## Реляционные БД (SQL)

### PostgreSQL
- Полная поддержка ACID
- Сложные запросы и JOIN
- Расширяемость

### Когда использовать SQL?
- Финансовые системы
- CRM/ERP системы
- Когда важна целостность данных

## Нереляционные БД (NoSQL)

### MongoDB
- Документо-ориентированная
- Гибкая схема
- Горизонтальное масштабирование

### Redis
- In-memory хранилище
- Кэширование
- Очереди сообщений

## Итог

Выбор зависит от конкретных требований проекта.`,
        category: 'databases',
        tags: 'sql,nosql,postgresql,mongodb,redis',
        readTime: 8,
        isPublished: true,
        isFeatured: true,
        authorId: user.id,
      },
    }),
    db.article.create({
      data: {
        title: 'Искусственный интеллект в 2026: практическое применение для разработчиков',
        slug: 'ai-practical-applications-2026',
        excerpt: 'Как разработчики используют AI для повышения продуктивности: code generation, автоматизация, AI-ассистенты и нейросети.',
        content: `# AI для разработчиков в 2026

Искусственный интеллект трансформирует процесс разработки ПО.

## Основные направления

### Code Generation
- GitHub Copilot и аналоги
- Автоматическая генерация кода
- Рефакторинг с помощью AI

### Автоматизация тестирования
- Генерация тест-кейсов
- Автоматическое обнаружение багов

### AI-ассистенты
- Ответы на вопросы
- Code review
- Документация

## Инструменты

1. **GitHub Copilot** — AI pair programmer
2. **Cursor** — AI-first IDE
3. **v0** — генерация UI
4. **Claude/GPT** — текстовые ассистенты

## Заключение

AI не заменяет разработчиков, а усиливает их возможности.`,
        category: 'ai',
        tags: 'ai,machine-learning,copilot,automation',
        readTime: 6,
        isPublished: true,
        isFeatured: false,
        authorId: user.id,
      },
    }),
    db.article.create({
      data: {
        title: '3D-моделирование в Blender: первые шаги',
        slug: '3d-modeling-blender-first-steps',
        excerpt: 'Введение в 3D-моделирование с помощью Blender: интерфейс, базовые инструменты, создание первой модели и рендеринг.',
        content: `# 3D-моделирование в Blender

Blender — мощный бесплатный инструмент для 3D-моделирования.

## Начало работы

### Интерфейс
- 3D Viewport
- Outliner
- Properties Panel
- Timeline

### Базовые операции
1. Extrude (E)
2. Scale (S)
3. Rotate (R)
4. Move (G)

## Создание первой модели

### Шаг 1: Базовая форма
Начните с куба или сферы

### Шаг 2: Детализация
Добавьте модификаторы:
- Subdivision Surface
- Bevel
- Boolean

### Шаг 3: Материалы
Настройте цвета и текстуры

## Рендеринг

- **Eevee** — быстрый реал-тайм
- **Cycles** — фотореалистичный

## Ресурсы для обучения

- Blender Guru (YouTube)
- CG Cookie
- Official Documentation`,
        category: '3d-modeling',
        tags: 'blender,3d,modeling,rendering',
        readTime: 9,
        isPublished: true,
        isFeatured: false,
        authorId: user.id,
      },
    }),
    db.article.create({
      data: {
        title: 'Кибербезопасность: базовые принципы защиты веб-приложений',
        slug: 'cybersecurity-web-application-basics',
        excerpt: 'Основы безопасности веб-приложений: OWASP Top 10, XSS, CSRF, SQL-инъекции и методы защиты от распространенных атак.',
        content: `# Кибербезопасность веб-приложений

Безопасность — критически важный аспект разработки.

## OWASP Top 10

1. **Broken Access Control**
2. **Cryptographic Failures**
3. **Injection**
4. **Insecure Design**
5. **Security Misconfiguration**

## Основные угрозы

### SQL-инъекции
- Используйте параметризованные запросы
- ORM защищает автоматически

### XSS (Cross-Site Scripting)
- Санитайз входных данных
- CSP headers
- Escape вывода

### CSRF
- Anti-CSRF tokens
- SameSite cookies
- Проверка Origin header

## Лучшие практики

✅ Валидация всех входных данных
✅ Использование HTTPS
✅ Регулярные обновления зависимостей
✅ Принцип наименьших привилегий
✅ Логирование и мониторинг`,
        category: 'security',
        tags: 'security,owasp,xss,csrf,injection',
        readTime: 11,
        isPublished: true,
        isFeatured: false,
        authorId: user.id,
      },
    }),
  ]);

  console.log(`Created ${articles.length} articles`);

  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
