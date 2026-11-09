// @vitest-environment node
/**
 * Route-level tests for POST /api/courses/[id]/assignments/[assignmentId].
 *
 * Covers the access checks added on top of the submit path: a cancelled
 * enrolment is rejected, the server-side time limit refuses late answers, and
 * the attempt-limit outcome from createSubmissionWithinAttemptLimit is mapped
 * to a 403 instead of being stored.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockDb, mockCreateSubmission, mockHandleApiError } = vi.hoisted(() => ({
  mockDb: {
    course: { findFirst: vi.fn() },
    assignment: { findFirst: vi.fn() },
    enrollment: { findUnique: vi.fn() },
    assignmentSubmission: { findFirst: vi.fn(), count: vi.fn() },
    progress: { findUnique: vi.fn() },
  },
  mockCreateSubmission: vi.fn(),
  mockHandleApiError: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: mockDb,
  Prisma: { TransactionIsolationLevel: { Serializable: "Serializable" } },
}));

vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(),
  requireAuth: vi.fn((session: { user?: unknown } | null) => Boolean(session?.user)),
  authErrorResponse: vi.fn(
    () => new Response(JSON.stringify({ error: "Необходимо авторизоваться" }), { status: 401 }),
  ),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => () => null,
  RATE_LIMITS: { default: { windowMs: 60_000, maxRequests: 10 } },
}));

vi.mock("@/lib/api-errors", () => ({
  handleApiError: (...args: unknown[]) => mockHandleApiError(...args),
}));

vi.mock("@/lib/assignment-submission", () => ({
  createSubmissionWithinAttemptLimit: (...args: unknown[]) => mockCreateSubmission(...args),
}));

import { getAuthSession } from "@/lib/auth";
import { POST } from "@/app/api/courses/[id]/assignments/[assignmentId]/route";

const COURSE_ID = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const ASSIGNMENT_ID = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";
const LESSON_ID = "cccccccc-cccc-4ccc-cccc-cccccccccccc";

const baseAssignment = {
  id: ASSIGNMENT_ID,
  type: "quiz",
  title: "Тест",
  points: 100,
  maxAttempts: 3,
  timeLimit: null,
  correctAnswer: JSON.stringify(["0"]),
  options: JSON.stringify(["Вариант 1", "Вариант 2"]),
  lesson: { id: LESSON_ID, module: {} },
};

const session = { user: { id: "user-1", name: "Студент" } };

function submitRequest(body: unknown = { answer: "0" }) {
  return new NextRequest(
    `http://localhost/api/courses/${COURSE_ID}/assignments/${ASSIGNMENT_ID}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function submitContext() {
  return { params: Promise.resolve({ id: COURSE_ID, assignmentId: ASSIGNMENT_ID }) };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthSession).mockResolvedValue(session as never);
  mockDb.course.findFirst.mockResolvedValue({ id: COURSE_ID });
  mockDb.assignment.findFirst.mockResolvedValue(baseAssignment);
  mockDb.enrollment.findUnique.mockResolvedValue({ status: "active" });
  mockDb.assignmentSubmission.findFirst.mockResolvedValue(null);
  mockDb.progress.findUnique.mockResolvedValue(null);
  mockCreateSubmission.mockResolvedValue({
    submission: { id: "sub-1", status: "graded", score: 100 },
  });
  mockHandleApiError.mockReturnValue(
    new Response(JSON.stringify({ error: "internal" }), { status: 500 }),
  );
});

describe("POST /api/courses/[id]/assignments/[assignmentId]", () => {
  it("requires authentication", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const res = await POST(submitRequest(), submitContext());
    expect(res.status).toBe(401);
    expect(mockDb.enrollment.findUnique).not.toHaveBeenCalled();
  });

  it("returns 404 when the course does not exist", async () => {
    mockDb.course.findFirst.mockResolvedValue(null);

    const res = await POST(submitRequest(), submitContext());
    expect(res.status).toBe(404);
  });

  it("returns 404 when the assignment is not in the course", async () => {
    mockDb.assignment.findFirst.mockResolvedValue(null);

    const res = await POST(submitRequest(), submitContext());
    expect(res.status).toBe(404);
    expect(mockDb.enrollment.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a student without an enrolment", async () => {
    mockDb.enrollment.findUnique.mockResolvedValue(null);

    const res = await POST(submitRequest(), submitContext());
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.code).toBe("enrollment_required");
    expect(mockCreateSubmission).not.toHaveBeenCalled();
  });

  it("rejects a cancelled enrolment", async () => {
    mockDb.enrollment.findUnique.mockResolvedValue({ status: "cancelled" });

    const res = await POST(submitRequest(), submitContext());
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.code).toBe("enrollment_required");
    expect(mockCreateSubmission).not.toHaveBeenCalled();
  });

  it("rejects an answer past the server-side time limit", async () => {
    mockDb.assignment.findFirst.mockResolvedValue({ ...baseAssignment, timeLimit: 30 });
    // The first attempt was 2 hours ago, so a 30-minute limit is long gone.
    mockDb.assignmentSubmission.findFirst.mockResolvedValue({
      submittedAt: new Date(Date.now() - 2 * 60 * 60_000),
    });

    const res = await POST(submitRequest(), submitContext());
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.code).toBe("time_limit_exceeded");
    expect(body.timeLimit).toBe(30);
    expect(mockCreateSubmission).not.toHaveBeenCalled();
  });

  it("accepts an answer while the time limit is still running", async () => {
    mockDb.assignment.findFirst.mockResolvedValue({ ...baseAssignment, timeLimit: 30 });
    mockDb.assignmentSubmission.findFirst.mockResolvedValue({
      submittedAt: new Date(Date.now() - 5 * 60_000),
    });

    const res = await POST(submitRequest(), submitContext());
    expect(res.status).toBe(200);
    expect(mockCreateSubmission).toHaveBeenCalledTimes(1);
  });

  it("uses the lesson lastAccessed as the clock when there is no attempt yet", async () => {
    mockDb.assignment.findFirst.mockResolvedValue({ ...baseAssignment, timeLimit: 30 });
    mockDb.progress.findUnique.mockResolvedValue({
      lastAccessed: new Date(Date.now() - 45 * 60_000),
    });

    const res = await POST(submitRequest(), submitContext());
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.code).toBe("time_limit_exceeded");
  });

  it("does not enforce a clock when nothing anchors the attempt", async () => {
    // Known gap, asserted so it does not silently change: without a previous
    // submission or a Progress row there is no start time, so the first attempt
    // is allowed through.
    mockDb.assignment.findFirst.mockResolvedValue({ ...baseAssignment, timeLimit: 30 });

    const res = await POST(submitRequest(), submitContext());
    expect(res.status).toBe(200);
    expect(mockCreateSubmission).toHaveBeenCalledTimes(1);
  });

  it("maps the attempt-limit outcome to 403 without storing anything", async () => {
    mockCreateSubmission.mockResolvedValue({ limitExceeded: true, attemptCount: 3 });

    const res = await POST(submitRequest(), submitContext());
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.code).toBe("attempt_limit_exceeded");
    expect(body.maxAttempts).toBe(3);
    expect(body.attemptCount).toBe(3);
  });

  it("passes the answer through the attempt-limited helper", async () => {
    const res = await POST(submitRequest({ answer: "1" }), submitContext());
    expect(res.status).toBe(200);

    const arg = mockCreateSubmission.mock.calls[0][0];
    expect(arg.assignmentId).toBe(ASSIGNMENT_ID);
    expect(arg.userId).toBe("user-1");
    expect(arg.maxAttempts).toBe(3);
    expect(arg.data.answer).toBe("1");
  });

  it("rejects an invalid body before touching the limit helper", async () => {
    const res = await POST(submitRequest({ answer: 123 }), submitContext());
    expect(res.status).toBe(400);
    expect(mockCreateSubmission).not.toHaveBeenCalled();
  });

  it("serializes an array answer to JSON before grading", async () => {
    const res = await POST(submitRequest({ answer: ["0", "1"] }), submitContext());
    expect(res.status).toBe(200);

    const arg = mockCreateSubmission.mock.calls[0][0];
    expect(arg.data.answer).toBe(JSON.stringify(["0", "1"]));
  });
});
