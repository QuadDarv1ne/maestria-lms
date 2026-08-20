// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDb, mockUploadFileToS3, mockDeleteFileFromS3 } = vi.hoisted(() => {
  const mock = {
    course: { findFirst: vi.fn(), findUnique: vi.fn() },
    lesson: { findUnique: vi.fn() },
    enrollment: { findUnique: vi.fn() },
    lessonAttachment: {
      findMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  };
  return {
    mockDb: mock,
    mockUploadFileToS3: vi.fn(),
    mockDeleteFileFromS3: vi.fn(),
  };
});

vi.mock("@/lib/db", () => ({ db: mockDb }));

vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(),
  requireAuth: vi.fn((s: any) => !!s?.user),
  authErrorResponse: vi.fn(() =>
    new Response(JSON.stringify({ error: "Необходимо авторизоваться" }), { status: 401 }),
  ),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => () => null,
  RATE_LIMITS: { default: { windowMs: 60_000, maxRequests: 30 }, attachmentUpload: { windowMs: 60_000, maxRequests: 10 } },
}));

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/api-errors", () => ({
  handleApiError: vi.fn((error: unknown) =>
    new Response(JSON.stringify({ error: String(error) }), { status: 500 }),
  ),
}));

vi.mock("@/lib/file-upload", () => ({
  uploadFileToS3: (...args: unknown[]) => mockUploadFileToS3(...args),
  deleteFileFromS3: (...args: unknown[]) => mockDeleteFileFromS3(...args),
  UploadError: class UploadError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  },
}));

import { getAuthSession } from "@/lib/auth";
import { UploadError } from "@/lib/file-upload";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/courses/[id]/lessons/[lessonId]/attachments/route";
import { DELETE } from "@/app/api/courses/[id]/lessons/[lessonId]/attachments/[attachmentId]/route";

const COURSE_ID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const LESSON_ID = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const ATTACHMENT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const studentSession = { user: { id: "user-1", name: "Student", role: "student" } };
const teacherSession = { user: { id: "teacher-1", name: "Teacher", role: "teacher" } };

const courseRow = { id: COURSE_ID, title: "Test Course", teacherId: "teacher-1" };
const lessonRow = { id: LESSON_ID, module: { courseId: COURSE_ID }, isFree: false };

function attachmentsUrl() {
  return `http://localhost/api/courses/${COURSE_ID}/lessons/${LESSON_ID}/attachments`;
}

function attachmentUrl() {
  return `http://localhost/api/courses/${COURSE_ID}/lessons/${LESSON_ID}/attachments/${ATTACHMENT_ID}`;
}

async function makeUploadRequest(file?: File): Promise<NextRequest> {
  const formData = new FormData();
  if (file) formData.append("file", file);
  return new NextRequest(attachmentsUrl(), { method: "POST", body: formData });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.course.findFirst.mockResolvedValue(courseRow);
  mockDb.course.findUnique.mockResolvedValue(courseRow);
  mockDb.lesson.findUnique.mockResolvedValue(lessonRow);
  mockDb.enrollment.findUnique.mockResolvedValue({ status: "active" });
  mockUploadFileToS3.mockResolvedValue({
    key: "attachments/lesson/file.pdf",
    url: "https://cdn.example.com/attachments/lesson/file.pdf",
    size: 1000,
    type: "application/pdf",
  });
});

