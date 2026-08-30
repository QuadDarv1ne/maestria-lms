# Maestria LMS — Worklog

---

---

---

---

---

---

---

---

Task ID: 16
Agent: Main Agent
Task: Crypto-безопасная генерация промокодов + тесты ранее не покрытых модулей (csrf, api-logging, courseImage)

Work Log:
- FIX (LOW/SECURITY): src/lib/promo-code.ts — generatePromoCode использовал Math.random() (предсказуемый PRNG) для кодов, дающих скидки; заменён на crypto.randomInt() (node:crypto). Код по-прежнему состоит из [A-Z0-9], длина по умолчанию 8. Добавлен тест, проверяющий, что берутся индексы randomInt(0, 36) (детерминированная проверка через mock), + mock node:crypto в тесте
- TEST: src/lib/csrf.test.ts (8 тестов) — SAFE_METHODS пропускаются без проверки, Origin==Host допустим, другой Origin -> 403, отсутствие Origin/Host пропускается (SameSite=Strict — единственная защита), совпадение портов, Origin с портом vs Host без порта -> 403, невалидный Origin URL -> 403
- TEST: src/lib/api-logging.test.ts (11 тестов) — generateRequestId (8 hex, уникальность), уровень лога по статусу (2xx info / 4xx warn / 5xx error), пустые queryParams опускаются, смена X-Request-Id/X-Response-Time на успехе, чтение X-User-Id/X-User-Role из ответа в контекст, редоктеция sensitive query params (token->[REDACTED], page остаётся), брошенный хендлер -> 500 + X-Request-Id, сохранение статуса хендлера (201)
- TEST: src/lib/courseImage.test.ts (7 тестов) — resolveCourseImageUrl (null/''->null, absolute http(s) as-is, срез /courses/, CDN base с/без завершающего слеша, относительный путь -> CDN, фолбэк на локальный путь без CDN), getLocalFallbackImage; env.cdnUrl замокан через getter (vi.hoisted + vi.mock)
- NB: покрыты 3 ранее непокрытых модуля безопасности/утилит; итог — +27 тестов (промо +1, csrf +8, api-logging +11, courseImage +7)
- CHANGELOG.md и worklog.md обновлены

Stage Summary:
- 1 фикс безопасности (промокоды на crypto.randomInt)
- 3 новых тестовых файла (csrf, api-logging, courseImage) +1 тест к promo-code
- Итого +27 тестов, все проверки чистые

---
Task ID: 15
Agent: Main Agent
Task: Фикс битых изображений промо-курсов + тесты целостности данных

Work Log:
- FIX (MEDIUM): src/lib/promo-courses.ts — промо-курсы 33/34 (`scientific-writing.jpg`, `thesis-writing.jpg`) ссылались на несуществующие файлы; в public/courses файлов нет, живут только русские имена («Написание научных статей v2.jpg», «Написние курсовых, дипломных работ.jpg»). Пути исправлены, карточки больше не падают на placeholder
- TEST: promo-courses.test.ts (6 тестов) — уникальность id, валидный формат stepik URL (/a/<digits>), rating в [0,5], непустые image; для ru/en/zh: title/description/tag/duration и levelKey существуют и непустые; существует файл изображения в public/courses (тест сдулся бы на прежних битых путях)
- NB: руссифицированные имена файлов (пробелы, кириллица) — fs.existsSync работает; env.cdnUrl → не URL-энкодится, но локально plain path
- Проверено: 455 тестов (было 449), typecheck чистый, lint 0 ошибок/0 warnings

Stage Summary:
- 1 фикс данных (два битых изображения промо)
- +6 тестов (целостность данных), итого 455

---
Task ID: 14
Agent: Main Agent
Task: Фикс GET статуса попыток + тесты api-versioning

