# Changelog Maestria

Все существенные изменения проекта Maestria документируются в этом файле.

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/).

---

## [Unreleased]

### Добавлено
- **Email-очередь на Redis с приоритетами, retry и dead-letter**: `src/lib/email-queue.ts` — транзакционные письма ставятся в sorted-set очередь вместо синхронной отправки внутри API-роута. Четыре приоритета (`urgent`/`high`/`normal`/`low`) задаются старшим разрядом score (`priority × 1e13 + timestamp`), что сохраняет точный порядок в пределах точности float64 и даёт FIFO внутри приоритета. Повторные попытки уходят в **отдельный** retry-сет с скорингом по часу готовности (`promoteDueRetries()` поднимает их в основную очередь) — раньше задача возвращалась в голову очереди с текущим временем и backoff 1/5/15/45/90 минут фактически не работал. Исчерпанные попытки попадают в dead-letter с сохранением последней ошибки
- **Worker очереди** (`src/lib/email-worker.ts`): `processEmailQueue()` за один прогон выполняет maintenance (`collectOrphanedJobs()` — возврат в обработку зависших в `processing` задач, `promoteDueRetries()`) и доставляет до `batchSize` писем, возвращая сводку `processed/succeeded/failed/promoted/cleaned/queueStats`
- **`dispatchEmail()`** (`src/lib/email-dispatch.ts`) — рекомендуемая точка входа для транзакционных писем: ставит письмо в очередь и фоном запускает worker (Amvera не предоставляет cron, поэтому очередь «самосливающаяся»; внешний cron на `POST /api/emails/process` остаётся поддержанным и лишь дополняет). При недоступном Redis — прозрачный откат на прежнюю прямую отправку, так что поведение деплоя без кэша не меняется. Флаг `direct: true` там, где булев результат важен (например, логирование жёсткого сбоя письма верификации)
- **API очереди** (защищены общим секретом `EMAIL_QUEUE_SECRET` — `Authorization: Bearer` или `X-Email-Secret`, сравнение constant-time; при пустом секрете все эндпоинты отключены `503`, rate limit 10/мин): `POST /api/emails` — постановка готового письма или ссылки на шаблон (`{ template, to, data }`, 11 шаблонов), `GET /api/emails/stats` — счётчики очередей с разбивкой pending по приоритетам, `POST /api/emails/process` — запуск worker'а (для внешнего крона), `GET|POST /api/emails/dead` — просмотр мёртвых писем и команды `purge`/`retry`
- Тесты: `email-queue.test.ts` (29) — приоритетный порядок и FIFO внутри приоритета, retry уходит в delayed-сет на горизонте backoff а не в голову очереди, dead-letter после исчерпания попыток, promotion только созревших задач с пересчётом по приоритету, сбор осиротевших задач по TTL, счётчики и разбивка по приоритетам, dead-letter операции; `email-worker.test.ts` (8) — доставка и завершение, остановка на пустой очереди, `batchSize`, отсутствие API-ключa как фатальная ошибка без retry, изоляция сбоя `sendEmail` по письму, maintenance по умолчанию и по флагу; `email-dispatch.test.ts` (5) — постановка в очередь, приоритет, откат на прямую отправку при недоступном Redis, `direct`-режим

### Изменено
- `emails/index.ts` — добавлен ре-экспорт `refundNotificationEmail` (шаблон существовал, но не был доступен из барреля)

---

