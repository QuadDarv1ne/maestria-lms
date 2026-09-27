# План миграции на правила React Hooks v7

Зафиксировано 2026-09-27. Источник: обновление `eslint-config-next` до 16.3.x,
которое принесло `eslint-plugin-react-hooks` v7 (правила React Compiler).

## Текущее состояние

`npm run lint` → **0 ошибок, 12 предупреждений**. Правила ниже понижены с `error`
до `warn` в `eslint.config.mjs`, чтобы не блокировать CI до миграции:

| Правило | Уровень | Сколько |
|---|---|---|
| `react-hooks/set-state-in-effect` | warn | 9 |
| `react-hooks/preserve-manual-memoization` | warn | 2 |
| `@next/next/no-location-assign-relative-destination` | warn | 1 |

## Перечень срабатываний

| Файл:строка | Правило | Причина |
|---|---|---|
| `src/app/payment/[id]/PaymentPageClient.tsx:89` | set-state-in-effect | fetch-on-mount |
| `src/app/reset-password/page.tsx:60` | set-state-in-effect | чтение токена из хранилища в эффекте |
| `src/app/status/page.tsx:168` | set-state-in-effect | fetch-on-mount |
| `src/components/BlogPageClient.tsx:150` | set-state-in-effect | fetch-on-mount |
| `src/components/LessonAttachments.tsx:91` | set-state-in-effect | fetch-on-mount |
| `src/components/LessonComments.tsx:82` | set-state-in-effect | fetch-on-mount |
| `src/components/ProfilePage.tsx:121` | set-state-in-effect | fetch-on-mount |
| `src/components/TeacherDashboard.tsx:98` | set-state-in-effect | fetch-on-mount |
| `src/components/admin/AdminFeatureFlags.tsx:43` | set-state-in-effect | fetch-on-mount |
| `src/components/LessonPage.tsx:161` | preserve-manual-memoization | мемоизация не сохраняется компилятором |
| `src/components/step-viewer/StepDragDrop.tsx:112` | preserve-manual-memoization | то же |
| `src/components/ErrorBoundary.tsx:162` | no-location-assign-relative-destination | `window.location.assign("/")` в классе-компоненте |

## Оценка риска

Независимое ревью (см. отчёт ревизии пакета 2) разобрало все срабатывания:
**корректностных дефектов нет** — 9 случаев это осознанный fetch-on-mount с
корректно мемоизированными колбэками, 2 — артефакты вывода компилятора
(optional chaining, сброс состояния при смене пропса), 1 — намеренный полный
реload в error boundary (класс-компонент, где `useRouter` недоступен).

Поэтому миграция — это улучшение кода, а не исправление бага. Спешить не нужно.

## Порядок работ

**Этап 1. Данные на клиенте (7 файлов, низкий риск).**
Заменить `useEffect(() => { void fetch() }, [])` на слой запросов:
`@tanstack/react-query` уже в зависимостях и используется в проекте.
`useQuery` убирает сам паттерн «эффект + setState» и даёт кэш, повторные попытки,
`isPending` вместо ручного `loading`.

Файлы: `BlogPageClient`, `LessonComments`, `LessonAttachments`, `ProfilePage`,
`TeacherDashboard`, `AdminFeatureFlags`, `status/page`.

**Этап 2. Особые случаи (2 файла, средний риск).**
- `PaymentPageClient.tsx` — опрос статуса платежа: перенести на `useQuery` с
  `refetchInterval`, который останавливается при терминальном статусе.
  Обязательно покрыть тестом: создание платежа, ожидание, успех, ошибка.
- `reset-password/page.tsx` — начальное значение токена брать лениво
  (`useState(() => readToken())`) вместо setState в эффекте.

**Этап 3. Мемоизация (2 файла, требует проверки поведения).**
`LessonPage.tsx:161` и `StepDragDrop.tsx:112` — устранить причины отказа компилятора
(разделить вычисление и побочный эффект, вынести вычисления из зависимостей).
Перед правкой снять эталонное поведение (drag-and-drop, переходы по шагам).

**Этап 4. Навигация в error boundary (1 файл).**
`ErrorBoundary` — класс-компонент; перевести на `useRouter().push("/")` можно только
переписав его в функциональный компонент с `componentDidCatch`. Либо оставить
осознанное исключение с комментарием и точечным `eslint-disable`.

**Этап 5. Вернуть правила в `error`.**
После этапов 1–4 убрать понижение в `eslint.config.mjs` и убедиться, что
`npm run lint` даёт 0 проблем.

## Критерии приёмки

- `npm run lint` → 0 ошибок и 0 предупреждений этих правил.
- `npm run typecheck` → exit 0, `npm run test:coverage` → exit 0 без падения покрытия.
- Поведение пользовательских сценариев не изменилось: курсы, уроки, комментарии,
  вложения, платежи, админка (проверять вручную на dev-сборке после каждого этапа).
- Пакетные изменения не смешивать: один этап — один коммит/PR.
