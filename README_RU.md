<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16.1.1-black?style=flat-square&logo=next.js" alt="Next.js">
  <img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react" alt="React">
  <img src="https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-06b6d4?style=flat-square&logo=tailwindcss" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/License-CC_BY--SA_4.0-green?style=flat-square" alt="License">
  <img src="https://img.shields.io/badge/version-3.1.0-blueviolet?style=flat-square" alt="Version">
</p>

<h1 align="center">🎓 Maestria — Образовательная платформа нового поколения</h1>

<p align="center">
  <strong>by Maestro7IT / MentorHUB</strong><br>
  Аналог Stepik с современным интерфейсом, админ-панелью и полной локализацией
</p>

---

## 📋 О проекте

**Maestria** — это полнофункциональная образовательная LMS-платформа (Learning Management System), разработанная на стеке Next.js 16 + React 19 + TypeScript + Tailwind CSS 4. Платформа предоставляет инструменты для создания и прохождения онлайн-курсов, управления образовательным процессом, отслеживания прогресса и аналитики.

Проект создан компанией **Maestro7IT** под руководством **Дуплея Максима Игоревича** и предназначен для использования на территории Российской Федерации с полным соответствием законодательству РФ в сфере образования и защиты персональных данных.

---

## 🚀 Ключевые возможности

### Для студентов
- **34 курса** по программированию, веб-разработке, Data Science, геймдеву и другим направлениям
- Прохождение уроков с пошаговым просмотром (Step Viewer)
- Прохождение тестов и заданий с отслеживанием результатов
- Прогресс обучения и сертификаты по завершении
- Система достижений и уведомлений
- Избранные курсы

### Для преподавателей
- Создание и редактирование курсов (Course Editor)
- Управление модулями и уроками
- Просмотр статистики по студентам
- Модерация отзывов

### Для администраторов
- **Закрытая панель администратора** с парольной защитой
- **9 секций**: Дашборд, Пользователи, Тесты, Материалы, Финансы, Курсы, Жалобы, Логи, Настройки
- **4 типа SVG-графиков**: линейный, столбчатый, кольцевая диаграмма, спарклайн
- Управление пользователями (роли, блокировка, 2FA)
- Статистика прохождения тестов и прочитывания материалов
- Финансовая аналитика (доход, категории, бесплатное/платное)
- Журнал действий платформы
- Управление жалобами и модерация

### Платформенные функции
- **3 темы оформления**: светлая, тёмная, янтарная
- **3 языка**: Русский, English, 中文
- **Кастомный курсор** (точка + контур с плавным следованием, только pointer:fine)
- **GlobalScrollToTop** с SVG progress ring
- **10 юридических страниц** по законодательству РФ
- Кнопки **App Store / Google Play / RuStore** в Footer
- CDN-изображения с freeimage.host
- Адаптивный дизайн (мобильные, планшеты, десктоп)

---

## 🛠 Технологический стек

| Технология | Версия | Назначение |
|---|---|---|
| Next.js | 16.1.1 | Фреймворк (App Router, SSR, API Routes) |
| React | 19 | UI-библиотека |
| TypeScript | 5 | Типизация |
| Tailwind CSS | 4 | Стилизация (oklch color space) |
| Zustand | 5.0.6 | Стейт-менеджмент |
| Prisma | latest | ORM (SQLite) |
| NextAuth.js | 4 | Аутентификация |
| shadcn/ui | 40+ компонентов | UI-примитивы |
| Sonner | — | Toast-уведомления |
| Lucide React | — | Иконки |

---

## 📦 Установка и запуск

### Предварительные требования
- **Node.js** >= 18.17
- **npm** >= 9 или **bun** >= 1.0

### Установка

```bash
# Клонирование репозитория
git clone https://github.com/Maestro7IT/Maestria.git
cd Maestria

# Установка зависимостей
npm install

# Генерация Prisma-клиента
npx prisma generate

# Запуск dev-сервера
npm run dev
```

### Сборка для продакшена

```bash
npm run build
npm start
```

При первом запуске база данных SQLite создаётся и заполняется автоматически (seed).

