# Архитектура Maestria LMS v3.1

## 🏗 Общая архитектура

Maestria — одностраничное приложение (SPA) на базе Next.js 16 с App Router, использующее hash-based маршрутизацию. Вся навигация происходит через изменение `window.location.hash`, а рендеринг страниц управляется единым компонентом-роутером в `page.tsx`.

```
┌─────────────────────────────────────────────────────────┐
│                      Браузер (Client)                    │
│  ┌─────────────────────────────────────────────────────┐│
│  │                 page.tsx (SPA Router)                ││
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────────────┐││
│  │  │ CustomCu │ │ GlobalSc │ │    ErrorBoundary     │││
│  │  │  rsor    │ │ rollToTop│ │  ┌────────────────┐  │││
│  │  └──────────┘ └──────────┘ │  │ PageTransition │  │││
│  │  ┌──────────┐ ┌──────────┐ │  │  ┌──────────┐  │  │││
│  │  │  Header  │ │  Footer  │ │  │  │  renderPa│  │  │││
│  │  │(theme/i1│ │(legal/sto│ │  │  │  ge()    │  │  │││
│  │  │  8n)    │ │  res)    │ │  │  └──────────┘  │  │││
│  │  └──────────┘ └──────────┘ │  └────────────────┘  │││
│  │                           └──────────────────────┘││
│  └─────────────────────────────────────────────────────┘│
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ Zustand Store│  │   i18n (3    │  │  localStorage │  │
│  │ (state mgmt)│  │   locales)   │  │  (persist)    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          │ HTTP / API
                          ▼
┌─────────────────────────────────────────────────────────┐
│                   Next.js Server (API)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ /api/    │ │ /api/    │ │ /api/    │ │ /api/admin│  │
│  │ auth/*   │ │ courses/*│ │ payments │ │ (courses, │  │
│  │          │ │          │ │          │ │  users)   │  │
│  │ NextAuth │ │ CRUD +   │ │ stripe- │ │ admin     │  │
│  │ 2FA,Reg │ │ reviews  │ │ like     │ │ only      │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│                          │                               │
│                          ▼                               │
│  ┌──────────────────────────────────────────────────┐   │
│  │            Prisma ORM → SQLite (file.db)          │   │
│  │  User · Course · Module · Lesson · Assignment     │   │
│  │  Enrollment · Progress · Review · Payment         │   │
│  │  Certificate · Category · Account · Session       │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 Стейт-менеджмент (Zustand)

Единый глобальный store в `src/lib/store.ts`:

```
AppState
├── currentPage: string           // Текущий hash-маршрут
├── user: UserData | null         // Данные пользователя (id, email, name, role, image)
├── theme: Theme                  // "light" | "dark" | "amber" → localStorage
├── locale: Locale                // "ru" | "en" | "zh" → localStorage
├── favorites: string[]           // ID избранных курсов → localStorage
├── notifications: Notification[] // Уведомления → localStorage
├── sidebarOpen: boolean          // Мобильное меню
├── isLoading: boolean
├── courseFilters: {...}          // category, search, level, sortBy, freeOnly
├── currentCourseId: string | null
└── currentLessonId: string | null
```

**Действия**: navigate, setUser, logout, setTheme, setLocale, toggleFavorite, addNotification, markNotificationRead, markAllNotificationsRead, setCourseFilters, setCurrentCourseId, setCurrentLessonId

**Персистенция**: theme, locale, favorites, notifications сохраняются в localStorage с префиксом `maestria-`.

---

## 🎨 Система тем

Три темы реализованы через CSS custom properties с oklch color space:

```
:root (Light)
├── --primary: oklch(0.45 0.2 265)      // Синий-фиолетовый
├── --background: oklch(1 0 0)           // Белый
├── --card: oklch(1 0 0)
└── --cursor-dot: #2962ff                 // Синий курсор

.dark
├── --primary: oklch(0.65 0.2 265)       // Яркий фиолетовый
├── --background: oklch(0.13 0.02 270)   // Тёмный
├── --card: oklch(0.18 0.02 270)
└── --cursor-dot: #7c6aff                 // Фиолетовый курсор

.amber
├── --primary: oklch(0.55 0.18 55)       // Золотой
├── --background: oklch(0.97 0.02 75)    // Тёплый светлый
├── --card: oklch(0.95 0.02 75)
└── --cursor-dot: #b45309                 // Янтарный курсор
```

Тема применяется через CSS-класс на `<html>` элементе, управляемый из `page.tsx` через `useEffect`.

---

## 🌍 Система локализации

Лёгкая кастомная i18n без внешних зависимостей:

```typescript
// src/lib/i18n.ts
const translations: Record<Locale, Record<string, string>> = {
  ru: { "nav.home": "Главная", ... },  // 400+ ключей
  en: { "nav.home": "Home", ... },
  zh: { "nav.home": "首页", ... },
};