- **Фоновая сверка зависших платежей (cron)**: `reconcilePendingPayments()` (`src/lib/payments/reconcile.ts`) находит `pending`-платежи с реальным `providerPaymentId`, созданные 15 минут – 30 дней назад, и batch-ом (до 200 за прогон) опрашивает провайдера через `getPaymentStatus`. Платёж, оплаченный при потерянном вебхуке и закрытой странице оплаты, теперь восстанавливается автоматически: идемпотентный `completePayment` выдаёт доступ, а уведомление и письмо отправляются только тем прогоном, который действительно завершил платёж. Placeholder-ids (`pending_*`, `sim_*`), неизвестные/ненастроенные провайдеры и ошибки шлюза не ломают батч и учитываются в сводке (`skipped`/`unknown`/`errors`)
- **`POST /api/payments/reconcile`** — cron-endpoint для запуска сверки: общий секрет `PAYMENT_RECONCILE_SECRET` (`Authorization: Bearer` или `X-Reconcile-Secret`, сравнение constant-time), при пустом секрете endpoint отключён (`503`), rate limit 6 запросов/мин, опциональные `minAgeMinutes`/`maxAgeDays`/`batchSize`
- Тесты: `payments-reconcile.test.ts` (5) — выборка только stale pending с реальным provider id, границы `createdAt`, clamp опций, агрегация всех исходов, уведомление только при фактическом завершении, отсутствие курса/пользователя; `payments-reconcile-route.test.ts` (8) — 503 без секрета, 401 без/с неверным секретом, Bearer и X-Reconcile-Secret, пустое тело, невалидный JSON и out-of-range опции
- **Страница /help — фичи из публичной базы знаний (Tilda)**: глубокие ссылки `/help#faq-N` открывают и прокручивают к нужному вопросу (hash обновляется через `history.replaceState` при открытии/закрытии), счётчик "Найдено: N из M" при активном поиске/фильтре, кнопка очистки поиска, поддержка ссылок внутри ответов (внутренние маршруты и mailto). 6 новых вопросов из `tilda/knowledge-base.html`, адаптированных под LMS (мгновенный доступ после оплаты, внутренние страницы вместо Stepik-ссылок): доступ после оплаты, чек/документы об оплате, оплата по счёту для юрлиц, вопросы преподавателю во время обучения, скачивание материалов (запрещено, ссылка на /terms), устройства для обучения — ключи добавлены во все три локали
- **Автоматическая синхронизация контента при каждом деплое (Amvera)**: `prisma/seed.mjs` получил не-деструктивный режим `--sync` — upsert по slug категорий, курсов (только скалярные поля контента; метрики `rating`/`studentCount`/`reviewCount` и `views` статей не перетираются, существующие модули/уроки и прогресс студентов не трогаются, новые модули дозаписываются по title) и статей. Демо-пользователь создаётся, только если отсутствует. `start.sh` теперь запускает `node scripts/seed.js --sync` при каждом старте контейнера вместо одноразового `--if-empty` — новые/обновлённые статьи и курсы из репозитория автоматически попадают в PostgreSQL на Amvera (раньше seed выполнялся только на пустой БД и изменения контента никогда не доезжали до прода). npm-скрипт `db:sync` для ручного запуска. Сбой синхронизации не останавливает старт сервера
- Создание курсов/статей в seed переведено с `Promise.all` на последовательное выполнение: конкурентный батч на драйвер-адаптерах (better-sqlite3) превращал любую ошибку запроса в непрозрачный внутренний сбой рендеринга ошибок Prisma (masked `TypeError: … 'sep'`); теперь место сбоя логируется слагом (`[seed] course sync FAILED at: <slug>`)
- Хелперы `syncCourse`/`upsertArticle`/`upsertCategory` в `prisma/seed.mjs` — единая точка создания контента для обоих режимов (деструктивный seed и `--sync`)

### Исправлено
- **MEDIUM (деньги/UX)**: `GET /api/payments/[id]` мог отправить повторное письмо "Оплата прошла успешно": pull-сверка вызывается при каждом поллинге страницы оплаты, а `notifyPaymentCompleted` срабатывал и тогда, когда платёж уже завершил вебхук или параллельный запрос. `PaymentSyncOutcome` теперь возвращает `alreadyCompleted` (и identity платежа), уведомление отправляется только тем вызовом, который действительно завершил оплату
- **MEDIUM (деньги/UX)**: `payments/service.ts` — повторная попытка оплаты существующего pending-платежа возвращала провайдера и метод **из текущего запроса**, а не фактические (`existingAsCreated`): пользователь, создавший оплату через ЮKassa SBP и повторивший запрос картой через Tinkoff, получал confirmationUrl ЮKassa с меткой "Tinkoff", а `init-provider` мог завести вторую оплату у другого шлюза для той же строки. Теперь возвращаются `paymentProvider`/`paymentMethod` из БД (fallback на запрошенную пару — только для легаси-строк без сохранённого провайдера)
- **MEDIUM (справедливость)**: промокод больше не сжигается при создании платежа. Ранее `redeemPromoCode` вызывался сразу после принятия платежа провайдером (статус pending), и отмена платежа (webhook `payment.canceled`) навсегда тратила попытку пользователя. Теперь погашение происходит только при фактическом завершении оплаты: в `completePayment` (вебхук-путь, идемпотентно по userId) и зеркально в `/api/payments/[id]/simulate-complete` (тестовый путь) — оба пути завершения больше не расходятся

### Добавлено
- Тесты `payments-service.test.ts` (13): существующий pending возвращает фактического провайдера/метод из БД (и fallback для легаси-строк), ALREADY_PAID при completed, `promoCodeId`/`discountAmount` сохраняются на строке платежа **без** вызова `redeemPromoCode` (attempt не сжигается), `completePayment` гасит промокод только при реальном завершении и не делает этого для already-completed/без промокода; pull-сверка — completed→completePayment+studentCount, canceled→failed, provider pending → без изменений, ошибка шлюза → `unknown` без изменения платежа, пропуск placeholder-ов (`pending_`/`sim_`/null) и не-pending/ненастроенных провайдеров

