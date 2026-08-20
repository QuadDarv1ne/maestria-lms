/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDb, mockCreateNotification } = vi.hoisted(() => {
  const mock = {
    course: { findFirst: vi.fn(), findUnique: vi.fn() },
    lesson: { findUnique: vi.fn() },
    enrollment: { findUnique: vi.fn() },
    lessonComment: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  return { mockDb: mock, mockCreateNotification: vi.fn().mockResolvedValue({ id: "notif-1" }) };
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
  RATE_LIMITS: { default: { windowMs: 60_000, maxRequests: 30 }, commentCreate: { windowMs: 60_000, maxRequests: 15 } },
}));

vi.mock("@/lib/notifications", () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
}));

vi.mock("@/lib/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/api-errors", () => ({
  handleApiError: vi.fn((error: unknown) =>
    new Response(JSON.stringify({ error: String(error) }), { status: 500 }),
  ),
}));

import { getAuthSession } from "@/lib/auth";
import { NextRequest } from "next/server";
import { POST, GET } from "@/app/api/courses/[id]/lessons/[lessonId]/comments/route";
import { PATCH, DELETE } from "@/app/api/courses/[id]/lessons/[lessonId]/comments/[commentId]/route";

const COURSE_ID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const LESSON_ID = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const COMMENT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const studentSession = { user: { id: "user-1", name: "Student", role: "student" } };
const otherSession = { user: { id: "user-2", name: "Other", role: "student" } };
const teacherSession = { user: { id: "teacher-1", name: "Teacher", role: "teacher" } };

const courseRow = { id: COURSE_ID, title: "Test Course", teacherId: "teacher-1" };
const lessonRow = { id: LESSON_ID, module: { courseId: COURSE_ID }, isFree: false };

function commentsUrl() {
  return `http://localhost/api/courses/${COURSE_ID}/lessons/${LESSON_ID}/comments`;
}

function commentUrl() {
  return `http://localhost/api/courses/${COURSE_ID}/lessons/${LESSON_ID}/comments/${COMMENT_ID}`;
}

function makeJsonRequest(url: string, method: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockDb.course.findFirst.mockResolvedValue(courseRow);
  mockDb.lesson.findUnique.mockResolvedValue(lessonRow);
  mockDb.enrollment.findUnique.mockResolvedValue({ status: "active" });
  mockDb.course.findUnique.mockResolvedValue(courseRow);
});

describe("GET /comments", () => {
  it("returns 404 when course is missing", async () => {
    mockDb.course.findFirst.mockResolvedValue(null);
    const res = await GET(new NextRequest(commentsUrl()), { params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID }) });
    expect(res.status).toBe(404);
  });

  it("returns 404 when lesson belongs to another course", async () => {
    mockDb.lesson.findUnique.mockResolvedValue({ id: LESSON_ID, module: { courseId: "other" }, isFree: false });
    const res = await GET(new NextRequest(commentsUrl()), { params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID }) });
    expect(res.status).toBe(404);
  });

  it("returns 403 for non-enrolled user on paid lesson", async () => {
    (getAuthSession as any).mockResolvedValue(studentSession);
    mockDb.enrollment.findUnique.mockResolvedValue(null);
    const res = await GET(new NextRequest(commentsUrl()), { params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID }) });
    expect(res.status).toBe(403);
  });

  it("lists comments for enrolled user", async () => {
    (getAuthSession as any).mockResolvedValue(studentSession);
    mockDb.lessonComment.findMany.mockResolvedValue([{ id: COMMENT_ID, content: "Hello" }]);
    mockDb.lessonComment.count.mockResolvedValue(1);
    const res = await GET(new NextRequest(commentsUrl()), { params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID }) });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.comments).toHaveLength(1);
    expect(data.pagination.total).toBe(1);
  });
});

