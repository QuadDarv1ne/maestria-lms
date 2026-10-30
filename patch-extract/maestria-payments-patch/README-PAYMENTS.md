# Доработка системы оплаты Maestria LMS — мультипровайдерная интеграция

Патч добавляет поддержку **нескольких платёжных систем** в проект `maestria-lms`:

- ✅ **ЮKassa** — карты, СБП, ЮMoney, SberPay, T-Pay, Yandex Pay *(полностью реализован)*
- ✅ **Т-Банк (Tinkoff Kassa)** — карты, СБП, T-Pay *(полностью реализован, с подписью SHA-256)*
- ✅ **CloudPayments** — карты, СБП, ЮMoney, SberPay, T-Pay *(полностью реализован)*
- ✅ **Ozon Pay** — Ozon Card, карты, СБП *(реализован)*
- 🚧 **Сбербанк** — заглушка (допилить после получения доступов)
- 🚧 **ВТБ** — заглушка
- 🚧 **МКБ** — заглушка

Архитектура построена так, что **добавление нового провайдера = 1 файл** в `src/lib/payments/providers/` + регистрация в `registry.ts`. Никаких изменений в route-хендлерах.

---

## Что в архиве

```
maestria-payments-patch/
├── 0001-payments-multigateway.patch       ← git-патч (применяется через git apply / git am)
├── README-PAYMENTS.md                     ← этот файл
└── files/                                 ← готовые файлы (для ручного копирования)
    ├── .env.example                       (модифицирован)
    ├── prisma/
    │   ├── schema.prisma                  (модифицирован: Payment + PaymentWebhookEvent)
    │   └── migrations/20261030000000_payments_multigateway/migration.sql
    └── src/
        ├── app/
        │   ├── api/payments/
        │   │   ├── route.ts                              (модифицирован: новая POST-логика)
        │   │   ├── webhook/route.ts                      (модифицирован: мультипровайдерный webhook)
        │   │   └── [id]/init-provider/route.ts           (НОВЫЙ: универсальная инициализация)
        │   └── payment/[id]/PaymentPageClient.tsx        (модифицирован: QR для СБП, разные провайдеры)
        ├── components/payments/
        │   ├── CheckoutDialog.tsx                        (НОВЫЙ: модалка оформления заказа)
        │   └── PaymentMethodSelector.tsx                 (НОВЫЙ: выбор метода оплаты)
        └── lib/
            ├── env.ts                                    (модифицирован: добавлены env-геттеры)
            └── payments/                                 (НОВЫЙ модуль целиком)
                ├── types.ts                              (IPaymentProvider интерфейс)
                ├── registry.ts                           (реестр провайдеров)
                ├── service.ts                            (сервисный слой)
                ├── receipts.ts                           (54-ФЗ чеки)
                ├── ip-whitelist.ts                       (проверка IP провайдеров)
                └── providers/
                    ├── yookassa.ts                       (эталонная реализация)
                    ├── tinkoff.ts
                    ├── cloudpayments.ts
                    ├── ozon.ts
                    ├── sberbank.ts                       (заглушка)
                    ├── vtb.ts                            (заглушка)
                    └── mkb.ts                            (заглушка)
```

---

## 1. Как применить патч

### Вариант A — через `git apply` (рекомендуется)

Откройте терминал в корне вашего клона `maestria-lms`:

```bash
# Убедитесь, что вы на ветке main и рабочее дерево чистое
git checkout main
git status

# Примените патч (dry-run для проверки сначала)
git apply --check /path/to/0001-payments-multigateway.patch

# Если проверка прошла — применяйте
git apply /path/to/0001-payments-multigateway.patch

# Закоммитьте изменения
git add -A
git commit -m "feat(payments): multi-gateway support"
```

### Вариант B — через `git am` (создаст коммит автоматически)

```bash
git checkout main
git am /path/to/0001-payments-multigateway.patch
```

### Вариант C — ручное копирование файлов

Если `git apply` выдаёт конфликты (например, вы уже меняли эти файлы), просто скопируйте файлы из папки `files/` поверх вашего проекта, сохраняя структуру каталогов:

```bash
# Из корня проекта
cp -r /path/to/patch/files/. .
```

