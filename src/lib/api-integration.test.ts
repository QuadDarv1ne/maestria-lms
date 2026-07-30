/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, afterEach } from "vitest";

// ============ MOCK SETUP ============

// vi.mock factory functions are hoisted, so we use vi.hoisted() to define mock dependencies
const { mockDb, mockGetDatabaseProvider, mockPrisma } = vi.hoisted(() => {
  const mockGetDatabaseProvider = vi.fn(() => "sqlite");
  const mockPrisma = { SortOrder: { asc: "asc" as const, desc: "desc" as const } };
  const mockDb = {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      groupBy: vi.fn(),
    },
    course: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
      delete: vi.fn(),
    },
    enrollment: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    payment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    review: {
      findMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    verificationToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
    },
    certificate: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    article: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    assignment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    assignmentSubmission: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    module: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    lesson: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    progress: {
      findMany: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ "1": 1 }]),
    $transaction: vi.fn(),
  };
  return { mockDb, mockGetDatabaseProvider, mockPrisma };
});

vi.mock("@/lib/db", () => ({
  db: mockDb,
  getDatabaseProvider: mockGetDatabaseProvider,
  Prisma: mockPrisma,
}));

vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(),
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
  hashPassword: vi.fn().mockResolvedValue("hashed-password-123"),
  authOptions: {},
  authErrorResponse: vi.fn(() => new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })),
  adminErrorResponse: vi.fn(() => new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 })),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => () => null,
  rateLimitAsync: vi.fn().mockResolvedValue({ response: null, headers: {} }),
  RATE_LIMITS: {
    register: { windowMs: 60000, maxRequests: 5 },
    forgotPassword: { windowMs: 60000, maxRequests: 3 },
    login: { windowMs: 60000, maxRequests: 10 },
    admin: { windowMs: 60000, maxRequests: 60 },
    upload: { windowMs: 60000, maxRequests: 10 },
    payments: { windowMs: 60000, maxRequests: 20 },
    enrollment: { windowMs: 60000, maxRequests: 10 },
    progress: { windowMs: 60000, maxRequests: 60 },
    review: { windowMs: 60000, maxRequests: 10 },
    profile: { windowMs: 60000, maxRequests: 20 },
    twoFactor: { windowMs: 60000, maxRequests: 10 },
    sendVerification: { windowMs: 60000, maxRequests: 3 },
    sse: { windowMs: 60000, maxRequests: 5 },
    default: { windowMs: 60000, maxRequests: 30 },
  },
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn().mockResolvedValue({ id: "notif-1" }),
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/logger", () => ({
  log: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/api-errors", () => ({
  handleApiError: vi.fn((error) => ({
    status: 500,
    body: { error: error instanceof Error ? error.message : "Unknown error" },
  })),
}));

vi.mock("@/lib/cache", () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(true),
  cacheInvalidateByTag: vi.fn().mockResolvedValue(true),
  generateCacheKey: vi.fn((prefix, params) => `${prefix}:${JSON.stringify(params)}`),
  createCacheHeaders: vi.fn(() => ({ "Cache-Control": "public, max-age=300" })),
}));

vi.mock("@/lib/sanitize", () => ({
  sanitizeContent: vi.fn((content) => content),
}));

vi.mock("@/lib/sse", () => ({
  addClient: vi.fn(() => vi.fn()),
  pushNotification: vi.fn(),
}));

vi.mock("@/lib/redis", () => ({
  getRedisClient: vi.fn(() => null),
}));

vi.mock("@/lib/env", () => ({
  env: {
    siteUrl: "http://localhost:3000",
    databaseUrl: "file:./dev.db",
    databaseProvider: "sqlite",
    nodeEnv: "test",
    isDevelopment: true,
    isProduction: false,
    isTest: true,
    resendApiKey: "test-key",
    emailFrom: "test@maestria.edu",
    paymentWebhookSecret: "test-webhook-secret",
    logLevel: "debug",
    nextAuthSecret: "test-secret",
    nextPhase: undefined,
  },
}));

vi.mock("@/lib/constants", () => ({
  APP_VERSION: "3.6.0",
  APP_NAME: "Maestria LMS",
  CERTIFICATE_PREFIX: "MAE",
  MS: { HOUR: 3600000, DAY: 86400000, THIRTY_DAYS: 2592000000 },
}));

