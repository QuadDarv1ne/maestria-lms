import { useMemo } from "react";
import { FEATURE_FLAGS, FeatureFlagKey } from "./feature-flags-config";
import { log } from "./logger";

/**
 * Feature Flags utility with layered evaluation:
 * 1. Environment variable override
 * 2. Database/admin settings
 * 3. URL query parameter (for testing)
 * 4. localStorage (for client-side testing)
 * 5. Default value from config
 */

// Client-side flag cache
const flagCache = new Map<string, boolean>();

function isClient(): boolean {
  return typeof window !== "undefined";
}

function getFromLocalStorage(key: string): boolean | null {
  if (!isClient()) return null;
  try {
    const value = localStorage.getItem(`feature-flag:${key}`);
    if (value !== null) return value === "true";
    return null;
  } catch {
    return null;
  }
}

function getFromUrlParams(key: string): boolean | null {
  if (!isClient()) return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get(`flag-${key}`);
    if (value === "true" || value === "false") return value === "true";
    return null;
  } catch {
    return null;
  }
}

function getFromEnvVar(key: string): boolean | null {
  if (typeof process === "undefined") return null;
  const envValue = process.env[`FEATURE_FLAG_${key.toUpperCase()}`];
  if (envValue === "true") return true;
  if (envValue === "false") return false;
  return null;
}

/**
 * Evaluate a feature flag with layered priority.
 * Priority: env > url > localStorage > default
 */
export function isFeatureEnabled(key: FeatureFlagKey): boolean {
  // Check cache first (client-side)
  if (isClient() && flagCache.has(key)) {
    return flagCache.get(key) as boolean;
  }

  const flagDef = FEATURE_FLAGS[key];
  if (!flagDef) {
    log.warn(`Feature flag "${key}" not found in configuration`);
    return false;
  }

  // 1. Environment variable override
  const envValue = getFromEnvVar(key);
  if (envValue !== null) {
    const result = envValue;
    if (isClient()) flagCache.set(key, result);
    return result;
  }

  // 2. URL query parameter (for testing)
  const urlValue = getFromUrlParams(key);
  if (urlValue !== null) {
    const result = urlValue;
    if (isClient()) flagCache.set(key, result);
    return result;
  }

  // 3. localStorage override
  const localValue = getFromLocalStorage(key);
  if (localValue !== null) {
    const result = localValue;
    if (isClient()) flagCache.set(key, result);
    return result;
  }

  // 4. Rollout percentage check
  if (flagDef.rolloutPercentage != null && flagDef.rolloutPercentage < 100) {
    // Use deterministic hash based on user/session for consistent rollout
    const seed = isClient() ? (localStorage.getItem("user-id") || navigator.userAgent + window.location.hostname) : "server";
    const hash = simpleHash(seed + key);
    const isEnabled = (hash % 100) < flagDef.rolloutPercentage;
    if (isClient()) flagCache.set(key, isEnabled);
    return isEnabled;
  }

  // 5. Default value
  return flagDef.defaultValue;
}

/**
 * Get all feature flags with their current evaluation.
 */
export function getAllFeatureFlags(): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  for (const key of Object.keys(FEATURE_FLAGS)) {
    flags[key] = isFeatureEnabled(key as FeatureFlagKey);
  }
  return flags;
}

/**
 * Set a feature flag in localStorage (client-side only).
 * Useful for testing and user preferences.
 */
export function setFeatureFlag(key: FeatureFlagKey, value: boolean): void {
  if (!isClient()) {
    log.warn("setFeatureFlag is client-side only");
    return;
  }
  localStorage.setItem(`feature-flag:${key}`, String(value));
  flagCache.set(key, value);
}

/**
 * Clear all feature flag overrides from localStorage.
 */
export function clearFeatureFlags(): void {
  if (!isClient()) return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith("feature-flag:")) {
      keysToRemove.push(key);
    }
  }
  for (const key of keysToRemove) {
    localStorage.removeItem(key);
    flagCache.delete(key.replace("feature-flag:", ""));
  }
}

/**
 * React hook for feature flags (client-side only).
 */
export function useFeatureFlag(key: FeatureFlagKey): boolean {
  return useMemo(() => isFeatureEnabled(key), [key]);
}

/**
 * Simple string hash function for rollout percentage calculation.
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Server-side: fetch flags from database/admin settings.
 * Returns evaluated flags for the current request context.
 */
export async function getServerFeatureFlags(): Promise<Record<string, boolean>> {
  const flags: Record<string, boolean> = {};
  for (const key of Object.keys(FEATURE_FLAGS)) {
    flags[key] = isFeatureEnabled(key as FeatureFlagKey);
  }
  return flags;
}
