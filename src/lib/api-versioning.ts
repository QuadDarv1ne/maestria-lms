/**
 * API Versioning Support
 *
 * Provides utilities for API versioning via:
 * 1. URL prefix versioning (e.g., /api/v1/courses)
 * 2. Accept-Version header versioning
 * 3. Version compatibility checks
 *
 * Usage:
 * ```ts
 * import { withApiVersion, API_VERSIONS } from "@/lib/api-versioning";
 *
 * // In your API route:
 * export async function GET(request: NextRequest) {
 *   const version = getApiVersion(request);
 *   // ... handle based on version
 * }
 * ```
 */

import { NextResponse } from "next/server";

/**
 * Supported API versions.
 * The current version is always the latest.
 */
export const API_VERSIONS = {
  V1: "1.0.0",
  V2: "2.0.0",
} as const;

export type ApiVersion = (typeof API_VERSIONS)[keyof typeof API_VERSIONS];

export const CURRENT_API_VERSION: ApiVersion = API_VERSIONS.V2;
export const MINIMUM_SUPPORTED_VERSION: ApiVersion = API_VERSIONS.V1;

/**
 * Version entry with deprecation info.
 */
interface VersionInfo {
  version: ApiVersion;
  releasedAt: string;
  deprecationDate?: string;
  sunsetDate?: string;
  changelog: string[];
}

const VERSION_REGISTRY: Record<string, VersionInfo> = {
  [API_VERSIONS.V1]: {
    version: API_VERSIONS.V1,
    releasedAt: "2025-06-01",
    changelog: ["Initial API release"],
  },
  [API_VERSIONS.V2]: {
    version: API_VERSIONS.V2,
    releasedAt: "2026-01-15",
    changelog: [
      "Added pagination metadata to all list endpoints",
      "Standardized error response format",
      "Added rate limit headers to all responses",
      "Added analytics endpoint",
    ],
  },
};

/**
 * Parse the API version from the request.
 * Checks in order:
 * 1. Accept-Version header
 * 2. URL path prefix (e.g., /api/v2/courses)
 * 3. Defaults to current version
 */
export function getApiVersion(request: Request): ApiVersion {
  // Check Accept-Version header
  const headerVersion = request.headers.get("Accept-Version");
  if (headerVersion) {
    const normalized = headerVersion.trim();
    if (Object.values(API_VERSIONS).includes(normalized as ApiVersion)) {
      return normalized as ApiVersion;
    }
    // Accept partial versions like "2" or "2.0"
    if (normalized === "1" || normalized === "1.0") return API_VERSIONS.V1;
    if (normalized === "2" || normalized === "2.0") return API_VERSIONS.V2;
  }

  // Check URL prefix
  const url = new URL(request.url);
  const pathMatch = url.pathname.match(/^\/api\/v(\d+)\//);
  if (pathMatch) {
    const major = pathMatch[1];
    if (major === "1") return API_VERSIONS.V1;
    if (major === "2") return API_VERSIONS.V2;
  }

  return CURRENT_API_VERSION;
}

/**
 * Check if a given version is supported.
 */
export function isVersionSupported(version: string): boolean {
  return Object.values(API_VERSIONS).includes(version as ApiVersion);
}

/**
 * Check if a version is deprecated (has a deprecation date in the past).
 */
export function isVersionDeprecated(version: ApiVersion): boolean {
  const info = VERSION_REGISTRY[version];
  if (!info?.deprecationDate) return false;
  return new Date(info.deprecationDate) <= new Date();
}

/**
 * Check if a version is sunset (no longer supported).
 */
export function isVersionSunset(version: ApiVersion): boolean {
  const info = VERSION_REGISTRY[version];
  if (!info?.sunsetDate) return false;
  return new Date(info.sunsetDate) <= new Date();
}

/**
 * Get version info for registry/display purposes.
 */
export function getVersionInfo(version: ApiVersion): VersionInfo | null {
  return VERSION_REGISTRY[version] ?? null;
}

/**
 * Get all registered versions.
 */
export function getAllVersions(): VersionInfo[] {
  return Object.values(VERSION_REGISTRY).sort((a, b) =>
    b.version.localeCompare(a.version),
  );
}

/**
 * Add version-related headers to a response.
 * Includes:
 * - X-API-Version: current version used
 * - X-API-Deprecated: true if version is deprecated
 * - Sunset: date when version will be removed (if applicable)
 */
export function addVersionHeaders(
  headers: Headers,
  version: ApiVersion,
): void {
  headers.set("X-API-Version", version);

  const info = VERSION_REGISTRY[version];
  if (info?.deprecationDate && isVersionDeprecated(version)) {
    headers.set("X-API-Deprecated", "true");
    headers.set("X-API-Deprecation-Date", info.deprecationDate);
    if (info.sunsetDate) {
      headers.set("Sunset", info.sunsetDate);
    }
  }
}

/**
 * Middleware-style wrapper that checks version compatibility
 * and returns a 400/410 response if the version is invalid/sunset.
 *
 * Returns null if the version is acceptable.
 */
export function validateApiVersion(request: Request): NextResponse | null {
  const version = getApiVersion(request);

  if (!isVersionSupported(version)) {
    return NextResponse.json(
      {
        error: `API version "${version}" is not supported`,
        code: "UNSUPPORTED_API_VERSION",
        supportedVersions: Object.values(API_VERSIONS),
        currentVersion: CURRENT_API_VERSION,
      },
      { status: 400 },
    );
  }

  if (isVersionSunset(version)) {
    return NextResponse.json(
      {
        error: `API version "${version}" has been sunset and is no longer available`,
        code: "SUNSET_API_VERSION",
        currentVersion: CURRENT_API_VERSION,
        supportedVersions: Object.values(API_VERSIONS),
      },
      { status: 410 },
    );
  }

  return null;
}

/**
 * Higher-order function that wraps an API route handler with versioning support.
 * Automatically validates the version and adds version headers.
 *
 * @example
 * ```ts
 * export const GET = withApiVersion(async (request, version) => {
 *   // Your handler logic here
 *   return NextResponse.json({ data });
 * });
 * ```
 */
export function withApiVersion(
  handler: (request: Request, version: ApiVersion) => Promise<NextResponse>,
): (request: Request) => Promise<NextResponse> {
  return async (request: Request) => {
    // Validate version
    const versionError = validateApiVersion(request);
    if (versionError) return versionError;

    const version = getApiVersion(request);

    // Call the handler
    const response = await handler(request, version);

    // Add version headers
    if (response.headers) {
      addVersionHeaders(response.headers, version);
    }

    return response;
  };
}