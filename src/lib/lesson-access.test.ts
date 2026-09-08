import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { resolveLessonAccess, resolveLessonManageAccess } from "./lesson-access";

// Mock dependencies
vi.mock("./db", () => ({
  db: {
    course: {
      findFirst: vi.fn(),
    },
    lesson: {
      findUnique: vi.fn(),
    },
    enrollment: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("./auth", () => ({
  getAuthSession: vi.fn(),
}));

const mockDb = await import("./db").then((m) => ({
  course: m.db.course as Mock,
  lesson: m.db.lesson as Mock,
  enrollment: m.db.enrollment as Mock,
}));
const mockGetAuthSession = await import("./auth").then((m) => m.getAuthSession as Mock);

describe("resolveLessonAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.course.findFirst.mockResolvedValue(null);
    mockDb.lesson.findUnique.mockResolvedValue(null);
    mockDb.enrollment.findUnique.mockResolvedValue(null);
    (mockGetAuthSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 404 when course not found", async () => {
    mockDb.course.findFirst.mockResolvedValueOnce(null);

    const result = await resolveLessonAccess("nonexistent-course", "lesson-1");

    expect(result).toHaveProperty("response");
    const response = (result as { response: Response }).response as Response;
    expect(response.status).toBe(404);
  });

  it("returns 404 when lesson does not belong to the course", async () => {
    mockDb.course.findFirst.mockResolvedValueOnce({
      id: "course-1",
      teacherId: "teacher-1",
      title: "Test Course",
    });
    mockDb.lesson.findUnique.mockResolvedValueOnce({
      id: "lesson-1",
      isFree: false,
      module: { courseId: "course-2" }, // different course
    });

    const result = await resolveLessonAccess("course-1", "lesson-1");

    expect(result).toHaveProperty("response");
    const response = (result as { response: Response }).response as Response;
    expect(response.status).toBe(404);
  });

  it("returns 404 when lesson has no module", async () => {
    mockDb.course.findFirst.mockResolvedValueOnce({
      id: "course-1",
      teacherId: "teacher-1",
      title: "Test Course",
    });
    mockDb.lesson.findUnique.mockResolvedValueOnce({
      id: "lesson-1",
      isFree: false,
      module: null,
    });

    const result = await resolveLessonAccess("course-1", "lesson-1");

    expect(result).toHaveProperty("response");
    const response = (result as { response: Response }).response as Response;
    expect(response.status).toBe(404);
  });

  it("allows access to free lessons without enrollment", async () => {
    mockDb.course.findFirst.mockResolvedValueOnce({
      id: "course-1",
      teacherId: "teacher-1",
      title: "Test Course",
    });
    mockDb.lesson.findUnique.mockResolvedValueOnce({
      id: "lesson-1",
      isFree: true,
      module: { courseId: "course-1" },
    });

    const result = await resolveLessonAccess("course-1", "lesson-1");

    expect(result).toHaveProperty("data");
    const data = (result as { data: unknown }).data as {
      lessonId: string;
      courseId: string;
      isEnrolled: boolean;
      isFree: boolean;
      courseTeacherId: string | null;
      courseTitle: string;
    };
    expect(data.isFree).toBe(true);
    expect(data.isEnrolled).toBe(false);
    expect(data.courseTitle).toBe("Test Course");
  });

  it("allows access for enrolled users to paid lessons", async () => {
    mockDb.course.findFirst.mockResolvedValueOnce({
      id: "course-1",
      teacherId: "teacher-1",
      title: "Test Course",
    });
    mockDb.lesson.findUnique.mockResolvedValueOnce({
      id: "lesson-1",
      isFree: false,
      module: { courseId: "course-1" },
    });
    mockDb.enrollment.findUnique.mockResolvedValueOnce({
      status: "active",
    });
    (mockGetAuthSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: { id: "user-1", role: "student" },
    });

    const result = await resolveLessonAccess("course-1", "lesson-1");

    expect(result).toHaveProperty("data");
    const data = (result as { data: unknown }).data as { isEnrolled: boolean };
    expect(data.isEnrolled).toBe(true);
  });

  it("denies access for non-enrolled users to paid lessons", async () => {
    mockDb.course.findFirst.mockResolvedValueOnce({
      id: "course-1",
      teacherId: "teacher-1",
      title: "Test Course",
    });
    mockDb.lesson.findUnique.mockResolvedValueOnce({
      id: "lesson-1",
      isFree: false,
      module: { courseId: "course-1" },
    });
    mockDb.enrollment.findUnique.mockResolvedValueOnce(null);
    (mockGetAuthSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: { id: "user-1", role: "student" },
    });

    const result = await resolveLessonAccess("course-1", "lesson-1");

    expect(result).toHaveProperty("response");
    const response = (result as { response: Response }).response as Response;
    expect(response.status).toBe(403);
  });

  it("allows course teacher access to paid lessons", async () => {
    mockDb.course.findFirst.mockResolvedValueOnce({
      id: "course-1",
      teacherId: "teacher-1",
      title: "Test Course",
    });
    mockDb.lesson.findUnique.mockResolvedValueOnce({
      id: "lesson-1",
      isFree: false,
      module: { courseId: "course-1" },
    });
    (mockGetAuthSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: { id: "teacher-1", role: "teacher" },
    });

    const result = await resolveLessonAccess("course-1", "lesson-1");

    expect(result).toHaveProperty("data");
  });

  it("allows admin access to any paid lesson", async () => {
    mockDb.course.findFirst.mockResolvedValueOnce({
      id: "course-1",
      teacherId: "teacher-1",
      title: "Test Course",
    });
    mockDb.lesson.findUnique.mockResolvedValueOnce({
      id: "lesson-1",
      isFree: false,
      module: { courseId: "course-1" },
    });
    (mockGetAuthSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: { id: "admin-1", role: "admin" },
    });

    const result = await resolveLessonAccess("course-1", "lesson-1");

    expect(result).toHaveProperty("data");
  });

  it("supports course resolution by slug", async () => {
    mockDb.course.findFirst.mockResolvedValueOnce({
      id: "course-1",
      teacherId: "teacher-1",
      title: "Test Course",
    });
    mockDb.lesson.findUnique.mockResolvedValueOnce({
      id: "lesson-1",
      isFree: true,
      module: { courseId: "course-1" },
    });

    const result = await resolveLessonAccess("my-course-slug", "lesson-1");

    expect(result).toHaveProperty("data");
    expect(mockDb.course.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ id: "my-course-slug" }, { slug: "my-course-slug" }] },
      select: { id: true, teacherId: true, title: true },
    });
  });

  it("returns 403 with correct error message for non-enrolled paid lesson", async () => {
    mockDb.course.findFirst.mockResolvedValueOnce({
      id: "course-1",
      teacherId: "teacher-1",
      title: "Test Course",
    });
    mockDb.lesson.findUnique.mockResolvedValueOnce({
      id: "lesson-1",
      isFree: false,
      module: { courseId: "course-1" },
    });
    mockDb.enrollment.findUnique.mockResolvedValueOnce(null);
    (mockGetAuthSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: { id: "user-1", role: "student" },
    });

    const result = await resolveLessonAccess("course-1", "lesson-1");

    const response = (result as { response: Response }).response as Response;
    const body = await response.json() as { error: string };
    expect(body.error).toBe("Запишитесь на курс для доступа к этому материалу");
  });
});