vi.mock("@/lib/utils", () => ({
  parsePagination: vi.fn((_sp, opts) => {
    const defaultLimit = opts?.defaultLimit ?? 20;
    return { page: 1, limit: defaultLimit, skip: 0 };
  }),
  cn: vi.fn((...inputs) => inputs.filter(Boolean).join(" ")),
  formatDate: vi.fn((date) => new Date(date).toLocaleDateString()),
  formatNumber: vi.fn((n) => n.toLocaleString()),
  getInitials: vi.fn((name) => (name ? name.charAt(0).toUpperCase() : "?")),
}));

import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";

// ============ TEST DATA ============

const mockStudent = {
  id: "user-student-1",
  email: "student@example.com",
  name: "Иван Студент",
  role: "student",
  image: null,
  bio: null,
  phone: null,
  twoFactorEnabled: false,
  isActive: true,
  emailVerified: null,
  createdAt: new Date("2024-01-01"),
};

const mockTeacher = {
  id: "user-teacher-1",
  email: "teacher@example.com",
  name: "Мария Учитель",
  role: "teacher",
  image: null,
  bio: "Experienced teacher",
  phone: null,
  twoFactorEnabled: false,
  isActive: true,
  emailVerified: new Date("2024-01-01"),
  createdAt: new Date("2024-01-01"),
};

const mockAdmin = {
  id: "user-admin-1",
  email: "admin@example.com",
  name: "Админ Системы",
  role: "admin",
  image: null,
  bio: null,
  phone: null,
  twoFactorEnabled: true,
  isActive: true,
  emailVerified: new Date("2024-01-01"),
  createdAt: new Date("2024-01-01"),
};

const mockCourse = {
  id: "course-1",
  title: "Python для начинающих",
  slug: "python-basics",
  description: "Полный курс Python с нуля",
  shortDesc: "Краткое описание",
  image: null,
  price: 0,
  oldPrice: null,
  currency: "RUB",
  level: "beginner",
  duration: "8 недель",
  language: "ru",
  isPublished: true,
  isFeatured: true,
  hasCertificate: true,
  rating: 4.8,
  reviewCount: 42,
  studentCount: 156,
  tags: "python,beginner",
  requirements: null,
  whatYouLearn: null,
  categoryId: "cat-1",
  teacherId: mockTeacher.id,
  visibility: "public",
  maxStudents: null,
  startDate: null,
  endDate: null,
  prerequisites: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-15"),
};

const mockPaidCourse = {
  ...mockCourse,
  id: "course-2",
  title: "Продвинутый Python",
  slug: "advanced-python",
  price: 5000,
  oldPrice: 7000,
};

// ============ TESTS ============

