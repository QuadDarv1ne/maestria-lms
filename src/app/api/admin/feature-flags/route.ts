import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, requireAdmin } from "@/lib/auth";
import { FEATURE_FLAGS } from "@/lib/feature-flags-config";
import { getAllFeatureFlags } from "@/lib/feature-flags";
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
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminError = requireAdmin(session);
    if (adminError) return adminError;

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
    const authError = requireAdmin(session);
    if (authError) return authError;

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

    // For server-side: set environment variable (requires restart to take effect)
    // For client-side: this endpoint returns the new value, client sets localStorage
    process.env[`FEATURE_FLAG_${key.toUpperCase()}`] = String(enabled);

    return NextResponse.json({
      message: `Feature flag ${key} updated`,
      key,
      enabled,
      note: "Server-side change requires restart. Client will use localStorage override.",
    });
  } catch (error: unknown) {
    return handleApiError(error, { route: "admin/feature-flags" });
  }
}
