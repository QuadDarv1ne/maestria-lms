# Политика миграций Prisma

Зафиксировано 2026-09-27.

## Решение

**Источник истины для продакшена — миграции Prisma.** Так устроен деплой:
`start.sh` выполняет `prisma migrate deploy` при старте контейнера, а `Dockerfile`
копирует каталог `prisma/` в рантайм-образ.

**Для остальных провайдеров (sqlite/mysql в разработке) миграции не применяются** —
используется `npm run db:push`. Это не компромисс, а следствие того, что история
миграций принадлежит конкретному движку: `migration_lock.toml` фиксирует `postgresql`,
и обе существующие миграции созданы для PostgreSQL.

Причина такого разделения — поддержка нескольких СУБД в проекте
(`scripts/db-setup.js`, `src/lib/db.ts` выбирают адаптер по провайдеру).

## Что было сломано (наблюдаемые факты)

Случай A — локальная разработка (sqlite URL + sqlite-схема):

```
$ node node_modules/prisma/build/index.js migrate status
Error: P3019
The datasource provider `sqlite` specified in your schema does not match the one
specified in the migration_lock.toml, `postgresql`.
exit 1
```

Случай B — контейнер (в образе схема собрана как sqlite, `DATABASE_URL` — PostgreSQL):

```
Datasource "db": SQLite database "maestria_lms" at "127.0.0.1:5432"
Error: P1001: Can't reach database server at `127.0.0.1:5432`
exit 1
```

Провайдер в образ попадает туда на этапе сборки: `Dockerfile` вызывает
`scripts/prisma-auto.js generate`, который переписывает `datasource.provider`
по `DATABASE_URL` окружения сборки, а при её отсутствии откатывается к `sqlite`.

`start.sh` трактует любую ошибку миграций как некритичную (`WARN` и старт сервера),
поэтому в продакшене миграции могли не применяться молча.

## Что сделано

1. `start.sh` вызывает Prisma через `scripts/prisma-auto.js` — провайдер
   определяется по **рантаймовому** `DATABASE_URL` перед `generate` и `migrate deploy`.
2. `Dockerfile` копирует `scripts/prisma-auto.js` и `scripts/lib/` в рантайм-образ.
3. `scripts/prisma-auto.js` отказывается выполнять `migrate dev|deploy|reset|status|resolve`,
   если провайдер не совпадает с `migration_lock.toml`, и печатает понятную подсказку
   вместо загадочной ошибки Prisma.
4. Если shim `node_modules/.bin/prisma` в образе отсутствует, обёртка запускает CLI
   через `node node_modules/prisma/build/index.js`.

Проверено локально: `node --check scripts/prisma-auto.js` — OK, `sh -n start.sh` — OK,
при sqlite-провайдере команда `migrate` завершается понятной ошибкой (exit 1), при
postgres-URL Prisma сообщает `Datasource "db": PostgreSQL database ...` (ранее — SQLite).

## Как добавлять миграции

```bash
# DATABASE_URL должен указывать на PostgreSQL
npm run db:migrate        # применить/создать миграцию (migrate dev)
npm run db:reset          # пересоздать БД по миграциям
```

Для sqlite/mysql разработки:

```bash
npm run db:push           # синхронизировать схему без истории миграций
```

## Если история миграций разошлась с реальной схемой прода

Опасное место: `start.sh` считает падение `migrate deploy` некритичным. Если база
уже содержит таблицы, но история миграций устарела, нужно не «применить заново», а
выровнять состояние:

```bash
# 1. Проверить расхождение
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script

# 2. Если расхождение пустое — отметить текущую миграцию применённой
npx prisma migrate resolve --applied <migration_name>

# 3. Если расхождение не пустое — оформить недостающую миграцию и применить её
```

Это операция над продакшен-данными: выполнять осознанно и с бэкапом.

## Почему в `schema.prisma` стоит sqlite (это случайность, а не решение)

Установлено по истории git:

- `f07c22d` (29.08.2026, «переключение на PostgreSQL») перевёл схему на `postgresql`
  и пересоздал baseline-миграцию `20260829155052_init` с `migration_lock.toml` = postgresql;
- `6d8186d` (04.09.2026, «add libsql adapter…») вернул `provider = "sqlite"` попутно,
  вне связи с задачей.

Разница файла между этими состояниями — только строка `provider`; моделей и полей
правки не касались. История миграций при этом **не разъехалась**: 21 модель = 21 таблица,
86 индексов = 86, единственное отличие — `Assignment.timeLimit`, которое добавляет
вторая миграция. Init-миграция — postgres-only (43× `TIMESTAMP(3)`,
29× `ALTER TABLE … ADD CONSTRAINT`), применить её к SQLite нельзя.

Выводы:

1. Целевой провайдер истории миграций — **PostgreSQL**.
2. Значение `provider` в `schema.prisma` перезаписывается скриптами при каждом
   `npm run dev` / `db:*`, поэтому источником истины оно не является.
3. `ARG/ENV DATABASE_PROVIDER=postgresql` из `Dockerfile` теперь действительно
   учитывается обёрткой (`scripts/prisma-auto.js`). Ранее читался только `.env`,
   поэтому образ мог запечься как SQLite.
4. `.dockerignore` обязан пропускать `scripts/prisma-auto.js` и `scripts/lib` —
   `Dockerfile` запускает обёртку на этапе сборки, и без этих файлов сборка падает.
