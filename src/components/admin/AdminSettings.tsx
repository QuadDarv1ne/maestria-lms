import { t } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Globe, Monitor, Zap, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import type { AdminTabProps } from "./types";

export function AdminSettings(_props: AdminTabProps) {
  const locale = _props.locale;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Globe className="w-5 h-5 text-blue-700" />{t("admin.platform", locale)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { title: t("adminPage.settingMaintenance", locale), desc: t("adminPage.settingMaintenanceDesc", locale), action: t("adminPage.settingMaintenanceAction", locale), color: "default" },
              { title: t("adminPage.settingRegistration", locale), desc: t("adminPage.settingRegistrationDesc", locale), action: t("adminPage.settingRegistrationAction", locale), color: "green" },
              { title: t("adminPage.settingModeration", locale), desc: t("adminPage.settingModerationDesc", locale), action: t("adminPage.settingModerationAction", locale), color: "blue" },
              { title: t("adminPage.settingEmailNotify", locale), desc: t("adminPage.settingEmailNotifyDesc", locale), action: t("adminPage.settingEmailNotifyAction", locale), color: "blue" },
              { title: t("adminPage.setting2FA", locale), desc: t("adminPage.setting2FADesc", locale), action: t("adminPage.setting2FAAction", locale), color: "green" },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
                <Button
                  size="sm"
                  variant={item.color === "default" ? "outline" : undefined}
                  className={item.color === "green" ? "bg-green-600 hover:bg-green-700 text-white" : item.color === "blue" ? "bg-blue-700 hover:bg-blue-800 text-white" : undefined}
                  onClick={() => toast.success(`${item.title}: ${item.action}`)}
                >
                  {item.action}
                </Button>
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
            <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => toast.info(t("adminPage.cacheCleared", locale))}>
              {t("adminPage.settingClearCacheBtn", locale)}
            </Button>
          </div>
          <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
            <div>
              <p className="text-sm font-medium">{t("adminPage.settingResetData", locale)}</p>
              <p className="text-xs text-muted-foreground">{t("adminPage.settingResetDataDesc", locale)}</p>
            </div>
            <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50" onClick={() => toast.info(t("adminPage.testDataReset", locale))}>
              {t("adminPage.settingResetDataBtn", locale)}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