Work Log:
- FIX (MEDIUM): src/app/api/courses/[id]/assignments/[assignmentId]/route.ts GET — раньше: courseId не использовался вообще, assignment искался без проверки принадлежности курсу, enrollment не проверялся (метаданные задания — любому авторизованному), при пустых попытках maxAttempts=0 вместо реального лимита. Теперь: резолв courseId (id/slug), фильтр принадлежности к курсу (404), проверка enrollment (403), maxAttempts берётся из Assignment (в select title/type/points/maxAttempts)
- TEST: api-versioning.test.ts (15 тестов) — getApiVersion: Accept-Version (точный, частичный "2"/"1.0", неверный → дефолт), URL-префикс /api/v1//api/v2/неизвестный, фолбэк на CURRENT; isVersionSupported; isVersionDeprecated/isVersionSunset (false — нет дат в реестре); getVersionInfo (null для неизвестной); getAllVersions отсортированы по убыванию; addVersionHeaders (X-API-Version, без deprecation заголовков); validateApiVersion (null для зарегистрированных); withApiVersion (вызывает handler с версией, добавляет заголовки)
- Проверено: 449 тестов (было 434), typecheck чистый, lint 0 ошибок/0 warnings

Stage Summary:
- 1 фикс безопасности/корректности (assignment GET)
- +15 тестов (api-versioning), итого 449

---
Task ID: 13
Agent: Main Agent
Task: Лимит времени на задание (timeLimit) — полная поддержка

Work Log:
- FEATURE: prisma/schema.prisma — Assignment.timeLimit Int? (минуты, null = без лимита); миграция 20260829160000_assignment_time_limit (ALTER TABLE ADD COLUMN "timeLimit" INTEGER); prisma generate
- FIX: course-validation.ts — assignmentSchema теперь принимает timeLimit (string | number | null)
- FIX: admin/courses route → assignmentDataShape сериализует timeLimit (0/пусто → null); POST и PUT покрыты
- FIX: CourseEditorPage.tsx → handleSave отправляет timeLimit из AssignmentForm; ранее поле собиралось UI, но молча терялось (данные не сохранялись)
- FIX: GET lessons/[lessonId] route → в select заданий добавлены maxAttempts и timeLimit; StepTypes.AssignmentData дополнено
- FEATURE: StepAssignment.tsx — обратный отсчёт MM:SS (badge, Timer icon), автоотправка ответа при истечении времени (если ответ введён), блокировка полей и кнопки после таймаута; таймер не запускается для пройденных уроков
- i18n: добавлены ключи course.step.timeRemaining/timeUp/timeUpNotice в ru/en/zh
- TEST: course-validation.test.ts (14 тестов) — schema (мин. курс, ошибки title/slug/description, string-цена, модули + задания с timeLimit/maxAttempts, timeLimit как string/null, невалидный type/videoUrl), validatePrices (отрицательные, oldPrice<=price, null)
- NB: перегенерация prisma client обязательна после изменения схемы (npx prisma generate), иначе typecheck падает
- Проверено: 434 теста (было 420), typecheck чистый, lint 0 ошибок/0 warnings, check:i18n все ключи на месте

Stage Summary:
- 1 фича (timeLimit) сквозняком: БД → валидация → API → редактор → студент; устраняет молчаливую потерю данных в редакторе
- +14 тестов (course-validation), итого 434

---
Task ID: 12
Agent: Main Agent
Task: Фикс валидации course-restricted промокодов

Work Log:
- FIX (MEDIUM): src/lib/promo-code.ts — проверка courseId в validatePromoCode: `if (promoCode.courseId && courseId && promoCode.courseId !== courseId)` → `if (promoCode.courseId && promoCode.courseId !== courseId)`. Раньше промокод, привязанный к курсу, мог пройти валидацию, когда вызывающий не передал courseId; теперь отсутствие или несовпадение курса отклоняется
- Безопасность: все 3 вызывающих (enroll/route.ts, payments/route.ts, payments/promo/validate/route.ts) передают courseId; в promo/validate courseId обязателен в zod-схеме
- TEST: promo-code.test.ts +2 теста — course-restricted код без courseId отклоняется ("not valid for this course"), для совпадающего курса принимается (discount 20%)
- Проверено: 420 тестов (было 418), typecheck чистый, lint 0 ошибок/0 warnings, check:i18n exit 0 (все ключи на месте)

