"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Flag, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { setFeatureFlag, clearFeatureFlags } from "@/lib/feature-flags";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/stores/ui";

interface FlagDefinition {
  key: string;
  description: string;
  defaultValue: boolean;
  enabled: boolean;
  rolloutPercentage?: number | null;
}

export function AdminFeatureFlags({ locale }: { locale: Locale }) {
  const [flags, setFlags] = useState<FlagDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFlags = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/feature-flags");
      if (!res.ok) throw new Error(t("admin.feature_flags.fetch_failed", locale));
      const data = await res.json();
      setFlags(data.flags);
    } catch {
      toast.error(t("admin.feature_flags.load_failed", locale));
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  async function toggleFlag(key: string, enabled: boolean) {
    try {
      // Update server (for logging)
      await fetch("/api/admin/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, enabled }),
      });

      // Update client immediately via localStorage
      setFeatureFlag(key as Parameters<typeof setFeatureFlag>[0], enabled);

      // Update local state
      setFlags((prev) =>
        prev.map((f) => (f.key === key ? { ...f, enabled } : f))
      );

      toast.success(`${key} ${enabled ? t("admin.settings.enabled", locale) : t("admin.settings.disabled", locale)}`);
    } catch {
      toast.error(t("admin.feature_flags.update_failed", locale));
    }
  }

  function handleClearOverrides() {
    clearFeatureFlags();
    toast.success(t("admin.feature_flags.cleared", locale));
    fetchFlags();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2"><Flag className="w-5 h-5" />{t("admin.feature_flags.title", locale)}</span>
          <Button onClick={handleClearOverrides} variant="outline" size="sm">
            {t("admin.feature_flags.clear_overrides", locale)}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {flags.map((flag) => (
          <div
            key={flag.key}
            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium font-mono">{flag.key}</p>
                {flag.enabled !== flag.defaultValue && (
                  <Badge variant="secondary" className="text-xs">{t("admin.feature_flags.overridden", locale)}</Badge>
                )}
                {flag.rolloutPercentage != null && flag.rolloutPercentage < 100 && (
                  <Badge variant="outline" className="text-xs">{flag.rolloutPercentage}% {t("admin.feature_flags.rollout", locale)}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{flag.description}</p>
            </div>
            <Switch
              checked={flag.enabled}
              onCheckedChange={(checked) => toggleFlag(flag.key, checked)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
