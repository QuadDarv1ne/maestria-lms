import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, requireAdmin } from "@/lib/auth";
import { handleApiError } from "@/lib/api-errors";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";

const SETTINGS_PATH = path.join(process.cwd(), "data", "settings.json");

const checkAdminRateLimit = rateLimit("admin", RATE_LIMITS.admin);

const DEFAULT_SETTINGS = {
  maintenanceMode: false,
  registrationDisabled: false,
  moderationEnabled: false,
  emailNotificationsEnabled: false,
};

async function ensureSettingsDir() {
  const dir = path.dirname(SETTINGS_PATH);
  await fs.mkdir(dir, { recursive: true });
}

async function readSettings() {
  try {
    await fs.access(SETTINGS_PATH);
    const content = await fs.readFile(SETTINGS_PATH, "utf-8");
    return JSON.parse(content);
  } catch {
    await ensureSettingsDir();
    await fs.writeFile(SETTINGS_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2));
    return DEFAULT_SETTINGS;
  }
}

async function writeSettings(settings: Record<string, unknown>) {
  await ensureSettingsDir();
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2));
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