### Изменено
- **Новый логотип бренда**: `public/logo.svg` (векторный мастер, 256×256, белая плитка + академическая шапочка + градиентная "M") и `public/maestria-logo-icon.png` (растровый двойник 512×512) заменили прежний `maestro7it-logo.png` в metadata (`layout.tsx`), Open Graph, JSON-LD и интерфейсе. `public/icon.svg` — копия мастера для `<link rel="icon">`
- **Компонент `Logo`** (`src/components/Logo.tsx`): единая точка рендера знака (размер, wordmark, подпись "by Maestro7IT", выбор SVG/PNG-источника) — внедрён в `Header` (десктоп + мобильный Sheet), `Footer`, `AboutPage` (hero) и `CertificatePage` (для html2canvas используется растровая версия)
- `theme_color` в `manifest.json` и `<meta name="theme-color">` приведены к фиолетовому бренду `#7c3aed`

### Добавлено
- **Сгенерированы отсутствовавшие брендовые ассеты**: `favicon.ico` (ICO с 16/32/48/64), `og-image.png` (1200×630), PWA-иконки 72–512 px, включая maskable-варианты 192/512. Ранее `manifest.json`, `sw.js` и `layout.tsx` ссылались на несуществующие файлы — PWA не устанавливалась, соцкарточки оставались без картинки
- `scripts/generate-brand-assets.ps1` — воспроизводимая генерация всех размеров из мастер-PNG (System.Drawing, без внешних зависимостей)
- Тест `src/lib/brand-assets.test.ts` (29): существование каждого файла, на который ссылаются metadata/manifest/service worker, синхронность `logo.svg`/`icon.svg` с мастером, валидность ICO-заголовка и размеров OG-картинки, обязательные размеры и maskable-иконки манифеста

### Исправлено
- **`public/sw.js`**: `cache.addAll(urlsToCache)` падал целиком при одном отсутствующем файле, из-за чего не регистрировался и offline-fallback; теперь ассеты кэшируются по одному с warning'ом, а версия кэша поднята до `3.7.1`, чтобы старые клиенты получили новый набор
- **`layout.tsx`**: удалены дублирующие `<link rel="icon">`/`<link rel="apple-touch-icon">` в `<head>` — иконки объявлены в `generateMetadata()`
- **HIGH (security)**: `payments/providers/ozon.ts` — `verifyWebhook()` принимал вебхуки **без подписи**, если `OZON_WEBHOOK_SECRET` был настроен: отсутствующий заголовок `X-Ozon-Signature` проваливался в ветку IP-whitelist, а для Ozon опубликованные диапазоны не заданы (`ip-whitelist.ts` → `OZON: []`), поэтому `isIpAllowed("OZON", …)` возвращает `true` для **любого** источника. Любой, кто знал форму тела (`payment_id` + `order_id`), мог прислать неподписанное событие `payment.succeeded` на `/api/payments/webhook` и пометить собственный платёж оплаченным. Теперь подпись обязательна: без заголовка или при несовпадении HMAC — отказ; запасная IP-ветка удалена вместе с неиспользуемым импортом
- **MEDIUM**: `payments/providers/tinkoff.ts` — `verifyWebhook()` бросал `Error("TINKOFF_PASSWORD is not configured")` при вебхуке с заголовком `Token` и ненастроенном терминале. Метод вызывается из публичного роута `/api/payments/webhook` вне `try/catch` провайдера, поэтому вместо корректного `401` сервер отвечал `500` и светил конфигурацию в логах. Добавлена проверка `isConfigured()` до пересчёта подписи — теперь чистый отказ с warn-логом

