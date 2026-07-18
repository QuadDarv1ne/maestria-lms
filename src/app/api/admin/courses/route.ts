import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getAuthSession, requireAuth, requireAdmin, authErrorResponse, adminErrorResponse } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { parsePagination } from "@/lib/utils";
import { createCourseSchema, type ModuleInput, validatePrices } from "@/lib/course-validation";
import { sanitizeContent } from "@/lib/sanitize";
import { cacheInvalidateByTag } from "@/lib/cache";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("admin", RATE_LIMITS.admin);

type AssignmentInput = {
  title?: string;
  description?: string;
  type?: string;
  points?: string | number;
  options?: string | null;
  correctAnswer?: string | null;
  maxAttempts?: string | number | null;
};

const assignmentDataShape = (a: AssignmentInput) => ({
  title: a.title || "Задание",
  description: a.description || "",
  type: a.type || "quiz",
  points: Number(a.points) || 10,
  options: a.options || null,
  correctAnswer: a.correctAnswer || null,
  maxAttempts: a.maxAttempts ? Number(a.maxAttempts) : undefined,
});

const assignmentCreateData = (a: AssignmentInput, lessonId: string) => ({
  lessonId,
  ...assignmentDataShape(a),
});

const assignmentUpdateData = (a: AssignmentInput) => assignmentDataShape(a);

