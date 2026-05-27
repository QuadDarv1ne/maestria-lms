# Руководство по развёртыванию Maestria LMS

## 🖥 Требования к серверу

| Компонент | Минимум | Рекомендуется |
|---|---|---|
| CPU | 1 vCPU | 2+ vCPU |
| RAM | 1 GB | 2+ GB |
| Диск | 10 GB | 20+ GB SSD |
| ОС | Ubuntu 20.04+ / Debian 11+ | Ubuntu 22.04 LTS |
| Node.js | 20.x | 20.x LTS |
| База данных | SQLite | PostgreSQL 16 + Redis 7 |

---

## 📋 Сравнительная таблица платформ

| Платформа | Сложность | Цена | Free tier | Лучше для |
|---|---|---|---|---|
| **Render** | Низкая | От $7/мес | Да (ограничен) | Быстрый деплой из GitHub |
| **Railway** | Низкая | Pay-as-you-go | $5 кредит | Прототипы и MVP |
| **Fly.io** | Средняя | Pay-as-you-go | Да (allowance) | Docker-контейнеры |
| **Vercel + Neon** | Низкая | Free | Да | Next.js оптимизация |
| **DigitalOcean** | Средняя | От $6/мес | Нет | Полный контроль |
| **Hetzner** | Средняя | От €3/мес | Нет | Бюджетный VPS |
| **VPS (свой)** | Высокая | Зависит | Нет | Продакшен, полный контроль |

---

## 🌐 1. Render