Stage Summary:
- 1 фикс безопасности (course-restricted промокоды)
- +2 теста, итого 420

---

Task ID: 11
Agent: Main Agent
Task: Тесты для webhook-verify, api-response, cors

Work Log:
- TEST: webhook-verify.test.ts (8 тестов) — verifyWebhookSignature: валидная sha256, отсутствие подписи, подмена тела, короткая подпись (length check против timing-атак), неверный секрет, формат "sha256=..." (Stripe-style), sha512, подпись с "=" посередине
- TEST: api-response.test.ts (16 тестов) — withTimeout (успех/таймаут с кастомным и дефолтным сообщением/проброс ошибки), все api*Response: notFound (с id и без), methodNotAllowed (Allow-заголовок), badRequest (details опционально), conflict, serviceUnavailable (дефолтное сообщение), success (meta опционально, кастомный статус), paginated, unauthorized, forbidden, internalError, validationError
- TEST: cors.test.ts (10 тестов) — applyCorsHeaders (разрешённый/запрещённый origin, wildcard, allowCredentials=false, expose headers), handleCorsPreflight (204/denied→null), withCors (preflight не вызывает handler, 403 на запрещённый origin, заголовки на реальных ответах). Для совместимости с типами используются NextRequest вместо Request
- NB: среда node для crypto/timingSafeEqual; setTimeout().unref() в withTimeout не мешает тестам
- Проверено: 418 тестов (было 382), typecheck чистый, lint src 0 ошибок/0 warnings

Stage Summary:
- 3 новых тестовых файла (34 теста) для ранее не покрытых модулей безопасности/ответов
- Итого 418 тестов, typecheck чистый, lint чистый

---

Task ID: 10
Agent: Main Agent
Task: Локализация formatFileSize, чистка db.ts, тесты request-validation/webhook-retry/utils

Work Log:
- FIX (MEDIUM): src/lib/utils.ts — formatFileSize всегда выводил русские единицы («Б», «КБ», «МБ») даже для en/zh локалей; добавлена карта единиц per-locale (ru: Б/КБ/МБ, en+zh: B/KB/MB), с фолбэком на en для неизвестных локалей. Используется в LessonAttachments (вложения уроков)
- FIX (LOW): src/lib/db.ts — ESLint error prefer-spread (.apply() → spread), удалена неиспользуемая переменная getClient, тип глобала Promise<any> → Promise<PrismaClient>; lint по src/**/*.{ts,tsx} теперь 0 ошибок / 0 warnings
- TEST: request-validation.test.ts (23 теста) — validateBody/validateQuery/validateParams (валид/невалид uuid, idOrSlug), paginationSchema (defaults, >100 limit rejected, page 0 rejected), searchSchema, uuidSchema, safeJsonParse, withErrorHandling (успех, generic → 500, Prisma P2025 → 404, Zod → 400)
- TEST: webhook-retry.test.ts (9 тестов) — calculateRetryDelay (эксп. рост, кап 1 час, целое >0), processWebhookWithRetry (нет записи, завершён, превышение попыток → failed, планирование retry), processPendingWebhooks, cleanupOldWebhookEvents
- TEST: utils.test.ts расширены formatFileSize (en/zh единицы, TB, десятичные с локальным разделителем 1,5 КБ / 1.5 KB, инф. значения)
- CHANGELOG.md + worklog.md обновлены

Stage Summary:
- 1 MEDIUM фикс локализации (formatFileSize per-locale)
- 1 LOW фикс ESLint (db.ts: prefer-spread, unused var, any-тип)
- 2 новых тестовых файла (request-validation, webhook-retry) + расширен utils.test
- Итого 382 теста (было 308), typecheck чистый, lint 0 ошибок/0 warnings, check:i18n — все ключи на месте