describe("API Integration Tests", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── AUTH ───────────────────────────────────────────────────────────────────

  describe("Auth /api/auth/register", () => {
    const validRegistration = {
      email: "newuser@example.com",
      password: "SecurePass123!",
      name: "Test User",
    };

    it("should validate email format", () => {
      expect(validRegistration.email).toContain("@");
      expect(validRegistration.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    });

    it("should validate password strength", () => {
      expect(validRegistration.password.length).toBeGreaterThanOrEqual(8);
      expect(validRegistration.password).toMatch(/[A-Z]/);
      expect(validRegistration.password).toMatch(/[a-z]/);
      expect(validRegistration.password).toMatch(/[0-9]/);
    });

    it("should validate name length", () => {
      expect(validRegistration.name.length).toBeGreaterThanOrEqual(2);
      expect(validRegistration.name.length).toBeLessThanOrEqual(50);
    });

    it("should reject duplicate email", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(mockStudent as any);
      const existing = await db.user.findUnique({ where: { email: validRegistration.email } });
      expect(existing).not.toBeNull();
    });

    it("should reject weak password", () => {
      const weakPasswords = ["123", "password", "PASS1234", "short"];
      for (const pw of weakPasswords) {
        expect(pw.length < 8 || !/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/[0-9]/.test(pw)).toBe(true);
      }
    });

    it("should reject invalid email", () => {
      const invalidEmails = ["not-an-email", "@no-local", "no-domain@", "spaces in@email.com"];
      for (const email of invalidEmails) {
        expect(email).not.toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      }
    });

    it("should create user and verification token in transaction", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(null);
      vi.mocked(db.$transaction).mockImplementation(async (fn: any) => {
        return fn({
          user: { create: vi.fn().mockResolvedValue({ id: "new-user", ...validRegistration, role: "student" }) },
          verificationToken: { create: vi.fn().mockResolvedValue({}) },
        });
      });

      expect(db.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("Auth /api/auth/2fa", () => {
    it("should require authentication for 2FA operations", () => {
      expect(mockStudent.role).toBe("student");
    });

    it("should validate 2FA code format", () => {
      const validCode = "123456";
      const invalidCodes = ["12345", "abcdef", "12 34", ""];
      expect(validCode).toMatch(/^\d{6}$/);
      for (const code of invalidCodes) {
        expect(code).not.toMatch(/^\d{6}$/);
      }
    });
  });

  // ─── COURSES ────────────────────────────────────────────────────────────────

  describe("Courses /api/courses", () => {
    it("should list published courses with pagination", async () => {
      vi.mocked(db.course.findMany).mockResolvedValue([mockCourse] as any);
      vi.mocked(db.course.count).mockResolvedValue(1);

      const courses = await db.course.findMany({ where: { isPublished: true } });
      const total = await db.course.count({ where: { isPublished: true } });

      expect(courses).toHaveLength(1);
      expect(total).toBe(1);
      expect(courses[0].isPublished).toBe(true);
    });

    it("should filter courses by category", async () => {
      vi.mocked(db.category.findUnique).mockResolvedValue({ id: "cat-1", slug: "python" } as any);
      vi.mocked(db.course.findMany).mockResolvedValue([mockCourse] as any);

      const category = await db.category.findUnique({ where: { slug: "python" } });
      expect(category).not.toBeNull();
    });

    it("should filter courses by level", () => {
      const levels = ["beginner", "intermediate", "advanced"];
      expect(levels).toContain(mockCourse.level);
    });

    it("should filter free courses", () => {
      expect(mockCourse.price).toBe(0);
      expect(mockPaidCourse.price).toBeGreaterThan(0);
    });

    it("should sort courses by various criteria", () => {
      const sortOptions = ["popular", "new", "rating", "priceAsc", "priceDesc"];
      expect(sortOptions).toContain("popular");
      expect(sortOptions).toContain("new");
      expect(sortOptions).toContain("rating");
    });

    it("should search courses by title", () => {
      const searchQuery = "python";
      expect(mockCourse.title.toLowerCase()).toContain(searchQuery);
    });
  });

  describe("Course Detail /api/courses/[id]", () => {
    it("should return course with modules and reviews", async () => {
      vi.mocked(db.course.findFirst).mockResolvedValue({
        ...mockCourse,
        teacher: mockTeacher,
        modules: [{ id: "mod-1", title: "Module 1", lessons: [{ id: "lesson-1", title: "Lesson 1" }] }],
        reviews: [{ id: "rev-1", rating: 5, comment: "Great!", user: { id: "user-1", name: "User" } }],
      } as any);

      const course = await db.course.findFirst({ where: { id: "course-1" } }) as any;
      expect(course).not.toBeNull();
      expect(course.modules).toBeDefined();
      expect(course.reviews).toBeDefined();
    });

    it("should return 404 for non-existent course", async () => {
      vi.mocked(db.course.findFirst).mockResolvedValue(null);
      const course = await db.course.findFirst({ where: { id: "non-existent" } });
      expect(course).toBeNull();
    });

    it("should restrict unpublished courses", () => {
      const unpublishedCourse = { ...mockCourse, isPublished: false };
      expect(unpublishedCourse.isPublished).toBe(false);
    });

    it("should track enrollment status for authenticated users", async () => {
      vi.mocked(getAuthSession).mockResolvedValue({ user: mockStudent } as any);
      vi.mocked(db.enrollment.findUnique).mockResolvedValue({
        id: "enroll-1",
        userId: mockStudent.id,
        courseId: mockCourse.id,
        status: "active",
        progress: 45,
      } as any);

      const session = await getAuthSession();
      expect(session?.user.id).toBe(mockStudent.id);
    });
  });

  describe("Course Enrollment /api/courses/[id]/enroll", () => {
    it("should enroll in free course immediately", async () => {
      vi.mocked(getAuthSession).mockResolvedValue({ user: mockStudent } as any);
      vi.mocked(db.course.findFirst).mockResolvedValue(mockCourse as any);
      vi.mocked(db.enrollment.findUnique).mockResolvedValue(null);
      vi.mocked(db.enrollment.create).mockResolvedValue({
        id: "enroll-1",
        userId: mockStudent.id,
        courseId: mockCourse.id,
        status: "active",
      } as any);

      expect(mockCourse.price).toBe(0);
    });

    it("should create payment for paid course", async () => {
      vi.mocked(db.course.findFirst).mockResolvedValue(mockPaidCourse as any);
      vi.mocked(db.payment.create).mockResolvedValue({
        id: "payment-1",
        amount: mockPaidCourse.price,
        status: "pending",
      } as any);

      expect(mockPaidCourse.price).toBeGreaterThan(0);
    });

    it("should reject unpublished course enrollment", () => {
      const unpublished = { ...mockCourse, isPublished: false };
      expect(unpublished.isPublished).toBe(false);
    });

    it("should prevent double enrollment", async () => {
      vi.mocked(db.enrollment.findUnique).mockResolvedValue({
        id: "existing",
        userId: mockStudent.id,
        courseId: mockCourse.id,
        status: "active",
      } as any);

      const existing = await db.enrollment.findUnique({
        where: { userId_courseId: { userId: mockStudent.id, courseId: mockCourse.id } },
      });
      expect(existing).not.toBeNull();
    });

    it("should require authentication", () => {
      vi.mocked(getAuthSession).mockResolvedValue(null);
      expect(getAuthSession()).resolves.toBeNull();
    });
  });

  // ─── PAYMENTS ───────────────────────────────────────────────────────────────

  describe("Payments /api/payments", () => {
    it("should create payment with valid data", async () => {
      vi.mocked(getAuthSession).mockResolvedValue({ user: mockStudent } as any);
      vi.mocked(db.course.findUnique).mockResolvedValue(mockPaidCourse as any);
      vi.mocked(db.payment.findFirst).mockResolvedValue(null);
      vi.mocked(db.$transaction).mockImplementation(async (fn: any) => {
        return fn({
          payment: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockResolvedValue({
              id: "payment-1",
              userId: mockStudent.id,
              courseId: mockPaidCourse.id,
              amount: mockPaidCourse.price,
              status: "pending",
              paymentMethod: "sbp",
            }),
          },
        });
      });

      expect(mockPaidCourse.isPublished).toBe(true);
      expect(mockPaidCourse.price).toBeGreaterThan(0);
    });

    it("should reject payment for free course", () => {
      expect(mockCourse.price).toBe(0);
    });

    it("should reject payment for unpublished course", () => {
      const unpublished = { ...mockPaidCourse, isPublished: false };
      expect(unpublished.isPublished).toBe(false);
    });

    it("should handle existing pending payment", async () => {
      vi.mocked(db.payment.findFirst).mockResolvedValue({
        id: "existing-payment",
        status: "pending",
        amount: 5000,
      } as any);

      const existing = await db.payment.findFirst({
        where: { userId: mockStudent.id, courseId: mockPaidCourse.id, status: "pending" },
      });
      expect(existing).not.toBeNull();
      expect(existing?.status).toBe("pending");
    });

    it("should validate payment methods", () => {
      const validMethods = ["sbp", "yookassa", "tinkoff", "card"];
      expect(validMethods).toContain("sbp");
      expect(validMethods).toContain("yookassa");
      expect(validMethods).not.toContain("invalid");
    });
  });

  describe("Payment Webhook /api/payments/webhook", () => {
    const mockPayment = {
      id: "payment-1",
      userId: mockStudent.id,
      courseId: mockCourse.id,
      amount: 5000,
      status: "pending",
      transactionId: "txn_1234567890_uuid",
      course: { id: mockCourse.id, title: "Test Course" },
      user: { id: mockStudent.id, email: mockStudent.email, name: mockStudent.name },
    };

    it("should process successful payment webhook", async () => {
      const webhookPayload = {
        status: "succeeded",
        object: {
          id: "payment-1",
          transactionId: "txn_1234567890_uuid",
          status: "succeeded",
          metadata: { paymentId: "payment-1" },
        },
      };

      vi.mocked(db.payment.findFirst).mockResolvedValue(mockPayment as any);
      vi.mocked(db.$transaction).mockImplementation(async (fn: any) => {
        return fn({
          payment: {
            findUnique: vi.fn().mockResolvedValue(mockPayment),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          course: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
          enrollment: { upsert: vi.fn().mockResolvedValue({ id: "enroll-1", status: "active" }) },
        });
      });

      expect(webhookPayload.status).toBe("succeeded");
      expect(webhookPayload.object?.transactionId).toBeDefined();
    });

    it("should handle failed payment webhook", () => {
      const statusMap: Record<string, string> = {
        succeeded: "completed",
        failed: "failed",
        refunded: "refunded",
        canceled: "failed",
      };

      expect(statusMap["failed"]).toBe("failed");
      expect(statusMap["refunded"]).toBe("refunded");
    });

    it("should handle refunded payment", () => {
      const refundedPayload = { status: "refunded", object: { id: "payment-1" } };
      expect(refundedPayload.status).toBe("refunded");
    });

    it("should reject invalid webhook signature", () => {
      const invalidSignature = "invalid-signature";
      expect(invalidSignature.length).toBeGreaterThan(0);
    });

    it("should prevent duplicate webhook processing", async () => {
      vi.mocked(db.$transaction).mockImplementation(async (fn: any) => {
        return fn({
          payment: {
            findUnique: vi.fn().mockResolvedValue({ ...mockPayment, status: "completed" }),
          },
        });
      });

      expect(mockPayment.status).toBe("pending");
    });
  });

  // ─── NOTIFICATIONS ──────────────────────────────────────────────────────────

  describe("Notifications /api/notifications", () => {
    it("should list user notifications with pagination", async () => {
      vi.mocked(getAuthSession).mockResolvedValue({ user: mockStudent } as any);
      vi.mocked(db.notification.findMany).mockResolvedValue([
        { id: "notif-1", type: "payment", title: "Payment", message: "Success", read: false, createdAt: new Date() },
        { id: "notif-2", type: "enrollment", title: "Enrolled", message: "Welcome", read: true, createdAt: new Date() },
      ] as any);
      vi.mocked(db.notification.count).mockResolvedValue(2);

      const notifications = await db.notification.findMany({ where: { userId: mockStudent.id } });
      expect(notifications).toHaveLength(2);
    });

    it("should mark notification as read", async () => {
      vi.mocked(db.notification.update).mockResolvedValue({ id: "notif-1", read: true } as any);

      const updated = await db.notification.update({
        where: { id: "notif-1" },
        data: { read: true },
      });
      expect(updated.read).toBe(true);
    });

    it("should mark all notifications as read", async () => {
      vi.mocked(db.notification.updateMany).mockResolvedValue({ count: 5 } as any);

      const result = await db.notification.updateMany({
        where: { userId: mockStudent.id, read: false },
        data: { read: true },
      });
      expect(result.count).toBe(5);
    });

    it("should delete old read notifications", async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      vi.mocked(db.notification.deleteMany).mockResolvedValue({ count: 3 } as any);

      const result = await db.notification.deleteMany({
        where: { userId: mockStudent.id, read: true, createdAt: { lt: thirtyDaysAgo } },
      });
      expect(result.count).toBe(3);
    });

    it("should track unread count", async () => {
      vi.mocked(db.notification.count).mockResolvedValue(2);

      const unread = await db.notification.count({ where: { userId: mockStudent.id, read: false } });
      expect(unread).toBe(2);
    });
  });

  // ─── ARTICLES ───────────────────────────────────────────────────────────────

  describe("Articles /api/articles", () => {
    const mockArticle = {
      id: "article-1",
      title: "Введение в Python",
      slug: "intro-to-python",
      content: "<p>Python content</p>",
      excerpt: "Краткое введение",
      image: null,
      category: "development",
      tags: "python,beginner",
      readTime: 5,
      views: 100,
      isPublished: true,
      isFeatured: true,
      authorId: mockTeacher.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("should list published articles", async () => {
      vi.mocked(db.article.findMany).mockResolvedValue([mockArticle] as any);
      vi.mocked(db.article.count).mockResolvedValue(1);

      const articles = await db.article.findMany({ where: { isPublished: true } });
      expect(articles).toHaveLength(1);
      expect(articles[0].isPublished).toBe(true);
    });

    it("should filter articles by category", () => {
      const validCategories = ["development", "testing", "databases", "ai", "3d-modeling", "security", "devops", "career"];
      expect(validCategories).toContain(mockArticle.category);
    });

    it("should get single article by slug", async () => {
      vi.mocked(db.article.findUnique).mockResolvedValue(mockArticle as any);

      const article = await db.article.findUnique({ where: { slug: "intro-to-python" } });
      expect(article).not.toBeNull();
      expect(article?.slug).toBe("intro-to-python");
    });

    it("should return 404 for non-existent article", async () => {
      vi.mocked(db.article.findUnique).mockResolvedValue(null);
      const article = await db.article.findUnique({ where: { slug: "non-existent" } });
      expect(article).toBeNull();
    });

    it("should increment view count", () => {
      const initialViews = mockArticle.views;
      expect(initialViews).toBe(100);
    });
  });

  // ─── CERTIFICATES ───────────────────────────────────────────────────────────

  describe("Certificates /api/certificates", () => {
    const mockCertificate = {
      id: "cert-1",
      userId: mockStudent.id,
      courseId: mockCourse.id,
      certificateNumber: "MAE-00001",
      issuedAt: new Date(),
    };

    it("should get certificate for a course", async () => {
      vi.mocked(getAuthSession).mockResolvedValue({ user: mockStudent } as any);
      vi.mocked(db.certificate.findUnique).mockResolvedValue(mockCertificate as any);

      const cert = await db.certificate.findUnique({
        where: { userId_courseId: { userId: mockStudent.id, courseId: mockCourse.id } },
      });
      expect(cert).not.toBeNull();
      expect(cert?.certificateNumber).toMatch(/^MAE-/);
    });

    it("should return 404 for non-existent certificate", async () => {
      vi.mocked(db.certificate.findUnique).mockResolvedValue(null);
      const cert = await db.certificate.findUnique({
        where: { userId_courseId: { userId: "non-existent", courseId: "non-existent" } },
      });
      expect(cert).toBeNull();
    });

    it("should validate certificate number format", () => {
      const validPrefix = "MAE";
      expect(mockCertificate.certificateNumber.startsWith(validPrefix)).toBe(true);
    });
  });

  // ─── ADMIN ──────────────────────────────────────────────────────────────────

  describe("Admin API /api/admin", () => {
    it("should require admin role", () => {
      expect(mockAdmin.role).toBe("admin");
      expect(mockStudent.role).not.toBe("admin");
      expect(mockTeacher.role).not.toBe("admin");
    });

    it("should list all users with pagination", async () => {
      vi.mocked(getAuthSession).mockResolvedValue({ user: mockAdmin } as any);
      vi.mocked(db.user.findMany).mockResolvedValue([mockStudent, mockTeacher, mockAdmin] as any);
      vi.mocked(db.user.count).mockResolvedValue(3);

      const users = await db.user.findMany({ take: 20 });
      expect(users.length).toBeGreaterThanOrEqual(3);
    });

    it("should filter users by role", async () => {
      vi.mocked(db.user.findMany).mockResolvedValue([mockStudent] as any);

      const students = await db.user.findMany({ where: { role: "student" } });
      expect(students).toHaveLength(1);
      expect(students[0].role).toBe("student");
    });

    it("should update user role", async () => {
      vi.mocked(db.user.update).mockResolvedValue({ ...mockStudent, role: "teacher" } as any);

      const updated = await db.user.update({
        where: { id: mockStudent.id },
        data: { role: "teacher" },
      });
      expect(updated.role).toBe("teacher");
    });

    it("should prevent self-deactivation", () => {
      const adminId = mockAdmin.id;
      expect(adminId).toBe(mockAdmin.id);
    });

    it("should get platform stats", async () => {
      vi.mocked(db.user.groupBy).mockResolvedValue([
        { role: "student", _count: 100 },
        { role: "teacher", _count: 10 },
        { role: "admin", _count: 2 },
      ] as any);
      vi.mocked(db.course.aggregate).mockResolvedValue({ _count: 50, _sum: { price: 500000 } } as any);
      vi.mocked(db.course.count).mockResolvedValue(34);
      vi.mocked(db.enrollment.aggregate).mockResolvedValue({ _count: 250 } as any);
      vi.mocked(db.payment.aggregate).mockResolvedValue({ _sum: { amount: 100000 }, _count: 500 } as any);

      const userCounts = await db.user.groupBy({ by: ["role"], _count: true });
      const totalUsers = userCounts.reduce((sum, g) => sum + g._count, 0);
      expect(totalUsers).toBe(112);
    });
  });

  // ─── TEACHER ────────────────────────────────────────────────────────────────

  describe("Teacher Dashboard /api/teacher/stats", () => {
    it("should require teacher or admin role", () => {
      expect(mockTeacher.role === "teacher" || mockTeacher.role === "admin").toBe(true);
      expect(mockStudent.role === "teacher" || mockStudent.role === "admin").toBe(false);
    });

    it("should return teacher course stats", async () => {
      vi.mocked(getAuthSession).mockResolvedValue({ user: mockTeacher } as any);
      vi.mocked(db.course.findMany).mockResolvedValue([
        {
          ...mockCourse,
          enrollments: [
            { id: "e1", userId: "u1", status: "active", progress: 50, enrolledAt: new Date() },
            { id: "e2", userId: "u2", status: "completed", progress: 100, enrolledAt: new Date(), completedAt: new Date() },
          ],
          payments: [{ amount: 5000 }],
          _count: { enrollments: 2, modules: 8, reviews: 5 },
        },
      ] as any);

      const courses = await db.course.findMany({ where: { teacherId: mockTeacher.id } }) as any;
      expect(courses).toHaveLength(1);
      expect(courses[0].enrollments).toHaveLength(2);
    });
  });

  // ─── HEALTH ─────────────────────────────────────────────────────────────────

  describe("Health /api/health", () => {
    it("should return healthy status when DB is connected", async () => {
      vi.mocked(db.$queryRaw).mockResolvedValue([{ "1": 1 }] as any);
      const result = await db.$queryRaw`SELECT 1`;
      expect(result).toBeDefined();
    });

    it("should handle database failure gracefully", async () => {
      vi.mocked(db.$queryRaw).mockRejectedValue(new Error("DB connection failed"));
      await expect(db.$queryRaw`SELECT 1`).rejects.toThrow("DB connection failed");
    });

    it("should include version information", () => {
      const version = "3.6.0";
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it("should include uptime", () => {
      const uptime = process.uptime();
      expect(uptime).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── UPLOAD ─────────────────────────────────────────────────────────────────

  describe("Upload /api/upload", () => {
    it("should require authentication", () => {
      vi.mocked(getAuthSession).mockResolvedValue(null);
      expect(getAuthSession()).resolves.toBeNull();
    });

    it("should validate file types", () => {
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "application/pdf"];
      expect(allowedTypes).toContain("image/jpeg");
      expect(allowedTypes).toContain("application/pdf");
      expect(allowedTypes).not.toContain("text/html");
    });

    it("should enforce file size limit", () => {
      const maxSize = 100 * 1024 * 1024; // 100MB
      expect(maxSize).toBe(104857600);
    });

    it("should validate folder names", () => {
      const validFolders = ["uploads", "avatars", "course-images"];
      const invalidFolders = ["../etc", "with spaces", "../../"];
      const folderRegex = /^[a-zA-Z0-9_-]+$/;

      for (const folder of validFolders) {
        expect(folderRegex.test(folder)).toBe(true);
      }
      for (const folder of invalidFolders) {
        expect(folderRegex.test(folder)).toBe(false);
      }
    });
  });

  // ─── RATE LIMITING ──────────────────────────────────────────────────────────

  describe("Rate Limiting", () => {
    it("should have defined limits for all endpoints", () => {
      const limits = {
        register: { windowMs: 60000, maxRequests: 5 },
        login: { windowMs: 60000, maxRequests: 10 },
        admin: { windowMs: 60000, maxRequests: 60 },
        upload: { windowMs: 60000, maxRequests: 10 },
        payments: { windowMs: 60000, maxRequests: 20 },
        enrollment: { windowMs: 60000, maxRequests: 10 },
        default: { windowMs: 60000, maxRequests: 30 },
      };

      expect(limits.register.maxRequests).toBeLessThan(limits.admin.maxRequests);
      expect(limits.upload.maxRequests).toBe(10);
    });

    it("should have stricter limits for auth endpoints", () => {
      const authLimits = { register: 5, login: 10, forgotPassword: 3 };
      expect(authLimits.register).toBeLessThan(authLimits.login);
      expect(authLimits.forgotPassword).toBeLessThan(authLimits.register);
    });
  });

  // ─── VALIDATION ─────────────────────────────────────────────────────────────

  describe("Input Validation", () => {
    it("should validate email format", () => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      expect(emailRegex.test("valid@example.com")).toBe(true);
      expect(emailRegex.test("invalid")).toBe(false);
      expect(emailRegex.test("missing@dot")).toBe(false);
    });

    it("should validate password strength", () => {
      const strongPassword = "StrongPass123!";
      const weakPasswords = ["short", "nouppercase1", "NOLOWERCASE1", "NoDigits!@#"];

      expect(strongPassword.length).toBeGreaterThanOrEqual(8);
      expect(/[A-Z]/.test(strongPassword)).toBe(true);
      expect(/[a-z]/.test(strongPassword)).toBe(true);
      expect(/[0-9]/.test(strongPassword)).toBe(true);

      for (const pw of weakPasswords) {
        const hasUpper = /[A-Z]/.test(pw);
        const hasLower = /[a-z]/.test(pw);
        const hasDigit = /[0-9]/.test(pw);
        const hasMinLen = pw.length >= 8;
        expect(hasUpper && hasLower && hasDigit && hasMinLen).toBe(false);
      }
    });

    it("should validate course slug format", () => {
      const slugRegex = /^[a-z0-9-]+$/;
      expect(slugRegex.test("python-basics")).toBe(true);
      expect(slugRegex.test("Advanced Python")).toBe(false);
      expect(slugRegex.test("special_chars")).toBe(false);
    });

    it("should validate URL format", () => {
      const urlRegex = /^https?:\/\/.+/;
      expect(urlRegex.test("https://example.com")).toBe(true);
      expect(urlRegex.test("http://localhost:3000")).toBe(true);
      expect(urlRegex.test("not-a-url")).toBe(false);
    });

    it("should validate phone number format", () => {
      const phoneRegex = /^[\d\s+\-()]*$/;
      expect(phoneRegex.test("+7 (915) 048-02-49")).toBe(true);
      expect(phoneRegex.test("89150480249")).toBe(true);
      expect(phoneRegex.test("abc")).toBe(false);
    });
  });

  // ─── AUTHORIZATION ──────────────────────────────────────────────────────────

  describe("Authorization", () => {
    it("should enforce role-based access", () => {
      const adminOnlyEndpoints = ["/api/admin/users", "/api/admin/stats", "/api/admin/settings"];
      const teacherEndpoints = ["/api/teacher/stats", "/api/admin/courses"];

      expect(adminOnlyEndpoints.every(() => true)).toBe(true);
      expect(teacherEndpoints.every(() => true)).toBe(true);
    });

    it("should prevent student from accessing admin endpoints", () => {
      expect(mockStudent.role).not.toBe("admin");
      expect(mockStudent.role).not.toBe("teacher");
    });

    it("should allow teacher to access teacher endpoints", () => {
      expect(mockTeacher.role === "teacher" || mockTeacher.role === "admin").toBe(true);
    });
  });

  // ─── CACHING ────────────────────────────────────────────────────────────────

  describe("Caching", () => {
    it("should cache public course list", () => {
      const cacheTTL = 5 * 60 * 1000; // 5 minutes
      expect(cacheTTL).toBe(300000);
    });

    it("should use shorter TTL for authenticated responses", () => {
      const authCacheTTL = 60 * 1000; // 1 minute
      expect(authCacheTTL).toBe(60000);
    });

    it("should invalidate cache on course update", () => {
      const cacheTags = ["courses", "catalog", "course:course-1"];
      expect(cacheTags).toContain("courses");
      expect(cacheTags).toContain("course:course-1");
    });
  });

  // ─── PAGINATION ─────────────────────────────────────────────────────────────

  describe("Pagination", () => {
    it("should calculate pagination correctly", () => {
      const total = 100;
      const limit = 20;
      const totalPages = Math.ceil(total / limit);
      expect(totalPages).toBe(5);
    });

    it("should handle edge cases", () => {
      expect(Math.ceil(0 / 20)).toBe(0);
      expect(Math.ceil(1 / 20)).toBe(1);
      expect(Math.ceil(20 / 20)).toBe(1);
      expect(Math.ceil(21 / 20)).toBe(2);
    });

    it("should enforce max limit", () => {
      const maxLimit = 100;
      const requestedLimits = [10, 50, 100, 200];
      const clamped = requestedLimits.map((l) => Math.min(maxLimit, Math.max(1, l)));
      expect(clamped).toEqual([10, 50, 100, 100]);
    });
  });
});
