import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { getAuthSession } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { parsePagination } from "@/lib/utils";
import { z } from "zod";

export const runtime = "nodejs";

const checkRateLimit = rateLimit("admin", RATE_LIMITS.admin);

const lessonSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  type: z.string().optional(),
  content: z.string().optional(),
  videoUrl: z.string().optional(),
  duration: z.union([z.string(), z.number()]).optional(),
  sortOrder: z.number().optional(),
  isFree: z.boolean().optional(),
});

const moduleSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  sortOrder: z.number().optional(),
  lessons: z.array(lessonSchema).optional(),
});

const createCourseSchema = z.object({
  title: z.string().min(3, "Название должно быть от 3 до 200 символов").max(200),
  slug: z.string().min(3, "Slug должен быть от 3 до 100 символов").max(100),
  description: z.string().min(10, "Описание должно быть от 10 до 5000 символов").max(5000),
  shortDesc: z.string().max(500, "Краткое описание не должно превышать 500 символов").optional().nullable(),
  price: z.union([z.string(), z.number()]).optional().default(0),
  oldPrice: z.union([z.string(), z.number()]).optional().nullable(),
  level: z.string().optional().default("beginner"),
  duration: z.string().optional().nullable(),
  isPublished: z.boolean().optional().default(false),
  isFeatured: z.boolean().optional().default(false),
  hasCertificate: z.boolean().optional().default(true),
  tags: z.string().optional().nullable(),
  requirements: z.string().optional().nullable(),
  whatYouLearn: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  modules: z.array(moduleSchema).optional().default([]),
  // New settings
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  visibility: z.string().optional().default("public"),
  maxStudents: z.union([z.string(), z.number()]).optional().nullable(),
  prerequisites: z.string().optional().nullable(),
  language: z.string().optional().default("ru"),
});

// GET: Все курсы (включая неопубликованные) — для админов
export async function GET(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;
  try {
    const session = await getAuthSession();
    if (!session?.user || session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Доступ запрещён. Требуются права администратора" },
        { status: 403 }
      );
    }

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
  } catch (error) {
    return handleApiError(error, { route: "admin/courses GET" });
  }
}

// POST: Создать новый курс с модулями и уроками
export async function POST(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: "Необходимо авторизоваться" },
        { status: 401 }
      );
    }

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
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return NextResponse.json(
        { error: "Цена должна быть неотрицательным числом" },
        { status: 400 }
      );
    }

    if (oldPrice !== undefined && oldPrice !== null) {
      const parsedOldPrice = Number(oldPrice);
      if (!Number.isFinite(parsedOldPrice) || parsedOldPrice < 0) {
        return NextResponse.json(
          { error: "Старая цена должна быть неотрицательным числом" },
          { status: 400 }
        );
      }
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

    // Типы для входных данных модулей и уроков
    type ModuleInput = {
      title?: string;
      description?: string;
      sortOrder?: number;
      lessons?: LessonInput[];
    };
    type LessonInput = {
      title?: string;
      type?: string;
      content?: string;
      videoUrl?: string;
      duration?: string | number;
      sortOrder?: number;
      isFree?: boolean;
    };

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
                content: lesson.content || null,
                videoUrl: lesson.videoUrl || null,
                duration: Number(lesson.duration) || 0,
                sortOrder: lesson.sortOrder || lIdx + 1,
                isFree: lesson.isFree || false,
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
  } catch (error) {
    return handleApiError(error, { route: "admin/courses POST" });
  }
}

// PUT: Обновить существующий курс с модулями и уроками
export async function PUT(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: "Необходимо авторизоваться" },
        { status: 401 }
      );
    }

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
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return NextResponse.json(
        { error: "Цена должна быть неотрицательным числом" },
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
      type ModuleInput = {
        id?: string;
        title?: string;
        description?: string;
        sortOrder?: number;
        lessons?: LessonInput[];
      };
      type LessonInput = {
        id?: string;
        title?: string;
        type?: string;
        content?: string;
        videoUrl?: string;
        duration?: string | number;
        sortOrder?: number;
        isFree?: boolean;
      };

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

      // Cache existing module data before transaction (needed for lesson diff)
      const existingModuleData = new Map<string, (typeof existingModules)[number]>();
      for (const [id, mod] of existingModuleMap) {
        if (incomingModuleIds.has(id)) {
          existingModuleData.set(id, mod);
        }
      }

      await db.$transaction(async (tx) => {
        for (let mIdx = 0; mIdx < (modules as ModuleInput[]).length; mIdx++) {
          const mod = (modules as ModuleInput[])[mIdx];
          const existingId = mod.id && existingModuleMap.has(mod.id) ? mod.id : null;

          if (existingId) {
            await tx.module.update({
              where: { id: existingId },
              data: {
                title: mod.title || `Модуль ${mIdx + 1}`,
                description: mod.description || null,
                sortOrder: mod.sortOrder ?? mIdx + 1,
              },
            });

            const existingMod = existingModuleData.get(existingId);
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
                await tx.lesson.update({
                  where: { id: existingLessonId },
                  data: {
                    title: lesson.title || `Урок ${lIdx + 1}`,
                    type: lesson.type || "text",
                    content: lesson.content || null,
                    videoUrl: lesson.videoUrl || null,
                    duration: Number(lesson.duration) || 0,
                    sortOrder: lesson.sortOrder ?? lIdx + 1,
                    isFree: lesson.isFree || false,
                  },
                });
              } else {
                await tx.lesson.create({
                  data: {
                    moduleId: existingId,
                    title: lesson.title || `Урок ${lIdx + 1}`,
                    type: lesson.type || "text",
                    content: lesson.content || null,
                    videoUrl: lesson.videoUrl || null,
                    duration: Number(lesson.duration) || 0,
                    sortOrder: lesson.sortOrder ?? lIdx + 1,
                    isFree: lesson.isFree || false,
                  },
                });
              }
            }

            for (const [lessonId, _existingLesson] of existingLessonMap) {
              if (!incomingLessonIds.has(lessonId)) {
                await tx.lesson.delete({ where: { id: lessonId } });
              }
            }
          } else {
            const newModule = await tx.module.create({
              data: {
                courseId,
                title: mod.title || `Модуль ${mIdx + 1}`,
                description: mod.description || null,
                sortOrder: mod.sortOrder ?? mIdx + 1,
              },
            });

            for (let lIdx = 0; lIdx < (mod.lessons || []).length; lIdx++) {
              const lesson = (mod.lessons || [])[lIdx];
              await tx.lesson.create({
                data: {
                  moduleId: newModule.id,
                  title: lesson.title || `Урок ${lIdx + 1}`,
                  type: lesson.type || "text",
                  content: lesson.content || null,
                  videoUrl: lesson.videoUrl || null,
                  duration: Number(lesson.duration) || 0,
                  sortOrder: lesson.sortOrder ?? lIdx + 1,
                  isFree: lesson.isFree || false,
                },
              });
            }
          }
        }

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
  } catch (error) {
    return handleApiError(error, { route: "admin/courses PUT" });
  }
}

// DELETE: Удалить курс
export async function DELETE(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: "Необходимо авторизоваться" },
        { status: 401 }
      );
    }

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

    return NextResponse.json(
      { message: "Курс удалён" },
      { status: 200 }
    );
  } catch (error) {
    return handleApiError(error, { route: "admin/courses DELETE" });
  }
}