Затем вручную разрешите конфликты в модифицированных файлах (`.env.example`, `prisma/schema.prisma`, `src/lib/env.ts`, `src/app/api/payments/route.ts`, `src/app/api/payments/webhook/route.ts`, `src/app/payment/[id]/PaymentPageClient.tsx`).

### Вариант D — отдать патч Koda в VS Code

1. Откройте проект `maestria-lms` в VS Code
2. Откройте **Koda** (или любой AI-ассистент в VS Code)
3. Дайте ему промпт:
   > "У меня есть патч для мультипровайдерной системы оплаты. Примени его к проекту. Файл патча: `/path/to/0001-payments-multigateway.patch`. Сначала сделай `git apply --check` — если конфликты, разреши их вручную. После применения запусти `npx prisma generate` и `npx prisma migrate dev` для применения миграции. Проверь, что `npm run build` проходит без ошибок типов."
4. Koda прочитает патч, применит его, разрешит конфликты, прогенерирует Prisma-клиент и запустит билд.

---

## 2. Применение миграции базы данных

После применения патча нужно обновить схему БД. В проекте две команды:

```bash
# 1. Перегенерировать Prisma-клиент (чтобы появился тип PaymentWebhookEvent)
npx prisma generate

# 2. Применить миграцию (создаст таблицу PaymentWebhookEvent и индекс)
npx prisma migrate dev --name payments_multigateway
```

Если вы на проде (Amvera) и не хотите рисковать — сначала прогоните локально на SQLite, убедитесь что всё ок, потом пушьте в репозиторий. На Amvera `prisma migrate deploy` сработает автоматически при деплое (согласно `amvera.yml`).

**Если что-то сломалось:**

```bash
# Откатить миграцию (только SQLite / PostgreSQL с поддержкой down-миграций)
npx prisma migrate resolve --rolled-back 20261030000000_payments_multigateway

# Сбросить БД в чистое состояние (⚠ удалит все данные!)
npx prisma migrate reset
```

---

## 3. Регистрация в платёжных системах

> **Важно:** вам **не обязательно** подключать всех провайдеров сразу. Достаточно начать с **ЮKassa** — она одна покрывает карты, СБП, ЮMoney, SberPay, T-Pay и Yandex Pay. Остальные добавляйте по мере необходимости.

### 3.1. ЮKassa (рекомендуется начать с неё) 🥇

**Что даёт:** карты (Visa/Mastercard/МИР), СБП, ЮMoney, SberPay, T-Pay, Yandex Pay — всё из одного кабинета.

**Комиссия:** 2.8% с физических лиц, без абонплаты. Для самозанятых — 2.0%.

**Срок подключения:** 1-3 дня (после подачи документов).

**Шаги:**

1. Зарегистрируйтесь на https://yookassa.ru/
   - Юр. лицо — через личный кабинет ЮKassa + загрузка уставных документов
   - Самозанятый — упрощённая регистрация по ИНН
   - ИП —介于 между, нужен ИНН + ОГРНИП
2. Дождитесь активации магазина (придёт письмо на email)
3. В личном кабинете → **Настройки → API ключи**:
   - Скопируйте **shopId** (число, например `712304`)
   - Создайте **Секретный ключ** → скопируйте (он показывается один раз!)
4. В **Настройки → Webhook**:
   - URL: `https://ваш-домен.ru/api/payments/webhook`
   - Header: `x-payment-provider: YOOKASSA` (можно не указывать — патч умеет определять по телу)
   - События для подписки:
     - `payment.succeeded`
     - `payment.canceled`
     - `refund.succeeded`
5. (Опционально) **Включите онлайн-кассу** в кабинете → укажите систему налогообложения и ОФД. ЮKassa сама отправит чек в налоговую.

**Тестовые ключи:**

После регистрации вам сразу дадут **тестовый shopId** (начинается с `7######`) и **тестовый секретный ключ**. С ними можно прогнать весь флоу без реальных денег — карты для теста: https://yookassa.ru/developers/using-api/testing

### 3.2. Т-Банк (Tinkoff Kassa)

**Что даёт:** карты, СБП, T-Pay, рассрочка.

**Комиссия:** от 1.6% (зависит от оборота), без абонплаты.

**Срок:** 1-2 рабочих дня.

**Шаги:**

