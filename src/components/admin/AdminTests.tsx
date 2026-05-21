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
import {
  ClipboardCheck,
  CheckCircle2,
  Award,
  TrendingUp,
  BarChart3,
  AlertTriangle,
} from "lucide-react";
import { LineChart, BarChart, DonutChart } from "@/components/admin/Charts";
import { demoTestCompletions, demoTestPassRate, demoTestResults } from "@/data/demo-data";
import type { AdminTabProps } from "./types";

export function AdminTests(props: AdminTabProps) {
  const { locale, dayLabels } = props;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t("adminPage.kpiTotalAttempts", locale), value: demoTestResults.reduce((a, t) => a + t.attempts, 0), icon: <ClipboardCheck className="w-5 h-5 text-blue-600" /> },
          { label: t("adminPage.kpiSuccessful", locale), value: demoTestResults.reduce((a, t) => a + t.completions, 0), icon: <CheckCircle2 className="w-5 h-5 text-green-600" /> },
          { label: t("adminPage.kpiAvgPassRate", locale), value: `${Math.round(demoTestResults.reduce((a, t) => a + t.passRate, 0) / demoTestResults.length)}%`, icon: <Award className="w-5 h-5 text-amber-600" /> },
          { label: t("adminPage.kpiAvgScore", locale), value: Math.round(demoTestResults.reduce((a, t) => a + t.avgScore, 0) / demoTestResults.length), icon: <TrendingUp className="w-5 h-5 text-violet-600" /> },
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
              <ClipboardCheck className="w-5 h-5 text-blue-700" />
              {t("admin.testCompletions", locale)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={demoTestCompletions} labels={dayLabels} color="#4f46e5" height={200} />
            <div className="flex justify-between mt-3 text-xs text-muted-foreground">
              <span>{t("adminPage.statTotal", locale)}: <strong className="text-foreground">{demoTestCompletions.reduce((a, b) => a + b, 0)}</strong></span>
              <span>{t("adminPage.statAvgDay", locale)}: <strong className="text-foreground">{Math.round(demoTestCompletions.reduce((a, b) => a + b, 0) / 7)}</strong></span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              {t("admin.testPassRate", locale)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart data={demoTestPassRate} labels={dayLabels} color="#10b981" height={200} />
            <div className="flex justify-between mt-3 text-xs text-muted-foreground">
              <span>{t("adminPage.statMin", locale)}: <strong className="text-foreground">{Math.min(...demoTestPassRate)}%</strong></span>
              <span>{t("adminPage.statMax", locale)}: <strong className="text-foreground">{Math.max(...demoTestPassRate)}%</strong></span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-violet-600" />
            {t("admin.testResults", locale)}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("adminPage.thCourse", locale)}</TableHead>
                  <TableHead>{t("adminPage.thPassRate", locale)}</TableHead>
                  <TableHead>{t("adminPage.thAvgScore", locale)}</TableHead>
                  <TableHead>{t("adminPage.thAttempts", locale)}</TableHead>
                  <TableHead>{t("adminPage.thSuccessful", locale)}</TableHead>
                  <TableHead>{t("adminPage.thProgress", locale)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {demoTestResults.map((test, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium text-sm">{test.course}</TableCell>
                    <TableCell>
                      <span className={`font-semibold ${test.passRate >= 75 ? 'text-green-600' : test.passRate >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                        {test.passRate}%
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{test.avgScore}/100</TableCell>
                    <TableCell className="text-sm">{test.attempts}</TableCell>
                    <TableCell className="text-sm">{test.completions}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={test.passRate} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground w-8">{test.passRate}%</span>
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
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            {t("adminPage.statTestDifficulty", locale)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DonutChart
            segments={[
              { label: t("adminPage.testDifficultyEasy", locale), value: 3, color: "#10b981" },
              { label: t("adminPage.testDifficultyMedium", locale), value: 3, color: "#f59e0b" },
              { label: t("adminPage.testDifficultyHard", locale), value: 2, color: "#ef4444" },
            ]}
            centerValue="8"
            centerLabel={t("adminPage.donutTests", locale)}
            size={160}
            strokeWidth={26}
          />
        </CardContent>
      </Card>
    </div>
  );
}
