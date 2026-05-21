import { t } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BarChart, LineChart } from "@/components/admin/Charts";
import { FileText, Timer, BookCheck, TrendingUp } from "lucide-react";
import {
  demoReadingSessions,
  demoAvgReadingTime,
  demoMaterialProgress,
} from "@/data/demo-data";
import type { AdminTabProps } from "./types";

export function AdminMaterials(props: AdminTabProps) {
  const { locale, dayLabels: _dayLabels, monthLabels } = props;

  const dayLabelsI18n = [
    t("common.dayMon", locale), t("common.dayTue", locale), t("common.dayWed", locale),
    t("common.dayThu", locale), t("common.dayFri", locale), t("common.daySat", locale),
    t("common.daySun", locale),
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t("adminPage.kpiReadingSessions", locale), value: demoReadingSessions.reduce((a, b) => a + b, 0), icon: <FileText className="w-5 h-5 text-blue-600" /> },
          { label: t("adminPage.kpiAvgReadingTime", locale), value: `${Math.round(demoAvgReadingTime.reduce((a, b) => a + b, 0) / 7)} ${t("common.min", locale)}`, icon: <Timer className="w-5 h-5 text-amber-600" /> },
          { label: t("adminPage.kpiCompleted", locale), value: demoMaterialProgress.reduce((a, m) => a + m.completed, 0), icon: <BookCheck className="w-5 h-5 text-green-600" /> },
          { label: t("adminPage.kpiAvgProgress", locale), value: `${Math.round(demoMaterialProgress.reduce((a, m) => a + m.readPercent, 0) / demoMaterialProgress.length)}%`, icon: <TrendingUp className="w-5 h-5 text-violet-600" /> },
        ].map((stat, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">{stat.icon}<span className="text-xl font-bold">{stat.value}</span></div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-700" />
              {t("admin.readingSessions", locale)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={demoReadingSessions} labels={dayLabelsI18n} color="#4f46e5" height={200} />
            <div className="flex justify-between mt-3 text-xs text-muted-foreground">
              <span>{t("adminPage.statTotal", locale)}: <strong className="text-foreground">{demoReadingSessions.reduce((a, b) => a + b, 0)}</strong></span>
              <span>{t("adminPage.statPeak", locale)}: <strong className="text-foreground">{`${dayLabelsI18n[demoReadingSessions.indexOf(Math.max(...demoReadingSessions))]} (${Math.max(...demoReadingSessions)})`}</strong></span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Timer className="w-5 h-5 text-amber-600" />
              {t("admin.avgReadingTime", locale)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart data={demoAvgReadingTime} labels={dayLabelsI18n} color="#f59e0b" height={200} fillOpacity={0.12} />
            <div className="flex justify-between mt-3 text-xs text-muted-foreground">
              <span>{t("adminPage.statMin", locale)}: <strong className="text-foreground">{Math.min(...demoAvgReadingTime)} {t("common.min", locale)}</strong></span>
              <span>{t("adminPage.statMax", locale)}: <strong className="text-foreground">{Math.max(...demoAvgReadingTime)} {t("common.min", locale)}</strong></span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookCheck className="w-5 h-5 text-green-600" />
            {t("admin.readingProgress", locale)}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("adminPage.thCourse", locale)}</TableHead>
                  <TableHead>{t("adminPage.thReadingProgress", locale)}</TableHead>
                  <TableHead>{t("adminPage.thAvgTime", locale)}</TableHead>
                  <TableHead>{t("adminPage.thReaders", locale)}</TableHead>
                  <TableHead>{t("adminPage.thCompleted", locale)}</TableHead>
                  <TableHead>{t("adminPage.thVisual", locale)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {demoMaterialProgress.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-sm">{item.course}</TableCell>
                    <TableCell>
                      <span className={`font-semibold ${item.readPercent >= 70 ? 'text-green-600' : item.readPercent >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                        {item.readPercent}%
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{item.avgTime}</TableCell>
                    <TableCell className="text-sm">{item.totalReaders}</TableCell>
                    <TableCell className="text-sm">{item.completed}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={item.readPercent} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground w-8">{item.readPercent}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-violet-600" />
            {t("adminPage.statEngagement", locale)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LineChart data={[42, 48, 55, 62, 68, 75, 82, 88, 92, 95, 78, 85]} labels={monthLabels} color="#7c3aed" height={180} fillOpacity={0.15} />
          <div className="flex justify-between mt-3 text-xs text-muted-foreground">
            <span>{t("adminPage.statTrend", locale)}: <strong className="text-green-600">{t("common.growth", locale)} +38%</strong></span>
            <span>{t("adminPage.statAvgEngagement", locale)}: <strong className="text-foreground">72%</strong></span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