1. Подайте заявку на https://www.tbank.ru/business/internet-acquiring/
2. Подпишите договор (электронно через Т-Банк Бизнес)
3. В кабинете → **Настройки → Термины**:
   - Скопируйте **TerminalKey** (строка, например `1624567890ABCDEF`)
   - Скопируйте **Password** (32 символа)
4. **Настройки → Уведомления**:
   - URL: `https://ваш-домен.ru/api/payments/webhook?provider=TINKOFF`
   - Метод: POST
   - Email для ошибок: ваш email

### 3.3. CloudPayments (альтернатива ЮKassa)

**Что даёт:** карты, СБП, ЮMoney, SberPay, T-Pay, Apple/Google Pay.

**Комиссия:** 2.5–2.9%, есть абонплата от 5000 ₽/мес.

**Шаги:**

1. Регистрация: https://cloudpayments.ru/
2. Кабинет → **Сайт → Настройки → API**:
   - **PublicID** (начинается с `pk_`)
   - **API Secret** (32 символа)
3. **Настройки → Уведомления**:
   - URL: `https://ваш-домен.ru/api/payments/webhook?provider=CLOUDPAYMENTS`
   - Включить уведомления: `Pay`, `Refund`, `Confirm`, `Cancel`

### 3.4. Ozon Pay

**Что даёт:** Ozon Card (без комиссии для клиента), карты, СБП, рассрочка.

**Важно:** доступно только тем, у кого **уже есть магазин на Ozon Seller**.

**Шаги:**

1. Если ещё нет — зарегистрируйтесь на https://seller.ozon.ru/
2. Кабинет продавца → **Настройки → API ключи**:
   - **Client-Id** (число)
   - **Api-Key** (36 символов)
3. Включите продукт **Ozon Pay** в личном кабинете (отдельная заявка)
4. Настройте webhook URL через менеджера Ozon:
   - URL: `https://ваш-домен.ru/api/payments/webhook?provider=OZON`

### 3.5. Сбербанк, ВТБ, МКБ

**Когда подключать:** только если у вас уже есть там счёт по бизнес-причинам. ЮKassa/Т-Банк/CloudPayments объективно удобнее (один кабинет для всех методов).

**Сбербанк:**
1. Заявка: https://www.sberbank.ru/ru/s_m_business/pro/businessconnect/acquiring
2. После подписания договора — выдадут `userName` + `password` для REST API
3. В личном кабинете укажите Notification URL: `https://ваш-домен.ru/api/payments/webhook?provider=SBER`
4. ⚠ В коде (`src/lib/payments/providers/sberbank.ts`) — заглушка. Нужно дописать реальные вызовы к `register.do`, `getOrderStatusExtended.do` и `refund.do`. Документация доступна только после подключения.

**ВТБ:** https://www.vtb.ru/malyy-biznes/priem-platezhey/ekvayring/ — после договора получите `merchantId` + `secretKey`. Заглушка в `src/lib/payments/providers/vtb.ts`.

**МКБ:** https://mkb.ru/business/electronic-acquiring — аналогично. Заглушка в `src/lib/payments/providers/mkb.ts`.

---

## 4. Настройка переменных окружения

Скопируйте новые строки из `.env.example` в ваш `.env` (локально) и в настройки среды Amvera (для прода).

**Минимальный набор для старта (только ЮKassa):**

```bash
# Webhook secret (сгенерируйте один раз, используйте для всех провайдеров)
PAYMENT_WEBHOOK_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# ЮKassa
YOOKASSA_SHOP_ID=712345          # тестовый shopId начинается с 7
YOOKASSA_SECRET_KEY=test_XXXXXX  # тестовый ключ начинается с test_
```

**Расширенный набор (ЮKassa + Т-Банк + CloudPayments + Ozon):**

```bash
PAYMENT_WEBHOOK_SECRET=<random_hex_64>
# YooKassa
YOOKASSA_SHOP_ID=712345
YOOKASSA_SECRET_KEY=test_XXXXXX
# T-Bank
TINKOFF_TERMINAL_KEY=1624567890ABCDEF
TINKOFF_PASSWORD=password123
# CloudPayments
CLOUDPAYMENTS_PUBLIC_ID=pk_abc123
CLOUDPAYMENTS_API_SECRET=api_secret_xyz
# Ozon
OZON_CLIENT_ID=12345
OZON_API_KEY=abc-def-ghi
OZON_WEBHOOK_SECRET=whsec_xyz
```

