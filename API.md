# API Documentation — Maestria LMS v3.6

Base URL: `http://localhost:3000/api`

All endpoints return JSON. Authentication uses NextAuth.js JWT sessions.

---

## Table of Contents

- [Authentication](#-authentication)
- [User Profile](#-user-profile)
- [Courses](#-courses)
- [Payments](#-payments)
- [Notifications](#-notifications)
- [Achievements](#-achievements)
- [Certificates](#-certificates)
- [Articles (Blog)](#-articles-blog)
- [Upload](#-upload)
- [Teacher Dashboard](#-teacher-dashboard)
- [Admin API](#-admin-api)
- [Health & Metrics](#-health--metrics)
- [Seeding](#-seeding)
- [Rate Limiting](#-rate-limiting)
- [Error Codes](#-error-codes)
- [Caching](#-caching)
- [Security](#-security)

---

## 🔐 Authentication

### POST `/api/auth/register`

Register a new user. Automatically sends email verification.

**Rate limit:** 5 requests per minute

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "Иван Иванов"
}
```

**Password requirements:**
- Minimum 8 characters
- At least one uppercase letter (including Russian)
- At least one lowercase letter (including Russian)
- At least one digit

**Response (201):**
```json
{
  "user": { "id": "clx...", "email": "user@example.com", "name": "Иван Иванов", "role": "student" },
  "message": "Регистрация успешна"
}
```

**Errors:** `400` validation, `409` email exists, `429` rate limited

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

## 👤 User Profile

### GET `/api/user`

Get current user profile with enrollments, progress, and certificates (requires authentication).

**Rate limit:** 20 requests per minute

**Response:**
```json
{
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "name": "Иван Иванов",
    "role": "student",
    "image": null,
    "bio": null,
    "phone": null,
    "twoFactorEnabled": false,
    "isActive": true,
    "emailVerified": null,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "_count": { "enrollments": 3, "reviews": 2, "certificates": 1, "teacherCourses": 0 }
  },
  "enrollments": [
    {
      "id": "clx...",
      "status": "active",
      "progress": 45,
      "enrolledAt": "2024-01-15T00:00:00.000Z",
      "course": { "id": "clx...", "title": "Python для начинающих", "image": null, "level": "beginner" }
    }
  ],
  "enrollmentDetails": [
    {
      "id": "clx...",
      "status": "active",
      "progress": 45,
      "enrolledAt": "2024-01-15T00:00:00.000Z",
      "course": { "id": "clx...", "title": "Python для начинающих", "image": null, "level": "beginner" },
      "totalLessons": 20,
      "completedLessons": 9,
      "totalTimeSpent": 5400,
      "lastAccessed": "2024-02-01T00:00:00.000Z",
      "avgScore": 85
    }
  ],
  "certificates": [
    {
      "id": "clx...",
      "certificateNumber": "MAE-00001",
      "issuedAt": "2024-03-01T00:00:00.000Z",
      "course": { "id": "clx...", "title": "Python для начинающих" }
    }
  ]
}
```

### PUT `/api/user`

Update current user profile.

**Rate limit:** 20 requests per minute

**Request:**
```json
{ "name": "Новое имя", "bio": "О себе...", "phone": "+79150480249", "image": "https://..." }
```

**Validation:**
- `name`: 2-50 characters
- `bio`: max 500 characters
- `phone`: max 20 characters, digits/spaces/+-() only
- `image`: valid URL or empty string

---

## 📚 Courses

### GET `/api/courses`

List published courses with filtering, sorting, and pagination.

**Rate limit:** 30 requests per minute
**Cache:** 5 minutes (Redis/memory), tags: `courses`, `catalog`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `category` | string | — | Filter by category slug |
| `search` | string | — | Search by title, description, shortDesc |
| `level` | string | — | Level: `beginner`, `intermediate`, `advanced` |
| `freeOnly` | boolean | `false` | Show only free courses |
| `sortBy` | string | `new` | Sort: `popular`, `new`, `rating`, `priceAsc`, `priceDesc` |
| `page` | number | `1` | Page number |
| `limit` | number | `12` | Items per page (max: 100) |
| `ids` | string | — | Comma-separated course IDs for batch fetch (lightweight) |

**Response:**
```json
{
  "courses": [
    {
      "id": "clx...",
      "title": "Python для начинающих",
      "slug": "python-basics",
      "description": "Полный курс Python...",
      "shortDesc": "Краткое описание",
      "image": "https://...",
      "price": 0,
      "oldPrice": null,
      "currency": "RUB",
      "level": "beginner",
      "duration": "8 недель",
      "language": "ru",
      "isFeatured": true,
      "hasCertificate": true,
      "rating": 4.8,
      "reviewCount": 42,
      "studentCount": 156,
      "tags": "python,beginner",
      "teacher": { "id": "clx...", "name": "Дуплей М.И.", "image": null },
      "category": { "id": "clx...", "name": "Программирование", "slug": "programming", "icon": "🐍", "color": "#..." },
      "totalLessons": 48,
      "totalDuration": 360,
      "modulesCount": 8
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 12,
    "total": 34,
    "totalPages": 3
  }
}
```

---

### GET `/api/courses/[id]`

Get single course details with modules, lessons, reviews, and user progress.

**Rate limit:** 30 requests per minute
**Cache:** 5 minutes (anonymous users only), tags: `course`, `course:{id}`, `course:{slug}`

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Course ID or slug |

**Response:**
```json
{
  "course": {
    "id": "clx...",
    "title": "Python для начинающих",
    "slug": "python-basics",
    "description": "Полный курс...",
    "shortDesc": "Краткое описание",
    "image": "https://...",
    "price": 0,
    "oldPrice": null,
    "currency": "RUB",
    "level": "beginner",
    "duration": "8 недель",
    "language": "ru",
    "isPublished": true,
    "isFeatured": true,
    "hasCertificate": true,
    "rating": 4.8,
    "reviewCount": 42,
    "studentCount": 156,
    "tags": "python,beginner",
    "requirements": "[\"Базовые знания ПК\"]",
    "whatYouLearn": "[\"Писать код на Python\", \"Работать с данными\"]",
    "teacher": { "id": "clx...", "name": "Дуплей М.И.", "image": null, "bio": "..." },
    "category": { "id": "clx...", "name": "Программирование", "slug": "programming", "icon": "🐍", "color": "#..." },
    "modules": [
      {
        "id": "clx...",
        "title": "Введение в Python",
        "description": "Первый модуль",
        "sortOrder": 1,
        "lessons": [
          { "id": "clx...", "title": "Первая программа", "type": "video", "duration": 15, "sortOrder": 1, "isFree": true, "completed": false }
        ]
      }
    ],
    "reviews": [
      { "id": "clx...", "rating": 5, "comment": "Отличный курс!", "createdAt": "2024-01-15T00:00:00.000Z", "user": { "id": "clx...", "name": "Иван", "image": null } }
    ],
    "totalLessons": 48,
    "totalDuration": 360,
    "freeLessons": 5,
    "isEnrolled": false,
    "enrollmentStatus": null,
    "enrollmentProgress": 0
  }
}
```

**Access control:** Unpublished courses are only accessible by admin, teacher-owner, or enrolled students.

---

### POST `/api/courses/[id]/enroll`

Enroll in a course (requires authentication). Free courses enroll immediately, paid courses create a payment.

**Rate limit:** 10 requests per minute

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

List course reviews with pagination.

### POST `/api/courses/[id]/reviews`

Add a review (requires enrollment, auth required).

**Rate limit:** 10 requests per minute

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

**Rate limit:** 20 requests per minute

**Request:**
```json
{ "courseId": "clx...", "paymentMethod": "sbp" }
```

**Payment methods:** `sbp`, `yookassa`, `tinkoff`, `card`

**Response (201):**
```json
{
  "message": "Платёж создан",
  "payment": {
    "id": "clx...",
    "amount": 5000,
    "currency": "RUB",
    "status": "pending",
    "paymentMethod": "sbp",
    "paymentProvider": "СБП",
    "transactionId": "txn_1234567890_uuid",
    "createdAt": "2024-01-15T00:00:00.000Z"
  }
}
```

**Race condition protection:** Uses database transactions to prevent duplicate payments from concurrent requests.

---

### GET `/api/payments`

List user's payments with pagination.

**Rate limit:** 20 requests per minute

**Query:** `page` (default: 1), `limit` (default: 20, max: 50)

---

### GET `/api/payments/[id]`

Get single payment details.

---

### POST `/api/payments/webhook`

Receive payment provider callbacks (SBP, YooKassa, Tinkoff). No authentication required — verified via HMAC-SHA256 webhook signature.

**Rate limit:** 100 requests per minute

**Headers:**
| Header | Description |
|--------|-------------|
| `x-payment-provider` | Provider name (sbp, yookassa, tinkoff) |
| `x-webhook-signature` | HMAC-SHA256 signature (verified against `PAYMENT_WEBHOOK_SECRET`) |
| `x-signature` | Alternative signature header |

**Request (YooKassa success):**
```json
{
  "event": "payment.succeeded",
  "status": "succeeded",
  "object": {
    "id": "pay_123",
    "transactionId": "txn_1234567890_uuid",
    "status": "succeeded",
    "amount": { "value": "5000.00", "currency": "RUB" },
    "metadata": { "paymentId": "clx..." }
  }
}
```

**On success:** Auto-completes payment, creates enrollment, increments course studentCount, sends notification + email.

**Response:** `{ "received": true, "status": "completed" }`

**Refund events (YooKassa `refund.succeeded` / `refund.canceled`):**

When the `event`/`type` field starts with `refund.`, the webhook validates the 
payload and calls the refund handler. On a successful refund the payment is 
marked `refunded`, the active enrollment is cancelled and the course 
`studentCount` is decremented (atomically, idempotent).

```json
{
  "event": "refund.succeeded",
  "status": "succeeded",
  "object": {
    "id": "rt-123",
    "payment_id": "22220000-0000-0000-0000-000000000000",
    "status": "succeeded",
    "amount": { "value": "5000.00", "currency": "RUB" }
  }
}
```

**Response:** `{ "received": true, "status": "refunded" }`

---

### POST `/api/payments/[id]/init-yookassa`

Initialize YooKassa payment (creates payment on YooKassa side).

### POST `/api/payments/[id]/simulate-complete`

Simulate payment completion (development only).

---

## 🔔 Notifications

### GET `/api/notifications`

List user notifications (requires authentication).

**Rate limit:** 30 requests per minute

**Query:** `limit` (default: 50, max: 100), `offset` (default: 0)

**Response:**
```json
{
  "notifications": [
    { "id": "clx...", "type": "payment", "title": "Оплата прошла успешно", "message": "...", "read": false, "createdAt": 1705334400000, "link": "/course/..." }
  ],
  "total": 15,
  "unreadCount": 3
}
```

### PATCH `/api/notifications/[id]`

Mark a single notification as read.

### PATCH `/api/notifications/mark-all`

Mark all notifications as read.

### DELETE `/api/notifications`

Delete old read notifications (older than 30 days). Also cleans up stale verification tokens.

### POST `/api/notifications/publish`

Create a notification for a user.

**Rate limit:** 30 requests per minute

**Request:**
```json
{ "userId": "...", "type": "system", "title": "Обновление", "message": "..." }
```

**Access control:**
- Admins can send any type to any user
- Regular users can only send `enrollment`, `completion`, `achievement` types to themselves

### GET `/api/notifications/sse`

Server-Sent Events stream for real-time notifications.

**Rate limit:** 5 connections per minute per user

**Headers:** `Content-Type: text/event-stream`, `Cache-Control: no-cache`

**Events:**
```
data: {"type":"notification","notification":{...}}
data: {"type":"unreadCount","count":3}
data: {"type":"ping"}
```

Heartbeat every 30 seconds. Max 5 concurrent connections per user.

---

## 🏆 Achievements

### GET `/api/achievements`

Get achievement progress data for the current user (requires authentication).

**Rate limit:** 30 requests per minute

**Response:**
```json
{
  "completedCodingAssignments": 5,
  "completedLessonsCount": 42,
  "totalUsers": 12000,
  "userRegistrationOrder": 156
}
```

Achievements are computed client-side using this data combined with the achievement definitions in `src/data/achievements.ts`.

**Achievement categories:**
- `learning` — Enroll in courses (1, 3, 5), explore categories (3)
- `progress` — Complete lessons (1), reach 50% progress, complete courses (1, 3)
- `social` — Platform has >1 user, write reviews (5)
- `coding` — Complete coding assignments (5, 15, 30)
- `special` — Early bird (top 100), veteran (10 enrollments), completionist (5 courses), teacher role

---

## 📜 Certificates

### GET `/api/certificates?courseId=...`

Get certificate for a specific course (requires authentication).

**Rate limit:** 30 requests per minute

**Response:**
```json
{
  "id": "clx...",
  "certificateNumber": "MAE-00001",
  "issuedAt": "2024-03-01T00:00:00.000Z",
  "courseTitle": "Python для начинающих",
  "courseSlug": "python-basics",
  "userName": "Иван Иванов"
}
```

### GET `/api/certificates/[id]`

Get certificate details by ID (requires authentication, owner or admin only).

---

## 📝 Articles (Blog)

### GET `/api/articles`

List published articles with filtering and pagination.

**Rate limit:** 30 requests per minute
**Cache:** 5 minutes, tags: `articles`, `blog`

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `category` | string | — | Filter by category |
| `search` | string | — | Search by title, excerpt, content |
| `tag` | string | — | Filter by tag |
| `featured` | boolean | — | Featured articles only |
| `sortBy` | string | `new` | Sort: `new`, `popular`, `featured` |
| `page` | number | `1` | Page number |
| `limit` | number | `12` | Items per page (max: 100) |

**Article categories:** `development`, `testing`, `databases`, `ai`, `3d-modeling`, `security`, `devops`, `career`

**Response:**
```json
{
  "articles": [
    {
      "id": "clx...",
      "title": "Введение в Python",
      "slug": "intro-to-python",
      "excerpt": "Краткое введение...",
      "image": "https://...",
      "category": "development",
      "tags": "python,beginner",
      "readTime": 5,
      "views": 1200,
      "isPublished": true,
      "isFeatured": true,
      "createdAt": "2024-01-15T00:00:00.000Z",
      "updatedAt": "2024-01-20T00:00:00.000Z",
      "author": { "id": "clx...", "name": "Дуплей М.И.", "image": null, "role": "admin" }
    }
  ],
  "pagination": { "page": 1, "limit": 12, "total": 25, "totalPages": 3 }
}
```

### GET `/api/articles/[slug]`

Get single article by slug with full content.

**View counting:** Incremented with cookie-based deduplication (30s cooldown).

### POST `/api/articles`

Create a new article (teacher/admin only).

### PATCH `/api/articles/[slug]`

Update an article (author or admin only).

### DELETE `/api/articles/[slug]`

Delete an article (admin only).

---

## 📤 Upload

### POST `/api/upload`

Upload a file to S3-compatible storage.

**Rate limit:** 10 requests per minute

**Body:** `multipart/form-data`

| Field | Type | Description |
|-------|------|-------------|
| `file` | File | The file to upload (max 100MB) |
| `folder` | string | Target folder (alphanumeric only, default: `uploads`) |

**Allowed file types:** `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `video/mp4`, `video/webm`, `application/pdf`

**Security:**
- Magic byte verification prevents MIME-type spoofing
- Path traversal prevention on folder names
- Server-side file size validation
- Authentication required

**Response:**
```json
{
  "key": "uploads/1705334400000-a1b2c3d4.png",
  "url": "https://cdn.example.com/uploads/1705334400000-a1b2c3d4.png",
  "size": 102400,
  "type": "image/png"
}
```

---

## 🧑‍🏫 Teacher Dashboard

### GET `/api/teacher/stats`

Get teacher dashboard statistics (requires teacher or admin role).

**Rate limit:** 30 requests per minute

**Response:**
```json
{
  "courses": [
    {
      "id": "clx...",
      "title": "Python для начинающих",
      "slug": "python-basics",
      "isPublished": true,
      "rating": 4.8,
      "category": { "name": "Программирование", "slug": "programming" },
      "enrolledStudents": 45,
      "completedStudents": 12,
      "totalEnrollments": 60,
      "averageProgress": 65,
      "recentEnrollments": [
        { "userId": "clx...", "name": "Иван", "image": null, "progress": 20, "enrolledAt": "2024-01-15T00:00:00.000Z" }
      ],
      "moduleCount": 8,
      "reviewCount": 15
    }
  ],
  "stats": {
    "totalCourses": 3,
    "totalStudents": 120,
    "totalCompleted": 30,
    "avgCompletionRate": 25,
    "avgProgress": 55,
    "totalRevenue": 150000,
    "recentStudents": 45,
    "publishedCourses": 3
  }
}
```

---

## 🔧 Admin API

All admin endpoints require `admin` role.

### GET `/api/admin/users`

List all users with filtering and pagination.

**Rate limit:** 60 requests per minute

**Query:** `page`, `limit` (max: 100), `search`, `role`

**Response:**
```json
{
  "users": [
    {
      "id": "clx...",
      "email": "user@example.com",
      "name": "Иван Иванов",
      "image": null,
      "role": "student",
      "isActive": true,
      "twoFactorEnabled": false,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "_count": { "enrollments": 3, "teacherCourses": 0, "reviews": 2 }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 150, "totalPages": 8 }
}
```

### PUT `/api/admin/users`

Update user role or status.

**Request:**
```json
{ "userId": "clx...", "role": "teacher", "isActive": true, "name": "Новое имя" }
```

**Constraints:** Cannot change own role, cannot block self.

---

### GET `/api/admin/courses`

List all courses (including unpublished) with filtering.

**Query:** `page`, `limit` (max: 100), `status` (`published`/`unpublished`), `search`

### POST `/api/admin/courses`

Create a new course with modules, lessons, and assignments.

**Request:**
```json
{
  "title": "Новый курс",
  "slug": "new-course",
  "description": "Описание курса",
  "shortDesc": "Краткое описание",
  "price": 1999,
  "oldPrice": 2999,
  "level": "beginner",
  "duration": "8 недель",
  "isPublished": false,
  "isFeatured": false,
  "hasCertificate": true,
  "tags": "python,beginner",
  "requirements": "[\"Базовые знания ПК\"]",
  "whatYouLearn": "[\"Писать код на Python\"]",
  "categoryId": "clx...",
  "language": "ru",
  "visibility": "public",
  "modules": [
    {
      "title": "Модуль 1",
      "description": "Введение",
      "lessons": [
        {
          "title": "Урок 1",
          "type": "video",
          "content": "<p>HTML content</p>",
          "videoUrl": "https://...",
          "duration": 15,
          "isFree": true,
          "assignments": [
            { "title": "Тест", "type": "quiz", "points": 10, "options": "...", "correctAnswer": "..." }
          ]
        }
      ]
    }
  ]
}
```

### PUT `/api/admin/courses?id=...`

Update an existing course with full module/lesson/assignment sync.

**Cache invalidation:** Automatically invalidates `course:{id}`, `course:{slug}`, `courses`, `catalog` cache tags.

### DELETE `/api/admin/courses?id=...`

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

Get platform-wide statistics.

**Response:**
```json
{
  "totalUsers": 12000,
  "totalStudents": 11500,
  "totalTeachers": 450,
  "totalAdmins": 5,
  "totalCourses": 50,
  "totalPublishedCourses": 34,
  "totalEnrollments": 25000,
  "totalRevenue": 5000000,
  "totalPayments": 3000,
  "activeToday": 1200,
  "activeThisWeek": 4500,
  "activeThisMonth": 8000,
  "serverUptime": "72.3 ч",
  "dbSize": "PostgreSQL"
}
```

### GET `/api/admin/student-stats/[id]`

Get detailed statistics for a specific student.

---

### GET `/api/admin/payments`

List payments with filters and pagination (admin only).

**Query params:**
- `page`, `limit` (max 100), `status` (`pending|completed|failed|refunded|cancelled`), `userId` (UUID), `courseId`, `search`

**Response:**
```json
{
  "payments": [
    {
      "id": "uuid",
      "amount": 5000,
      "currency": "RUB",
      "status": "completed",
      "paymentMethod": "sbp",
      "user": { "id": "uuid", "name": "Иван", "email": "ivan@example.com" },
      "course": { "id": "uuid", "title": "Python Pro" },
      "promoCode": { "id": "uuid", "code": "SUMMER25" }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3 },
  "summary": { "totalRevenue": 1500000, "completedPayments": 38, "refundedPayments": 2 }
}
```

### POST `/api/admin/payments/[id]/refund`

Refund a completed payment (admin only).

Issues a YooKassa refund when `transactionId` holds a provider payment id and YooKassa is configured; otherwise marks the payment as refunded locally (mock/manual mode). Marking the payment refunded, the active enrollment is cancelled and the course `studentCount` is decremented atomically (race-condition safe).

**Response 200:**
```json
{
  "message": "Платёж возвращён",
  "refund": {
    "paymentId": "uuid",
    "amount": 5000,
    "currency": "RUB",
    "status": "refunded",
    "providerRefundId": "rt-123"
  }
}
```

**Errors:** `404` — платёж не найден; `400` — платёж не оплачен; `409` — уже возвращён; `502` — провайдер отклонил возврат.

---

### GET `/api/admin/categories`

List all course categories.

### POST `/api/admin/categories`

Create a category.

### PUT `/api/admin/categories`

Update a category.

### DELETE `/api/admin/categories?id=...`

Delete a category.

---

### GET `/api/admin/settings`

Get system settings.

**Response:**
```json
{
  "maintenanceMode": false,
  "registrationDisabled": false,
  "moderationEnabled": false,
  "emailNotificationsEnabled": false
}
```

### PUT `/api/admin/settings`

Update system settings.

**Request:** `{ "maintenanceMode": true }`

### GET `/api/admin/feature-flags`

Get all feature flags with current evaluation.

### POST `/api/admin/feature-flags`

Update a feature flag override.

---

### POST `/api/admin/cache/clear`

Clear all server cache (Redis + memory).

---

## 🏥 Health & Metrics

### GET `/api/health`

Comprehensive health check with service diagnostics.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T00:00:00.000Z",
  "version": "3.6.0",
  "uptime": "72h 15m 30s",
  "environment": "production",
  "services": {
    "database": { "status": "healthy", "responseTime": 5, "provider": "postgresql" },
    "cache": { "status": "healthy", "responseTime": 2 },
    "storage": { "status": "configured", "configured": true },
    "email": { "status": "configured", "configured": true }
  },
  "memory": {
    "rss": "150.2 MB",
    "heapUsed": "85.5 MB",
    "heapTotal": "128.0 MB"
  }
}
```

**Status values:** `healthy` — all services OK, `degraded` — non-critical service down (e.g., Redis), `unhealthy` — critical service down (e.g., database)

### GET `/api/metrics`

System metrics (admin only).

**Response:**
```json
{
  "system": {
    "uptime": "4335m",
    "nodeVersion": "v22.0.0",
    "platform": "linux",
    "memory": { "rss": "150MB", "heapUsed": "85MB", "heapTotal": "128MB" }
  },
  "data": {
    "users": 12000,
    "courses": 34,
    "activeEnrollments": 15000,
    "completedPayments": 3000,
    "reviews": 5000,
    "publishedArticles": 25,
    "unreadNotifications": 450
  },
  "timestamp": "2024-01-15T00:00:00.000Z"
}
```

---

## 🌱 Seeding

### POST `/api/seed`

Seed development data. Only available in development with `ALLOW_SEED_DATA=true`.

**Response:**
```json
{ "message": "База данных заполнена", "courses": 34, "users": 5 }
```

---

## 📊 Rate Limiting

| Endpoint Group | Limit | Window | Backend |
|----------------|-------|--------|---------|
| Register | 5 | 1 min | Memory |
| Login | 10 | 1 min | Memory |
| Forgot Password | 3 | 1 min | Memory |
| Reset Password | 5 | 1 min | Memory |
| Profile | 20 | 1 min | Memory |
| Courses (list) | 30 | 1 min | Memory |
| Course Detail | 30 | 1 min | Memory |
| Payments POST | 20 | 1 min | Memory |
| Payments GET | 20 | 1 min | Memory |
| Enrollment | 10 | 1 min | Memory |
| Progress | 60 | 1 min | Memory |
| Review | 10 | 1 min | Memory |
| Upload | 10 | 1 min | Memory |
| Admin | 60 | 1 min | Memory |
| SSE | 5 | 1 min | Memory |
| Webhook | 100 | 1 min | Memory |
| 2FA | 10 | 1 min | Memory |
| Send Verification | 3 | 1 min | Memory |
| Default | 30 | 1 min | Memory |

Rate-limited responses include headers:
- `X-RateLimit-Limit` — Max requests per window
- `X-RateLimit-Remaining` — Remaining requests
- `X-RateLimit-Reset` — Unix timestamp when the window resets
- `Retry-After` — Seconds to wait before retrying

---

## ❌ Error Codes

| Status | Description | Common Causes |
|--------|-------------|---------------|
| 400 | Bad Request | Invalid JSON, Zod validation failure, missing required fields |
| 401 | Unauthorized | Missing/invalid session, expired token |
| 403 | Forbidden | Insufficient role (not admin/teacher), course not accessible |
| 404 | Not Found | Resource doesn't exist (course, user, article, etc.) |
| 409 | Conflict | Email already exists, already enrolled, duplicate slug |
| 429 | Rate Limited | Too many requests, check `Retry-After` header |
| 500 | Internal Server Error | Unexpected server error, check server logs |
| 503 | Service Unavailable | Database down, storage not configured |

**Error format:**
```json
{ "error": "Human-readable error message" }
```

**Prisma error mapping:**
| Prisma Code | HTTP Status | Message |
|-------------|-------------|---------|
| P2002 | 409 | Record already exists |
| P2003 | 400 | Related data not found |
| P2025 | 404 | Record not found |
| P2014 | 400 | Relation constraint violation |

---

## ⚡ Caching

The API uses a two-tier caching system:

1. **Redis** (primary) — When `REDIS_URL` is configured
2. **In-memory Map** (fallback) — Max 1000 entries, FIFO eviction

**Cache tags** enable targeted invalidation:
- `courses`, `catalog` — Course list pages
- `course:{id}`, `course:{slug}` — Individual course pages
- `articles`, `blog` — Article list pages

**Cache headers:**
- `X-Cache: HIT` — Served from cache
- `X-Cache: MISS` — Computed fresh
- `Cache-Control: public, max-age=300, stale-while-revalidate=600` — Public pages
- `Cache-Control: private, max-age=60` — Authenticated pages

**Default TTL:** 5 minutes for public data, 1 minute for authenticated data.

---

## 🛡️ Security

### Authentication
- JWT-based sessions via NextAuth.js
- Session cookie: `SameSite=Strict`, `httpOnly`, `Secure` in production
- JWT cache with 5-minute TTL for role/isActive checks
- Automatic session invalidation on deactivation

### CSRF Protection
- Primary: `SameSite=Strict` cookie
- Secondary: Origin header validation against Host

### Input Validation
- Zod schemas on all mutation endpoints
- HTML sanitization via `sanitize-html` for rich content
- Password strength validation (8+ chars, mixed case, digits)

### File Upload Security
- MIME type whitelist (images, video, PDF)
- Magic byte verification (server-side content inspection)
- Path traversal prevention
- File size limits (100MB)

### Webhook Security
- HMAC-SHA256 signature verification
- Constant-time comparison to prevent timing attacks
- Configurable via `PAYMENT_WEBHOOK_SECRET`

### Rate Limiting
- Per-endpoint rate limits with in-memory fallback
- IP-based + user-based tracking
- FIFO eviction for memory limits
- Redis support for distributed rate limiting

### API Response Headers
- `X-Request-Id` — Unique request identifier for tracing
- `X-Response-Time` — Request duration in milliseconds
- `X-Cache` — Cache hit/miss status
- `X-RateLimit-*` — Rate limit status