---
Task ID: 9
Agent: Main Agent
Task: Комментарии к урокам, бейдж «Новинка», фикс сортировки каталога

Work Log:
- FEATURE: LessonComment (Prisma) — self-relation CommentReplies (ответы в 1 уровень), индексы (lessonId, createdAt), (parentId), (userId), (lessonId, userId); миграция 20260815081455_lesson_comments (SQLite)
- FEATURE: GET/POST /api/courses/[id]/lessons/[lessonId]/comments:
  - GET — пагинация (page/limit, max 50), плоский список по createdAt desc, с select юзера
  - POST — auth, resolveLessonAccess (запись курса или бесплатный урок), content ≤ 2000 (MAX_COMMENT_LENGTH), parentId обязан принадлежать этому уроку, запрет ответа на ответ (parentId.parentId != null → 400), уведомление учителя курса createNotification(type: "comment"), лимит commentCreate 15/мин
- FEATURE: PATCH/DELETE /api/courses/[id]/lessons/[lessonId]/comments/[commentId] — редактирование (автор/учитель курса/admin, isEdited=true) и удаление (каскадно с ответами); комментарий обязан принадлежать уроку из URL (иначе 404), чужие комментарии → 403
- FEATURE: _access.ts (resolveLessonAccess — курс по id/slug, урок должен быть этого курса, запись проверяется для платных) и _validation.ts (MAX_COMMENT_LENGTH, commentContentSchema) в папке роута
- FEATURE: UI LessonComments.tsx (client) — дерево комментариев, ответы, редактирование, двухшаговое удаление, скелетоны, счётчик символов; встроен в StepViewerPage после нижней навигации (проп isEnrolled убран — доступ проверяет сервер)
- FEATURE: Тип уведомления "comment" — lib/notifications.ts, lib/stores/notifications.ts, NotificationsPage.tsx (MessageCircle, cyan), publish route (enum + запрет для не-админов)
- FEATURE: Бейдж «Новинка» (каталог) — createdAt в GET /api/courses (coursesWithStats) + CourseCard (NEW_COURSE_CUTOFF = 30 дней, вынесено из рендера — фикс react-hooks/purity), ключ catalog.new в ru/en/zh
- FIX (MEDIUM): CatalogPage.tsx — клиентская повторная сортировка ломала серверный порядок при пагинации; убрана
- Тесты: lesson-comments.test.ts (16 тестов: 401/403/404/400, GET пагинация, POST успех + уведомление учителя, parentId чужого урока 400, ответ на ответ 400, PATCH 403 чужой + isEdited, DELETE владелец/403/404). ВАЖНО: zod 4.3.5 uuid() требует RFC 9562 variant (4-я группа 8/a/b) — тестовые константы с "c"/"d" невалидны, исправлены
- API.md: документированы 4 комментариев-роута; schema.prisma — тип "comment" в комментарии модели Notification
- Проверено: typecheck чистый, ESLint 0 ошибок, check:i18n, 308 тестов проходят

Stage Summary:
- 2 новых API роута (comments + comments/[commentId]) с общим _access.ts/_validation.ts
- 1 миграция Prisma (LessonComment)
- 1 UI-компонент комментариев + интеграция в просмотр урока
- Бейдж «Новинка» + createdAt в каталог, фикс клиентской сортировки
- 16 новых тестов (итого 308)

---
Task ID: 8
Agent: Main Agent
Task: Возвраты платежей (YooKassa refunds), список платежей в админке, фикс email-ссылки

Work Log:
- FEATURE: Возвраты — POST /api/admin/payments/[id]/refund (только admin, rate limited, UUID-валидация):
  - Возврат оформляется в YooKassa (createRefund) если transactionId — ID платежа провайдера и YooKassa настроена; при отказе провайдера платёж не меняется (502)
  - Если YooKassa не настроена / transactionId локальный (txn_*) — локальная пометка refunded (mock/manual режим)
  - Атомарно (updateMany where status=completed → race-condition safe): payment.status=refunded + paymentData{refundedAt, refundAmount, providerRefundId, refundedBy}, enrollment.active→cancelled, studentCount decrement
  - createNotification пользователю (тип payment) + лог
