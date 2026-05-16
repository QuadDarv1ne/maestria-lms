# API Documentation — Maestria LMS v3.1

Base URL: `http://localhost:3000/api`

---

## 🔐 Аутентификация

### POST `/api/auth/register`

Регистрация нового пользователя.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "name": "Иван Иванов"
}
```

**Response (201):**
```json
{
  "user": { "id": "clx...", "email": "user@example.com", "name": "Иван Иванов" },
  "message": "Пользователь зарегистрирован"
}
```

### POST `/api/auth/[...nextauth]`

NextAuth.js endpoints: signIn, signOut, getSession, getCsrfToken.

### POST `/api/auth/2fa`

Включение/проверка двухфакторной аутентификации.

**Enable 2FA:**
```json
{ "action": "enable", "password": "currentPassword" }
```

**Verify 2FA:**
```json
{ "action": "verify", "code": "123456", "secret": "JBSWY3DPEHPK3PXP" }
```

### POST `/api/auth/forgot-password`

Запрос на сброс пароля.

```json
{ "email": "user@example.com" }
```

### POST `/api/auth/forgot-password` (с токеном)

Сброс пароля по токену.

```json
{ "token": "reset-token-here", "password": "NewPassword123" }
```

---

## 📚 Курсы

### GET `/api/courses`

Получить список опубликованных курсов.

**Query Parameters:**
| Параметр | Тип | Описание |
|---|---|---|
| `category` | string | Фильтр по категории |
| `search` | string | Поиск по названию |
| `level` | string | Уровень (beginner/intermediate/advanced) |
| `sort` | string | Сортировка (popular/new/rating/priceAsc/priceDesc) |
| `free` | boolean | Только бесплатные |
| `page` | number | Страница (default: 1) |
| `limit` | number | Количество на странице (default: 12) |

**Response:**
```json
{
  "courses": [
    {
      "id": "clx...",
      "title": "Python для начинающих",
      "description": "...",
      "price": 0,
      "rating": 4.8,
      "isPublished": true,
      "category": { "name": "Программирование" },
      "teacher": { "name": "Дуплей М.И." },
      "_count": { "enrollments": 156, "reviews": 42, "modules": 8 }
    }
  ],
  "total": 34,
  "page": 1,
  "totalPages": 3
}
```

### GET `/api/courses/[id]`

Получить детальную информацию о курсе.

**Response:**
```json
{
  "id": "clx...",
  "title": "Python для начинающих",
  "description": "Полный курс...",
  "price": 0,
  "rating": 4.8,
  "modules": [
    {
      "id": "clx...",
      "title": "Введение в Python",
      "order": 1,
      "lessons": [
        { "id": "clx...", "title": "Первая программа", "order": 1 }
      ]
    }
  ],
  "reviews": [...],
  "isEnrolled": false
}
```

### POST `/api/courses/[id]/enroll`

Записаться на курс (требуется авторизация).

**Response:**
```json
{ "message": "Вы записаны на курс", "enrollmentId": "clx..." }
```

### GET `/api/courses/[id]/reviews`

Получить отзывы о курсе.

### POST `/api/courses/[id]/reviews`

Оставить отзыв (требуется авторизация, только для записанных студентов).

**Request:**
```json
{ "rating": 5, "comment": "Отличный курс!" }
```

### GET `/api/courses/[id]/lessons/[lessonId]`

Получить данные урока + прогресс пользователя.

**Response:**
```json
{
  "lesson": { "id": "clx...", "title": "Первая программа", "content": "..." },
  "progress": { "completed": false, "score": null, "timeSpent": 0 },
  "assignment": { "type": "quiz", "questions": [...] }
}
```

---

## 👤 Пользователь

### GET `/api/user`

Получить данные текущего пользователя (требуется авторизация).

**Response:**
```json
{
  "id": "clx...",
  "email": "user@example.com",
  "name": "Иван Иванов",
  "role": "student",
  "image": null,
  "enrollments": [...],
  "achievements": [...]
}
```

---

## 💰 Платежи

### POST `/api/payments`

Создать платёж (требуется авторизация).

**Request:**
```json
{ "courseId": "clx..." }
```

### GET `/api/payments/[id]`

Проверить статус платежа.

---

## 🏆 Достижения

### GET `/api/achievements`

Получить список достижений пользователя.

---

## 🔧 Админ API

Все админ-эндпоинты требуют роль `admin` или `teacher`.

### GET `/api/admin/courses`

Получить ВСЕ курсы (включая неопубликованные).

**Query Parameters:**
| Параметр | Тип | Описание |
|---|---|---|
| `search` | string | Поиск по названию |
| `page` | number | Страница |
| `limit` | number | Количество (default: 50) |

### POST `/api/admin/courses`

Создать новый курс.

**Request:**
```json
{
  "title": "Новый курс",
  "description": "Описание курса",
  "price": 1999,
  "categoryId": "clx...",
  "modules": [
    {
      "title": "Модуль 1",
      "lessons": [
        { "title": "Урок 1", "content": "Контент урока" }
      ]
    }
  ]
}
```

### GET `/api/admin/users`

Получить список всех пользователей.

**Query Parameters:**
| Параметр | Тип | Описание |
|---|---|---|
| `search` | string | Поиск по имени/email |
| `role` | string | Фильтр по роли |
| `page` | number | Страница |
| `limit` | number | Количество (default: 50) |

### PUT `/api/admin/users`

Обновить роль или статус пользователя.

**Request:**
```json
{ "userId": "clx...", "role": "teacher" }
```

или

```json
{ "userId": "clx...", "isActive": false }
```

**Ограничения:**
- Нельзя изменить свою собственную роль
- Нельзя заблокировать самого себя
- Нельзя заблокировать другого администратора

---

## 🌱 Сидирование

### POST `/api/seed`

Заполнить базу данных демо-данными. Вызывается автоматически при первом запуске.

**Response:**
```json
{ "message": "База данных заполнена", "courses": 34, "users": 5 }
```

---

## ❌ Коды ошибок

| Код | Описание |
|---|---|
| 400 | Неверные параметры запроса (валидация Zod) |
| 401 | Не авторизован |
| 403 | Нет прав доступа |
| 404 | Ресурс не найден |
| 409 | Конфликт (email занят, уже записаны) |
| 500 | Внутренняя ошибка сервера |

**Формат ошибки:**
```json
{ "error": "Описание ошибки" }
```