---

## 🌐 Маршрутизация

Проект использует **hash-based SPA-роутинг** (`#home`, `#catalog`, `#admin`). Все страницы рендерятся через единый `page.tsx`.

| Маршрут | Компонент | Описание |
|---|---|---|
| `#home` | `HomePage` | Главная страница |
| `#catalog` | `CatalogPage` | Каталог курсов |
| `#course/ID` | `CourseDetailPage` | Страница курса |
| `#course/ID/lesson/LESSON_ID` | `StepViewerPage` | Просмотр урока |
| `#profile` | `ProfilePage` | Профиль пользователя |
| `#admin` | `AdminPage` | Панель администратора |
| `#about` | `AboutPage` | О платформе |
| `#achievements` | `AchievementsPage` | Достижения |
| `#notifications` | `NotificationsPage` | Уведомления |
| `#certificate/ID` | `CertificatePage` | Сертификат |
| `#course-editor` | `CourseEditorPage` | Редактор курсов |
| `#terms` | `TermsPage` | Пользовательское соглашение |
| `#privacy` | `PrivacyPage` | Политика конфиденциальности |
| `#personal-data` | `PersonalDataConsentPage` | Согласие на обработку ПД |
| `#offer` | `OfferPage` | Публичная оферта |
| `#refund` | `RefundPage` | Политика возврата средств |
| `#edu-info` | `EduInfoPage` | Сведения об образовании |
| `#rules` | `RulesPage` | Правила платформы |
| `#license` | `LicensePage` | Лицензия CC BY-SA 4.0 |
| `#age-rating` | `AgeRatingPage` | Возрастная маркировка |
| `#cookies` | `CookiePage` | Политика cookie |
| `#help` | `HelpPage` | Помощь |

---

## 🔒 Админ-панель

Доступна по маршруту `#admin` (только для пользователей с ролью `admin`).

**Пароль для входа**: `admin` или `Maestria2026`

### Секции:
1. **Дашборд** — KPI-карточки со спарклайнами, графики регистраций и записей, распределение по категориям, последние действия, статус серверов
2. **Пользователи** — поиск, фильтр по ролям, таблица с аватарами, управление ролями и статусами, графики роста и активности
3. **Тесты** — статистика прохождений, проходной %, средний балл, результаты по курсам, распределение по сложности
4. **Материалы** — сессии чтения, среднее время, прогресс прочитывания, динамика вовлечённости
5. **Финансы** — доход за 12 месяцев, доход по категориям, бесплатные vs платные
6. **Курсы** — таблица всех курсов, топ по записям
7. **Жалобы** — статусы жалоб, модерация
8. **Логи** — журнал действий с типизацией
9. **Настройки** — платформа, система, «опасная зона»

---

## 🎨 Темы оформления

Три темы с oklch-цветами и CSS-переменными:

| Тема | Класс | Акцент |
|---|---|---|
| Светлая | `:root` | Синий-фиолетовый `oklch(0.45 0.2 265)` |
| Тёмная | `.dark` | Яркий фиолетовый `oklch(0.65 0.2 265)` |
| Янтарная | `.amber` | Тёплый золотой `oklch(0.55 0.18 55)` |

Каждая тема включает отдельные CSS-переменные для кастомного курсора.

---

## 🌍 Локализация

3 языка с полным покрытием (400+ ключей на каждый):

| Код | Язык | Флаг |
|---|---|---|
| `ru` | Русский | 🇷🇺 |
| `en` | English | 🇬🇧 |
| `zh` | 中文 | 🇨🇳 |

---

## 📁 Структура проекта

