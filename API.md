# API Documentation — Maestria LMS v3.1

Base URL: `http://localhost:3000/api`

All endpoints return JSON. Authentication uses NextAuth.js JWT sessions.

---

## 🔐 Authentication

### POST `/api/auth/register`

Register a new user. Automatically sends email verification.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "Иван Иванов"
}
```

**Response (201):**
```json
{
  "user": { "id": "clx...", "email": "user@example.com", "name": "Иван Иванов", "role": "student" },
  "message": "Регистрация успешна"
}
```

**Errors:** `400` validation, `409` email exists, `429` rate limited (3/min)

---

### POST `/api/auth/[...nextauth]`

NextAuth.js credentials provider — login with email/password + optional 2FA.

**Request:**
```json
{ "email": "user@example.com", "password": "...", "twoFactorCode": "123456" }
```

**Errors:** `401` invalid credentials, `401` 2FA required, `401` invalid 2FA code

---

### POST `/api/auth/2fa`

Enable/disable/verify two-factor authentication.

**Actions:** `setup`, `verify`, `enable`, `disable`

**Enable 2FA:**
```json
{ "action": "enable", "password": "currentPassword" }
```

**Verify 2FA:**
```json
{ "action": "verify", "code": "123456", "secret": "JBSWY3DPEHPK3PXP" }
```

---

### POST `/api/auth/forgot-password`

Request password reset email.

```json
{ "email": "user@example.com" }
```

### POST `/api/auth/forgot-password` (with token)

Reset password using token.

```json
{ "token": "reset-token-here", "password": "NewPassword123!" }
```

---

### GET `/api/auth/verify-email?token=...`

Verify email via token sent during registration.

**Redirect:** `/?email-verified=true` on success, `/?error=expired-token` on failure

---

### POST `/api/auth/send-verification`

Resend email verification link (requires authentication).

**Response:** `{ "message": "Verification email sent" }`

---

## 👤 User

### GET `/api/user`

Get current user profile (requires authentication).

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

### PATCH `/api/user`

Update current user profile.

**Request:**
```json
{ "name": "Новое имя", "bio": "...", "phone": "+7..." }
```

---

## 📚 Courses

### GET `/api/courses`

List published courses with filtering and pagination.

**Query Parameters:**
| Parameter | Type | Description |
|---|---|---|
| `category` | string | Filter by category slug |
| `search` | string | Search by title |
| `level` | string | Level (beginner/intermediate/advanced) |
| `sort` | string | Sort (popular/new/rating/priceAsc/priceDesc) |
| `free` | boolean | Free courses only |
| `page` | number | Page (default: 1) |
| `limit` | number | Per page (default: 12, max: 50) |

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

Get single course details with modules, lessons, and reviews.

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
      "sortOrder": 1,
      "lessons": [
        { "id": "clx...", "title": "Первая программа", "sortOrder": 1 }
      ]
    }
  ],
  "reviews": [...],
  "isEnrolled": false
}
```

### PATCH `/api/courses/[id]`

Update course (admin/teacher only).

---

### POST `/api/courses/[id]/enroll`

Enroll in a course (requires authentication). Free courses enroll immediately, paid courses create a payment.

**Request:**
```json
{ "paymentMethod": "sbp" }
```

**Response (free course):**
```json
{ "message": "Вы успешно записаны на бесплатный курс", "enrollment": { "id": "clx...", "status": "active" } }
```

**Response (paid course):**
```json
{ "message": "Для записи на платный курс необходимо оплатить", "requiresPayment": true, "paymentId": "...", "amount": 5000 }
```

---

### GET `/api/courses/[id]/reviews`

List course reviews.

### POST `/api/courses/[id]/reviews`

Add a review (requires enrollment, auth required).

**Request:**
```json
{ "rating": 5, "comment": "Отличный курс!" }
```

---

### GET `/api/courses/[id]/lessons/[lessonId]`

Get lesson content + user progress (requires enrollment for paid courses).

**Response:**
```json
{
  "lesson": { "id": "clx...", "title": "Первая программа", "content": "...", "type": "video" },
  "progress": { "completed": false, "score": null, "timeSpent": 0 },
  "assignment": { "type": "quiz", "questions": [...] }
}
```

---

### GET `/api/courses/[id]/assignments/[assignmentId]`

Get assignment details.

### POST `/api/courses/[id]/assignments/[assignmentId]`

Submit assignment answer.

**Request:**
```json
{ "answer": "{\"selected\": [1, 3]}", "score": 90 }
```

---

## 💰 Payments

### POST `/api/payments`

Create a payment for a course (requires authentication).

**Request:**
```json
{ "courseId": "clx...", "paymentMethod": "sbp" }
```

**Response:**
```json
{ "message": "Платёж создан", "payment": { "id": "...", "amount": 5000, "status": "pending", "paymentMethod": "sbp" } }
```

**Rate limit:** 10/min

### GET `/api/payments`

List user's payments with pagination.

**Query:** `page`, `limit`

### GET `/api/payments/[id]`

Get single payment details.

---

### POST `/api/payments/webhook`

Receive payment provider callbacks (SBP, YooKassa, Tinkoff). No authentication required — verified via webhook signature.

**Headers:**
| Header | Description |
|---|---|
| `x-payment-provider` | Provider name (sbp, yookassa, tinkoff) |
| `x-webhook-signature` | HMAC-SHA256 signature (optional, verified if PAYMENT_WEBHOOK_SECRET is set) |

