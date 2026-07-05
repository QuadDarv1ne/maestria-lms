import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, requireAdmin } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { z } from "zod";
import { getRedisClient } from "@/lib/redis";

export const runtime = "nodejs";

const SETTINGS_KEY = "admin:settings";
const SETTINGS_TTL = 365 * 24 * 60 * 60; // 1 year in seconds

const checkAdminRateLimit = rateLimit("admin", RATE_LIMITS.admin);

const DEFAULT_SETTINGS = {
  maintenanceMode: false,
  registrationDisabled: false,
  moderationEnabled: false,
  emailNotificationsEnabled: false,
};

async function readSettings(): Promise<typeof DEFAULT_SETTINGS> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const data = await redis.get(SETTINGS_KEY);
      if (data) return JSON.parse(data) as typeof DEFAULT_SETTINGS;
    } catch {
      // Fall through to defaults
    }
  }
  return DEFAULT_SETTINGS;
}

async function writeSettings(settings: typeof DEFAULT_SETTINGS) {
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.setex(SETTINGS_KEY, SETTINGS_TTL, JSON.stringify(settings));
      return;
    } catch {
      // Fall through silently
    }
  }
}

export async function GET(request: NextRequest) {
  const blocked = checkAdminRateLimit(request);
  if (blocked) return blocked;
  try {
    const session = await getAuthSession();
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

    const settings = await readSettings();
    return NextResponse.json(settings);
  } catch (error: unknown) {
    return handleApiError(error, { route: "GET /api/admin/settings" });
  }
}

const settingsSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  registrationDisabled: z.boolean().optional(),
  moderationEnabled: z.boolean().optional(),
  emailNotificationsEnabled: z.boolean().optional(),
});

export async function PATCH(request: NextRequest) {
  const blocked = checkAdminRateLimit(request);
  if (blocked) return blocked;
  try {
    const session = await getAuthSession();
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

    const body = await request.json();
    const validation = settingsSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const current = await readSettings();
    const updated = { ...current, ...validation.data };
    await writeSettings(updated);

    return NextResponse.json(updated);
  } catch (error: unknown) {
    return handleApiError(error, { route: "PATCH /api/admin/settings" });
  }
}
