// Direct SQLite seed using better-sqlite3 - bypasses Prisma adapter issues
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.resolve(__dirname, '..', 'prisma', 'data.db');
const fs = require('fs');

// Remove existing database
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
}

const db = new Database(DB_PATH);

// Enable WAL mode and foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log('Database created at:', DB_PATH);

// Create tables based on Prisma schema
db.exec(`
  CREATE TABLE User (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    passwordHash TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    avatarUrl TEXT,
    bio TEXT,
    isVerified INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE Category (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    icon TEXT,
    color TEXT,
    description TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE Course (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    shortDesc TEXT,
    price INTEGER DEFAULT 0,
    oldPrice INTEGER,
    level TEXT NOT NULL DEFAULT 'beginner',
    duration TEXT,
    isPublished INTEGER DEFAULT 0,
    isFeatured INTEGER DEFAULT 0,
    hasCertificate INTEGER DEFAULT 0,
    rating REAL DEFAULT 0,
    studentCount INTEGER DEFAULT 0,
    tags TEXT,
    categoryId TEXT,
    teacherId TEXT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (categoryId) REFERENCES Category(id),
    FOREIGN KEY (teacherId) REFERENCES User(id)
  );

  CREATE TABLE Module (
    id TEXT PRIMARY KEY,
    courseId TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    sortOrder INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (courseId) REFERENCES Course(id) ON DELETE CASCADE
  );

  CREATE TABLE Lesson (
    id TEXT PRIMARY KEY,
    moduleId TEXT NOT NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'text',
    content TEXT,
    duration INTEGER,
    isFree INTEGER DEFAULT 0,
    sortOrder INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (moduleId) REFERENCES Module(id) ON DELETE CASCADE
  );
`);

console.log('Tables created');

// Insert demo user
const demoPassword = bcrypt.hashSync('demo123', 10);
const userId = 'demo-user-' + Date.now();

db.prepare(`
  INSERT OR REPLACE INTO User (id, email, name, passwordHash, role, bio)
  VALUES (?, ?, ?, ?, ?, ?)
`).run(userId, 'demo@maestria.lms', 'Demo Teacher', demoPassword, 'teacher', 'Преподаватель Maestria LMS');

console.log('Created user:', userId);

// Insert categories
const categories = [
  { name: 'Программирование на Python', slug: 'python', icon: '🐍', color: '#3776AB', description: 'Курсы по Python: от основ до продвинутых тем' },
  { name: 'Веб-разработка', slug: 'web-development', icon: '🌐', color: '#E34F26', description: 'HTML, CSS, JavaScript, фреймворки и всё для веба' },
  { name: 'Создание игр в Roblox', slug: 'roblox', icon: '🎮', color: '#E2231A', description: 'Разработка игр в Roblox Studio на Lua' },
  { name: 'C++/C#', slug: 'cpp-csharp', icon: '⚡', color: '#68217A', description: 'Программирование на C++ и C#' },
  { name: 'Data Science', slug: 'data-science', icon: '📊', color: '#FF6F00', description: 'Анализ данных, машинное обучение, визуализация' },
  { name: 'Мобильная разработка', slug: 'mobile-development', icon: '📱', color: '#3DDC84', description: 'Разработка мобильных приложений для iOS и Android' },
];

const catIds = [];
const insertCat = db.prepare(`
  INSERT INTO Category (id, name, slug, icon, color, description) VALUES (?, ?, ?, ?, ?, ?)
`);

categories.forEach(cat => {
  const id = 'cat-' + Date.now() + '-' + catIds.length;
  insertCat.run(id, cat.name, cat.slug, cat.icon, cat.color, cat.description);
  catIds.push(id);
  console.log(`Created category: ${cat.slug}`);
});

