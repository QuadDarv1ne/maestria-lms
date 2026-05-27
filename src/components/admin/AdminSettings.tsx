import { useState } from "react";
import { t } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Globe, Monitor, Zap, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import type { AdminTabProps } from "./types";

interface SystemSettings {
  maintenanceMode: boolean;
  registrationDisabled: boolean;
  moderationEnabled: boolean;
  emailNotificationsEnabled: boolean;
}

export function AdminSettings(_props: AdminTabProps) {
  const locale = _props.locale;
  const [settings, setSettings] = useState<SystemSettings>({
    maintenanceMode: false,
    registrationDisabled: false,
    moderationEnabled: false,
    emailNotificationsEnabled: false,
  });
  const [loading, setLoading] = useState(false);

  async function toggleSetting(key: keyof SystemSettings) {
    if (loading) return;
    setLoading(true);
    try {
      const newValue = !settings[key];
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: newValue }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        toast.error(err.error || "Failed to update setting");
        return;
      }
      const updated = await res.json();
      setSettings(updated);
      toast.success(`${key} set to ${updated[key] ? "enabled" : "disabled"}`);
    } catch {
      toast.error("Network error while updating settings");
    } finally {
      setLoading(false);
    }
  }

  async function clearCache() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/cache/clear", { method: "POST" });
      if (!res.ok) {
        toast.error("Failed to clear cache");
        return;
      }
      toast.success("Cache cleared successfully");
    } catch {
      toast.error("Network error while clearing cache");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Globe className="w-5 h-5 text-blue-700" />{t("admin.platform", locale)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { key: "maintenanceMode" as const, title: t("adminPage.settingMaintenance", locale), desc: t("adminPage.settingMaintenanceDesc", locale) },
              { key: "registrationDisabled" as const, title: t("adminPage.settingRegistration", locale), desc: t("adminPage.settingRegistrationDesc", locale) },
              { key: "moderationEnabled" as const, title: t("adminPage.settingModeration", locale), desc: t("adminPage.settingModerationDesc", locale) },
              { key: "emailNotificationsEnabled" as const, title: t("adminPage.settingEmailNotify", locale), desc: t("adminPage.settingEmailNotifyDesc", locale) },
              { key: "twoFARequired" as const, title: t("adminPage.setting2FA", locale), desc: t("adminPage.setting2FADesc", locale), noSetting: true },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                {"noSetting" in item && item.noSetting ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.info("2FA is available per-user in the Users tab")}
                  >
                    {t("adminPage.setting2FAAction", locale)}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    disabled={loading}
                    className={settings[item.key]
                      ? "bg-green-600 hover:bg-green-700 text-white"
                      : "bg-blue-700 hover:bg-blue-800 text-white"}
                    onClick={() => toggleSetting(item.key)}
                  >
                    {settings[item.key] ? "Disable" : "Enable"}
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Monitor className="w-5 h-5 text-violet-600" />{t("admin.system", locale)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {[
              { label: t("adminPage.infoVersion", locale), value: "v3.1.0" },
              { label: "Next.js", value: "16.1.1" },
              { label: "React", value: "19.0.0" },
              { label: t("adminPage.infoDatabase", locale), value: t("admin.database", locale), special: true },
              { label: t("adminPage.infoServerRegion", locale), value: t("adminPage.infoServerRegionValue", locale) },
              { label: t("adminPage.infoLicense", locale), value: t("admin.licenseValue", locale) },
              { label: t("adminPage.infoCustomCursor", locale), value: t("admin.active", locale), special: true },
              { label: t("adminPage.infoThemes", locale), value: t("admin.themesInfo", locale) },
              { label: t("adminPage.infoLocales", locale), value: t("admin.localesInfo", locale) },
            ].map((item, i) => (
              <div key={i} className="flex justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">{item.label}</span>
                {item.special ? (
                  <span className="font-medium text-green-600 flex items-center gap-1"><Zap className="w-3 h-3" />{item.value}</span>
                ) : (
                  <span className="font-medium">{item.value}</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="border-2 border-red-200 dark:border-red-900/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            {t("adminPage.settingDangerZone", locale)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
            <div>
              <p className="text-sm font-medium">{t("adminPage.settingClearCache", locale)}</p>
              <p className="text-xs text-muted-foreground">{t("adminPage.settingClearCacheDesc", locale)}</p>
            </div>
            <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" disabled={loading} onClick={clearCache}>
              {t("adminPage.settingClearCacheBtn", locale)}
            </Button>
          </div>
          <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
            <div>
              <p className="text-sm font-medium">{t("adminPage.settingResetData", locale)}</p>
              <p className="text-xs text-muted-foreground">{t("adminPage.settingResetDataDesc", locale)}</p>
            </div>
            <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" disabled onClick={undefined}>
              {t("adminPage.settingResetDataBtn", locale)}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
