import { t } from "@/lib/i18n";
import type { UserRole } from "@/hooks/useAdmin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import {
  Users, UserCheck, UserX, Shield, TrendingUp, PieChart, Activity,
  Search, ChevronLeft, ChevronRight, BarChart3, Eye,
} from "lucide-react";
import { LineChart, BarChart, DonutChart } from "@/components/admin/Charts";
import { demoMonthlyRegistrations } from "@/data/demo-data";
import { useAppStore } from "@/lib/store";
import type { AdminTabProps } from "./types";

export function AdminUsers(props: AdminTabProps) {
  const {
    locale, users, monthLabels, dayLabels,
    totalStudents, totalTeachers, activeUsers,
    userSearch, userRoleFilter, userPage,
    filteredUsers, totalUserPages, paginatedUsers,
    handleUserSearch, handleRoleFilter, handleUserRoleChange,
    handleUserStatusChange, setUserPage,
  } = props;
  const { user, navigate } = useAppStore();

  const dayLabelsI18n = [
    t("common.dayMon", locale), t("common.dayTue", locale), t("common.dayWed", locale),
    t("common.dayThu", locale), t("common.dayFri", locale), t("common.daySat", locale),
    t("common.daySun", locale),
  ];

  return (
    <div className="space-y-6">
      {/* User stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t("adminPage.kpiTotalUsers", locale), value: users.length, icon: <Users className="w-5 h-5 text-blue-600" />, bg: "bg-blue-50 dark:bg-blue-950/30" },
          { label: t("adminPage.kpiActive", locale), value: activeUsers, icon: <UserCheck className="w-5 h-5 text-green-600" />, bg: "bg-green-50 dark:bg-green-950/30" },
          { label: t("adminPage.kpiBlocked", locale), value: users.length - activeUsers, icon: <UserX className="w-5 h-5 text-red-600" />, bg: "bg-red-50 dark:bg-red-950/30" },
          { label: t("adminPage.kpiWith2FA", locale), value: users.filter(u => u.twoFactorEnabled).length, icon: <Shield className="w-5 h-5 text-violet-600" />, bg: "bg-violet-50 dark:bg-violet-950/30" },
        ].map((stat, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardContent className={`p-4 ${stat.bg} rounded-xl`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
                {stat.icon}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* User growth chart */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-700" />
            {t("adminPage.statUserGrowth", locale)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <LineChart data={demoMonthlyRegistrations} labels={monthLabels} color="#4f46e5" height={180} />
        </CardContent>
      </Card>

      {/* Role distribution & Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="w-5 h-5 text-violet-600" />
              {t("adminPage.statRoleDistribution", locale)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart
              segments={[
                { label: t("adminPage.userRoleStudents", locale), value: totalStudents, color: "#4f46e5" },
                { label: t("adminPage.userRoleTeachers", locale), value: totalTeachers, color: "#f59e0b" },
                { label: t("adminPage.userRoleAdmins", locale), value: users.filter(u => u.role === "admin").length, color: "#7c3aed" },
              ]}
              centerValue={users.length.toString()}
              centerLabel={t("adminPage.donutUsers", locale)}
              size={160}
              strokeWidth={26}
            />
          </CardContent>
        </Card>

        {/* Activity by day */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-600" />
              {t("adminPage.statUserActivity", locale)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart data={[65, 78, 52, 89, 72, 38, 42]} labels={dayLabelsI18n} color="#10b981" height={180} />
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
              <span>{t("adminPage.statPeakDay", locale)}: <strong className="text-foreground">{`${dayLabelsI18n[3]} (89)`}</strong></span>
              <span>{t("adminPage.statAvgDayValue", locale)}: <strong className="text-foreground">{Math.round([65, 78, 52, 89, 72, 38, 42].reduce((a, b) => a + b, 0) / 7)}</strong></span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <CardTitle className="text-base">{t("adminPage.statUserList", locale)}</CardTitle>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t("adminPage.userSearch", locale)}
                  value={userSearch}
                  onChange={(e) => handleUserSearch(e.target.value)}
                  className="pl-9 h-9 w-full sm:w-[200px]"
                />
              </div>
              <Select value={userRoleFilter} onValueChange={handleRoleFilter}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder={t("adminPage.userRoleFilter", locale)} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("admin.allRoles", locale)}</SelectItem>
                  <SelectItem value="student">{t("adminPage.userRoleStudents", locale)}</SelectItem>
                  <SelectItem value="teacher">{t("adminPage.userRoleTeachers", locale)}</SelectItem>
                  <SelectItem value="admin">{t("adminPage.userRoleAdmins", locale)}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("adminPage.tabUsers", locale)}</TableHead>
                  <TableHead>{t("common.email", locale)}</TableHead>
                  <TableHead>{t("admin.role", locale)}</TableHead>
                  <TableHead>{t("admin.twoFA", locale)}</TableHead>
                  <TableHead>{t("admin.status", locale)}</TableHead>
                  <TableHead>{t("adminPage.kpiCourses", locale)}</TableHead>
                  <TableHead>{t("adminPage.statRegistrationDate", locale)}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-violet-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                          {(u.name ?? "").split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || t("admin.unknown", locale)}
                        </div>
                        <span className="font-medium text-sm">{u.name || t("adminPage.userNoName", locale)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{u.email}</TableCell>
                    <TableCell>
                      <Select value={u.role} onValueChange={(value) => handleUserRoleChange(u.id, value as UserRole)}>
                        <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="student">{t("role.student", locale)}</SelectItem>
                          <SelectItem value="teacher">{t("role.teacher", locale)}</SelectItem>
                          <SelectItem value="admin">{t("role.admin", locale)}</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${u.twoFactorEnabled ? 'border-green-300 text-green-700' : 'border-gray-300 text-gray-500'}`}>
                        {u.twoFactorEnabled ? t("adminPage.user2faOn", locale) : t("adminPage.user2faOff", locale)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => handleUserStatusChange(u.id, !u.isActive)}
                        disabled={u.id === user?.id}
                        className="cursor-pointer disabled:cursor-not-allowed"
                      >
                        {u.isActive
                          ? <Badge className="bg-green-100 text-green-700 border-0 text-xs hover:bg-green-200 transition-colors">{t("admin.active", locale)}</Badge>
                          : <Badge className="bg-red-100 text-red-700 border-0 text-xs hover:bg-red-200 transition-colors">{t("admin.blocked", locale)}</Badge>
                        }
                      </button>
                    </TableCell>
                    <TableCell className="text-sm">{u._count.enrollments}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(u.createdAt, locale)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => window.location.href = `/admin/student/${u.id}`}>
                          <BarChart3 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => navigate("profile")}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {paginatedUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      {t("adminPage.statNotFound", locale)}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="p-3 border-t text-xs text-muted-foreground flex items-center justify-between">
            <span>{t("adminPage.statFound", locale)}: {filteredUsers.length} / {users.length}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={userPage <= 1}
                onClick={() => setUserPage(p => p - 1)}
                className="h-7 px-2.5 text-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <span>{t("adminPage.statPage", locale)} {userPage} / {totalUserPages || 1}</span>
              <Button
                variant="outline"
                size="sm"
                disabled={userPage >= totalUserPages}
                onClick={() => setUserPage(p => p + 1)}
                className="h-7 px-2.5 text-xs"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
