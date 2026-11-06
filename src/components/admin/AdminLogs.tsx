"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Clock,
  RefreshCw,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  auditActionIcon,
  AUDIT_ACTION_LABELS,
  AUDIT_ACTION_COLORS,
} from "@/lib/constants";
import { useAuditLogs } from "@/hooks/useAuditLogs";
import type { AdminTabProps } from "./types";

const PAGE_SIZE = 50;

/** Entity types carry a stable identifier; the UI needs a translated noun. */
const ENTITY_LABEL_KEYS: Record<string, string> = {
  user: "adminAudit.entityUser",
  course: "adminAudit.entityCourse",
  category: "adminAudit.entityCategory",
  promo_code: "adminAudit.entityPromoCode",
  payment: "adminAudit.entityPayment",
  submission: "adminAudit.entitySubmission",
  settings: "adminAudit.entitySettings",
  feature_flag: "adminAudit.entityFeatureFlag",
  cache: "adminAudit.entityCache",
  backup: "adminAudit.entityBackup",
  audit_log: "adminAudit.entityAuditLog",
};

/**
 * Human-readable rendering of an entry's metadata.
 *
 * The API stores a small, redacted object; there is no schema per action, so
 * the cell shows `key: value` pairs rather than pretending to know the shape.
 * Objects are flattened one level (`role: student → admin`), which covers the
 * `{ from, to }` change records written by the user/course routes.
 */
function describeMetadata(metadata: unknown): string {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "object" && !Array.isArray(value)) {
      const nested = Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(" → ");
      if (nested) parts.push(`${key}: ${nested}`);
      continue;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      parts.push(`${key}: ${value.map(String).join(", ")}`);
      continue;
    }
    parts.push(`${key}: ${String(value)}`);
  }
  return parts.join(" · ");
}

export function AdminLogs({ locale }: AdminTabProps) {
  const [action, setAction] = useState("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isFetching, isError, refetch } = useAuditLogs({
    action,
    search,
    page,
    limit: PAGE_SIZE,
  });

  const entries = data?.entries ?? [];
  const pagination = data?.pagination;

  function applySearch() {
    setSearch(searchInput);
    setPage(1);
  }

  function changeAction(value: string) {
    setAction(value);
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              {t("adminPage.statLogJournal", locale)}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {pagination?.total ?? 0} {t("adminPage.statLogEntries", locale)}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetch()}
                disabled={isFetching}
                aria-label={t("adminAudit.refresh", locale)}
              >
                {isFetching ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <div className="flex flex-1 gap-2">
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applySearch();
                }}
                placeholder={t("adminAudit.searchPlaceholder", locale)}
                aria-label={t("adminAudit.searchPlaceholder", locale)}
                className="max-w-sm"
              />
              <Button size="sm" variant="outline" onClick={applySearch}>
                <Search className="w-4 h-4" />
              </Button>
            </div>
            <Select value={action} onValueChange={changeAction}>
              <SelectTrigger className="w-full sm:w-[260px]" aria-label={t("adminAudit.filterAction", locale)}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("adminAudit.allActions", locale)}</SelectItem>
                {Object.entries(AUDIT_ACTION_LABELS).map(([value, labelKey]) => (
                  <SelectItem key={value} value={value}>
                    {t(labelKey, locale)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent>
          {isError ? (
            <p className="text-sm text-red-600 text-center py-6">{t("adminAudit.loadError", locale)}</p>
          ) : isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t("adminAudit.loading", locale)}…</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t("adminAudit.empty", locale)}</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("adminAudit.colAction", locale)}</TableHead>
                    <TableHead>{t("adminAudit.colTarget", locale)}</TableHead>
                    <TableHead>{t("adminAudit.colActor", locale)}</TableHead>
                    <TableHead>{t("adminAudit.colDetails", locale)}</TableHead>
                    <TableHead>{t("adminAudit.colDate", locale)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => {
                    const details = describeMetadata(entry.metadata);
                    return (
                      <TableRow key={entry.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="shrink-0">{auditActionIcon(entry.action)}</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] ${AUDIT_ACTION_COLORS[entry.action] ?? "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-400"}`}
                            >
                              {t(AUDIT_ACTION_LABELS[entry.action] ?? entry.action, locale)}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm max-w-[240px]">
                          <p className="truncate">{entry.targetLabel ?? "—"}</p>
                          {entry.entityType && (
                            <p className="text-xs text-muted-foreground">
                              {ENTITY_LABEL_KEYS[entry.entityType]
                                ? t(ENTITY_LABEL_KEYS[entry.entityType], locale)
                                : entry.entityType}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px]">
                          <p className="truncate">{entry.actorName ?? entry.actorEmail ?? "—"}</p>
                          {entry.ip && (
                            <p className="text-xs text-muted-foreground font-mono truncate">{entry.ip}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[280px]">
                          <span className="line-clamp-2">{details || "—"}</span>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">
                          {formatDate(entry.createdAt, locale, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-xs text-muted-foreground">
                {t("adminAudit.page", locale)} {pagination.page} / {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pagination.page <= 1 || isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  aria-label={t("adminAudit.prev", locale)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pagination.page >= pagination.totalPages || isFetching}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label={t("adminAudit.next", locale)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
