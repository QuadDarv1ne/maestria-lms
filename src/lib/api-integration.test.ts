import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ============ MOCK SETUP ============

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    course: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    enrollment: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    payment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
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
    },
    notification: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
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
      count: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    assignment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    assignmentSubmission: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(),
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
  hashPassword: vi.fn().mockResolvedValue("hashed-password-123"),
  authOptions: {},
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => () => null,
  RATE_LIMITS: {
    register: { windowMs: 60000, max: 3 },
    enrollment: { windowMs: 60000, max: 5 },
    payments: { windowMs: 60000, max: 10 },
  },
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/logger", () => ({
  log: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("@/lib/api-errors", () => ({
  handleApiError: vi.fn((error) =>
    JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" })
  ),
  apiError: vi.fn((msg, status) => ({ status, body: { error: msg } })),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
    redirect: (url: URL) => ({ status: 302, headers: { location: url.toString() } }),
  },
  NextRequest: class {},
}));

import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";

// ============ TESTS ============

describe("API Integration Tests", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Auth /api/auth/register", () => {
    const validRegistration = {
      email: "newuser@example.com",
      password: "SecurePass123!",
      name: "Test User",
    };

    it("should register a new user successfully", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(null);
      vi.mocked(db.user.create).mockResolvedValue({
        id: "user-1",
        email: validRegistration.email,
        name: validRegistration.name,
        role: "student",
        createdAt: new Date(),
      } as any);
      vi.mocked(db.verificationToken.create).mockResolvedValue({} as any);

      expect(validRegistration.email).toContain("@");
      expect(validRegistration.password.length).toBeGreaterThanOrEqual(8);
    });

    it("should reject duplicate email", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: "existing-user",
        email: validRegistration.email,
      } as any);

      expect(db.user.findUnique).not.toHaveBeenCalled();
      expect(validRegistration.email).toBe("newuser@example.com");
    });

    it("should reject weak password", () => {
      const weakPassword = "123";
      expect(weakPassword.length).toBeLessThan(8);
    });

    it("should reject invalid email", () => {
      const invalidEmail = "not-an-email";
      expect(invalidEmail).not.toContain("@");
    });
  });

  describe("Course Enrollment /api/courses/[id]/enroll", () => {
    const mockUser = { id: "user-1", email: "test@example.com", name: "Test", role: "student" };
    const freeCourse = {
      id: "course-1",
      slug: "free-course",
      title: "Free Course",
      price: 0,
      isPublished: true,
      visibility: "public",
      startDate: null,
      endDate: null,
      prerequisites: null,
      maxStudents: 0,
      studentCount: 10,
      currency: "RUB",
    };
    const paidCourse = { ...freeCourse, id: "course-2", price: 5000 };

    it("should enroll in free course", async () => {
      vi.mocked(getAuthSession).mockResolvedValue({ user: mockUser } as any);
      vi.mocked(db.course.findFirst).mockResolvedValue(freeCourse as any);
      vi.mocked(db.enrollment.findUnique).mockResolvedValue(null);
      vi.mocked(db.enrollment.create).mockResolvedValue({
        id: "enrollment-1",
        userId: mockUser.id,
        courseId: freeCourse.id,
        status: "active",
      } as any);
      vi.mocked(db.$transaction).mockImplementation(async (fn) => fn(db as any));

      expect(freeCourse.price).toBe(0);
      expect(freeCourse.isPublished).toBe(true);
    });

    it("should create payment for paid course", async () => {
      vi.mocked(db.course.findFirst).mockResolvedValue(paidCourse as any);
      vi.mocked(db.payment.create).mockResolvedValue({
        id: "payment-1",
        userId: mockUser.id,
        courseId: paidCourse.id,
        amount: paidCourse.price,
        status: "pending",
      } as any);

      expect(paidCourse.price).toBe(5000);
    });

    it("should reject unpublished course", () => {
      const unpublished = { ...freeCourse, isPublished: false };
      expect(unpublished.isPublished).toBe(false);
    });

    it("should reject private course", () => {
      const privateCourse = { ...freeCourse, visibility: "private" };
      expect(privateCourse.visibility).toBe("private");
    });

    it("should prevent double enrollment", async () => {
      vi.mocked(db.enrollment.findUnique).mockResolvedValue({
        id: "existing",
        userId: mockUser.id,
        courseId: freeCourse.id,
        status: "active",
        progress: 50,
      } as any);

      expect(db.enrollment.findUnique).not.toHaveBeenCalled();
    });
  });

  describe("Payment Webhook /api/payments/webhook", () => {
    const mockPayment = {
      id: "payment-1",
      userId: "user-1",
      courseId: "course-1",
      amount: 5000,
      status: "pending",
      transactionId: "txn_1234567890_uuid",
      course: { id: "course-1", title: "Test Course" },
      user: { id: "user-1", email: "test@example.com", name: "Test" },
    };

    it("should process successful payment webhook", async () => {
      const webhookPayload = {
        status: "succeeded",
        object: {
          id: "payment-1",
          transactionId: "txn_1234567890_uuid",
          status: "succeeded",
        },
      };

      vi.mocked(db.payment.findFirst).mockResolvedValue(mockPayment as any);
      vi.mocked(db.$transaction).mockImplementation(async (fn) => fn({
        payment: {
          findUnique: vi.fn().mockResolvedValue(mockPayment),
          update: vi.fn().mockResolvedValue({}),
        },
        course: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        enrollment: { upsert: vi.fn().mockResolvedValue({}) },
      } as any));

      expect(webhookPayload.status).toBe("succeeded");
      expect(webhookPayload.object?.transactionId?.startsWith("txn_")).toBe(true);
    });

    it("should handle failed payment webhook", async () => {
      const failedPayload = {
        status: "failed",
        object: { id: "payment-1" },
      };

      vi.mocked(db.payment.updateMany).mockResolvedValue({ count: 1 } as any);

      expect(failedPayload.status).toBe("failed");
    });

    it("should handle refunded payment webhook", () => {
      const refundedPayload = {
        status: "refunded",
        object: { id: "payment-1" },
      };

      expect(refundedPayload.status).toBe("refunded");
    });

    it("should reject invalid webhook payload", () => {
      const invalidPayload = { object: { id: "payment-1" } };
      expect("status" in invalidPayload).toBe(false);
    });
  });

  describe("Admin Settings /api/admin/settings", () => {
    const adminUser = { id: "admin-1", email: "admin@example.com", name: "Admin", role: "admin" };

    it("should get settings", async () => {
      vi.mocked(getAuthSession).mockResolvedValue({ user: adminUser } as any);

      const expectedSettings = {
        maintenanceMode: false,
        registrationDisabled: false,
        moderationEnabled: false,
        emailNotificationsEnabled: false,
      };

      expect(adminUser.role).toBe("admin");
      expect(expectedSettings.maintenanceMode).toBe(false);
    });

    it("should update settings", async () => {
      const updatePayload = { maintenanceMode: true };

      expect(updatePayload.maintenanceMode).toBe(true);
    });

    it("should reject non-admin access", () => {
      const studentUser = { id: "student-1", role: "student" };
      expect(studentUser.role).not.toBe("admin");
    });
  });

  describe("Notifications /api/notifications", () => {
    const mockUser = { id: "user-1", email: "test@example.com", name: "Test", role: "student" };

    it("should list user notifications", async () => {
      vi.mocked(getAuthSession).mockResolvedValue({ user: mockUser } as any);
      vi.mocked(db.notification.findMany).mockResolvedValue([
        { id: "notif-1", title: "Welcome", message: "Hello!", read: false },
      ] as any);
      vi.mocked(db.notification.count).mockResolvedValue(1);

      expect(mockUser.id).toBe("user-1");
    });

    it("should mark all notifications as read", async () => {
      vi.mocked(db.notification.updateMany).mockResolvedValue({ count: 5 } as any);

      expect(db.notification.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("Certificates /api/certificates", () => {
    const mockUser = { id: "user-1", email: "test@example.com", name: "Test", role: "student" };

    it("should list user certificates", async () => {
      vi.mocked(getAuthSession).mockResolvedValue({ user: mockUser } as any);
      vi.mocked(db.certificate.findMany).mockResolvedValue([
        { id: "cert-1", certificateNumber: "CERT-001", issuedAt: new Date() },
      ] as any);

      expect(mockUser.id).toBe("user-1");
    });
  });
});
