import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";

export type LessonAccessData = {
  lessonId: string;
  courseId: string;
  isEnrolled: boolean;
  isFree: boolean;
  courseTeacherId: string | null;
  courseTitle: string;
};

export type LessonAccessResult =
  | { data: LessonAccessData }
  | { response: NextResponse };

type ResolvedContext = {
  course: { id: string; teacherId: string | null; title: string };
  lessonId: string;
  isFree: boolean;
};

const lessonNotFound = () =>
  NextResponse.json({ error: "Шаг не найден" }, { status: 404 });

/**
 * Resolve a lesson inside a course (supports UUID or slug for the course).
 * Returns an error response when the course or lesson is missing.
 */
async function resolveCourseLesson(courseIdOrSlug: string, lessonId: string): Promise<ResolvedContext | null> {
  const course = await db.course.findFirst({
    where: { OR: [{ id: courseIdOrSlug }, { slug: courseIdOrSlug }] },
    select: { id: true, teacherId: true, title: true },
  });

  if (!course) return null;

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { select: { courseId: true } } },
  });

  if (!lesson || !lesson.module || lesson.module.courseId !== course.id) return null;

  return {
    course: { id: course.id, teacherId: course.teacherId, title: course.title },
    lessonId: lesson.id,
    isFree: lesson.isFree,
  };
}

async function checkEnrollment(userId: string, courseId: string): Promise<boolean> {
  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { status: true },
  });
  return !!enrollment && enrollment.status === "active";
}

/**
 * Resolve access to a lesson for the current user: enrolled users and free
 * lessons are allowed, as well as the course teacher and admins.
 * Returns a NextResponse error when the lesson is missing or locked.
 */
export async function resolveLessonAccess(
  courseId: string,
  lessonId: string,
): Promise<LessonAccessResult> {
  const ctx = await resolveCourseLesson(courseId, lessonId);
  if (!ctx) return { response: lessonNotFound() };

  let isEnrolled = false;
  const session = await getAuthSession();
  if (session?.user) {
    isEnrolled = await checkEnrollment(session.user.id, ctx.course.id);
  }

  const isManager = session?.user
    ? session.user.role === "admin" || ctx.course.teacherId === session.user.id
    : false;

  if (!ctx.isFree && !isEnrolled && !isManager) {
    return {
      response: NextResponse.json(
        { error: "Запишитесь на курс для доступа к этому материалу" },
        { status: 403 },
      ),
    };
  }

  return {
    data: {
      lessonId: ctx.lessonId,
      courseId: ctx.course.id,
      isEnrolled,
      isFree: ctx.isFree,
      courseTeacherId: ctx.course.teacherId,
      courseTitle: ctx.course.title,
    },
  };
}

/**
 * Resolve a lesson for management purposes (upload/delete attachments).
 * Only the course teacher or an admin may manage. The caller is responsible
 * for authentication (returns 403/404 otherwise).
 */
export async function resolveLessonManageAccess(
  courseId: string,
  lessonId: string,
): Promise<LessonAccessResult> {
  const ctx = await resolveCourseLesson(courseId, lessonId);
  if (!ctx) return { response: lessonNotFound() };

  const session = await getAuthSession();
  if (!session?.user) {
    return { response: lessonNotFound() };
  }

  const isManager =
    session.user.role === "admin" || ctx.course.teacherId === session.user.id;

  if (!isManager) {
    return {
      response: NextResponse.json(
        { error: "Нет прав для управления файлами урока" },
        { status: 403 },
      ),
    };
  }

  return {
    data: {
      lessonId: ctx.lessonId,
      courseId: ctx.course.id,
      isEnrolled: false,
      isFree: ctx.isFree,
      courseTeacherId: ctx.course.teacherId,
      courseTitle: ctx.course.title,
    },
  };
}