```
src/
├── app/
│   ├── globals.css           # Темы, курсор, prose-стили
│   ├── layout.tsx            # Root layout + JSON-LD
│   ├── page.tsx              # SPA hash-роутер
│   └── api/                  # API Routes
│       ├── admin/            # Админ API (courses, users)
│       ├── auth/             # NextAuth (2FA, register, forgot-password)
│       ├── courses/          # Курсы (CRUD, reviews, enroll, lessons)
│       ├── payments/         # Платежи
│       ├── achievements/     # Достижения
│       ├── seed/             # Автосид БД
│       └── user/             # Данные пользователя
├── components/
│   ├── AdminPage.tsx         # Админ-панель (9 секций + SVG графики)
│   ├── Header.tsx            # Навигация + тема + язык
│   ├── Footer.tsx            # Контакты + правовая информация + магазины
│   ├── HomePage.tsx          # Главная страница
│   ├── CatalogPage.tsx       # Каталог с фильтрами
│   ├── CourseDetailPage.tsx  # Страница курса
│   ├── StepViewerPage.tsx    # Просмотр урока
│   ├── ProfilePage.tsx       # Профиль
│   ├── CourseEditorPage.tsx  # Редактор курсов
│   ├── AuthDialogs.tsx       # Диалоги авторизации
│   ├── CustomCursor.tsx      # Кастомный курсор
│   ├── GlobalScrollToTop.tsx # Кнопка наверх + progress ring
│   ├── CoursePromoCarousel.tsx # Карусель курсов
│   ├── DocumentPageLayout.tsx # Шаблон юридических страниц
│   ├── AnimatedCounter.tsx   # Анимированный счётчик
│   ├── PageTransition.tsx    # Переходы между страницами
│   ├── ErrorBoundary.tsx     # Обработка ошибок
│   ├── Providers.tsx         # React Query + провайдеры
│   ├── TermsPage.tsx         # Пользовательское соглашение
│   ├── PrivacyPage.tsx       # Политика конфиденциальности
│   ├── PersonalDataConsentPage.tsx
│   ├── OfferPage.tsx         # Публичная оферта
│   ├── RefundPage.tsx        # Политика возврата
│   ├── EduInfoPage.tsx       # Сведения об образовании
│   ├── RulesPage.tsx         # Правила платформы
│   ├── LicensePage.tsx       # Лицензия
│   ├── AgeRatingPage.tsx     # Возрастная маркировка
│   ├── CookiePage.tsx        # Cookie политика
│   ├── HelpPage.tsx          # Помощь
│   └── ui/                   # 40+ shadcn/ui компонентов
├── lib/
│   ├── store.ts              # Zustand store
│   ├── i18n.ts               # Локализация (ru/en/zh)
│   ├── auth.ts               # NextAuth конфигурация
│   ├── db.ts                 # Prisma клиент
│   └── utils.ts              # cn() утилита
└── hooks/                    # Кастомные хуки
```

---

## 📊 База данных

**SQLite** через Prisma ORM. 14 моделей:

`User` → `Account` / `Session` / `Enrollment` → `Progress` / `Review` / `Certificate` / `Payment`
`Course` → `Module` → `Lesson` → `Assignment`
`Category` → `Course`
`VerificationToken`

Схема автоматически создаётся и заполняется демо-данными при первом запуске.

---

## 📜 Правовая информация

Все юридические страницы соответствуют законодательству Российской Федерации:

- Федеральный закон № 152-ФЗ «О персональных данных»
- Закон РФ № 2300-1 «О защите прав потребителей»
- Гражданский кодекс РФ (ст. 437 — публичная оферта)
- Постановление Правительства РФ № 1724 (дистанционная продажа)
- Требования Роскомнадзора к хранению данных на территории РФ

---

## 👥 Команда

| Участник | Роль |
|---|---|
| **Дуплей Максим Игоревич** | Директор, Fullstack-разработчик |
| **Maestro7IT** | Компания-разработчик |
| **MentorHUB** | Проектная группа |

---

## 📞 Контакты

- **Email**: maksimqwe42@mail.ru
- **Адрес**: г. Москва, Российская Федерация
- **VK**: сообщество Maestro7IT
- **Rutube**: канал Maestro7IT

---

## 📄 Лицензия

Пользовательский контент доступен по лицензии **Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)**.

Программный код платформы является собственностью Maestro7IT.

---

<p align="center">
  <strong>Maestria v3.1.0</strong> · 15.05.2026 · Maestro7IT
</p>