**Для прода (Amvera):**

1. Зайдите в проект на https://app.amvera.ru
2. **Настройки → Переменные окружения**
3. Добавьте каждую переменную (значения — **продакшен** ключи, не тестовые!)
4. Переразверните проект

---

## 5. Проверка работы

### 5.1. Локально (тестовый режим)

1. Запустите проект: `npm run dev`
2. Откройте http://localhost:3000
3. Залогиньтесь как студент
4. Откройте любой платный курс
5. Нажмите кнопку **"Купить"** → должна открыться модалка `CheckoutDialog`
6. Выберите метод оплаты (если ключей нет — будет показан только один вариант "ЮKassa" в тестовом режиме)
7. Нажмите **"Оплатить"** → попадёте на страницу `/payment/[id]` с кнопкой **"Симулировать завершение"** (dev-режим)
8. Нажмите её → платёж перейдёт в `completed` → вы автоматически запишетесь на курс

### 5.2. С реальной ЮKassa (тестовые ключи)

1. Установите тестовые `YOOKASSA_SHOP_ID` и `YOOKASSA_SECRET_KEY`
2. Пройдите весь флоу → вас редиректнет на тестовую страницу ЮKassa
3. Используйте тестовую карту: `5555 5555 5555 4444`, срок **любой будущий**, CVC **любой**
4. После успешной оплаты ЮKassa пришлёт webhook → платеж обновится до `completed`
5. Вы получите письмо + увидите уведомление в LMS

### 5.3. Проверка webhook'а на проде

Если webhook не приходит (платёж висит в `pending`):

1. Проверьте, что URL в кабинете провайдера = `https://ваш-домен.ru/api/payments/webhook` (с `?provider=...` для Т-Банка/CloudPayments)
2. Проверьте логи на Amvera (или в консоли) — должен прийти POST
3. Проверьте, что в БД появилась запись в `PaymentWebhookEvent`:
   ```sql
   SELECT * FROM PaymentWebhookEvent ORDER BY processedAt DESC LIMIT 10;
   ```
4. Если записей нет — провайдер не доходит до вашего сервера (проверьте HTTPS, Cloudflare, файрвол)
5. Если записи есть, но `paymentId` = null — значит в теле webhook'а нет нашего `metadata.paymentId` (так бывает для Т-Банка, который использует `OrderId`). Патч умеет искать платёж по `transactionId` — должно работать.

---

## 6. Деплой на Amvera

1. **Закоммитьте изменения** в основную ветку:
   ```bash
   git push origin main
   ```
2. **Убедитесь, что `amvera.yml` включает шаг миграции** — если нет, добавьте:
   ```yaml
   # в amvera.yml, в секцию build:
   - npm install
   - npx prisma generate
   - npm run build
   
   # в секцию run (перед стартом):
   - npx prisma migrate deploy
   - npm start
   ```
3. **В настройках Amvera** добавьте все переменные окружения (см. раздел 4)
4. **Задеплойте** — Amvera автоматически соберёт новую версию и применит миграции
5. **После деплоя** зайдите в кабинеты ЮKassa/Т-Банка и обновите webhook URL на прод-домен

---

## 7. Как добавить нового провайдера (если появится новый банк)

1. Создайте файл `src/lib/payments/providers/newbank.ts`:
   ```typescript
   import type { IPaymentProvider, ... } from "../types";
   
   export class NewBankProvider implements IPaymentProvider {
     readonly name = "NEWBANK" as const;
     readonly label = "Новый Банк";
     readonly supportedMethods = ["CARD", "SBP"] as const;
     
     isConfigured() { return !!(env.newBankKey && env.newBankSecret); }
     
     async createPayment(input) { /* ... реальный вызов API ... */ }
     async cancelPayment(id, key) { /* ... */ }
     async refundPayment(input) { /* ... */ }
     async getPaymentStatus(id) { /* ... */ }
     
     verifyWebhook(ctx, body) { /* проверка подписи */ }
     parseWebhook(body, ctx) { /* маппинг полей на ParsedWebhook */ }
   }
   ```
2. Зарегистрируйте в `src/lib/payments/registry.ts`:
   ```typescript
   import { NewBankProvider } from "./providers/newbank";
   const factories = {
     // ...
     NEWBANK: () => new NewBankProvider(),
   };
   ```
