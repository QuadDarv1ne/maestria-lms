# Changelog Maestria

Все существенные изменения проекта Maestria документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/).

---

## [Unreleased]

### Добавлено
- **Drag & Drop задание — настоящий перетаскивание в просмотрщике**: `StepDragDrop.tsx` переведён с click-based взаимодействия на `@dnd-kit/core` (PointerSensor + TouchSensor, DragOverlay, подсветка drop-зон при наведении, возврат элементов в пул перетаскиванием). Клик-фолбэк сохранён для клавиатуры/доступности. Новый i18n-ключ `course.step.removeItem`
- **Миграция синхронизации схемы БД** `20260802000000_schema_drift_sync`: закрыт разрыв между schema.prisma и миграциями (колонка `User.pendingTwoFactorSecret`, таблицы `PromoCode` и `WebhookEvent`, поля `Payment.promoCodeId`/`discountAmount`, ~40 индексов) — `prisma migrate deploy` теперь создаёт полную схему (исправлена ошибка `The column main.User.pendingTwoFactorSecret does not exist`)
- **Локализация демо-данных админки**: `demo-data.ts` переведён на i18n-ключи (`admin.demo.*`), убраны неиспользуемые `monthLabels`/`dayLabels`/`demoCategoryDistribution`; текст и временные метки журнала действий теперь зависят от локали
- **Локализованные метаданные** страниц `/admin` и `/course-editor` через `generateMetadata` + cookie-локаль (ключи `meta.admin*`, `meta.editor*`)
- **Скрипт проверки i18n** подключён как `npm run check:i18n`

### Исправлено
- **Database drift**: локальная БД приведена в соответствие с миграциями (`db push` + `migrate resolve --applied` для обеих миграций)

---

## [3.6.0] — 2026-07-05

### Исправлено
- **CRITICAL**: Повторная запись на платный курс после отмены — теперь требует новый платёж вместо бесплатного доступа
- **HIGH**: Админ не может понизить свою роль (защита от self-demotion)
- **MEDIUM**: `validatePrices` — старая цена должна быть строго больше текущей (запрет отрицательных скидок)
- **MEDIUM**: Course slug — добавлена regex-валидация `[a-z0-9-]+` (как у статей)
- **LOW**: Notifications store — ограничение 200 записей в localStorage
- **LOW**: Notifications store — rollback optimistic read при ошибке API
- **LOW**: CourseDetailPage — fallback для неизвестных level-значений в бейдже

---

## [3.5.0] — 2026-07-05

### Исправлено
- **CRITICAL SECURITY**: 2FA enrollment hijack — секрет теперь хранится на сервере (pendingTwoFactorSecret), клиент не получает raw secret. PUT читает секрет из БД, а не из тела запроса. Полная защита от account takeover через 2FA setup.
- **MEDIUM**: JWT role caching — теперь при каждом использовании токена роль обновляется из БД. Демотация/deactivation пользователя мгновенно отражается (вместо 30-дневного кэша).
- **MEDIUM**: payments/webhook — добавлен rate limiting (100 req/min) для предотвращения CPU exhaustion через HMAC verification.
- **MEDIUM**: payments/simulate-complete — studentCount больше не инкрементируется при повторной активации существующей записи.
- **LOW**: logger.ts — убрана production-блокировка info/debug логов. Теперь LOG_LEVEL работает корректно в продакшене.
- **LOW**: StepViewerPage — добавлен AbortController в fetchStep для корректной отмены при навигации между шагами.
- **Prisma schema**: добавлено поле `pendingTwoFactorSecret` для серверного хранения 2FA секрета.

---

## [3.4.0] — 2026-07-05

### Исправлено
- **CRITICAL**: Добавлен `runtime = "nodejs"` на 5 API-маршрутов (`api/route.ts`, `health/route.ts`, `upload/route.ts`, `admin/settings/route.ts`, `admin/cache/clear/route.ts`) — краш на edge runtime
- **CRITICAL**: Статьи — неопубликованные статьи теперь доступны только admin/teacher; просмотры не инкрементируются для неопубликованных
- **XSS**: PATCH `/api/articles/[slug]` теперь санитизирует content через `sanitizeContent()`
- **Performance**: Список статей `/api/articles` больше не возвращает HTML-контент в list view (select вместо include)
- **Performance**: Teacher stats — добавлен лимит `take: 100` на enrollments для предотвращения OOM
- **Performance**: User profile — убран raw `progress` массив из ответа (enrollmentDetails уже содержит вычисленную статистику)
- **Reliability**: `useUpdateUserRole` и `useToggleUserStatus` — добавлен `.catch()` на `res.json()` для обработки non-JSON ответов
- **Settings**: admin/settings теперь хранит настройки в Redis вместо файловой системы (совместимо с serverless)
- **Cache**: admin/cache/clear теперь очищает Redis + memory cache вместо удаления `.next/cache`

---

## [3.3.0] — 2026-07-05

