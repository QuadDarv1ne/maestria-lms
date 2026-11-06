"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  actorName: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  targetLabel: string | null;
  metadata: unknown;
  ip: string | null;
  createdAt: string;
}

export interface AuditLogFilters {
  action?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogResponse {
  entries: AuditLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Reads the admin audit trail.
 *
 * `keepPreviousData` keeps the current page on screen while the next one
 * loads -- without it every filter change flashes the empty state.
 */
export function useAuditLogs(filters: AuditLogFilters = {}) {
  const params = new URLSearchParams();
  params.set("page", String(filters.page ?? 1));
  params.set("limit", String(filters.limit ?? 50));
  if (filters.action && filters.action !== "all") params.set("action", filters.action);
  if (filters.search?.trim()) params.set("search", filters.search.trim());

  return useQuery<AuditLogResponse>({
    queryKey: ["admin", "audit-logs", params.toString()],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`, { signal });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: null }));
        throw new Error(error?.error || `Failed to fetch audit logs (${res.status})`);
      }
      return res.json();
    },
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });
}