describe("POST /comments", () => {
  it("returns 401 for unauthenticated user", async () => {
    (getAuthSession as any).mockResolvedValue(null);
    const res = await POST(makeJsonRequest(commentsUrl(), "POST", { content: "hello" }), {
      params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 for empty content", async () => {
    (getAuthSession as any).mockResolvedValue(studentSession);
    const res = await POST(makeJsonRequest(commentsUrl(), "POST", { content: "   " }), {
      params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID }),
    });
    expect(res.status).toBe(400);
  });

  it("creates a comment and notifies the course teacher", async () => {
    (getAuthSession as any).mockResolvedValue(studentSession);
    mockDb.lessonComment.create.mockResolvedValue({ id: COMMENT_ID, content: "hello" });
    const res = await POST(makeJsonRequest(commentsUrl(), "POST", { content: "hello" }), {
      params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID }),
    });
    expect(res.status).toBe(201);
    expect(mockDb.lessonComment.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ lessonId: LESSON_ID, userId: "user-1", content: "hello", parentId: null }),
    }));
    expect(mockCreateNotification).toHaveBeenCalledWith(expect.objectContaining({
      userId: "teacher-1",
      type: "comment",
    }));
  });

  it("rejects a reply whose parent belongs to another lesson", async () => {
    (getAuthSession as any).mockResolvedValue(studentSession);
    mockDb.lessonComment.findUnique.mockResolvedValue({ id: "other", lessonId: "different-lesson", userId: "x", parentId: null });
    const res = await POST(makeJsonRequest(commentsUrl(), "POST", { content: "reply", parentId: "dddddddd-dddd-4ddd-9ddd-dddddddddddd" }), {
      params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID }),
    });
    expect(res.status).toBe(400);
  });

  it("rejects a reply to a reply", async () => {
    (getAuthSession as any).mockResolvedValue(studentSession);
    mockDb.lessonComment.findUnique.mockResolvedValue({ id: "parent", lessonId: LESSON_ID, userId: "x", parentId: "grandparent" });
    const res = await POST(makeJsonRequest(commentsUrl(), "POST", { content: "reply", parentId: "dddddddd-dddd-4ddd-9ddd-dddddddddddd" }), {
      params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID }),
    });
    expect(res.status).toBe(400);
  });
});

describe("PATCH /comments/[commentId]", () => {
  const commentRow = {
    id: COMMENT_ID,
    lessonId: LESSON_ID,
    userId: "user-1",
    lesson: { module: { courseId: COURSE_ID } },
  };

  beforeEach(() => {
    mockDb.lessonComment.findUnique.mockResolvedValue(commentRow);
  });

  it("returns 401 for unauthenticated user", async () => {
    (getAuthSession as any).mockResolvedValue(null);
    const res = await PATCH(makeJsonRequest(commentUrl(), "PATCH", { content: "updated" }), {
      params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID, commentId: COMMENT_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 403 when editing someone else's comment", async () => {
    (getAuthSession as any).mockResolvedValue(otherSession);
    const res = await PATCH(makeJsonRequest(commentUrl(), "PATCH", { content: "updated" }), {
      params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID, commentId: COMMENT_ID }),
    });
    expect(res.status).toBe(403);
  });

  it("allows the owner to edit and marks isEdited", async () => {
    (getAuthSession as any).mockResolvedValue(studentSession);
    mockDb.lessonComment.update.mockResolvedValue({ id: COMMENT_ID, content: "updated", isEdited: true });
    const res = await PATCH(makeJsonRequest(commentUrl(), "PATCH", { content: "updated" }), {
      params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID, commentId: COMMENT_ID }),
    });
    expect(res.status).toBe(200);
    expect(mockDb.lessonComment.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ content: "updated", isEdited: true }),
    }));
  });

  it("allows the course teacher to edit", async () => {
    (getAuthSession as any).mockResolvedValue(teacherSession);
    mockDb.lessonComment.update.mockResolvedValue({ id: COMMENT_ID, content: "updated", isEdited: true });
    const res = await PATCH(makeJsonRequest(commentUrl(), "PATCH", { content: "updated" }), {
      params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID, commentId: COMMENT_ID }),
    });
    expect(res.status).toBe(200);
  });
});

describe("DELETE /comments/[commentId]", () => {
  const commentRow = {
    id: COMMENT_ID,
    lessonId: LESSON_ID,
    userId: "user-1",
    lesson: { module: { courseId: COURSE_ID } },
  };

  beforeEach(() => {
    mockDb.lessonComment.findUnique.mockResolvedValue(commentRow);
  });

  it("returns 403 when deleting someone else's comment", async () => {
    (getAuthSession as any).mockResolvedValue(otherSession);
    const res = await DELETE(new NextRequest(commentUrl(), { method: "DELETE" }), {
      params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID, commentId: COMMENT_ID }),
    });
    expect(res.status).toBe(403);
  });

  it("allows the owner to delete", async () => {
    (getAuthSession as any).mockResolvedValue(studentSession);
    mockDb.lessonComment.delete.mockResolvedValue({ id: COMMENT_ID });
    const res = await DELETE(new NextRequest(commentUrl(), { method: "DELETE" }), {
      params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID, commentId: COMMENT_ID }),
    });
    expect(res.status).toBe(200);
    expect(mockDb.lessonComment.delete).toHaveBeenCalledWith({ where: { id: COMMENT_ID } });
  });

  it("returns 404 when comment belongs to another lesson", async () => {
    (getAuthSession as any).mockResolvedValue(studentSession);
    mockDb.lessonComment.findUnique.mockResolvedValue({ ...commentRow, lessonId: "other-lesson" });
    const res = await DELETE(new NextRequest(commentUrl(), { method: "DELETE" }), {
      params: Promise.resolve({ id: COURSE_ID, lessonId: LESSON_ID, commentId: COMMENT_ID }),
    });
    expect(res.status).toBe(404);
  });
});