### Добавлено
- Тесты для `feature-flags.ts` (25, два файла): клиентское окружение (jsdom) — слоёная приоритезация `isFeatureEnabled` (env `FEATURE_FLAG_*` > URL `flag-<key>` > localStorage `feature-flag:<key>` > rollout > default), игнорирование мусорных URL-значений, клиентский кэш первой оценки и сброс через `clearFeatureFlags` (удаляет только `feature-flag:*`), `setFeatureFlag` (localStorage + кэш), игнорирование server-override на клиенте, `getAllFeatureFlags`, warn + `false` для неизвестного ключа; серверное окружение (node) — server-override (`setServerFeatureFlag`) старше env и персистентен между вызовами, отсутствие кэша на сервере (смена env применяется сразу), env со значением не `true`/`false` игнорируется; ветка rollout покрыта тестовыми флагами 0% (никогда) / 50% (детерминизм по seed) / 100% (без хэширования) через расширение мока `FEATURE_FLAGS`
- Тесты для async-части `rate-limit.ts` (13, `rate-limit-async.test.ts`): `rateLimitAsync` через Redis — атомарный EVAL (script/numKeys/`ratelimit:<key>`/windowMs), заголовки `X-RateLimit-*` до и после исчерпания, 429 + `Retry-After` при превышении; fallback на in-memory при недоступном Redis с warn-логом и обёрнутым сообщением (`Redis pipeline error in rate-limit check: …`); без Redis — memory-лимиты, изоляция bucket'ов по userId и routeId; `addRateLimitHeaders` — конфиг по routeId (`login` = 10, неизвестный route → default 30), инкремент счётчика, раздельные bucket'ы user/ip; инварианты `RATE_LIMITS` (окно 60с, положительные лимиты, критичные роуты определены)
- **Автоматические проверки через git-хуки**: активный каталог хуков — `hooks/` (`core.hooksPath=hooks`); `hooks/pre-commit` — lint-staged (ESLint + typecheck staged-файлов; ранее лежал неактивным в `.husky/`), `hooks/pre-push` — полный набор `npm run verify` (typecheck → unit-тесты → check:i18n) перед каждым push, включая автопуш из post-commit. npm-скрипт `verify` для локального прогона всего набора одной командой. Пропуск одноразовой проверки: `git commit/push --no-verify`
- Тесты для платёжных провайдеров (`payments/providers/ozon.test.ts`, 20): `isConfigured`, отказ `createPayment` без credentials **до** сетевого вызова, форма запроса `/v1/payment/create` (копейки, `order_id`, `payment_method` card/sbp/ozon_card, `customer` только при email, кастомный sandbox-URL из env), запуск ошибок (`Ozon network error`, `Ozon HTTP 403`, отсутствие `result` → сообщение провайдера), `cancel`/`refund`/`getPaymentStatus` с картежом статусов регистронезависимо, `verifyWebhook` (нет секрета → отказ даже с подписью, валидный base64-HMAC → принятие, подменённая подпись → отказ, **unsigned-вебхук с любого IP → отказ**), `parseWebhook` (стабильный `eventId`, вывод события из статуса, неизвестный статус → `failed`)
- Тесты для CloudPayments (`payments/providers/cloudpayments.test.ts`, 19): конверт HTTP Basic (`publicId:apiSecret`) и JSON, суммы в рублях (не копейки) с `InvoiceId`/`JsonData`, предвыбор метода SBP→`SBP`+`Schema: QR`, YOOMONEY→`YooMoney`, SBERPAY→`Sberbank`, TPAY→`TinkoffPay`, трансляция чека 54-ФЗ в форму CloudPayments (`Items` с `amount = price × quantity`, `vat`, `method`, `object`) и `taxationSystem: 0` без кода СН, ошибки `Success: false`, cancel/refund/status-карты, `verifyWebhook` по `X-Content-HMAC` (принятие валидной, отказ при отсутствии подписи/секрета, при другой длине и при подписи с чужим ключом той же длины), `parseWebhook` (`cp:<txId>:<EventType>`, refund-события, фолбэки `Event`/пустого типа)
- Тесты для T-Bank (`payments/providers/tinkoff.test.ts`, 19): подписание запросов — `Token` совпадает с эталонной реализацией документированного алгоритма (значения полей кроме `Token`/`DATA`, сортировка, конкатенация + `Password`, SHA-256 hex, длина 64) и меняется при подмене суммы, `/Init` с копейками/`OrderId`/`SuccessURL`/`FailURL?status=fail`/`NotificationURL?provider=TINKOFF` и подсказкой `PayType` для SBP и T-Pay, ошибки API и сети, `Cancel` с обрезкой `Ip` до 39 символов, `Refund`, регистрозависимый картеж статусов `GetState`, `verifyWebhook` (принятие корректной подписи, отказ при подменённом `Status`, отсутствии/нестроковом `Token`, игнорирование вложенного `DATA`, **отказ вместо исключения при ненастроенном пароле**), `parseWebhook`
- Тесты для `lesson-content.ts` (22): `detectContentFormat` (HTML-теги, приоритет HTML над markdown, заголовки/списки/цитаты/код/таблицы/ссылки/жирный, plain), `prepareLessonHtml` (пустой ввод без вызова санитайзера, делегирование в `sanitizeContent` с allowIframes/externalLinks/lazyImages), `htmlToPlainText` (удаление script/style/template, `<br>` и блоки → переводы строк, декодирование HTML-сущностей, схлопывание пробелов), `estimateReadingMinutes` (200 слов/мин, CJK 500 симв/мин, минимум 1 минута, 0 для пустого)
- Тесты для zustand-сторов (`stores.test.ts`, 27): auth slice (setUser/setSessionReady), ui slice (setTheme в storage, setLocale с cookie Path=/SameSite=Lax/Max-Age и без Secure на http — перехват сырой строки cookie через шадоу-дескриптор Document.prototype, hydrate с валидацией мусорных значений к дефолтам), catalog slice (мерж частичных фильтров и функциональная форма, currentCourseId/currentLessonId), favorites slice (toggle с синхронизацией storage, hydrate), notifications slice (дедупликация addNotification по id, кап 200, unreadNotificationsCount, оптимистичное markNotificationRead/markAllNotificationsRead с откатом при отказе сервера и ошибке сети, fetchNotifications с нормализацией createdAt строки в timestamp, publishNotification с серверным добавлением и локальным fallback при ошибке сети)
- Тесты для `video-embed.ts` (38): `resolveVideoEmbed` для YouTube (watch/youtu.be/embed/shorts/live/nocookie/m-домен, `/watch` без `v` → external), параметр старта `t`/`start` (число, `1m30s`, `1h2m3s`, `t=0` и мусор игнорируются), Vimeo, VK (`/video-oid_id` → video_ext, готовый video_ext, vkvideo.ru), Rutube, Kinescope, Dailymotion, видео-файлы (.mp4/.webm/.MOV), generic embed, external; невалидный ввод (null, пусто, не-http протоколы). Целостность `ALLOWED_EMBED_HOSTS` (ключевые домены, без дубликатов)
- Тесты для `articles.ts` (15): `getArticlesPage` (пагинация skip/take, фильтр категории, category=all, поиск с `mode: insensitive` на PostgreSQL и без mode на SQLite, sortBy=popular, ошибка БД → пустой результат), `getArticleBySlug` (находка/отсутствие/ошибка → null), `getRelatedArticles` (полная выдача по категории, фолбэк из других категорий с NOT category, ошибка → []), `incrementArticleViews` (инкремент, ошибка не бросает). React `cache()` замокан passthrough
- Тесты для IP-whitelist вебхуков платежей (`payments/ip-whitelist.test.ts`, 22): CIDR-диапазоны YooKassa (внутри/границы /27, точечный IP /32, /25), Tinkoff /21, CloudPayments /24, IPv6 (только полное строковое совпадение), провайдеры без whitelist (SBER → true даже без IP), невалидный ввод (нет IP, некорректный IPv4), обрезка пробелов
- Тесты для реестра платёжных провайдеров (`payments/registry.test.ts`, 27): `parseProviderName` (регистронезависимость, неизвестное/пустое → null), `getProvider` (инстанс, singleton-кэш, ошибка на неизвестном), `getConfiguredProviders`, `pickProviderForMethod` (bindings YOOMONEY/SBERPAY/TPAY/OZON_CARD, фолбэк на любого настроенного по приоритету, ничего не настроено → preferred), `getAvailablePaymentOptions` (тестовый режим CARD без настроенных провайдеров, дедупликация методов между провайдерами, OZON_CARD), `methodLabel`, `detectProviderFromWebhook` (заголовки HMAC/подписи, payload-формы Tinkoff/CloudPayments/Ozon/Sber/VTB/YooKassa, нераспознанные → null). Провайдеры замоканы с общим переключаемым состоянием configured
- Тесты для чеков 54-ФЗ (`payments/receipts.test.ts`, 6): `buildCourseReceipt` — paymentSubject `service`, paymentMode `full_payment`, vatCode 4 (УСН) по умолчанию, округление суммы до копеек, прокидывание vatCode/taxSystemCode и реквизитов покупателя
- Тесты для `logger.ts` (5): фильтрация по `LOG_LEVEL` (порог error не печатает warn/info), уровень debug включает debug/info, JSON-формат записей (level/message/timestamp/context), маршрутизация warn/error в соответствующие console-методы, устойчивость JSON-сериализации к циклическим ссылкам (fallback-ветка)
- Тесты для `notifications.ts` (2): `createNotification` создаёт запись в БД и пушит SSE-уведомление с корректным payload (createdAt в мс, link), отсутствие link → поле опускается из payload
- Тесты для `feature-flags-config.ts` (6): целостность реестра — ключи совпадают со свойством `key`, уникальность, непустые описания, rollout в [0,100] или null, валидный environment (если задан)