// Insert courses
const courses = [
  {
    title: 'Python с нуля до Junior Developer',
    slug: 'python-zero-to-junior',
    description: 'Полный курс Python для начинающих',
    shortDesc: 'Полный курс Python для начинающих',
    price: 4990, oldPrice: 9990, level: 'beginner', duration: '8 недель',
    isPublished: 1, isFeatured: 1, hasCertificate: 1, rating: 4.8, studentCount: 156,
    tags: 'python,programming,beginner', catIdx: 0
  },
  {
    title: 'React + Next.js: Fullstack разработка',
    slug: 'react-nextjs-fullstack',
    description: 'Современные веб-приложения с React и Next.js',
    shortDesc: 'Fullstack разработка на React и Next.js',
    price: 7990, oldPrice: 14990, level: 'intermediate', duration: '12 недель',
    isPublished: 1, isFeatured: 1, hasCertificate: 1, rating: 4.9, studentCount: 89,
    tags: 'react,nextjs,frontend,fullstack', catIdx: 1
  },
  {
    title: 'Создание игр в Roblox Studio',
    slug: 'roblox-game-dev',
    description: 'Создавайте собственные игры в Roblox Studio на Lua',
    shortDesc: 'Разработка игр в Roblox на Lua',
    price: 3990, level: 'beginner', duration: '6 недель',
    isPublished: 1, hasCertificate: 1, rating: 4.7, studentCount: 234,
    tags: 'roblox,lua,gamedev', catIdx: 2
  },
  {
    title: 'C++ для начинающих: основы программирования',
    slug: 'cpp-basics',
    description: 'Изучите C++ с нуля',
    shortDesc: 'Основы программирования на C++',
    price: 5490, oldPrice: 8990, level: 'beginner', duration: '10 недель',
    isPublished: 1, hasCertificate: 1, rating: 4.6, studentCount: 67,
    tags: 'cpp,programming,beginner', catIdx: 3
  },
  {
    title: 'Data Science с Python: анализ данных',
    slug: 'data-science-python',
    description: 'Pandas, NumPy, Matplotlib, Seaborn',
    shortDesc: 'Анализ данных и визуализация с Python',
    price: 6990, oldPrice: 12990, level: 'intermediate', duration: '10 недель',
    isPublished: 1, isFeatured: 1, hasCertificate: 1, rating: 4.8, studentCount: 112,
    tags: 'python,data-science,pandas,ml', catIdx: 4
  },
  {
    title: 'React Native: мобильные приложения',
    slug: 'react-native-mobile',
    description: 'Кроссплатформенные мобильные приложения',
    shortDesc: 'Кроссплатформенные приложения на React Native',
    price: 8490, level: 'advanced', duration: '14 недель',
    isPublished: 1, hasCertificate: 1, rating: 4.5, studentCount: 45,
    tags: 'react-native,mobile,ios,android', catIdx: 5
  },
  {
    title: 'Основы HTML и CSS: бесплатный курс',
    slug: 'html-css-basics-free',
    description: 'Бесплатный курс по основам HTML и CSS',
    shortDesc: 'Бесплатный курс по HTML и CSS',
    price: 0, level: 'beginner', duration: '3 недели',
    isPublished: 1, hasCertificate: 0, rating: 4.3, studentCount: 512,
    tags: 'html,css,free,beginner', catIdx: 1
  },
  // QA courses
  {
    title: 'QA-инженер: ручное тестирование с нуля',
    slug: 'qa-manual-testing-zero-to-hero',
    description: 'Научитесь тестировать веб-приложения, работать с API через Postman',
    shortDesc: 'Ручное тестирование: Postman, SQL, API, Test IT',
    price: 4990, level: 'beginner', duration: '4 месяца',
    isPublished: 1, isFeatured: 1, hasCertificate: 1, rating: 4.7, studentCount: 89,
    tags: 'qa,testing,manual,postman,sql,test-it', catIdx: 1
  },
  {
    title: 'Python QA: автоматизация тестирования с Playwright',
    slug: 'python-qa-automation-playwright',
    description: 'Пишите автотесты на Python с Playwright и requests',
    shortDesc: 'Автотесты на Python: Playwright, CI/CD, Allure',
    price: 8990, oldPrice: 14990, level: 'intermediate', duration: '9 месяцев',
    isPublished: 1, isFeatured: 1, hasCertificate: 1, rating: 4.9, studentCount: 67,
    tags: 'qa,python,playwright,automation,ci-cd,allure', catIdx: 0
  },
  // Python Pro
  {
    title: 'Python Pro: от Junior до Middle разработчика',
    slug: 'python-pro-junior-to-middle',
    description: 'Углублённое изучение Python: асинхронность, декораторы, генераторы',
    shortDesc: 'Продвинутый Python: async, паттерны, деплой',
    price: 7490, oldPrice: 12990, level: 'intermediate', duration: '10 недель',
    isPublished: 1, hasCertificate: 1, rating: 4.8, studentCount: 54,
    tags: 'python,advanced,async,oop,patterns', catIdx: 0
  },
  // FastAPI
  {
    title: 'FastAPI: создание REST API с нуля',
    slug: 'fastapi-rest-api-from-scratch',
    description: 'Создавайте современные API на FastAPI',
    shortDesc: 'REST API на FastAPI: Pydantic, SQLAlchemy, JWT',
    price: 6990, level: 'intermediate', duration: '8 недель',
    isPublished: 1, hasCertificate: 1, rating: 4.7, studentCount: 78,
    tags: 'python,fastapi,api,backend,sqlalchemy', catIdx: 0
  },
  // Frontend Pro
  {
    title: 'Frontend Pro: React, TypeScript, Next.js',
    slug: 'frontend-pro-react-typescript-nextjs',
    description: 'Полный курс фронтенда: React 19, Server Components, TypeScript',
    shortDesc: 'React 19, TypeScript, Next.js, Server Components',
    price: 9990, oldPrice: 16990, level: 'advanced', duration: '14 недель',
    isPublished: 1, isFeatured: 1, hasCertificate: 1, rating: 4.9, studentCount: 43,
    tags: 'react,typescript,nextjs,frontend,server-components', catIdx: 1
  },
  // Fullstack TypeScript
  {
    title: 'Fullstack TypeScript: от идеи до продакшена',
    slug: 'fullstack-typescript-idea-to-production',
    description: 'Создайте полноценное приложение: Next.js + tRPC + Prisma + PostgreSQL',
    shortDesc: 'Next.js + tRPC + Prisma + PostgreSQL',
    price: 11990, oldPrice: 19990, level: 'advanced', duration: '16 недель',
    isPublished: 1, hasCertificate: 1, rating: 4.8, studentCount: 31,
    tags: 'typescript,fullstack,nextjs,trpc,prisma,postgresql', catIdx: 1
  },
  // Unity
  {
    title: 'Unity C#: создание 2D и 3D игр',
    slug: 'unity-csharp-2d-3d-games',
    description: 'Создавайте игры на Unity с C#',
    shortDesc: 'Игры на Unity: физика, анимации, публикация',
    price: 5990, level: 'beginner', duration: '10 недель',
    isPublished: 1, hasCertificate: 1, rating: 4.6, studentCount: 123,
    tags: 'unity,csharp,gamedev,2d,3d', catIdx: 3
  },
  // Unreal Engine
  {
    title: 'Unreal Engine 5: разработка игр на C++',
    slug: 'unreal-engine-5-cpp-game-dev',
    description: 'Создавайте AAA-игры на UE5',
    shortDesc: 'AAA-игры на UE5: Blueprints, C++, Nanite, Lumen',
    price: 7990, oldPrice: 13990, level: 'intermediate', duration: '12 недель',
    isPublished: 1, hasCertificate: 1, rating: 4.8, studentCount: 56,
    tags: 'unreal-engine,cpp,gamedev,multiplayer,ue5', catIdx: 3
  },
  // ML
  {
    title: 'Machine Learning: от теории к практике',
    slug: 'machine-learning-theory-to-practice',
    description: 'Scikit-learn, TensorFlow, нейронные сети',
    shortDesc: 'ML: Scikit-learn, TensorFlow, нейронные сети',
    price: 8490, oldPrice: 14990, level: 'intermediate', duration: '12 недель',
    isPublished: 1, isFeatured: 1, hasCertificate: 1, rating: 4.7, studentCount: 67,
    tags: 'ml,tensorflow,scikit-learn,neural-networks,nlp', catIdx: 4
  },
  // Data Analyst
  {
    title: 'Аналитик данных: Excel → SQL → Python',
    slug: 'data-analyst-excel-sql-python',
    description: 'Полный стек аналитика',
    shortDesc: 'Excel, SQL, Python, Tableau для аналитики',
    price: 5990, level: 'beginner', duration: '8 недель',
    isPublished: 1, hasCertificate: 1, rating: 4.5, studentCount: 145,
    tags: 'data-analysis,excel,sql,python,tableau', catIdx: 4
  },
  // DevOps
  {
    title: 'DevOps для разработчиков: Docker, CI/CD, Kubernetes',
    slug: 'devops-docker-ci-cd-kubernetes',
    description: 'Контейнеризация с Docker, оркестрация Kubernetes',
    shortDesc: 'Docker, Kubernetes, CI/CD, мониторинг',
    price: 7490, oldPrice: 12990, level: 'intermediate', duration: '8 недель',
    isPublished: 1, hasCertificate: 1, rating: 4.8, studentCount: 52,
    tags: 'devops,docker,kubernetes,ci-cd,monitoring', catIdx: 1
  },
  // Linux Admin
  {
    title: 'Linux-администратор: от основ до продакшена',
    slug: 'linux-admin-basics-to-production',
    description: 'Установка Linux, командная строка, bash-скриптинг',
    shortDesc: 'Linux: CLI, bash, Nginx, безопасность',
    price: 4990, level: 'beginner', duration: '6 недель',
    isPublished: 1, hasCertificate: 1, rating: 4.6, studentCount: 89,
    tags: 'linux,sysadmin,bash,nginx,security', catIdx: 1
  },
  // UI/UX
  {
    title: 'UI/UX дизайнер: проектирование интерфейсов в Figma',
    slug: 'ui-ux-design-figma-interfaces',
    description: 'Принципы UX, прототипирование, дизайн-системы',
    shortDesc: 'Figma, прототипирование, дизайн-системы, UX',
    price: 5490, level: 'beginner', duration: '8 недель',
    isPublished: 1, hasCertificate: 1, rating: 4.7, studentCount: 167,
    tags: 'ui-ux,figma,design,prototyping,ux-research', catIdx: 1
  },
  // Flutter
  {
    title: 'Flutter & Dart: кроссплатформенные мобильные приложения',
    slug: 'flutter-dart-cross-platform-mobile',
    description: 'Создавайте приложения для iOS и Android на Flutter',
    shortDesc: 'Flutter: виджеты, Riverpod, публикация в сторах',
    price: 7990, oldPrice: 13990, level: 'intermediate', duration: '12 недель',
    isPublished: 1, hasCertificate: 1, rating: 4.6, studentCount: 38,
    tags: 'flutter,dart,mobile,ios,android,riverpod', catIdx: 5
  },
  // Ethical Hacking
  {
    title: 'Этичный хакинг: основы информационной безопасности',
    slug: 'ethical-hacking-cybersecurity-basics',
    description: 'OWASP Top 10, пентест веб-приложений',
    shortDesc: 'Пентест: OWASP, Kali Linux, Burp Suite',
    price: 6990, level: 'intermediate', duration: '8 недель',
    isPublished: 1, hasCertificate: 1, rating: 4.8, studentCount: 72,
    tags: 'security,hacking,owasp,kali-linux,burp-suite', catIdx: 1
  },
  // IT Freelance
  {
    title: 'IT-фриланс: как найти клиентов и зарабатывать удалённо',
    slug: 'it-freelance-find-clients-earn-remote',
    description: 'Биржи фриланса, создание портфолио',
    shortDesc: 'Фриланс в IT: портфолио, клиенты, переговоры',
    price: 2990, level: 'beginner', duration: '3 недели',
    isPublished: 1, hasCertificate: 0, rating: 4.4, studentCount: 234,
    tags: 'freelance,career,portfolio,negotiation,remote', catIdx: 1
  },
];

const insertCourse = db.prepare(`
  INSERT INTO Course (id, title, slug, description, shortDesc, price, oldPrice, level, duration, isPublished, isFeatured, hasCertificate, rating, studentCount, tags, categoryId, teacherId)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const courseIds = [];
courses.forEach((c, i) => {
  const id = 'course-' + Date.now() + '-' + i;
  insertCourse.run(
    id, c.title, c.slug, c.description, c.shortDesc,
    c.price, c.oldPrice || null, c.level, c.duration,
    c.isPublished, c.isFeatured || 0, c.hasCertificate, c.rating, c.studentCount,
    c.tags, catIds[c.catIdx], userId
  );
  courseIds.push(id);
  console.log(`Created course: ${c.slug}`);
});

// Close database
db.close();

console.log(`\n✅ Seeding complete!`);
console.log(`   - 1 user created`);
console.log(`   - ${categories.length} categories created`);
console.log(`   - ${courses.length} courses created`);
console.log(`   - Database: ${DB_PATH}`);
