import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, requireAdmin } from "@/lib/auth";
import { FEATURE_FLAGS } from "@/lib/feature-flags-config";
import { getAllFeatureFlags } from "@/lib/feature-flags";
import { handleApiError } from "@/lib/api-errors";

export const runtime = "nodejs";

// GET: List all feature flags and their current status
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const flags = getAllFeatureFlags();
    const definitions = Object.entries(FEATURE_FLAGS).map(([key, def]) => ({
      key,
      description: def.description,
      defaultValue: def.defaultValue,
      enabled: flags[key] ?? def.defaultValue,
      rolloutPercentage: def.rolloutPercentage,
    }));

    return NextResponse.json({ flags: definitions });
  } catch (error) {
    return handleApiError(error, { route: "admin/feature-flags" });
  }
}

// PATCH: Update a feature flag (admin only, persists to localStorage for client)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getAuthSession();
    const authError = requireAdmin(session);
    if (authError) return authError;

    const body = await request.json();
    const { key, enabled } = body as { key: string; enabled: boolean };

    if (!key || typeof enabled !== "boolean") {
      return NextResponse.json({ error: "key and enabled are required" }, { status: 400 });
    }

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
  } catch (error) {
    return handleApiError(error, { route: "admin/feature-flags" });
  }
}