3. Добавьте env-геттер в `src/lib/env.ts` и переменную в `.env.example`
4. Готово — UI автоматически покажет методы нового провайдера, как только вы установите env-переменные

---

## 8. 54-ФЗ (онлайн-касса) — что важно знать

По закону РФ (54-ФЗ) при приёме онлайн-платежей от физлиц вы **обязаны** формировать фискальный чек через ОФД (оператор фискальных данных).

**Хорошая новость:** ЮKassa, Т-Банк и CloudPayments **сами отправляют чек** в налоговую — нужно только передать им поле `receipt` при создании платежа. Патч это делает автоматически в `src/lib/payments/service.ts` (вызов `buildCourseReceipt`).

**Что нужно сделать в кабинете ЮKassa:**

1. Личный кабинет → **Настройки → Онлайн-касса**
2. Включите её
3. Укажите систему налогообложения (для УСН "доходы" — это код 2)
4. Укажите ОФД (можно оставить "По умолчанию")
5. Готово — чеки будут формироваться автоматически

**В коде** (файл `src/lib/payments/receipts.ts`):

- `vatCode: 4` — означает "без НДС" (для УСН). Если вы на ОСН с НДС 20% — поменяйте на `1`.
- `paymentSubject: "service"` — предмет расчёта "услуга" (онлайн-курс = услуга). Альтернатива: `"intellectual_activity"` если вы продаёте собственный контент как объект авторского права.
- `paymentMode: "full_payment"` — полная оплата.

Если вы используете ВТБ/МКБ напрямую (без фискального агента) — придётся **отдельно** подключить ОФД (АТОЛ, Эвотор, Первый ОФД). Это дополнительный договор и абонплата ~1500 ₽/мес.

---

## 9. Архитектура — что и как работает

```
Пользователь нажимает "Купить" на странице курса
        │
        ▼
   CheckoutDialog.tsx (модалка)
   ↓
   POST /api/payments
   body: { courseId, provider, method, promoCode }
        │
        ▼
   service.ts → createCoursePayment()
   1. Загружает курс, проверяет цену, валидирует промокод
   2. В транзакции создаёт запись Payment (status=pending)
   3. Вызывает provider.createPayment(input)
   4. Сохраняет providerPaymentId + confirmationUrl в paymentData
   5. Возвращает { confirmationUrl, qrCode }
        │
        ▼
   Если есть confirmationUrl → редирект на сайт провайдера (карты, кошельки)
   Если есть qrCode → /payment/[id] с QR для СБП
        │
        ▼
   Пользователь оплачивает на сайте провайдера / сканирует QR
        │
        ▼
   Провайдер шлёт POST /api/payments/webhook
   Header: x-payment-provider: YOOKASSA (или ?provider= в URL)
        │
        ▼
   webhook/route.ts:
   1. Определяет провайдера из header/URL
   2. provider.verifyWebhook(ctx, body) — проверка подписи + IP
   3. provider.parseWebhook(body) — нормализация события
   4. Идемпотентность #1: Redis (или in-memory) по eventId
   5. Идемпотентность #2: PaymentWebhookEvent (DB unique constraint)
   6. service.completePayment() в транзакции:
      - update Payment status=completed (через updateMany WHERE status=pending — race-safe)
      - upsert Enrollment (запись на курс)
      - increment Course.studentCount
   7. Отправка email + in-app уведомления
   8. Ответ 200 OK провайдеру
```

**Идемпотентность на всех уровнях:**
- `Idempotence-Key` header при создании платежа у провайдера (один ключ = один платёж)
- `PaymentWebhookEvent.eventId` unique constraint (повторный вебхук не создаст дубль)
- `Payment.updateMany WHERE status=pending` (race-safe обновление статуса)
- Redis + in-memory cache для быстрой фильтрации дублей

---

## 10. Частые вопросы

**Q: У меня уже есть записи в таблице Payment со старыми значениями `paymentMethod` (sbp/yookassa/tinkoff/card). Что с ними будет?**
A: Ничего — они продолжат работать. Патч обратно совместим: новые значения (`card`/`sbp`/`yoomoney`/...) сохраняются в нижнем регистре, а старые значения парсятся в `resolveProviderAndMethod` через `legacyMap`.

