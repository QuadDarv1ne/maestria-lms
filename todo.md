# TODO: Улучшения проекта Maestria LMS

## 🔴 Критические ошибки
- [x] Удалить зависимость `"2": "^3.0.0"` из package.json (ошибочный пакет)
- [x] Убрать пароль админа из CHANGELOG.md (строка 12: `admin / Maestria2026`)
- [x] Исправить ESLint config — удалить несуществующие правила `react-hooks/purity`, `set-state-in-effect`, `static-components`, `immutability`
- [x] Добавить динамический импорт (code splitting) в page.tsx для всех страниц SPA

## 🟡 Качество кода
- [ ] Разделить огромные файлы (AdminPage.tsx ~1834 строк, CourseEditorPage.tsx ~1697, StepViewerPage.tsx ~1048)
- [ ] Вынести i18n переводы из `src/lib/i18n.ts` в отдельные JSON-файлы (`locales/*.json`)
- [ ] Убрать дублирование: icon maps, level labels, category options, course card
- [ ] Заменить прямые `fetch()` вызовы на React Query (`@tanstack/react-query` уже установлен)
- [ ] Разделить единый Zustand store на несколько (auth, ui, catalog)

## 🔧 Архитектура
- [ ] Заменить hash-based SPA роутер на настоящие Next.js App Router страницы (SSR, SEO)
- [ ] Вынести демо-данные из AdminPage.tsx в `src/lib/demo-data.ts`
- [ ] Создать переиспользуемые компоненты: CourseCard, StatCard, IconMap
- [ ] Добавить Suspense границы и Error Boundaries для каждого раздела

## 🧪 Тестирование
- [ ] Добавить компонентные тесты (30+ компонентов, 0 тестов)
- [ ] Добавить API route тесты (18 роутов, 0 тестов)
- [ ] Добавить E2E тесты

## 🔒 Безопасность
- [ ] Реализовать rate limiting на API роутах
- [ ] Убрать `console.log` токенов сброса пароля (forgot-password/route.ts)
- [ ] Добавить централизованную проверку авторизации (middleware)

## ⚡ Производительность
- [ ] Добавить code splitting через `next/dynamic` (сделано)
- [ ] Использовать `next/image` вместо `<img>` везде
- [ ] Добавить React.memo/useMemo для больших списков

## 📦 Зависимости
- [ ] Проверить неиспользуемые пакеты: cmdk, input-otp, vaul, react-resizable-panels, @reactuses/core
- [ ] Перейти на единый пакетный менеджер (убрать или bun.lock или package-lock.json)

## 🗄️ База данных
- [ ] Рассмотреть миграцию с SQLite на PostgreSQL для продакшена
- [ ] Добавить стратегию миграций для production

## 🚀 CI/CD & DevOps
- [ ] Добавить GitHub Actions workflow для линтинга и тестов
- [ ] Настроить Docker контейнеризацию
- [ ] Добавить Sentry для отслеживания ошибок