- FEATURE: GET /api/admin/payments — пагинация, фильтры status/userId/courseId, search (до 100 символов), сводка totalRevenue/completed/refunded
- FEATURE: yookassa.ts — createRefund() (POST /refunds с Idempotence-Key) и formatYooKassaAmount() (1000.5 → "1000.50" — YooKassa требует ровно 2 знака)
- FEATURE: Webhook — обработка refund-событий (event/type начинается с "refund."): processRefundWebhook находит платёж по transactionId/payment_id, при succeeded/completed помечает refunded + отменяет запись + декремент (идемпотентно, атомарно); в схему добавлено поле object.payment_id (YooKassa refund object)
- FIX (MEDIUM): enroll route — ссылка в письме учителю собиралась из process.env.NEXT_PUBLIC_SITE_URL || "" → пустой origin при незаданной переменной; заменено на env.siteUrl (фолбэк NEXTAUTH_URL)
- Тесты: refund-flow.test.ts (9 тестов: 401/403/404/400/409, успешный refund с провайдером, отказ провайдера 502 без изменений, manual refund, txn_ не идёт в провайдер), yookassa.test.ts (formatYooKassaAmount, isYooKassaConfigured)
- API.md: документированы /api/admin/payments, /api/admin/payments/[id]/refund, refund-события webhook
- Проверено: typecheck чистый, ESLint 0 ошибок, 292 теста проходят

Stage Summary:
- 2 новых admin API роута (список платежей + возврат)
- 1 фикс email-ссылки (env.siteUrl вместо raw NEXT_PUBLIC_SITE_URL)
- 2 функции YooKassa (createRefund, formatYooKassaAmount)
- 1 расширение webhook (refund-события)
- 11 новых тестов

---
Task ID: 7
Agent: Main Agent
Task: Исправление сборки (middleware/proxy конфликт), провайдер-зависимый поиск, i18n-ключи, check-i18n

Work Log:
- CRITICAL: next build падал на "Both middleware file and proxy file are detected" — src/middleware.ts (шима, добавленная в f877a23) конфликтовал с src/proxy.ts; в Next.js 16 middleware переименован в proxy, шима удалена — build успешен
- MEDIUM: Поиск блога (src/app/(main)/blog/page.tsx) использовал mode: "insensitive" безусловно — на SQLite (дефолтный провайдер) тип StringFilter не поддерживает mode, сборка падала на типизации; исправлено по паттерну API-роутов: mode только для postgresql, иначе содержит без mode (SQLite LIKE case-insensitive нативно)
- LOW: Добавлены отсутствующие i18n-ключи courseEditor.published / courseEditor.draft (используются в TeacherDashboard) в ru/en/zh
- LOW: ESLint: prefer-const (src/lib/db.ts), any в типе where блога → Prisma.ArticleWhereInput
- LOW: check-i18n.mjs: regex t() теперь допускает цифры в ключах (terms.toc1 и т.д. давали ложные "unused"), тестовые файлы исключены из сканирования
- documents_fos_aup/ добавлена в .gitignore (сгенерированные .docx, не часть кода)
- Проверено: typecheck чистый, ESLint 0 ошибок/0 warnings, 281 тест проходят, next build успешен, check:i18n — все ключи присутствуют

Stage Summary:
- 1 CRITICAL фикс сборки (удалена конфликтующая шима middleware.ts)
- 1 MEDIUM фикс провайдер-зависимой фильтрации поиска
- 2 i18n-фикса (ключи + checker)
- 2 ESLint-фикса

---
Task ID: 6
Agent: Main Agent
Task: Валидация параметров API routes, rate limiting placement, i18n fixes