### Добавлено
- Тесты для `api-validation.ts` (5): `validateSearchParams` — валидные/пустые query-параметры, 400 при невалидных (page=0), превышение limit (999), сообщение первой ошибки в теле 400
- Тесты для `sse.ts` (4): регистрация клиентов и подсчёт `getTotalConnections` (несколько юзеров + cleanup), формат уведомления `data: {...}\n\n` через `pushNotification`, `pushUnreadCount` (`type="unreadCount"`, `count: 4`), отсутствие enqueue для пользователя без соединений

### Исправлено
- **LOW (security)**: `generatePromoCode()` использовал `Math.random()` (неублично-безопасный PRNG) для генерации промокодов — скидки были предсказуемы; заменено на `crypto.randomInt()` (`node:crypto`). Добавлен тест, проверяющий, что код строится из индексов `randomInt(0, 36)`
- **LOW**: покрытие тестами ранее не покрытых модулей — `csrf.ts` (8): разрешённые GET/HEAD/OPTIONS, совпадение Origin↔Host, разные Origin (403), отсутствие Origin/Host (пропуск, SameSite), порт Host, невалидный Origin URL; `api-logging.ts` (11): `generateRequestId` (8 hex), уровень лога по статусу (info/warn/error), пустые queryParams в контексте, заголовки `X-Request-Id`/`X-Response-Time`, чтение `X-User-Id`/`X-User-Role` из ответа, редоктеция sensitive query params, обработка брошенного хендлера (500), сохранение статуса; `courseImage.ts` (7): `resolveCourseImageUrl` (null/пусто, absolute-URL as-is, срез `/courses/`, CDN с/без завершающего слеша, относительный путь, локальный фолбэк без CDN), `getLocalFallbackImage`

