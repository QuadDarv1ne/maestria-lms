import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, getAuthSession } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

// POST: Заполнить базу данных демо-данными (только для разработки)
export async function POST() {
  // Полностью блокируем в production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  // Дополнительная защита: требуем заголовок X-Seed-Data для предотвращения случайных вызовов
  const allowSeed = process.env.ALLOW_SEED_DATA === "true";
  if (!allowSeed) {
    return NextResponse.json(
      { error: "Seed-данные отключены. Установите ALLOW_SEED_DATA=true для активации." },
      { status: 403 }
    );
  }

  // Defense-in-depth: только администраторы могут запускать seed
  const session = await getAuthSession();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Доступ запрещён" }, { status: 403 });
  }

  try {
  // Очистка базы данных перед заполнением
  try {
    const dbUrl = process.env.DATABASE_URL || "";
    const isPostgres = dbUrl.startsWith("postgresql://") || dbUrl.startsWith("postgres://");
    const isMySQL = dbUrl.startsWith("mysql://");

    if (isPostgres) {
      // PostgreSQL: disable foreign keys, truncate all tables
      await db.$executeRawUnsafe(`SET session_replication_role = 'replica'`);
      const tables = ['Progress', 'Enrollment', 'Assignment', 'Lesson', 'Module', 'Certificate', 'Review', 'Payment', 'Course', 'Category', 'Session', 'Account', 'VerificationToken', 'User'];
      for (const table of tables) {
        await db.$executeRawUnsafe(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE`);
      }
      await db.$executeRawUnsafe(`SET session_replication_role = 'origin'`);
    } else if (isMySQL) {
      // MySQL: disable foreign key checks, delete all rows
      await db.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS = 0`);
      const tables = ['Progress', 'Enrollment', 'Assignment', 'Lesson', 'Module', 'Certificate', 'Review', 'Payment', 'Course', 'Category', 'Session', 'Account', 'VerificationToken', 'User'];
      for (const table of tables) {
        await db.$executeRawUnsafe(`DELETE FROM \`${table}\``);
      }
      await db.$executeRawUnsafe(`SET FOREIGN_KEY_CHECKS = 1`);
    } else {
      // SQLite (default)
      await db.$executeRawUnsafe(`PRAGMA foreign_keys = OFF`);
      const tables = ['Progress', 'Enrollment', 'Assignment', 'Lesson', 'Module', 'Certificate', 'Review', 'Payment', 'Course', 'Category', 'Session', 'Account', 'VerificationToken', 'User'];
      for (const table of tables) {
        await db.$executeRawUnsafe(`DELETE FROM "${table}"`);
      }
      try { await db.$executeRawUnsafe(`DELETE FROM sqlite_sequence`); } catch { /* safe to ignore */ }
      await db.$executeRawUnsafe(`PRAGMA foreign_keys = ON`);
    }
  } catch (cleanupError) {
    log.warn("Database cleanup before seed failed, proceeding anyway", { error: String(cleanupError) });
  }

  // ============ КАТЕГОРИИ ============
  const categories = await Promise.all([
    db.category.create({
      data: {
        name: "Программирование на Python",
        slug: "python",
        description: "Курсы по программированию на Python — от основ до продвинутых тем",
        icon: "🐍",
        color: "#3776AB",
        sortOrder: 1,
      },
    }),
    db.category.create({
      data: {
        name: "Веб-разработка",
        slug: "web-development",
        description: "Фронтенд и бэкенд разработка: HTML, CSS, JavaScript, React, Node.js",
        icon: "🌐",
        color: "#F7DF1E",
        sortOrder: 2,
      },
    }),
    db.category.create({
      data: {
        name: "Создание игр в Roblox",
        slug: "roblox",
        description: "Разработка игр в Roblox Studio на языке Lua",
        icon: "🎮",
        color: "#E2231A",
        sortOrder: 3,
      },
    }),
    db.category.create({
      data: {
        name: "C++/C#",
        slug: "cpp-csharp",
        description: "Системное программирование, разработка на C++ и C#",
        icon: "⚡",
        color: "#00599C",
        sortOrder: 4,
      },
    }),
    db.category.create({
      data: {
        name: "Data Science",
        slug: "data-science",
        description: "Анализ данных, машинное обучение, нейросети",
        icon: "📊",
        color: "#FF6F00",
        sortOrder: 5,
      },
    }),
    db.category.create({
      data: {
        name: "Мобильная разработка",
        slug: "mobile-development",
        description: "Разработка мобильных приложений для iOS и Android",
        icon: "📱",
        color: "#3DDC84",
        sortOrder: 6,
      },
    }),
  ]);

  // ============ ДЕМО-ПОЛЬЗОВАТЕЛИ ============
  const adminPasswordHash = await hashPassword("admin123");
  const teacherPasswordHash = await hashPassword("teacher123");

  await db.user.create({
    data: {
      email: "admin@maestro7it.ru",
      name: "Дуплей Максим Игоревич",
      passwordHash: adminPasswordHash,
      role: "admin",
      isActive: true,
      bio: "Руководитель образовательной платформы Maestria, школы программирования Maestro7IT и MentorHUB",
    },
  });

  const teacher1 = await db.user.create({
    data: {
      email: "teacher@maestro7it.ru",
      name: "Алексей Петров",
      passwordHash: teacherPasswordHash,
      role: "teacher",
      isActive: true,
      bio: "Опытный преподаватель программирования с 10-летним стажем. Специализация: Python, веб-разработка.",
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=teacher1",
    },
  });

  const teacher2 = await db.user.create({
    data: {
      email: "ivanova@maestro7it.ru",
      name: "Елена Иванова",
      passwordHash: teacherPasswordHash,
      role: "teacher",
      isActive: true,
      bio: "Разработчик игр в Roblox, преподаватель с опытом работы с детьми и подростками.",
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=teacher2",
    },
  });

  const teacher3 = await db.user.create({
    data: {
      email: "sidorov@maestro7it.ru",
      name: "Дмитрий Сидоров",
      passwordHash: teacherPasswordHash,
      role: "teacher",
      isActive: true,
      bio: "Data Scientist, преподаватель машинного обучения и анализа данных.",
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=teacher3",
    },
  });

  // ============ КУРСЫ ============
  const courses = await Promise.all([
    // Python
    db.course.create({
      data: {
        title: "Python для начинающих: с нуля до уверенного программиста",
        slug: "python-beginners",
        description: "Полный курс программирования на Python для начинающих. Вы изучите основы языка, научитесь писать программы, работать с файлами, базами данных и создадите свои первые проекты. Курс подходит для школьников и студентов, которые хотят научиться программировать.\n\nПрограмма курса включает:\n- Установка и настройка Python\n- Переменные, типы данных, операторы\n- Условные конструкции и циклы\n- Функции и модули\n- Работа со строками и списками\n- Объектно-ориентированное программирование\n- Работа с файлами\n- Создание проектов",
        shortDesc: "Полный курс Python для начинающих — от установки до первых проектов",
        image: "/courses/python.png",
        price: 0,
        level: "beginner",
        duration: "8 недель",
        language: "ru",
        isPublished: true,
        isFeatured: true,
        hasCertificate: true,
        rating: 4.8,
        reviewCount: 156,
        studentCount: 2340,
        tags: "python,программирование,начинающие,основы",
        requirements: JSON.stringify(["Умение пользоваться компьютером", "Желание учиться"]),
        whatYouLearn: JSON.stringify([
          "Основы программирования на Python",
          "Работа с переменными, циклами и функциями",
          "Объектно-ориентированное программирование",
          "Создание собственных проектов",
          "Работа с файлами и базами данных"
        ]),
        categoryId: categories[0].id,
        teacherId: teacher1.id,
        modules: {
          create: [
            {
              title: "Введение в Python",
              description: "Знакомство с языком Python, установка и первая программа",
              sortOrder: 1,
              lessons: {
                create: [
                  { title: "Что такое Python и зачем его учить?", type: "text", content: "Python — один из самых популярных языков программирования в мире. Он прост в изучении, универсален и используется в веб-разработке, анализе данных, искусственном интеллекте и многих других областях.\n\nВ этом уроке вы узнаете:\n- Почему Python так популярен\n- Где применяется Python\n- Как устроен язык и его экосистема\n- Что вас ждёт в этом курсе", duration: 15, sortOrder: 1, isFree: true },
                  { title: "Установка Python и настройка среды", type: "video", content: "Пошаговая инструкция по установке Python на ваш компьютер", videoUrl: "https://example.com/install-python", duration: 25, sortOrder: 2, isFree: true },
                  { title: "Первая программа: Hello World", type: "coding", content: "Напишите свою первую программу на Python! В этом уроке вы научитесь выводить текст на экран с помощью функции print().", duration: 20, sortOrder: 3, isFree: true },
                  {
                    title: "Тест: Введение в Python",
                    type: "quiz",
                    duration: 10,
                    sortOrder: 4,
                    isFree: false,
                    assignments: {
                      create: [
                        {
                          title: "Для чего чаще всего используется Python?",
                          description: "Выберите наиболее полный ответ",
                          type: "quiz",
                          points: 10,
                          options: JSON.stringify(["Только для веб-разработки", "Только для анализа данных", "Веб-разработка, анализ данных, AI, автоматизация", "Только для создания игр"]),
                          correctAnswer: "2", // index 2 — correct option
                        },
                        {
                          title: "Какой символ используется для комментариев в Python?",
                          description: "Выберите правильный вариант",
                          type: "quiz",
                          points: 10,
                          options: JSON.stringify(["//", "#", "/* */", "--"]),
                          correctAnswer: "1",
                        },
                        {
                          title: "Какая функция выводит текст на экран?",
                          description: "Выберите правильный ответ",
                          type: "quiz",
                          points: 10,
                          options: JSON.stringify(["console.log()", "echo()", "print()", "write()"]),
                          correctAnswer: "2",
                        },
                      ],
                    },
                  },
                ],
              },
            },
            {
              title: "Переменные и типы данных",
              description: "Работа с переменными, числами и строками",
              sortOrder: 2,
              lessons: {
                create: [
                  { title: "Переменные в Python", type: "text", content: "Переменная — это именованная область памяти для хранения данных. В Python переменные создаются простым присваиванием.", duration: 20, sortOrder: 1, isFree: false },
                  { title: "Числовые типы данных", type: "video", duration: 30, sortOrder: 2, isFree: false },
                  { title: "Строки и их методы", type: "text", content: "Строки (strings) — один из основных типов данных в Python. Строка представляет собой последовательность символов, заключённых в кавычки.", duration: 35, sortOrder: 3, isFree: false },
                  { title: "Практика: Работа с переменными", type: "coding", duration: 40, sortOrder: 4, isFree: false },
                ],
              },
            },
            {
              title: "Условные конструкции",
              description: "Принятие решений в программах с помощью if/elif/else",
              sortOrder: 3,
              lessons: {
                create: [
                  { title: "Операторы сравнения", type: "text", content: "Операторы сравнения позволяют сравнивать значения и получать результат True или False.", duration: 20, sortOrder: 1, isFree: false },
                  { title: "Конструкция if/else", type: "video", duration: 30, sortOrder: 2, isFree: false },
                  { title: "Множественные условия: elif", type: "text", duration: 25, sortOrder: 3, isFree: false },
                  { title: "Практика: Условия", type: "assignment", duration: 45, sortOrder: 4, isFree: false },
                ],
              },
            },
          ],
        },
      },
    }),

    // Python Advanced
    db.course.create({
      data: {
        title: "Python: Объектно-ориентированное программирование",
        slug: "python-oop",
        description: "Углублённый курс по ООП в Python. Классы, наследование, полиморфизм, инкапсуляция, магические методы, декораторы и паттерны проектирования. Для тех, кто уже освоил основы Python.",
        shortDesc: "Углублённый курс ООП в Python — классы, наследование, паттерны",
        image: "/courses/python.png",
        price: 2990,
        oldPrice: 4990,
        level: "intermediate",
        duration: "6 недель",
        language: "ru",
        isPublished: true,
        isFeatured: false,
        hasCertificate: true,
        rating: 4.7,
        reviewCount: 89,
        studentCount: 870,
        tags: "python,ооп,классы,паттерны",
        categoryId: categories[0].id,
        teacherId: teacher1.id,
        modules: {
          create: [
            {
              title: "Основы ООП",
              description: "Классы и объекты — фундамент объектно-ориентированного программирования",
              sortOrder: 1,
              lessons: {
                create: [
                  { title: "Что такое ООП?", type: "text", content: "Объектно-ориентированное программирование — это парадигма программирования, основанная на концепции объектов.", duration: 15, sortOrder: 1, isFree: true },
                  { title: "Создание первого класса", type: "video", duration: 30, sortOrder: 2, isFree: true },
                  { title: "Методы и атрибуты", type: "text", duration: 25, sortOrder: 3, isFree: false },
                ],
              },
            },
          ],
        },
      },
    }),

    // Web Development
    db.course.create({
      data: {
        title: "Веб-разработка с нуля: HTML, CSS, JavaScript",
        slug: "web-development-basics",
        description: "Полный курс веб-разработки для начинающих. Вы научитесь создавать современные веб-страницы с помощью HTML, стилизовать их с CSS и добавлять интерактивность с JavaScript. К концу курса вы создадите свой первый полноценный веб-сайт.",
        shortDesc: "HTML, CSS и JavaScript — создайте свой первый сайт с нуля",
        image: "/courses/web-dev.png",
        price: 1990,
        oldPrice: 3490,
        level: "beginner",
        duration: "10 недель",
        language: "ru",
        isPublished: true,
        isFeatured: true,
        hasCertificate: true,
        rating: 4.9,
        reviewCount: 234,
        studentCount: 3100,
        tags: "html,css,javascript,веб,фронтенд",
        requirements: JSON.stringify(["Базовые навыки работы с компьютером"]),
        whatYouLearn: JSON.stringify([
          "Создание веб-страниц на HTML5",
          "Стилизация с помощью CSS3",
          "Программирование на JavaScript",
          "Адаптивная вёрстка",
          "Создание полноценного веб-сайта"
        ]),
        categoryId: categories[1].id,
        teacherId: teacher1.id,
        modules: {
          create: [
            {
              title: "Основы HTML",
              description: "Структура веб-страницы и базовые теги HTML5",
              sortOrder: 1,
              lessons: {
                create: [
                  { title: "Что такое HTML?", type: "text", content: "HTML (HyperText Markup Language) — это язык разметки для создания веб-страниц.", duration: 15, sortOrder: 1, isFree: true },
                  { title: "Структура HTML-документа", type: "video", duration: 20, sortOrder: 2, isFree: true },
                  { title: "Текст и заголовки", type: "text", duration: 25, sortOrder: 3, isFree: false },
                  { title: "Ссылки и изображения", type: "text", duration: 20, sortOrder: 4, isFree: false },
                ],
              },
            },
            {
              title: "Основы CSS",
              description: "Стилизация веб-страниц",
              sortOrder: 2,
              lessons: {
                create: [
                  { title: "Что такое CSS?", type: "text", content: "CSS (Cascading Style Sheets) — это язык таблиц стилей для оформления веб-страниц.", duration: 15, sortOrder: 1, isFree: false },
                  { title: "Селекторы и свойства", type: "video", duration: 30, sortOrder: 2, isFree: false },
                  { title: "Flexbox и Grid", type: "text", duration: 40, sortOrder: 3, isFree: false },
                ],
              },
            },
          ],
        },
      },
    }),

    // React
    db.course.create({
      data: {
        title: "React: Современная фронтенд-разработка",
        slug: "react-modern",
        description: "Курс по современной разработке на React. Компоненты, хуки, состояние, контекст, роутинг, работа с API, тестирование и деплой. Создание реальных проектов.",
        shortDesc: "React от основ до продвинутых техник с реальными проектами",
        image: "/courses/react-native.png",
        price: 4990,
        oldPrice: 7990,
        level: "intermediate",
        duration: "12 недель",
        language: "ru",
        isPublished: true,
        isFeatured: false,
        hasCertificate: true,
        rating: 4.6,
        reviewCount: 67,
        studentCount: 540,
        tags: "react,javascript,фронтенд,хуки",
        categoryId: categories[1].id,
        teacherId: teacher1.id,
        modules: {
          create: [
            {
              title: "Введение в React",
              description: "Первые шаги с React",
              sortOrder: 1,
              lessons: {
                create: [
                  { title: "Что такое React?", type: "text", content: "React — библиотека JavaScript для создания пользовательских интерфейсов.", duration: 15, sortOrder: 1, isFree: true },
                  { title: "Создание первого компонента", type: "video", duration: 25, sortOrder: 2, isFree: true },
                ],
              },
            },
          ],
        },
      },
    }),

    // Roblox
    db.course.create({
      data: {
        title: "Создание игр в Roblox Studio для детей",
        slug: "roblox-game-dev",
        description: "Увлекательный курс по созданию игр в Roblox Studio! Дети научатся программировать на Lua, создавать 3D-миры, добавлять механики и публиковать свои игры. Курс разработан специально для школьников 8-14 лет.",
        shortDesc: "Создай свою первую игру в Roblox — для детей 8-14 лет!",
        image: "/courses/roblox.png",
        price: 1490,
        oldPrice: 2490,
        level: "beginner",
        duration: "6 недель",
        language: "ru",
        isPublished: true,
        isFeatured: true,
        hasCertificate: true,
        rating: 4.9,
        reviewCount: 312,
        studentCount: 4500,
        tags: "roblox,игры,lua,дети,3d",
        requirements: JSON.stringify(["Возраст 8-14 лет", "Компьютер с доступом в интернет"]),
        whatYouLearn: JSON.stringify([
          "Установка и настройка Roblox Studio",
          "Программирование на Lua",
          "Создание 3D-миров и уровней",
          "Добавление механик и геймплея",
          "Публикация игры в Roblox"
        ]),
        categoryId: categories[2].id,
        teacherId: teacher2.id,
        modules: {
          create: [
            {
              title: "Знакомство с Roblox Studio",
              description: "Установка и первые шаги в Roblox Studio",
              sortOrder: 1,
              lessons: {
                create: [
                  { title: "Что такое Roblox и Roblox Studio?", type: "text", content: "Roblox — это платформа для создания и игр в пользовательские 3D-игры. Roblox Studio — это инструмент для создания собственных игр.", duration: 10, sortOrder: 1, isFree: true },
                  { title: "Установка Roblox Studio", type: "video", duration: 15, sortOrder: 2, isFree: true },
                  { title: "Интерфейс Roblox Studio", type: "video", duration: 20, sortOrder: 3, isFree: true },
                  { title: "Создание первого мира", type: "text", duration: 30, sortOrder: 4, isFree: false },
                ],
              },
            },
            {
              title: "Основы программирования на Lua",
              description: "Переменные, функции, условия в Lua",
              sortOrder: 2,
              lessons: {
                create: [
                  { title: "Первая программа на Lua", type: "text", content: "Lua — простой и мощный язык программирования, используемый в Roblox.", duration: 20, sortOrder: 1, isFree: false },
                  { title: "Переменные и типы данных", type: "video", duration: 25, sortOrder: 2, isFree: false },
                  { title: "Функции в Lua", type: "text", duration: 30, sortOrder: 3, isFree: false },
                ],
              },
            },
            {
              title: "Создание игры-обстаклса (Obby)",
              description: "Делаем свою первую полноценную игру",
              sortOrder: 3,
              lessons: {
                create: [
                  { title: "Планирование игры", type: "text", content: "Создадим классическую игру Obby с препятствиями!", duration: 15, sortOrder: 1, isFree: false },
                  { title: "Создание препятствий", type: "video", duration: 35, sortOrder: 2, isFree: false },
                  { title: "Добавление чекпоинтов", type: "text", duration: 30, sortOrder: 3, isFree: false },
                  { title: "Публикация игры", type: "video", duration: 20, sortOrder: 4, isFree: false },
                ],
              },
            },
          ],
        },
      },
    }),

    // Roblox Advanced
    db.course.create({
      data: {
        title: "Roblox: Продвинутая разработка игр",
        slug: "roblox-advanced",
        description: "Продвинутый курс для тех, кто уже создавал игры в Roblox. Глубокое погружение в скриптинг, системы инвентаря, мультиплеер, монетизацию и оптимизацию.",
        shortDesc: "Продвинутый Roblox — мультиплеер, инвентарь, монетизация",
        image: "/courses/roblox.png",
        price: 3490,
        level: "advanced",
        duration: "8 недель",
        language: "ru",
        isPublished: true,
        isFeatured: false,
        hasCertificate: true,
        rating: 4.5,
        reviewCount: 45,
        studentCount: 320,
        tags: "roblox,продвинутый,мультиплеер,скриптинг",
        categoryId: categories[2].id,
        teacherId: teacher2.id,
        modules: {
          create: [
            {
              title: "Продвинутый скриптинг",
              description: "Глубокое погружение в Lua и Roblox API",
              sortOrder: 1,
              lessons: {
                create: [
                  { title: "События и обработчики", type: "text", content: "Система событий — основа интерактивности в Roblox.", duration: 25, sortOrder: 1, isFree: true },
                  { title: "Remote Events и Remote Functions", type: "video", duration: 35, sortOrder: 2, isFree: false },
                ],
              },
            },
          ],
        },
      },
    }),

    // C++
    db.course.create({
      data: {
        title: "C++ с нуля: Основы программирования",
        slug: "cpp-basics",
        description: "Курс по основам программирования на C++. Подходит для школьников старших классов и студентов. Вы изучите синтаксис языка, научитесь работать с памятью, указателями и создадите консольные проекты.",
        shortDesc: "Основы C++ — от первых программ до работы с памятью",
        image: "/courses/cpp.png",
        price: 2490,
        oldPrice: 3990,
        level: "beginner",
        duration: "10 недель",
        language: "ru",
        isPublished: true,
        isFeatured: false,
        hasCertificate: true,
        rating: 4.6,
        reviewCount: 78,
        studentCount: 650,
        tags: "c++,программирование,основы,системное",
        categoryId: categories[3].id,
        teacherId: teacher3.id,
        modules: {
          create: [
            {
              title: "Введение в C++",
              description: "Знакомство с языком C++",
              sortOrder: 1,
              lessons: {
                create: [
                  { title: "Что такое C++?", type: "text", content: "C++ — мощный язык программирования общего назначения, созданный как расширение языка C.", duration: 15, sortOrder: 1, isFree: true },
                  { title: "Установка IDE и первая программа", type: "video", duration: 25, sortOrder: 2, isFree: true },
                  { title: "Переменные и ввод/вывод", type: "text", duration: 30, sortOrder: 3, isFree: false },
                ],
              },
            },
          ],
        },
      },
    }),

    // C#
    db.course.create({
      data: {
        title: "C# для начинающих: Путь к разработчику",
        slug: "csharp-beginners",
        description: "Курс по C# для начинающих. Вы освоите основы языка, научитесь писать консольные приложения и познакомитесь с платформой .NET. Отличная база для изучения Unity и разработки игр.",
        shortDesc: "C# от основ до .NET — старт для будущих разработчиков",
        image: "/courses/csharp.jpg",
        price: 2490,
        level: "beginner",
        duration: "8 недель",
        language: "ru",
        isPublished: true,
        isFeatured: false,
        hasCertificate: true,
        rating: 4.7,
        reviewCount: 56,
        studentCount: 480,
        tags: "c#,dotnet,программирование,unity",
        categoryId: categories[3].id,
        teacherId: teacher3.id,
        modules: {
          create: [
            {
              title: "Знакомство с C#",
              description: "Первые шаги в C# и .NET",
              sortOrder: 1,
              lessons: {
                create: [
                  { title: "Что такое C# и .NET?", type: "text", content: "C# — современный объектно-ориентированный язык от Microsoft.", duration: 15, sortOrder: 1, isFree: true },
                  { title: "Установка Visual Studio", type: "video", duration: 20, sortOrder: 2, isFree: true },
                ],
              },
            },
          ],
        },
      },
    }),

    // Data Science
    db.course.create({
      data: {
        title: "Data Science с Python: Анализ данных и визуализация",
        slug: "data-science-python",
        description: "Курс по Data Science на Python. Вы научитесь анализировать данные, строить графики, использовать Pandas, NumPy и Matplotlib. Подходит для тех, кто уже знает основы Python.",
        shortDesc: "Pandas, NumPy, Matplotlib — станьте аналитиком данных",
        image: "/courses/data-science.png",
        price: 3990,
        oldPrice: 5990,
        level: "intermediate",
        duration: "8 недель",
        language: "ru",
        isPublished: true,
        isFeatured: true,
        hasCertificate: true,
        rating: 4.8,
        reviewCount: 98,
        studentCount: 890,
        tags: "data-science,python,анализ данных,pandas",
        requirements: JSON.stringify(["Знание основ Python", "Умение работать с компьютером"]),
        whatYouLearn: JSON.stringify([
          "Анализ данных с Pandas",
          "Вычисления с NumPy",
          "Визуализация данных с Matplotlib",
          "Статистический анализ",
          "Создание дашбордов"
        ]),
        categoryId: categories[4].id,
        teacherId: teacher3.id,
        modules: {
          create: [
            {
              title: "Введение в Data Science",
              description: "Что такое Data Science и какие задачи он решает",
              sortOrder: 1,
              lessons: {
                create: [
                  { title: "Что такое Data Science?", type: "text", content: "Data Science — наука о данных, объединяющая статистику, программирование и анализ.", duration: 15, sortOrder: 1, isFree: true },
                  { title: "Инструменты Data Scientist", type: "video", duration: 20, sortOrder: 2, isFree: true },
                  { title: "Установка Jupyter Notebook", type: "video", duration: 15, sortOrder: 3, isFree: true },
                  { title: "Первый анализ данных", type: "coding", duration: 40, sortOrder: 4, isFree: false },
                ],
              },
            },
            {
              title: "Pandas: Работа с табличными данными",
              description: "Библиотека Pandas для анализа данных",
              sortOrder: 2,
              lessons: {
                create: [
                  { title: "DataFrame и Series", type: "text", content: "DataFrame — основная структура данных в Pandas.", duration: 25, sortOrder: 1, isFree: false },
                  { title: "Чтение и запись данных", type: "video", duration: 30, sortOrder: 2, isFree: false },
                  { title: "Фильтрация и сортировка", type: "text", duration: 35, sortOrder: 3, isFree: false },
                ],
              },
            },
          ],
        },
      },
    }),

    // Data Science ML
    db.course.create({
      data: {
        title: "Машинное обучение с Python",
        slug: "machine-learning-python",
        description: "Продвинутый курс по машинному обучению. Алгоритмы классификации, регрессии, кластеризации. Практика с реальными датасетами на scikit-learn.",
        shortDesc: "ML-алгоритмы и scikit-learn — от теории к практике",
        image: "/courses/data-science.png",
        price: 5990,
        level: "advanced",
        duration: "12 недель",
        language: "ru",
        isPublished: true,
        isFeatured: false,
        hasCertificate: true,
        rating: 4.7,
        reviewCount: 34,
        studentCount: 210,
        tags: "machine-learning,python,scikit-learn,нейросети",
        categoryId: categories[4].id,
        teacherId: teacher3.id,
        modules: {
          create: [
            {
              title: "Введение в машинное обучение",
              description: "Основные концепции ML",
              sortOrder: 1,
              lessons: {
                create: [
                  { title: "Что такое машинное обучение?", type: "text", content: "Машинное обучение — это раздел AI, позволяющий компьютерам обучаться на данных.", duration: 20, sortOrder: 1, isFree: true },
                ],
              },
            },
          ],
        },
      },
    }),

    // Mobile
    db.course.create({
      data: {
        title: "Мобильная разработка: React Native",
        slug: "react-native-mobile",
        description: "Курс по разработке мобильных приложений на React Native. Создавайте приложения для iOS и Android на JavaScript. От настройки окружения до публикации в App Store и Google Play.",
        shortDesc: "React Native — создавайте мобильные приложения на JavaScript",
        image: "/courses/react-native.png",
        price: 4490,
        oldPrice: 6990,
        level: "intermediate",
        duration: "10 недель",
        language: "ru",
        isPublished: true,
        isFeatured: false,
        hasCertificate: true,
        rating: 4.5,
        reviewCount: 42,
        studentCount: 380,
        tags: "react-native,mobile,ios,android",
        categoryId: categories[5].id,
        teacherId: teacher1.id,
        modules: {
          create: [
            {
              title: "Начало работы с React Native",
              description: "Установка и настройка окружения",
              sortOrder: 1,
              lessons: {
                create: [
                  { title: "Что такое React Native?", type: "text", content: "React Native позволяет создавать нативные мобильные приложения на JavaScript.", duration: 15, sortOrder: 1, isFree: true },
                  { title: "Настройка окружения", type: "video", duration: 25, sortOrder: 2, isFree: true },
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
        title: "Flutter: Кроссплатформенная разработка",
        slug: "flutter-cross-platform",
        description: "Курс по Flutter от Google. Создавайте красивые кроссплатформенные приложения на Dart. Быстрая разработка с Hot Reload, богатая библиотека виджетов.",
        shortDesc: "Flutter и Dart — красивые приложения для всех платформ",
        image: "/courses/mobile-dev.png",
        price: 3990,
        level: "intermediate",
        duration: "8 недель",
        language: "ru",
        isPublished: true,
        isFeatured: false,
        hasCertificate: true,
        rating: 4.4,
        reviewCount: 28,
        studentCount: 190,
        tags: "flutter,dart,mobile,кроссплатформенность",
        categoryId: categories[5].id,
        teacherId: teacher1.id,
        modules: {
          create: [
            {
              title: "Введение во Flutter",
              description: "Первые шаги с Flutter",
              sortOrder: 1,
              lessons: {
                create: [
                  { title: "Что такое Flutter?", type: "text", content: "Flutter — UI-фреймворк от Google для создания кроссплатформенных приложений.", duration: 15, sortOrder: 1, isFree: true },
                ],
              },
            },
          ],
        },
      },
    }),
  ]);

  return NextResponse.json({
    message: "База данных успешно заполнена демо-данными",
    data: {
      categories: categories.length,
      courses: courses.length,
      users: 4, // admin + 3 teachers
    },
  }, { status: 201 });
  } catch (error: unknown) {
    return handleApiError(error, { route: "seed" });
  }
}
