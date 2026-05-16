# Руководство по развёртыванию Maestria LMS

## 🖥 Требования к серверу

| Компонент | Минимум | Рекомендуется |
|---|---|---|
| CPU | 1 vCPU | 2+ vCPU |
| RAM | 1 GB | 2+ GB |
| Диск | 10 GB | 20+ GB SSD |
| ОС | Ubuntu 20.04+ / Debian 11+ | Ubuntu 22.04 LTS |
| Node.js | 18.17+ | 20.x LTS |
| SQLite | Встроен | Встроен |

---

## 📦 Установка на продакшен-сервер

### 1. Подготовка сервера

```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Установка PM2 (менеджер процессов)
sudo npm install -g pm2
```

### 2. Деплой приложения

```bash
# Клонирование
git clone https://github.com/Maestro7IT/Maestria.git /var/www/maestria
cd /var/www/maestria

# Установка зависимостей
npm ci --production

# Сборка
npm run build

# Генерация Prisma клиента
npx prisma generate
```

### 3. Настройка переменных окружения

Создайте `.env` файл:

```env
# База данных
DATABASE_URL="file:./prod.db"

# NextAuth
NEXTAUTH_URL="https://maestria.ru"
NEXTAUTH_SECRET="your-secret-key-min-32-chars"

# SMTP (для email-уведомлений)
SMTP_HOST="smtp.mail.ru"
SMTP_PORT=465
SMTP_USER="noreply@maestria.ru"
SMTP_PASSWORD="smtp-password"

# Платёжная система
PAYMENT_PROVIDER_API_KEY="your-payment-key"
```

### 4. Запуск через PM2

```bash
# Создание ecosystem.config.js
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'maestria',
    script: 'node_modules/.bin/next',
    args: 'start',
    cwd: '/var/www/maestria',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
EOF

# Запуск
pm2 start ecosystem.config.js

# Автозапуск при перезагрузке
pm2 startup
pm2 save
```

### 5. Настройка Nginx (Reverse Proxy)

```nginx
server {
    listen 80;
    server_name maestria.ru www.maestria.ru;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name maestria.ru www.maestria.ru;

    ssl_certificate /etc/letsencrypt/live/maestria.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/maestria.ru/privkey.pem;

    # SSL настройки
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Безопасность
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # CSP для РФ
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://iili.io https://freeimage.host; font-src 'self';" always;

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

    # Кэширование статики
    location /_next/static {
        proxy_pass http://127.0.0.1:3000;
        expires 365d;
        add_header Cache-Control "public, immutable";
    }

    location /courses {
        proxy_pass http://127.0.0.1:3000;
        expires 30d;
        add_header Cache-Control "public";
    }

    # Загрузка файлов
    client_max_body_size 10M;
}
```

### 6. SSL-сертификат (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d maestria.ru -d www.maestria.ru
```

---

## 🐳 Docker (альтернативный вариант)

### Dockerfile

```dockerfile
FROM node:20-alpine AS base

# Зависимости
FROM base AS deps
WORKDIR /app
COPY package.json ./
RUN npm ci

# Сборка
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# Продакшен
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

### docker-compose.yml

```yaml
version: '3.8'
services:
  maestria:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=file:./prod.db
      - NEXTAUTH_URL=https://maestria.ru
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
    volumes:
      - ./data:/app/prisma
    restart: unless-stopped
```

```bash
docker-compose up -d
```

---

## 📊 Мониторинг

### Health Check

```bash
curl -f http://localhost:3000/api || echo "Service down"
```

### PM2 Мониторинг

```bash
pm2 monit          # Мониторинг в реальном времени
pm2 logs maestria  # Логи
pm2 status         # Статус
```

### Логи

```bash
# Логи приложения
pm2 logs maestria --lines 100

# Логи Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 🔄 Обновление

```bash
cd /var/www/maestria
git pull origin main
npm ci --production
npx prisma generate
npm run build
pm2 restart maestria
```

---

## 💾 Резервное копирование

```bash
# Бэкап SQLite базы
cp /var/www/maestria/prisma/prod.db /backup/prod-$(date +%Y%m%d).db

# Автоматический бэкап (cron)
echo "0 2 * * * cp /var/www/maestria/prisma/prod.db /backup/prod-\$(date +\%Y\%m\%d).db" | crontab -
```

---

## 🔒 Безопасность

- Данные хранятся на серверах в **Российской Федерации**
- SSL/TLS шифрование обязательно
- Пароли хешируются через bcrypt
- 2FA доступен для всех пользователей
- Валидация входных данных через Zod
- CSP-заголовки настроены
- Соответствие 152-ФЗ «О персональных данных»
