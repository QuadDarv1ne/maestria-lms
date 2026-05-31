import { NextResponse } from "next/server";
import { getAuthSession, requireAdmin } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api-errors";
import { z } from "zod";
import fs from "fs";
import path from "path";

const SETTINGS_PATH = path.join(process.cwd(), "data", "settings.json");

const DEFAULT_SETTINGS = {
  maintenanceMode: false,
  registrationDisabled: false,
  moderationEnabled: false,
  emailNotificationsEnabled: false,
};

function readSettings() {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) {
      const dir = path.dirname(SETTINGS_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2));
      return DEFAULT_SETTINGS;
    }
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function writeSettings(settings: Record<string, unknown>) {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

export async function GET() {
  try {
    const session = await getAuthSession();
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

    const settings = readSettings();
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

export async function PATCH(request: Request) {
  try {
    const session = await getAuthSession();
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

    const body = await request.json();
    const parsed = settingsSchema.parse(body);

    const current = readSettings();
    const updated = { ...current, ...parsed };
    writeSettings(updated);

    return NextResponse.json(updated);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return apiError("Invalid settings data", 400);
    }
    return handleApiError(error, { route: "PATCH /api/admin/settings" });
  }
}