Work Log:
- Создан хелпер `validateParams()` в request-validation.ts для валидации route params через Zod
- Добавлены схемы `uuidSchema` и использование `idOrSlugSchema` для валидации параметров
- UUID-валидация добавлена в 16 dynamic API routes: payments/[id], notifications/[id], certificates/[id], admin/promo-codes/[id], admin/courses/[id]/submissions/[submissionId], courses/[id]/assignments/[assignmentId]
- idOrSlug-валидация добавлена в routes с UUID-or-slug: courses/[id], courses/[id]/lessons/[lessonId], courses/[id]/enroll, courses/[id]/progress, courses/[id]/students, courses/[id]/reviews, articles/[slug]
- Rate limiting перемещён из try-блока наверх handler'а в 8 routes: notifications/route.ts (GET+DELETE), notifications/[id] (PATCH+DELETE), notifications/mark-all, achievements, certificates, teacher/stats
- Валидация query params: role в admin/users (whitelist student/teacher/admin), status в admin/courses (published/unpublished), status в courses/[id]/students (active/completed/paused/cancelled), search length limit (100 chars) во всех admin endpoints
- ESLint: исправлен warning `any` → `Record<string, unknown>` в promo-code.test.ts
- i18n: заменен hardcoded 'ДИ' на `tr("about.directorInitials")` в AboutPage.tsx, добавлен ключ в 3 локали (ru/en/zh)
- Проверено: typecheck чистый, ESLint 0 ошибок/0 warnings, 281 тестов проходят, next build успешен

Stage Summary:
- 16 API routes защищены валидацией параметров (UUID/format)
- 8 routes исправлены: rate limiting теперь срабатывает до auth
- 3 admin endpoints защищены от произвольных значений role/status/search
- 1 i18n fix (hardcoded строка → t() call)

---
Task ID: 5
Agent: Main Agent
Task: Аудит кодовой базы — исправление безопасности, консистентности и качества

Work Log:
- Безопасность: `execSync` → `execFileSync` в backup route (защита от shell injection)
- Rate limiting: добавлен `checkRateLimit` на POST /api/admin/backup (ранее отсутствовал)
- Rate limiting: перемещён `checkRateLimit` перед `await params` в progress route (GET и PATCH)
- Консистентность API: все английские error messages в courses/[id]/progress/route.ts заменены на русские (как в остальных routes): "Course not found" → "Курс не найден", "Not enrolled" → "Вы не записаны", и т.д.
- Протокольный код: `"ТРЕБУЕТСЯ_2FA"` → `"REQUIRES_2FA"` в auth.ts и AuthDialogs.tsx (программный код, не UI-строка)
- Удалена deprecated функция `loadLocale()` из i18n.ts + очищен вызов в Providers.tsx
- Fallback локаль: `"ru-RU"` → `"en-US"` в formatDate/formatNumber для широкой совместимости
- Новая утилита `formatCurrency(amount, currency, locale)` на базе `Intl.NumberFormat`
- Все компоненты переведены с хардкода `₽` на `formatCurrency()`: PaymentHistory, CourseCard, CourseDetailPage, AdminFinance, AdminPromoCodes, PreviewTab
- Null safety: `p.discountAmount &&` → `p.discountAmount != null &&` в PaymentHistory.tsx
- Убран deprecated `document.execCommand("copy")` fallback в ErrorBoundary.tsx
- Убран hardcoded русский fallback в ErrorBoundary: `|| "Проблема не устранена..."` → просто `t("error.maxRetries", locale)`
- Очищены неиспользуемые imports (formatNumber) из 4 файлов
- Проверено: typecheck чистый, ESLint 0 ошибок/0 warnings, 280 тестов проходят

Stage Summary:
- 1 security fix (execSync → execFileSync)
- 2 rate limiting fixes (backup route, progress route ordering)
- ~15 API error messages стандартизированы
- 6 компонентов переведены на formatCurrency (убран хардкод ₽)
- 3 deprecated/unused функции/imports удалены

