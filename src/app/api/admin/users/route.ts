import { NextRequest, NextResponse } from "next/server";
import { db, Prisma, getDatabaseProvider } from "@/lib/db";
import { getAuthSession, requireAdmin, adminErrorResponse } from "@/lib/auth";
import { z } from "zod";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { handleApiError } from "@/lib/api-errors";
import { parsePagination } from "@/lib/utils";
import { AUDIT_ACTIONS, auditActorFromSession, recordAuditEvent } from "@/lib/audit-log";

export const runtime = "nodejs";

const updateUserSchema = z.object({
  userId: z.string().min(1, "ID пользователя обязателен"),
  role: z.enum(["student", "teacher", "admin"]).optional(),
  isActive: z.boolean().optional(),
  name: z.string().min(2).max(50).optional(),
});

const checkRateLimit = rateLimit("admin", RATE_LIMITS.admin);

// GET: Все пользователи с пагинацией
export async function GET(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;
  try {
    const session = await getAuthSession();
    if (!requireAdmin(session)) return adminErrorResponse();

    const { searchParams } = new URL(request.url);
    const { page, limit, skip } = parsePagination(searchParams, { defaultLimit: 20, maxLimit: 100 });
    const rawSearch = searchParams.get("search");
    const rawRole = searchParams.get("role");

    // Validate role against allowed values
    const allowedRoles = ["student", "teacher", "admin"];
    const role = rawRole && allowedRoles.includes(rawRole) ? rawRole : undefined;

    // Validate search length
    const search = rawSearch && rawSearch.length <= 100 ? rawSearch : undefined;

    const where: Prisma.UserWhereInput = {};
    if (role) where.role = role;
    if (search) {
      // Use case-insensitive search for PostgreSQL; SQLite handles this natively
      const provider = getDatabaseProvider();
      const searchFilter = provider === "postgresql"
        ? { contains: search, mode: "insensitive" as const }
        : { contains: search };
      where.OR = [
        { name: searchFilter },
        { email: searchFilter },
      ];
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          image: true,
          role: true,
          isActive: true,
          twoFactorEnabled: true,
          createdAt: true,
          _count: {
            select: {
              enrollments: true,
              teacherCourses: true,
              reviews: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, { status: 200 });
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/users GET" });
  }
}

// PUT: Обновить пользователя (роль, статус)
export async function PUT(request: NextRequest) {
  const blocked = checkRateLimit(request);
  if (blocked) return blocked;

  try {
    const session = await getAuthSession();
    if (!requireAdmin(session)) return adminErrorResponse();

    const body = await request.json();
    const validation = updateUserSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Ошибка валидации" },
        { status: 400 }
      );
    }

    const { userId, ...updateData } = validation.data;

    // Проверяем, не пытается ли админ заблокировать сам себя
    if (userId === session.user.id) {
      if (updateData.isActive === false) {
        return NextResponse.json(
          { error: "Нельзя заблокировать самого себя" },
          { status: 400 }
        );
      }
      if ("role" in updateData && updateData.role && updateData.role !== "admin") {
        return NextResponse.json(
          { error: "Нельзя понизить свою роль" },
          { status: 400 }
        );
      }
    }

    // Snapshot before the write: the audit entry records what actually changed,
    // and a re-sent identical PUT should not read as a change.
    const previousUser = await db.user.findUnique({
      where: { id: userId },
      select: { role: true, isActive: true, name: true, email: true },
    });

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        image: true,
      },
    });

    // One entry per meaningful change, so "who made this user an admin" is
    // answerable without diffing snapshots by hand.
    const changes: Record<string, unknown> = {};
    if (previousUser) {
      if (updateData.role && updateData.role !== previousUser.role) {
        changes.role = { from: previousUser.role, to: updateData.role };
      }
      if (updateData.isActive !== undefined && updateData.isActive !== previousUser.isActive) {
        changes.isActive = { from: previousUser.isActive, to: updateData.isActive };
      }
      if (updateData.name !== undefined && updateData.name !== previousUser.name) {
        changes.name = { from: previousUser.name, to: updateData.name };
      }
    }

    const action =
      changes.role !== undefined
        ? AUDIT_ACTIONS.userRoleChange
        : changes.isActive !== undefined
          ? AUDIT_ACTIONS.userStatusChange
          : AUDIT_ACTIONS.userUpdate;

    await recordAuditEvent({
      action,
      actor: auditActorFromSession(session),
      entityType: "user",
      entityId: userId,
      targetLabel: updatedUser.email,
      metadata: { changes },
      request,
    });

    return NextResponse.json(
      { message: "Пользователь обновлён", user: updatedUser },
      { status: 200 }
    );
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/users PUT" });
  }
}
