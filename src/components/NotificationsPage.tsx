"use client";

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import type { Locale } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Award,
  Trophy,
  Star,
  Bell,
  CheckCheck,
  BellRing,
} from "lucide-react";

// ============ TYPE CONFIG ============

type NotificationType = "enrollment" | "completion" | "achievement" | "review" | "system";

interface TypeConfig {
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  badgeColor: string;
  label: string;
}

const typeConfig: Record<NotificationType, TypeConfig> = {
  enrollment: {
    icon: BookOpen,
    iconColor: "text-blue-600",
    iconBg: "bg-blue-100",
    badgeColor: "bg-blue-100 text-blue-700",
    label: t("notifications.type.enrollment"),
  },
  completion: {
    icon: Award,
    iconColor: "text-green-600",
    iconBg: "bg-green-100",
    badgeColor: "bg-green-100 text-green-700",
    label: t("notifications.type.completion"),
  },
  achievement: {
    icon: Trophy,
    iconColor: "text-amber-600",
    iconBg: "bg-amber-100",
    badgeColor: "bg-amber-100 text-amber-700",
    label: t("notifications.type.achievement"),
  },
  review: {
    icon: Star,
    iconColor: "text-violet-600",
    iconBg: "bg-violet-100",
    badgeColor: "bg-violet-100 text-violet-700",
    label: t("notifications.type.review"),
  },
  system: {
    icon: Bell,
    iconColor: "text-gray-500",
    iconBg: "bg-gray-100",
    badgeColor: "bg-gray-100 text-gray-600",
    label: t("notifications.type.system"),
  },
};

// ============ TIME AGO ============

function formatTimeAgo(timestamp: number, locale: Locale): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return t("notifications.time.justNow", locale);

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    if (diffMin === 1) return `1 ${t("notifications.time.minutesAgo", locale)}`;
    return `${diffMin} ${t("notifications.time.minutesAgo", locale)}`;
  }

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) {
    if (diffHour === 1) return `1 ${t("notifications.time.hoursAgo", locale)}`;
    return `${diffHour} ${t("notifications.time.hoursAgo", locale)}`;
  }

  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) {
    if (diffDay === 1) return `1 ${t("notifications.time.daysAgo", locale)}`;
    return `${diffDay} ${t("notifications.time.daysAgo", locale)}`;
  }

  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) {
    if (diffMonth === 1) return `1 ${t("notifications.time.monthsAgo", locale)}`;
    return `${diffMonth} ${t("notifications.time.monthsAgo", locale)}`;
  }

  const diffYear = Math.floor(diffMonth / 12);
  if (diffYear === 1) return `1 ${t("notifications.time.yearsAgo", locale)}`;
  return `${diffYear} ${t("notifications.time.yearsAgo", locale)}`;
}

// ============ COMPONENT ============

export function NotificationsPage() {
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    unreadNotificationsCount,
    navigate,
    locale,
  } = useAppStore();

  const unreadCount = unreadNotificationsCount();

  // Sort by createdAt descending (newest first)
  const sortedNotifications = useMemo(() => {
    return [...notifications].sort((a, b) => b.createdAt - a.createdAt);
  }, [notifications]);

  const handleNotificationClick = (id: string, link?: string) => {
    markNotificationRead(id);
    if (link) {
      navigate(link);
    }
  };

  const handleMarkAllRead = () => {
    markAllNotificationsRead();
  };

  // ── Empty state ──
  if (sortedNotifications.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-700 to-violet-600 rounded-lg flex items-center justify-center">
              <BellRing className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold">{t("notifications.title")}</h1>
              <p className="text-muted-foreground text-sm">
                {t("notifications.subtitle")}
              </p>
            </div>
          </div>
        </div>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-12 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Bell className="w-10 h-10 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold mb-2">{t("notifications.noNotifications")}</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              {t("notifications.emptyDesc")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-700 to-violet-600 rounded-lg flex items-center justify-center">
            <BellRing className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">{t("notifications.title")}</h1>
            <p className="text-muted-foreground text-sm">
              {unreadCount > 0
                ? `${unreadCount} ${t("notifications.unread")}`
                : t("notifications.allRead")}
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleMarkAllRead}
            className="self-start sm:self-auto"
          >
            <CheckCheck className="w-4 h-4 mr-2" />
            {t("notifications.readAll")}
          </Button>
        )}
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {sortedNotifications.map((notification) => {
          const config = typeConfig[notification.type as NotificationType] ?? typeConfig.system;
          const Icon = config.icon;
          const isUnread = !notification.read;

          return (
            <Card
              key={notification.id}
              className={`relative overflow-hidden transition-all duration-200 cursor-pointer hover:shadow-md ${
                isUnread
                  ? "border-l-4 border-l-blue-500 bg-blue-50/60 shadow-sm"
                  : "border-0 shadow-sm"
              }`}
              onClick={() =>
                handleNotificationClick(notification.id, notification.link)
              }
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${config.iconBg}`}
                  >
                    <Icon className={`w-5 h-5 ${config.iconColor}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3
                            className={`text-sm font-semibold truncate ${
                              isUnread ? "text-foreground" : "text-foreground/80"
                            }`}
                          >
                            {notification.title}
                          </h3>
                          <Badge
                            className={`${config.badgeColor} border-0 text-[10px] font-medium flex-shrink-0`}
                          >
                            {config.label}
                          </Badge>
                        </div>
                        <p
                          className={`text-sm leading-snug ${
                            isUnread
                              ? "text-foreground/70"
                              : "text-muted-foreground"
                          }`}
                        >
                          {notification.message}
                        </p>
                      </div>

                      {/* Right side: unread dot + time */}
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {isUnread && (
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
                        )}
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatTimeAgo(notification.createdAt, locale)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