---
Task ID: 4
Agent: Main Agent
Task: Промокоды в чекауте и админке, история платежей в профиле, email-уведомления

Work Log:
- Промокод в чекауте (CourseDetailPage): поле ввода + кнопка «Применить» → POST /api/payments/promo/validate; при успехе показывается скидка и итоговая цена (оригинал зачёркнут); promoCode передаётся в /api/courses/[id]/enroll
- enroll route: валидация промокода (validatePromoCode) до транзакции, в tx.payment.create добавлены amount со скидкой, discountAmount, promoCodeId (обе ветки: повторная запись и новая); redeemPromoCode вызывается после успешного создания платежа; в ответе amount = finalAmount
- Управление промокодами в админке: новый клиентский компонент AdminPromoCodes.tsx встроен в AdminFinance (создание с типом скидки/сроком/лимитами/курсом, список, toggle активности, удаление с деактивацией использованных, копирование кода)
- История платежей: новый PaymentHistory.tsx + вкладка «Платежи» в ProfilePage (GET /api/payments; статусы paid/pending/failed/refunded/cancelled, сумма, скидка, способ оплаты)
- Email учителю при новом отзыве: courses/[id]/reviews POST → reviewNotificationEmail (только при создании, не обновлении; только если emailVerified). Исправлен текст шаблона: «Студент оставил новую оценку» вместо «Преподаватель»
- env.siteUrl: добавлен fallback на NEXTAUTH_URL — ссылки в письмах корректны в проде без NEXT_PUBLIC_SITE_URL
- ~70 i18n ключей добавлено (course.promo.*, adminPromo.*, profile.payment*), 3 локали синхронны
- Проверено: typecheck чистый, ESLint 0 ошибок, 280 тестов проходят, next build успешен (была одна транзиентная ошибка копирования assets из-за лока файла — при повторе прошло)

Stage Summary:
- Промокоды полностью работают E2E: создание в админке → валидация в чекауте → применение при оплате → списание использования
- Профиль обогащён историей платежей; учителя получают email о новых отзывах

---
Task ID: 3
Agent: Main Agent
Task: Продолжение улучшений — фикс drift БД, drag-drop UI на @dnd-kit, локализация остатков

Work Log:
- Исправлена критическая ошибка "The column main.User.pendingTwoFactorSecret does not exist":
  - Причина: schema.prisma ушёл вперёд от миграций (только init-миграция); на продакшене БД создаётся через `prisma migrate deploy`, поэтому не хватало колонок/таблиц
  - Создана миграция `20260802000000_schema_drift_sync` (migrate diff): User.pendingTwoFactorSecret, PromoCode, WebhookEvent, Payment.promoCodeId/discountAmount, ~40 индексов
  - Проверено: свежая БД после `migrate deploy` полностью соответствует схеме; `migrate diff` = "No difference detected"
  - Локальная БД синхронизирована: `db push` + `migrate resolve --applied` для обеих миграций (в _prisma_migrations)
- Drag & Drop задание: StepDragDrop.tsx переписан с click-based на @dnd-kit/core (Pointer/Touch sensors, DragOverlay, подсветка зон, возврат в пул). Клик-фолбэк сохранён для a11y. Добавлен i18n ключ course.step.removeItem (ru/en/zh)
- Локализация demo-data.ts: строки заменены на i18n-ключи admin.demo.* (отчёты, журнал, курсы), добавлены хелперы translateDemoText/formatDemoTime; убраны неиспользуемые monthLabels/dayLabels/demoCategoryDistribution
- Компоненты админки (AdminReports/AdminLogs/AdminTests/AdminMaterials) переводят демо-данные через t()
- Страницы /admin и /course-editor: generateMetadata с локалью из cookie (ключи meta.admin*/meta.editor*)
- check-i18n.mjs подключён как npm run check:i18n
- Проверено: typecheck чистый, ESLint 0 ошибок, 280 тестов проходят, next build успешен

