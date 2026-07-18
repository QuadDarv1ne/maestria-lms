import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, requireAdmin, adminErrorResponse } from "@/lib/auth";
import { FEATURE_FLAGS } from "@/lib/feature-flags-config";
import { getAllFeatureFlags, setServerFeatureFlag } from "@/lib/feature-flags";
import { handleApiError } from "@/lib/api-errors";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { z } from "zod";

const checkAdminRateLimit = rateLimit("admin", RATE_LIMITS.admin);

export const runtime = "nodejs";

// GET: List all feature flags and their current status
export async function GET(request: NextRequest) {
  const blocked = checkAdminRateLimit(request);
  if (blocked) return blocked;
  try {
    const session = await getAuthSession();
    if (!requireAdmin(session)) return adminErrorResponse();

    const flags = getAllFeatureFlags();
    const definitions = Object.entries(FEATURE_FLAGS).map(([key, def]) => ({
      key,
      description: def.description,
      defaultValue: def.defaultValue,
      enabled: flags[key] ?? def.defaultValue,
      rolloutPercentage: def.rolloutPercentage,
    }));

    return NextResponse.json({ flags: definitions });
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/feature-flags" });
  }
}

const updateFlagSchema = z.object({
  key: z.string().min(1, "key is required"),
  enabled: z.boolean(),
});

// PATCH: Update a feature flag (admin only, persists to localStorage for client)
export async function PATCH(request: NextRequest) {
  const blocked = checkAdminRateLimit(request);
  if (blocked) return blocked;
  try {
    const session = await getAuthSession();
    if (!requireAdmin(session)) return adminErrorResponse();

    const body = await request.json();
    const validation = updateFlagSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || "Invalid input" },
        { status: 400 }
      );
    }

    const { key, enabled } = validation.data;

    if (!(key in FEATURE_FLAGS)) {
      return NextResponse.json({ error: `Unknown feature flag: ${key}` }, { status: 404 });
    }

    // Set server-side override in memory (per-process, no process.env mutation)
    setServerFeatureFlag(key as keyof typeof FEATURE_FLAGS, enabled);

    return NextResponse.json({
      message: `Feature flag ${key} updated`,
      key,
      enabled,
      note: "Override is per-process. Client will use localStorage override.",
    });
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/feature-flags" });
  }
}
