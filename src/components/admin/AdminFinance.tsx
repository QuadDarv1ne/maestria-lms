import { t } from "@/lib/i18n";
import { formatNumber } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, DonutChart } from "@/components/admin/Charts";
import { demoMonthlyRevenue } from "@/data/demo-data";
import type { AdminTabProps } from "./types";
import type { AdminCourse } from "@/hooks/useAdmin";
import {
  DollarSign, BookOpen, Gift, Wallet, ArrowUpRight, BarChart3, PieChart,
} from "lucide-react";

export function AdminFinance(props: AdminTabProps) {
  const { locale, courses, totalRevenue, monthLabels } = props;

  return (
    <div className="space-y-6">
      {/* Финансовые KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t("adminPage.kpiTotalRevenue", locale), value: `${formatNumber(totalRevenue, locale)} ₽`, icon: <DollarSign className="w-5 h-5 text-emerald-600" /> },
          { label: t("adminPage.kpiPaidCourses", locale), value: courses.filter(c => c.price > 0).length, icon: <BookOpen className="w-5 h-5 text-blue-600" /> },
          { label: t("adminPage.kpiFreeCourses", locale), value: courses.filter(c => c.price === 0).length, icon: <Gift className="w-5 h-5 text-amber-600" /> },
          { label: t("adminPage.kpiAvgCheck", locale), value: courses.filter(c => c.price > 0).length > 0 ? `${formatNumber(Math.round(courses.filter(c => c.price > 0).reduce((a, c) => a + c.price, 0) / courses.filter(c => c.price > 0).length), locale)} ₽` : "0 ₽", icon: <Wallet className="w-5 h-5 text-violet-600" /> },
        ].map((stat, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">{stat.icon}<span className="text-xl font-bold">{stat.value}</span></div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* График дохода */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              {t("admin.revenueChart", locale)}
            </CardTitle>
            <Badge className="bg-green-100 text-green-700 border-0 text-xs">
              <ArrowUpRight className="w-3 h-3 mr-1" />+42%
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <LineChart data={demoMonthlyRevenue.map(v => v / 1000)} labels={monthLabels} color="#10b981" height={220} fillOpacity={0.15} strokeWidth={3} />
          <div className="flex justify-between mt-3 text-xs text-muted-foreground">
            <span>{t("adminPage.statTotalIncome", locale)}: <strong className="text-foreground">{(demoMonthlyRevenue.reduce((a, b) => a + b, 0) / 1000).toFixed(0)}K ₽</strong></span>
            <span>{t("adminPage.statPeak", locale)}: <strong className="text-foreground">{`${(Math.max(...demoMonthlyRevenue) / 1000).toFixed(0)}K ₽ (${monthLabels[demoMonthlyRevenue.indexOf(Math.max(...demoMonthlyRevenue))]})`}</strong></span>
          </div>
        </CardContent>
      </Card>

      {/* Доход по категориям + Распределение */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-700" />
              {t("admin.revenueByCategory", locale)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(Object.entries(
                courses.reduce((acc: Record<string, number>, c: AdminCourse) => {
                  const cat = c.category?.name || t("adminPage.courseNoCategory", locale);
                  acc[cat] = (acc[cat] || 0) + c.price * c._count.enrollments;
                  return acc;
                }, {} as Record<string, number>)
              ) as [string, number][])
                .sort(([, a], [, b]) => b - a)
                .slice(0, 6)
                .map(([cat, revenue]) => {
                  const maxRev = totalRevenue || 1;
                  return (
                    <div key={cat}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="truncate mr-2">{cat}</span>
                        <span className="font-medium shrink-0">{formatNumber(revenue, locale)} ₽</span>
                      </div>
                      <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full transition-all duration-700" style={{ width: `${(revenue / maxRev) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              {totalRevenue === 0 && <p className="text-sm text-muted-foreground">{t("adminPage.statNoData", locale)}</p>}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="w-5 h-5 text-violet-600" />
              {t("admin.freeVsPaid", locale)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              segments={[
                { label: t("adminPage.coursePaid", locale), value: courses.filter(c => c.price > 0).length || 1, color: "#4f46e5" },
                { label: t("adminPage.courseFree", locale), value: courses.filter(c => c.price === 0).length || 1, color: "#10b981" },
              ]}
              centerValue={courses.length.toString()}
              centerLabel={t("adminPage.donutCourses", locale)}
              size={160}
              strokeWidth={26}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