Stage Summary:
- 1 миграция создана, drift полностью устранён (локально и для migrate deploy)
- 1 компонент переписан на настоящий drag-and-drop
- ~35 i18n ключей добавлено (3 локали), остатки hardcoded строк убраны

---
Task ID: 2
Agent: Main Agent
Task: Улучшение проекта — фикс багов, система промокодов, стабилизация тестов

Work Log:
- Исправлена TypeScript ошибка в api-logging.ts (NextResponse cast в catch-блоке withApiLogging<T>)
- Исправлено 31 падающих тестов в api-integration.test.ts (дублирующий vi.mock("@/lib/db") без экспорта db, исправлено через vi.hoisted())
- Убраны дублирующие vi.mock("@/lib/auth") блоки в api-integration.test.ts
- Исправлены ESLint warnings: неиспользуемые переменные в request-validation.ts и api-integration.test.ts
- Исправлен security баг в sanitizeText: теперь корректно удаляет содержимое script/style/iframe/object/embed/noscript тегов
- Исправлен баг в sanitizeObject: опции (textFields, htmlFields, skipFields) теперь передаются в рекурсивные вызовы
- Создана система промокодов:
  - Модель PromoCode в Prisma schema (discount types, usage limits, validity period, course restriction)
  - Поля promoCodeId и discountAmount в модели Payment
  - Библиотека promo-code.ts: validatePromoCode, redeemPromoCode, generatePromoCode
  - API: POST /api/payments/promo/validate (валидация промокода)
  - Admin API: GET/POST /api/admin/promo-codes, GET/PATCH/DELETE /api/admin/promo-codes/[id]
  - Интеграция промокодов в POST /api/payments (с автоматическим redeem)
  - 20 модульных тестов для системы промокодов
- Все 282 теста проходят (19 файлов), TypeScript чистый, ESLint 0 ошибок

Stage Summary:
- 1 TypeScript ошибка исправлена
- 34 теста исправлены (31 api-integration + 3 sanitize)
- Система промокодов полностью реализована (schema + lib + API + tests)
- Security: sanitizeText теперь безопасно удаляет содержимое опасных тегов

---
Task ID: 1
Agent: Main Agent
Task: Создать расширенную закрытую панель администратора с графиками и статистикой

Work Log:
- Изучена текущая структура проекта (AdminPage.tsx, store.ts, i18n.ts, page.tsx)
- Полностью переписан AdminPage.tsx — 9 секций вместо 7 табов
- Создан экран входа с паролем (учитывается из .env: ADMIN_EMAIL / ADMIN_PASSWORD)
- Создан боковой сайдбар (сворачиваемый на десктопе, выдвижной на мобильных)
- Добавлены SVG-компоненты графиков: LineChart, BarChart, DonutChart, Sparkline
- Добавлены 9 вкладок: Дашборд, Пользователи, Тесты, Материалы, Финансы, Курсы, Жалобы, Логи, Настройки
- Добавлены KPI-карточки со спарклайнами
- Добавлена статистика прохождения тестов (проходной %, ср. балл, попытки)
- Добавлена статистика прочитывания материалов (прогресс, время, сессии)
- Добавлены графики: регистрации, записи, доход, активность
- Добавлена кольцевая диаграмма распределения по категориям
- Добавлены i18n ключи для админ-панели (48 ключей × 3 локали: ru/en/zh)
- Обновлён page.tsx: Header/Footer скрываются на странице #admin
- Проект успешно собран (next build)

Stage Summary:
- AdminPage.tsx полностью переписан (~900 строк)
- Добавлено 48 i18n ключей на 3 языка (ru/en/zh)
- page.tsx обновлён для полноэкранного режима админки
- Пароль для входа: из переменных окружения
- 4 типа SVG-графиков: LineChart, BarChart, DonutChart, Sparkline
- Все секции: Дашборд, Пользователи, Тесты, Материалы, Финансы, Курсы, Жалобы, Логи, Настройки