describe("GET /attachments", () => {
  it("returns 404 when course is missing", async () => {
    mockDb.course.findFirst.mockResolvedValue(null);
    const res = await GET(new NextRequest(attachmentsUrl()), {
      params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 404 when lesson belongs to another course", async () => {
    mockDb.lesson.findUnique.mockResolvedValue({ id: LESSON_ID, module: { courseId: "other" }, isFree: false });
    const res = await GET(new NextRequest(attachmentsUrl()), {
      params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 403 for non-enrolled user on paid lesson", async () => {
    (getAuthSession as any).mockResolvedValue(studentSession);
    mockDb.enrollment.findUnique.mockResolvedValue(null);
    const res = await GET(new NextRequest(attachmentsUrl()), {
      params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 200 with canManage=false for an enrolled student", async () => {
    (getAuthSession as any).mockResolvedValue(studentSession);
    mockDb.lessonAttachment.findMany.mockResolvedValue([{ id: ATTACHMENT_ID, name: "file.pdf" }]);
    const res = await GET(new NextRequest(attachmentsUrl()), {
      params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.attachments).toHaveLength(1);
    expect(data.canManage).toBe(false);
  });

  it("allows the course teacher to list and manage without enrollment", async () => {
    (getAuthSession as any).mockResolvedValue(teacherSession);
    mockDb.enrollment.findUnique.mockResolvedValue(null);
    mockDb.lessonAttachment.findMany.mockResolvedValue([]);
    const res = await GET(new NextRequest(attachmentsUrl()), {
      params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.canManage).toBe(true);
  });
});

describe("POST /attachments", () => {
  it("returns 401 for unauthenticated user", async () => {
    (getAuthSession as any).mockResolvedValue(null);
    const res = await POST(await makeUploadRequest(), {
      params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a student (not a manager)", async () => {
    (getAuthSession as any).mockResolvedValue(studentSession);
    const res = await POST(await makeUploadRequest(), {
      params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 when lesson is missing", async () => {
    (getAuthSession as any).mockResolvedValue(teacherSession);
    mockDb.lesson.findUnique.mockResolvedValue(null);
    const res = await POST(await makeUploadRequest(), {
      params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 400 when no file is provided", async () => {
    (getAuthSession as any).mockResolvedValue(teacherSession);
    const res = await POST(await makeUploadRequest(), {
      params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID }),
    });
    expect(res.status).toBe(400);
  });

  it("uploads a file and creates an attachment record", async () => {
    (getAuthSession as any).mockResolvedValue(teacherSession);
    mockDb.lessonAttachment.create.mockResolvedValue({ id: ATTACHMENT_ID, name: "notes.pdf" });
    const file = new File(["%PDF-1.4 fake"], "notes.pdf", { type: "application/pdf" });
    const res = await POST(await makeUploadRequest(file), {
      params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID }),
    });
    expect(res.status).toBe(201);
    expect(mockUploadFileToS3).toHaveBeenCalledWith(
      `attachments/${LESSON_ID}`,
      expect.objectContaining({ name: "notes.pdf", type: "application/pdf" }),
    );
    expect(mockDb.lessonAttachment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lessonId: LESSON_ID, name: "notes.pdf", addedById: "teacher-1" }),
      }),
    );
  });

  it("propagates upload errors as 4xx/5xx", async () => {
    (getAuthSession as any).mockResolvedValue(teacherSession);
    mockUploadFileToS3.mockRejectedValue(
      new UploadError("Тип application/x-executable не поддерживается", 400),
    );
    const file = new File(["MZ"], "app.exe", { type: "application/x-executable" });
    const res = await POST(await makeUploadRequest(file), {
      params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID }),
    });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("Тип application/x-executable не поддерживается");
  });
});

describe("DELETE /attachments/[attachmentId]", () => {
  const attachmentRow = { id: ATTACHMENT_ID, lessonId: LESSON_ID, key: "attachments/lesson/file.pdf" };

  beforeEach(() => {
    mockDb.lessonAttachment.findUnique.mockResolvedValue(attachmentRow);
  });

  it("returns 401 for unauthenticated user", async () => {
    (getAuthSession as any).mockResolvedValue(null);
    const res = await DELETE(new NextRequest(attachmentUrl(), { method: "DELETE" }), {
      params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID, attachmentId: ATTACHMENT_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a student", async () => {
    (getAuthSession as any).mockResolvedValue(studentSession);
    const res = await DELETE(new NextRequest(attachmentUrl(), { method: "DELETE" }), {
      params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID, attachmentId: ATTACHMENT_ID }),
    });
    expect(res.status).toBe(403);
  });

  it("returns 404 when the attachment belongs to another lesson", async () => {
    (getAuthSession as any).mockResolvedValue(teacherSession);
    mockDb.lessonAttachment.findUnique.mockResolvedValue({ ...attachmentRow, lessonId: "other-lesson" });
    const res = await DELETE(new NextRequest(attachmentUrl(), { method: "DELETE" }), {
      params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID, attachmentId: ATTACHMENT_ID }),
    });
    expect(res.status).toBe(404);
  });

  it("deletes the S3 object and the DB record", async () => {
    (getAuthSession as any).mockResolvedValue(teacherSession);
    mockDb.lessonAttachment.delete.mockResolvedValue({ id: ATTACHMENT_ID });
    const res = await DELETE(new NextRequest(attachmentUrl(), { method: "DELETE" }), {
      params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID, attachmentId: ATTACHMENT_ID }),
    });
    expect(res.status).toBe(200);
    expect(mockDeleteFileFromS3).toHaveBeenCalledWith("attachments/lesson/file.pdf");
    expect(mockDb.lessonAttachment.delete).toHaveBeenCalledWith({ where: { id: ATTACHMENT_ID } });
  });
});