### Оптимизировано
- **CORS**: сужены исключения — `/api/auth/session` и `/api/auth/signout` теперь используют site origin вместо `*`
- **Env vars**: ленивое кэширование в `env.ts` — чтение `process.env` кэшируется при первом обращении, eliminates повторные чтения в hot paths
- **AdminPage**: `tabProps` и `sidebarItems` обёрнуты в `useMemo`, предотвращая лишние re-renders дочерних табов
- **StepViewerPage**: добавлен `AbortController` в fetch запроса — при анмаунте компонента запрос корректно отменяется
- **Error pages**: заменены `framer-motion` анимации на CSS `tailwindcss-animate` — экономит ~40KB gzip на страницах ошибок
- **Test coverage thresholds**: увеличены с 60% до 75% (branches, functions, lines, statements)
- Добавлено исправление для `env.ts` кэша в тестах через `clearEnvCache()`

### Удалено
- Удалён неиспользуемый `react-syntax-highlighter` из зависимостей
- Удалены 6 неиспользуемых UI-компонентов (`aspect-ratio`, `context-menu`, `hover-card`, `menubar`, `navigation-menu`, `slider`) и их `@radix-ui` зависимости

### Исправлено
- Pre-existing TypeScript ошибки в `seed/route.ts` и `db.ts`

---

## [3.1.0] — 2026-05-15

### Добавлено
- **Закрытая панель администратора** с парольной защитой
- **9 секций админ-панели**: Дашборд, Пользователи, Тесты, Материалы, Финансы, Курсы, Жалобы, Логи, Настройки
- **4 типа SVG-графиков** (без внешних библиотек): LineChart, BarChart, DonutChart, Sparkline
- Боковой сайдбар (сворачиваемый на десктопе, выдвижной на мобильных)
- Статистика прохождения тестов (проходной %, ср. балл, попытки, результаты по курсам)
- Статистика прочитывания материалов (прогресс, время, сессии, вовлечённость)
- Финансовая аналитика (доход за 12 месяцев, по категориям, бесплатные/платные)
- KPI-карточки со спарклайнами на дашборде
- Распределение ролей и категорий (кольцевые диаграммы)
- Таблица пользователей с аватарами, поиском и фильтром по ролям
- Полноэкранный режим админ-панели (Header/Footer скрыты)
- 48 i18n ключей для админ-панели (ru/en/zh)
- «Опасная зона» в настройках (очистка кэша, сброс данных)

---

## [2.4.0] — 2026-05-15

### Добавлено
- CDN-изображения с freeimage.host (22 рекламных фото, 20 из 34 курсов)
- 2 новых курса: «Научные статьи v2», «Курсовые и дипломные работы» (34 всего)
- GlobalScrollToTop с SVG progress ring
- Next.js config обновлён с remotePatterns для iili.io и freeimage.host

---

## [2.3.1] — 2026-05-14

### Добавлено
- Кастомный курсор (точка 6px + контур 32px, requestAnimationFrame, lerp 0.25)
- Эффекты hover/press для курсора
- Поддержка pointer:fine (только десктоп), скрытие на тач-устройствах
- CSS-переменные курсора для 3 тем

---

## [2.3.0] — 2026-05-14

### Добавлено
- 3 темы оформления: светлая (light), тёмная (dark), янтарная (amber)
- Переключатель темы в Header (dropdown)
- oklch color space для всех CSS-переменных

---

## [2.2.0] — 2026-05-13

### Добавлено
- Переключатель языка в Header (ru/en/zh)
- Расширение i18n до 351 ключа на локаль
- Флаги и подписи для каждого языка

---

## [2.1.0] — 2026-05-12

### Добавлено
- Кнопки App Store / Google Play / RuStore в Footer
- Колонка «Правовая информация» в Footer со ссылками на все юридические страницы

---

## [2.0.0] — 2026-05-10

### Добавлено
- 10 юридических страниц по законодательству РФ:
  - Пользовательское соглашение
  - Политика конфиденциальности
  - Согласие на обработку персональных данных
  - Публичная оферта
  - Политика возврата средств
  - Сведения об образовательной организации
  - Правила платформы
  - Лицензионное соглашение CC BY-SA 4.0
  - Возрастная маркировка
  - Политика использования файлов cookie
- DocumentPageLayout с ReadingProgressBar и Table of Contents
- Полная локализация юридических страниц (ru/en/zh)

---

## [1.0.0] — 2026-05-01

### Добавлено
- Инициализация проекта Next.js 16 + TypeScript + Tailwind CSS 4
- SPA hash-роутер (23+ маршрутов)
- Главная страница с hero-секцией
- Каталог курсов с фильтрами и сортировкой
- Страница курса с описанием и отзывами
- Step Viewer для прохождения уроков
- Профиль пользователя
- Система аутентификации (NextAuth.js v4)
- Редактор курсов (Course Editor)
- Zustand store для стейт-менеджмента
- SQLite база данных через Prisma ORM
- 14 моделей данных
- API Routes для курсов, пользователей, платежей
- Система уведомлений и достижений
- Сертификаты по завершении курсов
- shadcn/ui компоненты (40+)
- Базовая локализация (ru/en)
- Адаптивный дизайн