// GET: Все курсы (включая неопубликованные) — для админов
export async function GET(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;
  try {
    const session = await getAuthSession();
    if (!requireAdmin(session)) return adminErrorResponse();

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams, { defaultLimit: 20, maxLimit: 100 });
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const where: Prisma.CourseWhereInput = {};
    if (status === "published") where.isPublished = true;
    if (status === "unpublished") where.isPublished = false;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const [courses, total] = await Promise.all([
      db.course.findMany({
        where,
        include: {
          teacher: {
            select: { id: true, name: true, email: true, image: true },
          },
          category: {
            select: { id: true, name: true, slug: true },
          },
          _count: {
            select: {
              enrollments: true,
              modules: true,
              reviews: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.course.count({ where }),
    ]);

    return NextResponse.json({
      courses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, { status: 200 });
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/courses GET" });
  }
}

// POST: Создать новый курс с модулями и уроками
export async function POST(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const session = await getAuthSession();
    if (!requireAuth(session)) return authErrorResponse();

    const userRole = session.user.role;
    if (userRole !== "admin" && userRole !== "teacher") {
      return NextResponse.json(
        { error: "Доступ запрещён. Требуются права администратора или преподавателя" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createCourseSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 }
      );
    }

    const {
      title,
      slug,
      description,
      shortDesc,
      price = 0,
      oldPrice,
      level = "beginner",
      duration,
      isPublished = false,
      isFeatured = false,
      hasCertificate = true,
      tags,
      requirements,
      whatYouLearn,
      categoryId,
      modules = [],
      startDate,
      endDate,
      visibility = "public",
      maxStudents,
      prerequisites,
      language = "ru",
    } = validation.data;

    const parsedPrice = Number(price);
    const priceError = validatePrices(price, oldPrice);
    if (priceError) {
      return NextResponse.json(
        { error: priceError.error },
        { status: 400 }
      );
    }

    const userId = session.user.id;

    // Проверяем уникальность slug
    const existingCourse = await db.course.findUnique({
      where: { slug },
    });

    if (existingCourse) {
      return NextResponse.json(
        { error: "Курс с таким URL-идентификатором уже существует" },
        { status: 409 }
      );
    }

    // Ищем категорию по slug если передан slug, а не id
    let categoryConnect = categoryId || undefined;
    if (categoryId && !categoryId.startsWith("cl")) {
      // Это slug, а не id — найдём категорию
      const cat = await db.category.findUnique({ where: { slug: categoryId } });
      if (cat) categoryConnect = cat.id;
    }

    // Создаём курс с модулями и уроками
    const course = await db.course.create({
      data: {
        title,
        slug,
        description,
        shortDesc: shortDesc || null,
        price: parsedPrice,
        oldPrice: oldPrice ? Number(oldPrice) : null,
        level,
        duration: duration || null,
        isPublished,
        isFeatured,
        hasCertificate,
        tags: tags || null,
        requirements: requirements || null,
        whatYouLearn: whatYouLearn || null,
        categoryId: categoryConnect || null,
        teacherId: userId,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        visibility,
        maxStudents: maxStudents ? Number(maxStudents) : null,
        prerequisites: prerequisites || null,
        language,
        modules: {
          create: (modules as ModuleInput[]).map((mod, mIdx) => ({
            title: mod.title || `Модуль ${mIdx + 1}`,
            description: mod.description || null,
            sortOrder: mod.sortOrder || mIdx + 1,
            lessons: {
              create: (mod.lessons || []).map((lesson, lIdx) => ({
                title: lesson.title || `Урок ${lIdx + 1}`,
                type: lesson.type || "text",
                content: lesson.content ? sanitizeContent(lesson.content) : null,
                videoUrl: lesson.videoUrl || null,
                duration: Number(lesson.duration) || 0,
                sortOrder: lesson.sortOrder || lIdx + 1,
                isFree: lesson.isFree || false,
                assignments: lesson.assignments && lesson.assignments.length > 0 ? {
                  create: lesson.assignments.map((a) => assignmentDataShape(a)),
                } : undefined,
              })),
            },
          })),
        },
      },
      include: {
        teacher: {
          select: { id: true, name: true },
        },
        category: {
          select: { id: true, name: true },
        },
        modules: {
          include: {
            lessons: true,
          },
        },
      },
    });

    return NextResponse.json(
      { message: isPublished ? "Курс опубликован" : "Курс сохранён как черновик", course },
      { status: 201 }
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/courses POST" });
  }
}

// PUT: Обновить существующий курс с модулями и уроками
export async function PUT(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  let courseId: string | null = null;

  try {
    const session = await getAuthSession();
    if (!requireAuth(session)) return authErrorResponse();

    const userRole = session.user.role;
    if (userRole !== "admin" && userRole !== "teacher") {
      return NextResponse.json(
        { error: "Доступ запрещён. Требуются права администратора или преподавателя" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    courseId = searchParams.get("id");
    if (!courseId) {
      return NextResponse.json(
        { error: "ID курса обязателен" },
        { status: 400 }
      );
    }

    // Проверяем что курс существует и пользователь имеет право его редактировать
    const existingCourse = await db.course.findUnique({
      where: { id: courseId },
      include: { teacher: true },
    });

    if (!existingCourse) {
      return NextResponse.json(
        { error: "Курс не найден" },
        { status: 404 }
      );
    }

    if (userRole !== "admin" && existingCourse.teacherId !== session.user.id) {
      return NextResponse.json(
        { error: "Доступ запрещён. Вы можете редактировать только свои курсы" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validation = createCourseSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 }
      );
    }

    const {
      title,
      slug,
      description,
      shortDesc,
      price = 0,
      oldPrice,
      level = "beginner",
      duration,
      isPublished = false,
      isFeatured = false,
      hasCertificate = true,
      tags,
      requirements,
      whatYouLearn,
      categoryId,
      modules,
      startDate,
      endDate,
      visibility = "public",
      maxStudents,
      prerequisites,
      language = "ru",
    } = validation.data;

    const parsedPrice = Number(price);
    const priceError = validatePrices(price, oldPrice);
    if (priceError) {
      return NextResponse.json(
        { error: priceError.error },
        { status: 400 }
      );
    }

    // Проверяем уникальность slug если он изменился
    if (slug !== existingCourse.slug) {
      const slugExists = await db.course.findUnique({
        where: { slug },
      });
      if (slugExists) {
        return NextResponse.json(
          { error: "Курс с таким URL-идентификатором уже существует" },
          { status: 409 }
        );
      }
    }

    // Ищем категорию по slug если передан slug, а не id
    let categoryConnect = categoryId || undefined;
    if (categoryId && !categoryId.startsWith("cl")) {
      const cat = await db.category.findUnique({ where: { slug: categoryId } });
      if (cat) categoryConnect = cat.id;
    }

    // Обновляем курс
    await db.course.update({
      where: { id: courseId },
      data: {
        title,
        slug,
        description,
        shortDesc: shortDesc || null,
        price: parsedPrice,
        oldPrice: oldPrice ? Number(oldPrice) : null,
        level,
        duration: duration || null,
        isPublished,
        isFeatured,
        hasCertificate,
        tags: tags || null,
        requirements: requirements || null,
        whatYouLearn: whatYouLearn || null,
        categoryId: categoryConnect || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        visibility,
        maxStudents: maxStudents ? Number(maxStudents) : null,
        prerequisites: prerequisites || null,
        language,
      },
      include: {
        teacher: {
          select: { id: true, name: true },
        },
        category: {
          select: { id: true, name: true },
        },
      },
    });

    // Если переданы модули, обновляем их с сохранением существующих ID
    if (modules !== undefined) {
      const existingModules = await db.module.findMany({
        where: { courseId },
        include: { lessons: true },
        orderBy: { sortOrder: "asc" },
      });

      const existingModuleMap = new Map<string, (typeof existingModules)[number]>();
      for (const mod of existingModules) {
        existingModuleMap.set(mod.id, mod);
      }

      const incomingModuleIds = new Set<string>();
      for (const mod of modules as ModuleInput[]) {
        if (mod.id && existingModuleMap.has(mod.id)) {
          incomingModuleIds.add(mod.id);
        }
      }

      // Pre-fetch all assignments for existing lessons (eliminates N+1 in transaction)
      const existingLessonIds = existingModules.flatMap((m) => m.lessons.map((l) => l.id));
      const existingAssignments = existingLessonIds.length > 0
        ? await db.assignment.findMany({ where: { lessonId: { in: existingLessonIds } } })
        : [];
      const assignmentsByLesson = new Map<string, typeof existingAssignments>();
      for (const a of existingAssignments) {
        const list = assignmentsByLesson.get(a.lessonId) ?? [];
        list.push(a);
        assignmentsByLesson.set(a.lessonId, list);
      }

      await db.$transaction(async (tx) => {
        // Batch-update existing modules in parallel
        const moduleUpdates: Promise<unknown>[] = [];
        const moduleLessonData: { existingId: string; mod: ModuleInput; mIdx: number }[] = [];
        const newModules: { mod: ModuleInput; mIdx: number }[] = [];

        for (let mIdx = 0; mIdx < (modules as ModuleInput[]).length; mIdx++) {
          const mod = (modules as ModuleInput[])[mIdx];
          const existingId = mod.id && existingModuleMap.has(mod.id) ? mod.id : null;

          if (existingId) {
            moduleUpdates.push(
              tx.module.update({
                where: { id: existingId },
                data: {
                  title: mod.title || `Модуль ${mIdx + 1}`,
                  description: mod.description || null,
                  sortOrder: mod.sortOrder ?? mIdx + 1,
                },
              })
            );
            moduleLessonData.push({ existingId, mod, mIdx });
          } else {
            newModules.push({ mod, mIdx });
          }
        }
        await Promise.all(moduleUpdates);

        // Process lessons for existing modules (in parallel per module)
        const lessonOps: Promise<unknown>[] = [];
        for (const { existingId, mod } of moduleLessonData) {
          const existingMod = existingModuleMap.get(existingId);
          if (!existingMod) continue;

          const existingLessonMap = new Map<string, (typeof existingMod.lessons)[number]>();
          for (const lesson of existingMod.lessons) {
            existingLessonMap.set(lesson.id, lesson);
          }

          const incomingLessonIds = new Set<string>();
          for (const lesson of mod.lessons || []) {
            if (lesson.id && existingLessonMap.has(lesson.id)) {
              incomingLessonIds.add(lesson.id);
            }
          }

          for (let lIdx = 0; lIdx < (mod.lessons || []).length; lIdx++) {
            const lesson = (mod.lessons || [])[lIdx];
            const existingLessonId = lesson.id && existingLessonMap.has(lesson.id) ? lesson.id : null;

            if (existingLessonId) {
              lessonOps.push(
                tx.lesson.update({
                  where: { id: existingLessonId },
                  data: {
                    title: lesson.title || `Урок ${lIdx + 1}`,
                    type: lesson.type || "text",
                    content: lesson.content ? sanitizeContent(lesson.content) : null,
                    videoUrl: lesson.videoUrl || null,
                    duration: Number(lesson.duration) || 0,
                    sortOrder: lesson.sortOrder ?? lIdx + 1,
                    isFree: lesson.isFree || false,
                  },
                })
              );

              if (lesson.assignments !== undefined) {
                const existingAssignmentList = assignmentsByLesson.get(existingLessonId) ?? [];
                const existingAssignmentMap = new Map(existingAssignmentList.map((a) => [a.id, a]));
                const incomingAssignmentIds = new Set<string>();
                for (const a of lesson.assignments || []) {
                  if (a.id && existingAssignmentMap.has(a.id)) incomingAssignmentIds.add(a.id);
                }

                for (const a of lesson.assignments || []) {
                  const existingAId = a.id && existingAssignmentMap.has(a.id) ? a.id : null;
                  if (existingAId) {
                    lessonOps.push(
                      tx.assignment.update({
                        where: { id: existingAId },
                        data: assignmentUpdateData(a),
                      })
                    );
                  } else {
                    lessonOps.push(
                      tx.assignment.create({
                        data: assignmentCreateData(a, existingLessonId),
                      })
                    );
                  }
                }

                for (const [aId] of existingAssignmentMap) {
                  if (!incomingAssignmentIds.has(aId)) {
                    lessonOps.push(tx.assignment.delete({ where: { id: aId } }));
                  }
                }
              }
            } else {
              lessonOps.push(
                tx.lesson.create({
                  data: {
                    moduleId: existingId,
                    title: lesson.title || `Урок ${lIdx + 1}`,
                    type: lesson.type || "text",
                    content: lesson.content ? sanitizeContent(lesson.content) : null,
                    videoUrl: lesson.videoUrl || null,
                    duration: Number(lesson.duration) || 0,
                    sortOrder: lesson.sortOrder ?? lIdx + 1,
                    isFree: lesson.isFree || false,
                  },
                }).then((newLesson) => {
                  if (lesson.assignments && lesson.assignments.length > 0) {
                    return Promise.all(
                      lesson.assignments.map((a) =>
                        tx.assignment.create({ data: assignmentCreateData(a, newLesson.id) })
                      )
                    );
                  }
                })
              );
            }
          }

          // Delete removed lessons
          for (const [lessonId] of existingLessonMap) {
            if (!incomingLessonIds.has(lessonId)) {
              lessonOps.push(tx.lesson.delete({ where: { id: lessonId } }));
            }
          }
        }
        await Promise.all(lessonOps);

        // Create new modules (must be sequential to get IDs, but lessons within can be parallel)
        for (const { mod, mIdx } of newModules) {
          const newModule = await tx.module.create({
            data: {
              courseId: courseId as string,
              title: mod.title || `Модуль ${mIdx + 1}`,
              description: mod.description || null,
              sortOrder: mod.sortOrder ?? mIdx + 1,
            },
          });

          if (mod.lessons && mod.lessons.length > 0) {
            const newLessons = await Promise.all(
              mod.lessons.map((lesson, lIdx) =>
                tx.lesson.create({
                  data: {
                    moduleId: newModule.id,
                    title: lesson.title || `Урок ${lIdx + 1}`,
                    type: lesson.type || "text",
                    content: lesson.content ? sanitizeContent(lesson.content) : null,
                    videoUrl: lesson.videoUrl || null,
                    duration: Number(lesson.duration) || 0,
                    sortOrder: lesson.sortOrder ?? lIdx + 1,
                    isFree: lesson.isFree || false,
                  },
                })
              )
            );
            const assignmentCreates: Promise<unknown>[] = [];
            for (let i = 0; i < newLessons.length; i++) {
              const lesson = mod.lessons[i];
              if (lesson.assignments && lesson.assignments.length > 0) {
                for (const a of lesson.assignments) {
                  assignmentCreates.push(
                    tx.assignment.create({ data: assignmentCreateData(a, newLessons[i].id) })
                  );
                }
              }
            }
            await Promise.all(assignmentCreates);
          }
        }

        // Delete removed modules
        for (const [moduleId] of existingModuleMap) {
          if (!incomingModuleIds.has(moduleId)) {
            await tx.module.delete({ where: { id: moduleId } });
          }
        }
      });
    }

    // Перечитываем курс с модулями
    const updatedCourse = await db.course.findUnique({
      where: { id: courseId },
      include: {
        teacher: {
          select: { id: true, name: true },
        },
        category: {
          select: { id: true, name: true },
        },
        modules: {
          include: {
            lessons: true,
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    return NextResponse.json(
      { message: isPublished ? "Курс обновлён и опубликован" : "Курс обновлён", course: updatedCourse },
      { status: 200 }
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/courses PUT" });
  } finally {
    // Fire-and-forget: don't delay error responses if cache ops fail
    if (courseId) {
      cacheInvalidateByTag(`course:${courseId}`).catch(() => {});
      cacheInvalidateByTag("courses").catch(() => {});
      cacheInvalidateByTag("catalog").catch(() => {});
    }
  }
}

// DELETE: Удалить курс
export async function DELETE(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const session = await getAuthSession();
    if (!requireAuth(session)) return authErrorResponse();

    const userRole = session.user.role;
    if (userRole !== "admin" && userRole !== "teacher") {
      return NextResponse.json(
        { error: "Доступ запрещён. Требуются права администратора или преподавателя" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const courseId = searchParams.get("id");
    if (!courseId) {
      return NextResponse.json(
        { error: "ID курса обязателен" },
        { status: 400 }
      );
    }

    const existingCourse = await db.course.findUnique({
      where: { id: courseId },
      include: { teacher: true },
    });

    if (!existingCourse) {
      return NextResponse.json(
        { error: "Курс не найден" },
        { status: 404 }
      );
    }

    if (userRole !== "admin" && existingCourse.teacherId !== session.user.id) {
      return NextResponse.json(
        { error: "Доступ запрещён. Вы можете удалять только свои курсы" },
        { status: 403 }
      );
    }

    await db.course.delete({
      where: { id: courseId },
    });

    // Fire-and-forget cache invalidation
    cacheInvalidateByTag(`course:${courseId}`).catch(() => {});
    cacheInvalidateByTag("courses").catch(() => {});
    cacheInvalidateByTag("catalog").catch(() => {});

    return NextResponse.json(
      { message: "Курс удалён" },
      { status: 200 }
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/courses DELETE" });
  }
}