[Render](https://render.com) — облачная платформа с автоматическим деплоем из GitHub. Поддерживает Docker, PostgreSQL, Redis.

### Шаг 1: Подготовка репозитория

Убедитесь, что в репозитории есть `Dockerfile` и `docker-compose.yml`.

### Шаг 2: Создание Web Service

1. Зарегистрируйтесь на [render.com](https://render.com) через GitHub
2. Нажмите **New + → Web Service**
3. Выберите репозиторий `maestria-lms`
4. Настройки:
   - **Name:** `maestria-lms`
   - **Region:** Frankfurt (ближе к РФ)
   - **Branch:** `main`
   - **Root Directory:** (оставить пустым)
   - **Runtime:** `Docker`
   - **Instance Type:** Free или Standard ($7/мес)

### Шаг 3: Создание PostgreSQL базы

1. **New + → PostgreSQL**
2. **Name:** `maestria-db`
3. **Region:** тот же, что у Web Service
4. **Plan:** Free (90 дней) или Standard
5. Скопируйте **Internal Database URL**

### Шаг 4: Создание Redis

1. **New + → Redis**
2. **Name:** `maestria-redis`
3. **Region:** тот же
4. Скопируйте **Redis URL**

### Шаг 5: Настройка переменных окружения

В настройках Web Service → **Environment** добавьте:

```env
NODE_ENV=production
DATABASE_URL=<Internal Database URL из шага 3>
DATABASE_PROVIDER=postgresql
NEXTAUTH_URL=https://maestria-lms.onrender.com
NEXTAUTH_SECRET=<сгенерируйте: openssl rand -base64 32>
REDIS_URL=<Redis URL из шага 4>
RESEND_API_KEY=<ваш ключ, если используете email>
EMAIL_FROM=<email для отправки>
```

### Шаг 6: Деплой

Нажмите **Deploy**. Render автоматически:
- Соберёт Docker-образ
- Запустит PostgreSQL и Redis
- Подключит всё через внутренние URL

Первый деплой занимает ~5-10 минут.

---

## 🚂 2. Railway

[Railway](https://railway.app) — платформа с простым деплоем и встроенной БД. Даёт $5 бесплатного кредита.

### Шаг 1: Подключение GitHub

1. Зарегистрируйтесь на [railway.app](https://railway.app) через GitHub
2. Нажмите **New Project → Deploy from GitHub repo**
3. Выберите `maestria-lms`

### Шаг 2: Настройка сервиса

Railway автоматически распознает `Dockerfile`. Настройте:

```
Settings →
  Root Directory: (пусто)
  Dockerfile: Dockerfile
```

### Шаг 3: Добавление PostgreSQL

1. **New → Database → Add PostgreSQL**
2. Railway создаст базу и автоматически прокинет `DATABASE_URL`

### Шаг 4: Добавление Redis

1. **New → Database → Add Redis**
2. Railway создаст Redis и прокинет `REDIS_URL`

### Шаг 5: Переменные окружения

**Settings → Variables** добавьте:

```env
NODE_ENV=production
DATABASE_PROVIDER=postgresql
NEXTAUTH_URL=<ваш Railway URL>
NEXTAUTH_SECRET=<openssl rand -base64 32>
```

> Railway автоматически подставляет `DATABASE_URL` и `REDIS_URL` — не нужно указывать вручную.

### Шаг 6: Деплой

Все изменения push в `main` автоматически запускают новый деплой.

---

## 🪂 3. Fly.io

[Fly.io](https://fly.io) — платформа для запуска Docker-контейнеров ближе к пользователям. Есть бесплатный allowance.

### Шаг 1: Установка CLI

```bash
# macOS
brew install flyctl

# Windows (PowerShell)
iwr https://fly.io/install.ps1 -useb | iex

# Linux
curl -L https://fly.io/install.sh | sh
```

### Шаг 2: Авторизация

```bash
fly auth signup
# или
fly auth login
```

### Шаг 3: Инициализация приложения

```bash
cd maestria-lms
fly launch --name maestria-lms --region fra
```

Выберите:
- **Region:** `fra` (Frankfurt, Германия)
- **PostgreSQL:** Yes, кластер `maestria-db`
- **Redis:** Yes

### Шаг 4: Настройка переменных

```bash
fly secrets set \
  NODE_ENV=production \
  DATABASE_PROVIDER=postgresql \
  NEXTAUTH_URL=https://maestria-lms.fly.dev \
  NEXTAUTH_SECRET=$(openssl rand -base64 32)
```

> `DATABASE_URL` и `REDIS_URL` Fly.io подставит автоматически.

### Шаг 5: Деплой

```bash
fly deploy
```

### Шаг 6: Открыть приложение

```bash
fly apps open
```

---

## ▲ 4. Vercel + внешняя БД

[Vercel](https://vercel.com) — оптимальная платформа для Next.js. Бесплатный tier. Базу данных нужно подключить отдельно (Neon, Supabase).

### Шаг 1: Подготовка БД

#### Вариант A: Neon (PostgreSQL)

1. Зарегистрируйтесь на [neon.tech](https://neon.tech)
2. Создайте проект → скопируйте **Connection String**

#### Вариант B: Supabase (PostgreSQL + Redis)

1. Зарегистрируйтесь на [supabase.com](https://supabase.com)
2. Создайте проект → Settings → Database → Connection string
3. Для Redis используйте [Upstash](https://upstash.com) (бесплатный tier)

### Шаг 2: Подключение к Vercel

1. Зарегистрируйтесь на [vercel.com](https://vercel.com) через GitHub
2. **Add New → Project** → импортируйте `maestria-lms`
3. Vercel автоматически определит Next.js

### Шаг 3: Переменные окружения

В **Project Settings → Environment Variables** добавьте:

```env
DATABASE_URL=<Neon/Supabase connection string>
DATABASE_PROVIDER=postgresql
NEXTAUTH_URL=https://maestria-lms.vercel.app
NEXTAUTH_SECRET=<openssl rand -base64 32>
REDIS_URL=<Upstash Redis URL>
RESEND_API_KEY=<ключ, если используете Resend>
EMAIL_FROM=<email>
```

### Шаг 4: Настройка Prisma

Vercel не запускает `prisma generate` автоматически. Убедитесь, что в `package.json` есть:

```json
{
  "scripts": {
    "vercel-build": "npx prisma generate && next build"
  }
}
```

### Шаг 5: Деплой

Push в `main` автоматически запускает деплой. Или вручную:

```bash
npx vercel --prod
```

### ⚠️ Важно для Vercel

- Vercel — serverless, поэтому **не работает** с SQLite
- Файлы загрузок нужно хранить в S3 (укажите `S3_*` переменные)
- Serverless функции имеют лимит 10 секунд для API вызовов

---

## 🌊 5. DigitalOcean

### Вариант A: App Platform (PaaS)

1. Зайдите на [cloud.digitalocean.com](https://cloud.digitalocean.com)
2. **Apps → Create App → GitHub** → выберите репозиторий
3. App Platform автоматически распознает Docker
4. **Add a database → PostgreSQL**
5. Настройте переменные окружения (как в Render)
6. Деплой автоматически

**Цена:** от $5/мес для app + $7/мес для managed DB

### Вариант B: Droplet (VPS)

```bash
# 1. Создание Droplet через CLI
doctl compute droplet create maestria-lms \
  --size s-2vcpu-2gb \
  --image ubuntu-22-04-x64 \
  --region fra1 \
  --ssh-keys <your-ssh-key-fingerprint>

# 2. Подключение
ssh root@<droplet-ip>

# 3. Установка Docker
apt update && apt install -y docker.io docker-compose
systemctl enable --now docker

# 4. Клонирование и запуск
git clone https://github.com/Maestro7IT/Maestria.git /opt/maestria
cd /opt/maestria

# 5. Создание .env
cat > .env << 'EOF'
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=http://<droplet-ip>:3000
POSTGRES_PASSWORD=<сильный-пароль>
EOF

# 6. Запуск
docker compose up -d
```

---

## 🏠 6. Hetzner (бюджетный VPS)

[Hetzner](https://www.hetzner.com) — одни из самых дешёвых VPS в Европе. От €3.50/мес.

### Шаг 1: Заказ сервера

1. Зарегистрируйтесь на [hetzner.com](https://www.hetzner.com)
2. **Cloud → Create Server**
3. Выберите:
   - **Location:** Nürnberg / Falkenstein (Германия)
   - **Type:** CPX11 (2 vCPU, 2 GB RAM, ~€3.50/мес)
   - **OS:** Ubuntu 22.04

### Шаг 2: Подключение и настройка

```bash
ssh root@<server-ip>

# Установка Docker
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# Установка Docker Compose
apt install -y docker-compose
```

### Шаг 3: Деплой

```bash
git clone https://github.com/Maestro7IT/Maestria.git /opt/maestria
cd /opt/maestria

# .env файл
cat > .env << EOF
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=http://<server-ip>:3000
POSTGRES_PASSWORD=$(openssl rand -base64 32)
EOF

# Запуск
docker compose up -d

# Проверка
docker compose ps
curl http://localhost:3000/api/
```

### Шаг 4: Домен и HTTPS (опционально)

```bash
# Установка Nginx и Certbot
apt install -y nginx certbot python3-certbot-nginx

# Nginx конфиг
cat > /etc/nginx/sites-available/maestria << 'EOF'
server {
    listen 80;
    server_name lms.yourdomain.ru;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    client_max_body_size 50M;
}
EOF

ln -s /etc/nginx/sites-available/maestria /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# SSL сертификат
certbot --nginx -d lms.yourdomain.ru
```

---

## 🚀 7. VPS с нуля (универсальный мануал)

Для любого VPS (Ubuntu 22.04+) с Docker.

### Подготовка сервера

```bash
# Обновление
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

# Установка зависимостей
sudo apt install -y git curl nginx certbot python3-certbot-nginx
```

### Деплой через Docker Compose

```bash
# Клонирование
git clone https://github.com/Maestro7IT/Maestria.git /opt/maestria
cd /opt/maestria

# Настройка окружения
cat > .env << EOF
NEXTAUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=https://lms.yourdomain.ru
POSTGRES_PASSWORD=$(openssl rand -base64 32)
RESEND_API_KEY=
EMAIL_FROM=
REDIS_URL=redis://redis:6379
EOF

# Запуск
docker compose up -d

# Проверка
docker compose logs -f app
```

### Настройка Nginx Reverse Proxy

```nginx
upstream maestria {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name lms.yourdomain.ru;

    # SSL redirect (после установки сертификата)
    # return 301 https://$server_name$request_uri;

    # SSL настройки
    ssl_certificate /etc/letsencrypt/live/lms.yourdomain.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/lms.yourdomain.ru/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Reverse proxy
    location / {
        proxy_pass http://maestria;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Статика с кэшированием
    location /_next/static {
        proxy_pass http://maestria;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    # Загрузки
    client_max_body_size 50M;
}
```

```bash
# Установка SSL
sudo certbot --nginx -d lms.yourdomain.ru

# Автообновление сертификатов
sudo certbot renew --dry-run
```

---

## 🔌 8. Быстрое демо (ngrok / Cloudflare Tunnel)

Для временного доступа к локально запущенному проекту.

### ngrok

```bash
# 1. Запуск проекта локально
bun dev

# 2. Установка ngrok (если нет)
# https://ngrok.com/download

# 3. Проброс порта
ngrok http 3000

# 4. Скопируйте URL из вывода (например: https://xxxx.ngrok-free.app)
```

> **Free tier:** 1 туннель, случайный URL при каждом запуске.

### Cloudflare Tunnel (бесплатно, стабильный URL)

```bash
# 1. Установка cloudflared
brew install cloudflared        # macOS
winget install cloudflare.cloudflared  # Windows
# или: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/

# 2. Быстрый туннель (без регистрации)
cloudflared tunnel --url http://localhost:3000

# 3. С доменом (нужен Cloudflare аккаунт)
cloudflared tunnel login
cloudflared tunnel create maestria
cloudflared tunnel route dns maestria lms.yourdomain.com
cloudflared tunnel run maestria
```

> **Преимущество:** стабильный URL, бесплатный, нет ограничений как у ngrok.

### localtunnel (альтернатива)

```bash
npx localtunnel --port 3000
# Выведет URL вида: https://xxxxx.loca.lt
```

---

## 💾 Резервное копирование

### SQLite

```bash
cp /opt/maestria/prisma/prod.db /backup/prod-$(date +%Y%m%d).db

# Автоматический бэкап (cron)
echo "0 2 * * * cp /opt/maestria/prisma/prod.db /backup/prod-\$(date +\%Y\%m\%d).db" | crontab -
```

### PostgreSQL (Docker)

```bash
# Бэкап
docker exec maestria-postgres pg_dump -U maestria maestria_lms > backup-$(date +%Y%m%d).sql

# Восстановление
docker exec -i maestria-postgres psql -U maestria maestria_lms < backup-20250101.sql
```

### PostgreSQL (managed — Render, Railway, etc.)

Используйте встроенные инструменты платформы:
- **Render:** Dashboard → PostgreSQL → Backups → Download
- **Railway:** Dashboard → Database → Backups
- **Neon:** Branch-based бэкапы, PITR

---

## 🔄 CI/CD: Автоматический деплой

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /opt/maestria
            git pull origin main
            docker compose down
            docker compose up -d --build
            docker image prune -f
```

---

## 📊 Мониторинг и логи

### Docker

```bash
# Статус контейнеров
docker compose ps

# Логи приложения
docker compose logs -f app

# Логи базы данных
docker compose logs -f db

# Использование ресурсов
docker stats
```

### Health Check

```bash
curl -f http://localhost:3000/api/ || echo "Service down"
```

### PM2 (если без Docker)

```bash
pm2 monit          # Мониторинг в реальном времени
pm2 logs maestria  # Логи
pm2 status         # Статус
pm2 restart maestria
```

---

## 🔒 Безопасность

- Данные хранятся на серверах в **Российской Федерации** (при выборе EU регионов — в ЕС)
- SSL/TLS шифрование обязательно
- Пароли хешируются через bcrypt
- 2FA доступен для всех пользователей
- Валидация входных данных через Zod
- CSP-заголовки настроены
- Соответствие 152-ФЗ «О персональных данных»

### Чеклист перед продакшеном

- [ ] `NEXTAUTH_SECRET` — сгенерирован через `openssl rand -base64 32`
- [ ] `POSTGRES_PASSWORD` — сильный пароль (не дефолтный)
- [ ] HTTPS включен и сертификат автообновляется
- [ ] `NODE_ENV=production`
- [ ] Бэкапы базы данных настроены
- [ ] Логи мониторинга настроены
- [ ] S3 для хранения файлов (если используется)
- [ ] Rate limiting включен
- [ ] CORS настроен правильно