**Request (YooKassa success):**
```json
{
  "event": "payment.succeeded",
  "status": "succeeded",
  "object": {
    "id": "pay_123",
    "transactionId": "txn_1234567890_uuid",
    "status": "succeeded",
    "amount": { "value": "5000.00", "currency": "RUB" }
  }
}
```

**On success:** Auto-completes payment, creates enrollment, increments course studentCount, sends notification to user.

**Response:** `{ "received": true, "status": "completed" }`

---

## 🔔 Notifications

### GET `/api/notifications`

List user notifications (requires authentication).

**Query:** `unread` (boolean), `page`, `limit`

### POST `/api/notifications/mark-all`

Mark all notifications as read.

### DELETE `/api/notifications/[id]`

Delete a notification.

### POST `/api/notifications/publish`

Create a system notification (admin only).

**Request:**
```json
{ "userId": "...", "type": "system", "title": "Обновление", "message": "..." }
```

### GET `/api/notifications/sse`

Server-Sent Events stream for real-time notifications.

---

## 🏆 Achievements

### GET `/api/achievements`

List user's achievements.

---

## 📜 Certificates

### GET `/api/certificates`

List user's certificates.

### POST `/api/certificates`

Generate certificate for a completed course.

**Request:** `{ "courseId": "..." }`

### GET `/api/certificates/[id]`

Get certificate details.

---

## 📝 Articles (Blog)

### GET `/api/articles`

List published articles.

**Query:** `page`, `limit`, `category`, `search`

### GET `/api/articles/[slug]`

Get single article by slug.

---

## 📤 Upload

### POST `/api/upload`

Upload a file to S3 storage.

**Body:** `FormData` with `file` field (max 100MB)

**Response:** `{ "url": "https://..." }`

---

## 🧑‍🏫 Teacher

### GET `/api/teacher/stats`

Get teacher dashboard statistics (requires teacher role).

---

## 🔧 Admin API

All admin endpoints require `admin` role.

### GET `/api/admin/users`

List all users with filtering and pagination.

**Query:** `page`, `limit`, `search`, `role`, `status`

### PATCH `/api/admin/users`

Update user role or status.

**Request:**
```json
{ "userId": "clx...", "role": "teacher" }
```
or
```json
{ "userId": "clx...", "isActive": false }
```

**Constraints:** Cannot change own role, cannot block self, cannot block another admin.

---

### GET `/api/admin/courses`

List all courses (including unpublished).

### POST `/api/admin/courses`

Create a new course.

**Request:**
```json
{
  "title": "Новый курс",
  "description": "Описание курса",
  "price": 1999,
  "categoryId": "clx...",
  "modules": [
    { "title": "Модуль 1", "lessons": [{ "title": "Урок 1", "content": "..." }] }
  ]
}
```

### PATCH `/api/admin/courses/[id]`

Update a course.

### DELETE `/api/admin/courses/[id]`

Delete a course.

---

### GET `/api/admin/courses/[id]/submissions`

List assignment submissions for a course.

### PATCH `/api/admin/courses/[id]/submissions/[submissionId]`

Grade a submission.

**Request:**
```json
{ "score": 95, "grade": "A", "feedback": "Отличная работа!" }
```

---

### GET `/api/admin/stats`

Get platform statistics (users, revenue, enrollments, etc).

### GET `/api/admin/student-stats/[id]`

Get detailed statistics for a specific student.

---

### GET `/api/admin/categories`

List course categories.

### POST `/api/admin/categories`

Create a category.

### PATCH `/api/admin/categories/[id]`

Update a category.

### DELETE `/api/admin/categories/[id]`

Delete a category.

---

### GET `/api/admin/settings`

Get system settings.

**Response:**
```json
{ "maintenanceMode": false, "registrationDisabled": false, "moderationEnabled": false, "emailNotificationsEnabled": false }
```

### PATCH `/api/admin/settings`

Update system settings.

**Request:** `{ "maintenanceMode": true }`

### POST `/api/admin/cache/clear`

Clear server cache (.next/cache).

---

## 🌱 Seeding

### POST `/api/seed`

Seed development data. Development only (`NODE_ENV !== "production"` and `ALLOW_SEED_DATA=true`).

**Response:**
```json
{ "message": "База данных заполнена", "courses": 34, "users": 5 }
```

---

## 🏥 Health

### GET `/api/`

API health check.

**Response:** `{ "status": "ok", "version": "3.1.0" }`

---

## 📊 Rate Limiting

| Endpoint | Limit | Window |
|---|---|---|
| Login | 5 | 1 min |
| Register | 3 | 1 min |
| Payments POST | 10 | 1 min |
| Enrollment | 5 | 1 min |
| General API | 60 | 1 min |

Responses include `X-RateLimit-Remaining` and `Retry-After` headers when rate limited.

---

## ❌ Error Codes

| Code | Description |
|---|---|
| 400 | Invalid request parameters (Zod validation) |
| 401 | Unauthorized |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 409 | Conflict (email exists, already enrolled) |
| 429 | Rate Limited |
| 500 | Internal Server Error |

**Error format:**
```json
{ "error": "Error message" }
```

---

## 🔑 Authentication

Authenticated endpoints require a valid NextAuth session cookie. For API testing:

```
Cookie: next-auth.session-token=YOUR_TOKEN
```