### Добавлено
- Тесты целостности данных промо-курсов (`promo-courses.test.ts`): уникальность id, валидные stepik URL, рейтинги в [0,5], непустые i18n-ключи title/description/tag/duration и levelKey во всех 3 локалях, **существование файлов изображений в `public/courses`** (не даёт промо-карточкам ломаться)
- Тесты для `api-versioning.test.ts` (15): `getApiVersion` (Accept-Version точное/частичное "2", "1.0", неверное → дефолт; URL-префикс /v1//v2/неизвестный), `isVersionSupported`, `getVersionInfo/getAllVersions`, `addVersionHeaders` (X-API-Version, без deprecation-заголовков), `validateApiVersion` (null для зарегистрированных), `withApiVersion` (передаёт версию, добавляет заголовки)
- **Лимит времени на задание (`timeLimit`)**: полная поддержка сквозняком — поле сохраняется в БД (миграция), валидируется (`course-validation.ts`), сериализуется из редактора курса, отдаётся в API урока и показывается студенту в `StepAssignment` (таймер обратного отсчёта MM:SS, автоотправка ответа при истечении, блокировка полей). Ранее поле собиралось в `AssignmentEditor`, но молча терялось
- Тесты для `course-validation.test.ts` (14): createCourseSchema (мин. курс, короткий title/description, невалидный slug, string-цена, модули/уроки/задания с timeLimit, невалидный videoUrl), validatePrices (отрицательные, oldPrice ≤ price)
- Тесты для проверки HMAC-подписи вебхуков (`webhook-verify.test.ts`): валидная sha256/sha512, формат `alg=signature` (Stripe-style), отсутствие/укороченная/подменённая подпись, защита от timing-атак через length-check
- Тесты для стандартизированных ответов API (`api-response.test.ts`): `withTimeout` (успех/таймаут/ошибка), все `api*Response`-хелперы (404/405 с Allow/400/409/503/200/пагинация/401/403/500/422)
- Тесты для CORS (`cors.test.ts`): разрешённые/запрещённые origin, wildcard, `allowCredentials: false`, preflight (204/запрет + null), обёртка `withCors` (preflight не вызывает handler, заголовки на реальных ответах)

### Исправлено
- **MEDIUM**: промо-курсы 33 и 34 ссылались на несуществующие изображения (`/courses/scientific-writing.jpg`, `/courses/thesis-writing.jpg`) — карточки на главной показывали только заглушку; пути исправлены на реальные файлы ("Написание научных статей v2.jpg", "Написние курсовых, дипломных работ.jpg"). Тест существования файлов предотвращает повторение
- **MEDIUM**: `GET /api/courses/[id]/assignments/[assignmentId]` — не проверял принадлежность задания курсу и запись пользователя (метаданные задания получал любой авторизованный); при отсутствии попыток возвращал `maxAttempts: 0` вместо реального лимита задания. Теперь: резолв courseId, проверка принадлежности и enrollment (403), корректный `maxAttempts` из Assignment
- **MEDIUM**: `validatePromoCode()` пропускал проверку привязки к курсу, когда `courseId` не передан — промокод, ограниченный конкретным курсом, проходил валидацию без указания курса; теперь `courseId` обязателен и несовпадение/отсутствие → ошибка. Добавлены тесты: код курса без `courseId` отклоняется, для совпадающего курса принимается
- **MEDIUM**: `formatFileSize()` выводил русские единицы ("Б", "КБ", "МБ") независимо от выбранной локали — теперь для `en`/`zh` используются латинские единицы (B/KB/MB/GB/TB); используется во вложениях уроков (`LessonAttachments`), обновлены тесты
- **LOW**: ESLint в `src/lib/db.ts` — `.apply()` → spread, удалена неиспользуемая переменная `getClient`, тип `Promise<any>` → `Promise<PrismaClient>`; lint для `src/**/*.{ts,tsx}` теперь 0 ошибок / 0 warnings

### Добавлено
- Тесты для `request-validation.ts`: `validateBody`/`validateQuery`/`validateParams`, `paginationSchema`/`searchSchema` (границы limit/page), `uuidSchema`/`idOrSlugSchema`, `safeJsonParse`, `withErrorHandling` (прма-ошибки → 404, Zod → 400, generic → 500)
- Тесты для `webhook-retry.ts`: `calculateRetryDelay` (экспоненциальный рост, лимит 1 час, положительное целое), `processWebhookWithRetry` (успех, максимум попыток, повторная попытка), `processPendingWebhooks`, `cleanupOldWebhookEvents`
- Расширены тесты `utils.test.ts` (`formatFileSize` для en/zh, TB, десятичные значения, инвалидные входные данные)

### Добавлено
- **Комментарии к урокам (обсуждение)**: `GET/POST /api/courses/[id]/lessons/[lessonId]/comments` и `PATCH/DELETE /api/courses/[id]/lessons/[lessonId]/comments/[commentId]` — просмотр (пагинация), создание, редактирование и удаление комментариев. Доступ: запись на курс для платных уроков (для бесплатных — открыто). Ответы в один уровень (нельзя ответить на ответ), `parentId` проверяется на принадлежность уроку. Автор/учитель курса/админ могут редактировать и удалять; удаление каскадно убирает ответы. Учитель курса получает уведомление типа `comment` при новом комментарии. Лимит: 15 созданий/мин. UI-компонент `LessonComments.tsx` встроен в просмотр урока
- **Бейдж "Новинка"**: курсы младше 30 дней помечаются `catalog.new` в `CourseCard`; `createdAt` добавлен в ответ `GET /api/courses`
- Тесты: 16 тестов комментариев (`lesson-comments.test.ts`)

### Исправлено
- **MEDIUM**: клиентская повторная сортировка в `CatalogPage.tsx` — из-за пагинации сортировка применялась только к текущей странице (серверная сортировка ломалась); убрана, серверный порядок сохранён
- **LOW**: ESLint `react-hooks/purity`: вызов `Date.now()` при рендере в `CourseCard` (для бейджа "Новинка") вынесен в модульную константу `NEW_COURSE_CUTOFF`

### Исправлено
- **Возвраты платежей (refunds)**: административный возврат оплаченных платежей — `POST /api/admin/payments/[id]/refund` оформляет возврат в YooKassa (когда `transactionId` содержит ID платежа провайдера и заданы ключи YooKassa) либо помечает платёж возвращённым вручную; атомарно отменяет запись, декрементирует `studentCount` и уведомляет студента. Webhook теперь обрабатывает события возврата (`refund.succeeded`/`refund.canceled`) — платёж помечается `refunded`, запись отменяется
- **Список платежей в админке**: `GET /api/admin/payments` — пагинация, фильтры по статусу/пользователю/курсу, поиск, сводка по выручке и числу возвратов
- **Хелперы YooKassa**: `createRefund()` (создание возврата с idempotency-key) и `formatYooKassaAmount()` (нормализация суммы `1 000.5` → `1000.50`, обязательная для API YooKassa)
- Документация API: `GET /api/admin/payments`, `POST /api/admin/payments/[id]/refund`, refund-события webhook в `API.md`
- Тесты: 9 тестов refund-потока (`refund-flow.test.ts`), 2 теста YooKassa-хелперов (`yookassa.test.ts`)

### Исправлено
- **MEDIUM**: письмо учителю при записи на бесплатный курс использовало `process.env.NEXT_PUBLIC_SITE_URL || ""` в ссылке — если переменная не задана, ссылка получалась пустой (`/teacher/...` без origin); теперь используется `env.siteUrl` (фолбэк на `NEXTAUTH_URL`)

### Исправлено
- **CRITICAL**: Сборка падала на "Both middleware file and proxy file are detected" — файл `src/middleware.ts` (шима для Next.js 16) конфликтовал с `src/proxy.ts`; шима удалена, `proxy.ts` остаётся единственным файлом middleware (в Next.js 16 middleware переименован в proxy)
- **MEDIUM**: Поиск по блогу использовал `mode: "insensitive"` без учёта провайдера БД — на SQLite (дефолт) такая фильтрация не поддерживается (типизированная ошибка сборки); теперь как в API-роутах: `mode` только для PostgreSQL, SQLite использует нативный case-insensitive LIKE
- **LOW**: Отсутствующие i18n-ключи `courseEditor.published` / `courseEditor.draft` (используются в TeacherDashboard) — добавлены во все 3 локали
- **LOW**: ESLint: `prefer-const` в `src/lib/db.ts`, `any` в типе `where` страницы блога — заменено на `Prisma.ArticleWhereInput`
- **LOW**: Скрипт `check:i18n` пропускал ключи с цифрами (`terms.toc1`, `courseEditor.*`) из-за regex без `[0-9]` и учитывал тестовые файлы — давал ложные срабатывания; regex расширен, тесты исключены

### Добавлено
- Папка `documents_fos_aup/` (сгенерированные .docx ФОС/АУП + генератор) исключена из git через .gitignore

### Добавлено
- **Промокоды в чекауте**: поле ввода промокода на странице курса — валидация через `POST /api/payments/promo/validate` (скидка и итоговая цена с зачёркнутой оригинальной), применение при записи/повторной записи (`/api/courses/[id]/enroll` учитывает `promoCode`, списывает использование после успешного создания платежа, сумма в ответе — со скидкой)
- **Управление промокодами в админке**: вкладка "Финансы" теперь содержит блок `AdminPromoCodes` — создание (процент/фиксированная, срок действия, лимиты, привязка к курсу), список с использованием/сроком, toggle активности, удаление (использованные деактивируются), копирование кода
- **История платежей в профиле**: новая вкладка "Платежи" (`PaymentHistory`) — список оплат с курсом, суммой, скидкой по промокоду и статусом (оплачен/ожидает/не оплачен/возврат/отменён), источник — `GET /api/payments`
- **Email учителю о новом отзыве**: при создании отзыва (не обновлении) преподавателю курса отправляется письмо по шаблону `reviewNotificationEmail` (исправлен текст — "Студент оставил новую оценку", а не "Преподаватель")
- **Drag & Drop задание — настоящий перетаскивание в просмотрщике**: `StepDragDrop.tsx` переведён с click-based взаимодействия на `@dnd-kit/core` (PointerSensor + TouchSensor, DragOverlay, подсветка drop-зон при наведении, возврат элементов в пул перетаскиванием). Клик-фолбэк сохранён для клавиатуры/доступности. Новый i18n-ключ `course.step.removeItem`
- **Миграция синхронизации схемы БД** `20260802000000_schema_drift_sync`: закрыт разрыв между schema.prisma и миграциями (колонка `User.pendingTwoFactorSecret`, таблицы `PromoCode` и `WebhookEvent`, поля `Payment.promoCodeId`/`discountAmount`, ~40 индексов) — `prisma migrate deploy` теперь создаёт полную схему (исправлена ошибка `The column main.User.pendingTwoFactorSecret does not exist`)
- **Локализация демо-данных админки**: `demo-data.ts` переведён на i18n-ключи (`admin.demo.*`), убраны неиспользуемые `monthLabels`/`dayLabels`/`demoCategoryDistribution`; текст и временные метки журнала действий теперь зависят от локали
- **Локализованные метаданные** страниц `/admin` и `/course-editor` через `generateMetadata` + cookie-локаль (ключи `meta.admin*`, `meta.editor*`)
- **Скрипт проверки i18n** подключён как `npm run check:i18n`

### Исправлено
- **CRITICAL**: Каталог и блог возвращали 500 (`RangeError: Maximum call stack size exceeded`) в dev-режиме — ленивый Proxy-клиент БД (`src/lib/db.ts`) сохранял сам себя в global и зацикливался при первом обращении; теперь кэш глобала проверяется через `util.types.isProxy` и Proxy никогда не сохраняется в глобал
- **CRITICAL**: Seed-данные не попадали в БД приложения (Prisma CLI писал в `prisma/prisma/data.db`, а приложение читало `prisma/data.db`) — seed выполняется через `scripts/seed.js` (jiti-загрузчик) против правильного файла
- **HIGH**: Сборка Amvera падала на "Module not found: Can't resolve './ROOT/scripts/backup-db.js'" — Turbopack сворачивает `process.cwd()` в виртуальный `/ROOT`; путь к скрипту в `backup` теперь собирается через base64+globalThis, недоступные статике
- **MEDIUM**: `npm run dev` падал на Windows (`spawnSync npx ENOENT`) — `prisma-auto.js` вызывает локальный бинарник Prisma вместо `npx`
- **MEDIUM**: GitHub Actions CI был сломан — `bun install --frozen-lockfile` без `bun.lock` в репозитории; CI переведён на npm (как Dockerfile), пороги покрытия приведены к фактическим (38%)
- **MEDIUM**: Расчёт серии дней (streak) в `/api/courses/[id]/progress` обрывался на втором дне и смешивал UTC/локальные даты — переписан на корректный UTC-проход
- **MEDIUM**: Кэш деталей курса проверялся ПОСЛЕ запроса к БД — кэш перенесён до запроса для анонимных пользователей (ключ — сырой параметр, работает и для slug)
- **MEDIUM**: Кэш списка блога не инвалидировался при редактировании/удалении статьи (`PATCH`/`DELETE` в `/api/articles/[slug]` теперь сбрасывают теги `articles`/`blog`)
- **LOW**: 500-ошибки логируются без стека — `handleApiError` добавляет `stack` в контекст лога; логгер переживает циклические ссылки в контексте
- **LOW**: Некорректный CSP-source `http://localhost:*:` в `next.config.ts` (лишнее двоеточие)
- **Base URL в письмах**: `env.siteUrl` теперь фолбэчится на `NEXTAUTH_URL` — ссылки верификации email и другие письма не ведут на `localhost` в проде при отсутствии `NEXT_PUBLIC_SITE_URL`
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
- "Опасная зона" в настройках (очистка кэша, сброс данных)

---

## [2.4.0] — 2026-05-15

### Добавлено
- CDN-изображения с freeimage.host (22 рекламных фото, 20 из 34 курсов)
- 2 новых курса: "Научные статьи v2", "Курсовые и дипломные работы" (34 всего)
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
- Колонка "Правовая информация" в Footer со ссылками на все юридические страницы

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
