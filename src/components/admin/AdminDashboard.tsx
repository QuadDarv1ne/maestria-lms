import { t } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, GraduationCap, BookOpen, BarChart3, DollarSign, TrendingUp,
  ArrowUpRight, ArrowDownRight, PieChart, Zap, Server, Activity, Clock, Award,
} from "lucide-react";
import { LineChart, DonutChart, Sparkline } from "@/components/admin/Charts";
import { activityIcon } from "@/lib/constants";
import {
  demoMonthlyRegistrations, demoMonthlyEnrollments, demoCategoryDistribution,
  demoActivityLog,
} from "@/data/demo-data";
import type { AdminTabProps } from "./types";

export function AdminDashboard(props: AdminTabProps) {
  const { locale, courses, users, totalStudents, totalEnrollments, avgRating, totalRevenue, monthLabels } = props;
  const stats = { totalUsers: users.length, totalStudents, totalTeachers: users.filter(u => u.role === "teacher").length, totalPublishedCourses: courses.filter(c => c.isPublished).length, totalEnrollments, serverUptime: t("admin.notAvailable", locale) };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: t("adminPage.kpiUsers", locale), value: users.length, icon: <Users className="w-5 h-5 text-blue-600" />, trend: "+18%", up: true, sparkData: [30, 35, 42, 48, 55, 62, 70, 78, 85, 92, 100, 110], sparkColor: "#4f46e5" },
          { label: t("adminPage.kpiStudents", locale), value: totalStudents, icon: <GraduationCap className="w-5 h-5 text-violet-600" />, trend: "+22%", up: true, sparkData: [20, 25, 30, 35, 42, 48, 55, 60, 68, 75, 82, 90], sparkColor: "#7c3aed" },
          { label: t("adminPage.kpiCourses", locale), value: courses.length, icon: <BookOpen className="w-5 h-5 text-blue-700" />, trend: "+2", up: true, sparkData: [8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 30, 34], sparkColor: "#1d4ed8" },
          { label: t("adminPage.kpiEnrollments", locale), value: totalEnrollments, icon: <BarChart3 className="w-5 h-5 text-purple-600" />, trend: "+12%", up: true, sparkData: [50, 65, 80, 95, 110, 128, 145, 160, 178, 195, 210, 230], sparkColor: "#9333ea" },
          { label: t("adminPage.kpiRevenue", locale), value: `${(totalRevenue / 1000).toFixed(0)}K`, icon: <DollarSign className="w-5 h-5 text-emerald-600" />, trend: "+24%", up: true, sparkData: [32, 45, 58, 72, 85, 98, 112, 125, 138, 152, 168, 185], sparkColor: "#10b981" },
          { label: t("adminPage.kpiAvgRating", locale), value: avgRating, icon: <TrendingUp className="w-5 h-5 text-amber-600" />, trend: "+0.2", up: true, sparkData: [3.2, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 4.0, 4.1, 4.2, 4.3, 4.5], sparkColor: "#f59e0b" },
        ].map((stat, i) => (
          <Card key={i} className="border-0 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                {stat.icon}
                <Sparkline data={stat.sparkData} color={stat.sparkColor} />
              </div>
              <p className="text-2xl font-bold">{stat.value}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-muted-foreground">{stat.label}</span>
                <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${stat.up ? 'text-green-600' : 'text-red-600'}`}>
                  {stat.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {stat.trend}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-700" />
                {t("admin.registrations", locale)}
              </CardTitle>
              <Badge className="bg-green-100 text-green-700 border-0 text-xs">
                <ArrowUpRight className="w-3 h-3 mr-1" />+18%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <LineChart data={demoMonthlyRegistrations} labels={monthLabels} color="#4f46e5" height={220} />
            <div className="flex justify-between mt-3 text-xs text-muted-foreground">
              <span>{t("adminPage.statTotalYear", locale)}: <strong className="text-foreground">{demoMonthlyRegistrations.reduce((a, b) => a + b, 0)}</strong></span>
              <span>{t("adminPage.statAvgMonth", locale)}: <strong className="text-foreground">{Math.round(demoMonthlyRegistrations.reduce((a, b) => a + b, 0) / 12)}</strong></span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-violet-600" />
                {t("admin.enrollmentsChart", locale)}
              </CardTitle>
              <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">
                <ArrowUpRight className="w-3 h-3 mr-1" />+32%
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <LineChart data={demoMonthlyEnrollments} labels={monthLabels} color="#7c3aed" height={220} fillOpacity={0.15} />
            <div className="flex justify-between mt-3 text-xs text-muted-foreground">
              <span>{t("adminPage.statTotalYear", locale)}: <strong className="text-foreground">{demoMonthlyEnrollments.reduce((a, b) => a + b, 0)}</strong></span>
              <span>{t("adminPage.statAvgMonth", locale)}: <strong className="text-foreground">{Math.round(demoMonthlyEnrollments.reduce((a, b) => a + b, 0) / 12)}</strong></span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="w-5 h-5 text-amber-600" />
              {t("admin.categoryDist", locale)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              segments={demoCategoryDistribution}
              centerValue={courses.length.toString()}
              centerLabel={t("adminPage.donutCourses", locale)}
              size={160}
              strokeWidth={26}
            />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-600" />
              {t("admin.recentActivity", locale)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {demoActivityLog.slice(0, 6).map((item) => (
                <div key={item.id} className="flex items-start gap-2.5">
                  <div className="mt-0.5 w-6 h-6 bg-muted rounded-md flex items-center justify-center shrink-0">
                    {activityIcon(item.type, "w-3.5 h-3.5")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate">{item.description}</p>
                    <p className="text-[10px] text-muted-foreground">{item.userName} · {item.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Server className="w-5 h-5 text-green-600" />
              {t("adminPage.statSystem", locale)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { name: t("adminPage.statUsers", locale), value: stats?.totalUsers ?? "—", icon: <Users className="w-4 h-4 text-blue-600" /> },
                { name: t("adminPage.statStudents", locale), value: stats?.totalStudents ?? "—", icon: <GraduationCap className="w-4 h-4 text-green-600" /> },
                { name: t("adminPage.statTeachers", locale), value: stats?.totalTeachers ?? "—", icon: <Award className="w-4 h-4 text-amber-600" /> },
                { name: t("adminPage.statCourses", locale), value: stats?.totalPublishedCourses ?? "—", icon: <BookOpen className="w-4 h-4 text-violet-600" /> },
                { name: t("adminPage.statEnrollments", locale), value: stats?.totalEnrollments ?? "—", icon: <Activity className="w-4 h-4 text-emerald-600" /> },
                { name: t("adminPage.statUptime", locale), value: stats?.serverUptime ?? "—", icon: <Clock className="w-4 h-4 text-gray-600" /> },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    {item.icon}
                    <span className="text-sm">{item.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