**Q: У меня в API.md описан старый формат. Нужно ли обновлять клиентов?**
A: Нет — старый формат `{ courseId, paymentMethod: "sbp" }` продолжает работать. Но если хотите использовать новые методы (`yoomoney`, `sberpay`, `tpay`, `yandex_pay`, `ozon_card`) — нужно передавать `{ courseId, provider, method }`.

**Q: Webhook не доходит на локалку. Как тестировать?**
A: Используйте `ngrok` или `cloudflared` чтобы получить публичный HTTPS-туннель к localhost:3000, и пропишите этот URL в кабинете провайдера. Или используйте `simulate-complete` для dev-тестирования без вебхуков.

**Q: А можно принимать оплату без ЮKassa, только напрямую через Т-Банк?**
A: Да, конечно. Просто не заполняйте `YOOKASSA_*` переменные — UI скроет методы, которые поддерживает только ЮKassa (ЮMoney, Yandex Pay). Остаются: карты, СБП, T-Pay.

**Q: Что если я хочу добавить кнопку "Оплатить через Mir Pay"?**
A: Mir Pay поддерживается ЮKassa как метод `card` (карты МИР) с доп. параметром. Добавьте новый метод `MIR_PAY` в `PaymentMethod` enum и обработку в `yookassa.ts`. ~20 строк кода.

**Q: Можно ли принимать оплату в иностранной валюте?**
A: По умолчанию нет — все провайдеры в РФ работают только в RUB. Для приёма иностранной валюты нужны зарубежные процессоры (Stripe, PayPal) — это отдельная интеграция.

**Q: Сколько занимает подключение?**
A: Если начинаете с ЮKassa:
- Регистрация: 1 день
- Получение тестовых ключей: сразу
- Получение продакшен-ключей: 1-3 дня
- Тестирование флоу: 2-4 часа
- **Итого: ~1 неделя до работающей системы.**

---

## 11. Если что-то сломалось

### Билд падает с ошибкой типов

```bash
npm run build 2>&1 | grep -A 5 "error TS"
```

Самые вероятные проблемы:
- `Property 'paymentWebhookEvent' does not exist on type 'PrismaClient'` → забыт `npx prisma generate`. Запустите.
- `Module not found: Can't resolve '@/lib/payments/service'` → проверьте, что файлы скопированы в правильное место (`src/lib/payments/`).

### Миграция падает

```bash
# Если SQLite и файл залочен:
rm -f prisma/data.db prisma/data.db-journal
npx prisma migrate dev --name payments_multigateway
```

⚠ Это удалит существующие данные! Перед этим сделайте бэкап:
```bash
cp prisma/data.db prisma/data.db.backup
```

### Webhook приходит, но платёж не обновляется

1. Посмотрите логи (на Amvera — `Логи → Runtime`)
2. Проверьте таблицу:
   ```sql
   SELECT * FROM PaymentWebhookEvent ORDER BY processedAt DESC LIMIT 10;
   ```
3. Если там есть запись с `paymentId = NULL` → провайдер не передал `metadata.paymentId`. Проверьте, что вы передаёте `metadata: { paymentId }` в `createPayment` (патч это делает).
4. Если `payload` в таблице есть, но `paymentId` не проставился → проверьте, что в `transactionId` таблицы `Payment` лежит `providerPaymentId` (это делается в сервисе после `createPayment`).

### Чек не формируется (54-ФЗ)

1. Проверьте, что в кабинете ЮKassa включена онлайн-касса
2. В `service.ts` → `buildCourseReceipt` вызывается только для `YOOKASSA`/`TINKOFF`/`CLOUDPAYMENTS`. Если вы используете `OZON`/`SBER` — нужно либо дописать формирование чека в их провайдерах, либо подключить отдельный ОФД.
3. В логах ЮKassa (кабинет → **Платежи → Детали платежа**) должно быть видно поле "Чек" со статусом "Отпарвлен в ОФД".

---

## 12. Контакты и поддержка

- ЮKassa поддержка: https://yookassa.ru/contacts (чат в кабинете)
- Т-Банк: https://www.tbank.ru/business/help/ (чат в кабинете)
- CloudPayments: https://cloudpayments.ru/contacts
- Ozon Seller: чат в кабинете продавца

По вопросам самого патча — открывайте issue в репозитории `QuadDarv1ne/maestria-lms`.

---

**Удачи с подключением! 🚀**