export function t(key: string, locale: Locale): string {
  return translations[locale]?.[key] || translations.ru[key] || key;
}
```

**Группы ключей**: nav, hero, catalog, footer, theme, common, legal, doc, terms, privacy, pdc, offer, refund, help, admin

**Fallback**: Если ключ не найден в текущей локали, используется русский, затем сам ключ.

---

## 🔐 Аутентификация

NextAuth.js v4 с поддержкой:
- Email/password авторизация
- 2FA (двухфакторная аутентификация)
- Восстановление пароля
- Регистрация нового пользователя

**Роли**: `student` | `teacher` | `admin`

**Проверка прав**:
- Клиентская: `user.role === "admin"` в компонентах
- Серверная: проверка сессии в API Routes (возврат 403 при отсутствии прав)

---

## 🖱 Кастомный курсор

Реализация в `CustomCursor.tsx`:

1. Два DOM-элемента: `.cursor-dot` (6px) и `.cursor-outline` (32px)
2. Позиционирование через `transform: translate()` с `position: fixed`
3. Плавное следование outline через `requestAnimationFrame` с lerp-коэффициентом 0.25
4. Эффекты:
   - **Hover** на интерактивных элементах: увеличение outline + подсветка фона
   - **Press**: уменьшение outline + усиление цвета
5. Работает **только на pointer:fine** (десктоп)
6. Полностью скрыт на тач-устройствах (`pointer:coarse`)
7. CSS-переменные курсора меняются для каждой темы

---

## 📊 SVG-графики админ-панели

4 типа графиков без внешних зависимостей:

### LineChart
- SVG `<path>` с `polyline` и `<circle>` для точек
- Area fill через замкнутый path с `fillOpacity`
- Сетка из горизонтальных линий
- Подписи осей через `<text>`

### BarChart
- SVG `<rect>` элементы с `rx` для скругления
- Адаптивная ширина столбцов
- Значения над столбцами

### DonutChart
- SVG `<circle>` с `stroke-dasharray` и `stroke-dashoffset`
- Поворот на -90° через `transform`
- Центральный текст (значение + подпись)
- Легенда рядом с диаграммой

### Sparkline
- Мини-график для KPI-карточек
- SVG `<polyline>` без осей
- Компактный (80×32px)

---

## 📊 База данных (Prisma + SQLite)

### ER-диаграмма

```
User ──1:N──→ Account
User ──1:N──→ Session
User ──1:N──→ Enrollment ──N:1──→ Course
User ──1:N──→ Progress ──N:1──→ Lesson
User ──1:N──→ Review ──N:1──→ Course
User ──1:N──→ Payment ──N:1──→ Course
User ──1:N──→ Certificate ──N:1──→ Course
User ──1:N──→ teacherCourses (Course)

Course ──1:N──→ Module ──1:N──→ Lesson ──1:N──→ Assignment
Course ──N:1──→ Category
Course ──N:1──→ User (teacher)
```

### Ключевые модели

| Модель | Поля | Описание |
|---|---|---|
| User | id, email, name, role, image, twoFactorEnabled, isActive | Пользователь |
| Course | id, title, description, price, rating, isPublished | Курс |
| Module | id, title, order, courseId | Модуль курса |
| Lesson | id, title, content, order, moduleId | Урок |
| Assignment | id, title, type, maxScore, lessonId | Задание |
| Enrollment | id, userId, courseId, progress, completedAt | Запись на курс |
| Progress | id, userId, lessonId, score, completed, timeSpent | Прогресс урока |
| Review | id, userId, courseId, rating, comment | Отзыв |
| Payment | id, userId, courseId, amount, status | Платёж |
| Certificate | id, userId, courseId, certificateUrl | Сертификат |

---

## 🔒 Безопасность

- **Хеширование паролей**: bcrypt через NextAuth
- **2FA**: TOTP-алгоритм (Google Authenticator совместимый)
- **CSRF-защита**: Встроена в NextAuth
- **Валидация входных данных**: Zod-схемы в API Routes
- **Проверка прав**: На каждом уровне (клиент + сервер)
- **Хранение данных**: Серверы в Российской Федерации

---

## 🚀 Производительность

- **SSR/SSG**: Next.js Server Components где возможно
- **Code splitting**: Автоматический через Next.js
- **Ленивая загрузка**: CDN-изображения с freeimage.host
- **Кэширование**: React Query для серверного состояния
- **Оптимизация бандла**: `output: "standalone"` в next.config.ts

---

## 📱 Адаптивность

- **Mobile-first**: Tailwind CSS breakpoints (sm, md, lg, xl)
- **Touch-оптимизация**: Скрытие кастомного курсора на touch-устройствах
- **Мобильное меню**: Гамбургер в Header, overlay в AdminPage
- **Адаптивные таблицы**: Горизонтальная прокрутка на мобильных
