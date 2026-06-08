"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/stores/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Database,
  HardDrive,
  Activity,
  Users,
  BookOpen,
  CreditCard,
  FileText,
  Bell,
} from "lucide-react";

interface HealthStatus {
  status: string;
  service: string;
  version: string;
  uptime: string;
  timestamp: string;
  database: { status: string; latencyMs: number };
  redis?: { status: string; latencyMs: number };
  memory?: { rss: number; heapTotal: number; heapUsed: number; external: number };
}

interface Metrics {
  system: {
    uptime: string;
    nodeVersion: string;
    platform: string;
    memory: { rss: string; heapUsed: string; heapTotal: string };
  };
  data: {
    users: number;
    courses: number;
    activeEnrollments: number;
    completedPayments: number;
    reviews: number;
    publishedArticles: number;
    unreadNotifications: number;
  };
}

function StatusBadge({ status, locale }: { status: string; locale: Locale }) {
  if (status === "ok" || status === "connected") {
    return <Badge className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" />{t("status.operational", locale)}</Badge>;
  }
  if (status === "degraded" || status === "not configured") {
    return <Badge className="bg-yellow-100 text-yellow-700"><AlertTriangle className="w-3 h-3 mr-1" />{t("status.degraded", locale)}</Badge>;
  }
  return <Badge className="bg-red-100 text-red-700"><XCircle className="w-3 h-3 mr-1" />{t("status.down", locale)}</Badge>;
}

export default function StatusPage() {
  const locale = useAppStore((s) => s.locale);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, metricsRes] = await Promise.all([
        fetch("/api/?detailed=true"),
        fetch("/api/metrics"),
      ]);

      if (!healthRes.ok || !metricsRes.ok) {
        throw new Error(t("status.fetchFailed", locale));
      }

      const healthData = await healthRes.json();
      const metricsData = await metricsRes.json();

      setHealth(healthData);
      setMetrics(metricsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("status.unknownError", locale));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">{t("status.failedToLoad", locale)}</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button onClick={fetchData}><RefreshCw className="w-4 h-4 mr-1" />{t("status.retry", locale)}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">{t("status.systemStatus", locale)}</h1>
          <p className="text-muted-foreground">{t("status.monitoringDesc", locale)}</p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-1" />{t("status.refresh", locale)}
        </Button>
      </div>

      {/* Service Status */}
      <div className="grid gap-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2"><Activity className="w-5 h-5" />{t("status.serviceHealth", locale)}</span>
              <StatusBadge status={health?.status || ""} locale={locale} />
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">{t("status.version", locale)}</p>
              <p className="font-mono">{health?.version}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("status.uptime", locale)}</p>
              <p className="font-mono">{health?.uptime}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{t("status.nodejs", locale)}</p>
              <p className="font-mono">{metrics?.system.nodeVersion}</p>
            </div>
          </CardContent>
        </Card>

        {/* Database */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <span className="flex items-center gap-2"><Database className="w-5 h-5" />{t("status.database", locale)}</span>
              <StatusBadge status={health?.database.status || ""} locale={locale} />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="text-muted-foreground">{t("status.latency", locale)}</p>
            <p className="font-mono">{health?.database.latencyMs}ms</p>
          </CardContent>
        </Card>

        {/* Redis */}
        {health?.redis && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center gap-2"><Activity className="w-5 h-5" />{t("status.redis", locale)}</span>
                <StatusBadge status={health.redis.status} locale={locale} />
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="text-muted-foreground">{t("status.latency", locale)}</p>
              <p className="font-mono">{health.redis.latencyMs}ms</p>
            </CardContent>
          </Card>
        )}

        {/* Memory */}
        {health?.memory && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2"><HardDrive className="w-5 h-5" />{t("status.memoryUsage", locale)}</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">{t("status.rss", locale)}</p>
                <p className="font-mono">{health.memory.rss}MB</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("status.heapUsed", locale)}</p>
                <p className="font-mono">{health.memory.heapUsed}MB</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("status.heapTotal", locale)}</p>
                <p className="font-mono">{health.memory.heapTotal}MB</p>
              </div>
              <div>
                <p className="text-muted-foreground">{t("status.external", locale)}</p>
                <p className="font-mono">{health.memory.external}MB</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Data Stats */}
      <h2 className="text-xl font-bold mb-4">{t("status.dataStatistics", locale)}</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: <Users className="w-5 h-5" />, key: "users", value: metrics?.data.users },
          { icon: <BookOpen className="w-5 h-5" />, key: "courses", value: metrics?.data.courses },
          { icon: <CreditCard className="w-5 h-5" />, key: "payments", value: metrics?.data.completedPayments },
          { icon: <FileText className="w-5 h-5" />, key: "articles", value: metrics?.data.publishedArticles },
          { icon: <Users className="w-5 h-5" />, key: "enrollments", value: metrics?.data.activeEnrollments },
          { icon: <Bell className="w-5 h-5" />, key: "unread", value: metrics?.data.unreadNotifications },
        ].map((stat, i) => (
          <Card key={i}>
            <CardContent className="pt-6 text-center">
              <div className="flex justify-center mb-2 text-blue-600">{stat.icon}</div>
              <p className="text-2xl font-bold">{stat.value ?? "-"}</p>
              <p className="text-sm text-muted-foreground">{t(`status.${stat.key}`, locale)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-8 text-center">
        {t("status.lastUpdated", locale)} {health?.timestamp || t("status.unknown", locale)}
      </p>
    </div>
  );
}
