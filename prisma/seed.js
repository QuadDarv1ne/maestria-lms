const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  console.log('Seeding database...');

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

  // Find existing user
  const user = await db.user.findFirst();
  if (!user) {
    console.error('No user found! Create a user first.');
    return;
  }

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
  ]);

  console.log(`Created ${courses.length} courses`);
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