describe("resolveLessonManageAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.course.findFirst.mockResolvedValue(null);
    mockDb.lesson.findUnique.mockResolvedValue(null);
    (mockGetAuthSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 404 when course not found", async () => {
    mockDb.course.findFirst.mockResolvedValueOnce(null);

    const result = await resolveLessonManageAccess("nonexistent", "lesson-1");

    expect(result).toHaveProperty("response");
    const response = (result as { response: Response }).response as Response;
    expect(response.status).toBe(404);
  });

  it("returns 404 when user is not authenticated", async () => {
    mockDb.course.findFirst.mockResolvedValueOnce({
      id: "course-1",
      teacherId: "teacher-1",
      title: "Test Course",
    });
    mockDb.lesson.findUnique.mockResolvedValueOnce({
      id: "lesson-1",
      isFree: false,
      module: { courseId: "course-1" },
    });
    (mockGetAuthSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);

    const result = await resolveLessonManageAccess("course-1", "lesson-1");

    expect(result).toHaveProperty("response");
    const response = (result as { response: Response }).response as Response;
    expect(response.status).toBe(404);
  });

  it("allows course teacher to manage", async () => {
    mockDb.course.findFirst.mockResolvedValueOnce({
      id: "course-1",
      teacherId: "teacher-1",
      title: "Test Course",
    });
    mockDb.lesson.findUnique.mockResolvedValueOnce({
      id: "lesson-1",
      isFree: false,
      module: { courseId: "course-1" },
    });
    (mockGetAuthSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: { id: "teacher-1", role: "teacher" },
    });

    const result = await resolveLessonManageAccess("course-1", "lesson-1");

    expect(result).toHaveProperty("data");
    const data = (result as { data: unknown }).data as {
      isEnrolled: boolean;
      isFree: boolean;
    };
    expect(data.isEnrolled).toBe(false);
  });

  it("allows admin to manage any lesson", async () => {
    mockDb.course.findFirst.mockResolvedValueOnce({
      id: "course-1",
      teacherId: "teacher-1",
      title: "Test Course",
    });
    mockDb.lesson.findUnique.mockResolvedValueOnce({
      id: "lesson-1",
      isFree: false,
      module: { courseId: "course-1" },
    });
    (mockGetAuthSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: { id: "admin-1", role: "admin" },
    });

    const result = await resolveLessonManageAccess("course-1", "lesson-1");

    expect(result).toHaveProperty("data");
  });

  it("denies regular student manage access", async () => {
    mockDb.course.findFirst.mockResolvedValueOnce({
      id: "course-1",
      teacherId: "teacher-1",
      title: "Test Course",
    });
    mockDb.lesson.findUnique.mockResolvedValueOnce({
      id: "lesson-1",
      isFree: false,
      module: { courseId: "course-1" },
    });
    (mockGetAuthSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: { id: "user-1", role: "student" },
    });

    const result = await resolveLessonManageAccess("course-1", "lesson-1");

    expect(result).toHaveProperty("response");
    const response = (result as { response: Response }).response as Response;
    expect(response.status).toBe(403);
    const body = await response.json() as { error: string };
    expect(body.error).toBe("Нет прав для управления файлами урока");
  });

  it("denies non-course teacher manage access", async () => {
    mockDb.course.findFirst.mockResolvedValueOnce({
      id: "course-1",
      teacherId: "teacher-1",
      title: "Test Course",
    });
    mockDb.lesson.findUnique.mockResolvedValueOnce({
      id: "lesson-1",
      isFree: false,
      module: { courseId: "course-1" },
    });
    (mockGetAuthSession as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      user: { id: "other-teacher", role: "teacher" },
    });

    const result = await resolveLessonManageAccess("course-1", "lesson-1");

    expect(result).toHaveProperty("response");
    const response = (result as { response: Response }).response as Response;
    expect(response.status).toBe(403);
  });
});
