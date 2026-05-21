import { t } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { activityIcon, ACTIVITY_TYPE_LABELS, ACTIVITY_TYPE_COLORS } from "@/lib/constants";
import { demoActivityLog } from "@/data/demo-data";
import type { AdminTabProps } from "./types";

export function AdminLogs(props: AdminTabProps) {
  const { locale } = props;

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              {t("adminPage.statLogJournal", locale)}
            </CardTitle>
            <Badge variant="outline" className="text-xs">{demoActivityLog.length} {t("adminPage.statLogEntries", locale)}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {demoActivityLog.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted/80 transition-colors">
                <div className="w-9 h-9 bg-background rounded-lg flex items-center justify-center shrink-0 shadow-sm">
                  {activityIcon(item.type, "w-4 h-4")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{item.description}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.userName} · {item.timestamp}
                  </p>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] shrink-0 ${ACTIVITY_TYPE_COLORS[item.type] || "border-gray-300 text-gray-700"}`}
                >
                  {t(ACTIVITY_TYPE_LABELS[item.type] || item.type, locale)}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
