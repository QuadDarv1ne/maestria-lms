import { t } from "@/lib/i18n";
import { useAppStore } from "@/lib/store";
import { formatNumber } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BookOpen, CheckCircle2, FileText, TrendingUp, Eye,
} from "lucide-react";
import type { AdminTabProps } from "./types";

export function AdminCourses(props: AdminTabProps) {
  const { locale, courses, avgRating } = props;
  const { navigate } = useAppStore();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t("adminPage.kpiCourses", locale), value: courses.length, icon: <BookOpen className="w-5 h-5 text-blue-600" /> },
          { label: t("adminPage.kpiPublished", locale), value: courses.filter(c => c.isPublished).length, icon: <CheckCircle2 className="w-5 h-5 text-green-600" /> },
          { label: t("adminPage.kpiDrafts", locale), value: courses.filter(c => !c.isPublished).length, icon: <FileText className="w-5 h-5 text-amber-600" /> },
          { label: t("adminPage.kpiAvgRating", locale), value: avgRating, icon: <TrendingUp className="w-5 h-5 text-violet-600" /> },
        ].map((stat, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">{stat.icon}<span className="text-xl font-bold">{stat.value}</span></div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("adminPage.thCourse", locale)}</TableHead>
                  <TableHead>{t("adminPage.thCategory", locale)}</TableHead>
                  <TableHead>{t("adminPage.thTeacher", locale)}</TableHead>
                  <TableHead>{t("adminPage.thPrice", locale)}</TableHead>
                  <TableHead>{t("adminPage.thRating", locale)}</TableHead>
                  <TableHead>{t("adminPage.thStudents", locale)}</TableHead>
                  <TableHead>{t("adminPage.thStatus", locale)}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courses.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell className="font-medium text-sm max-w-[200px] truncate">{course.title}</TableCell>
                    <TableCell className="text-sm">{course.category?.name || t("adminPage.courseNoCategory", locale)}</TableCell>
                    <TableCell className="text-sm">{course.teacher?.name || t("admin.notAvailable", locale)}</TableCell>
                    <TableCell className="text-sm">
                      {course.price === 0 ? <Badge className="bg-green-100 text-green-700 border-0 text-xs">{t("courseCard.free", locale)}</Badge> : `${formatNumber(course.price, locale)}`}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{course.rating > 0 ? course.rating.toFixed(1) : t("admin.notAvailable", locale)}</TableCell>
                    <TableCell className="text-sm">{course._count.enrollments}</TableCell>
                    <TableCell>
                      {course.isPublished
                        ? <Badge className="bg-green-100 text-green-700 border-0 text-xs">{t("common.published", locale)}</Badge>
                        : <Badge className="bg-yellow-100 text-yellow-700 border-0 text-xs">{t("common.draft", locale)}</Badge>
                      }
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => navigate(`course/${course.id}`)}>
                        <Eye className="w-4 h-4" />
                      </Button>
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
            <TrendingUp className="w-5 h-5 text-blue-700" />
            {t("adminPage.statTopCourses", locale)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...courses].sort((a, b) => b._count.enrollments - a._count.enrollments).slice(0, 8).map((course, i) => (
              <div key={course.id} className="flex items-center gap-3">
                <span className={`text-sm font-bold w-7 text-center ${i < 3 ? 'text-amber-500' : 'text-muted-foreground'}`}>#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{course.title}</p>
                  <p className="text-xs text-muted-foreground">{course._count.enrollments} {t("common.students", locale)}</p>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0">{course.rating.toFixed(1)}</Badge>
              </div>
            ))}
            {courses.length === 0 && <p className="text-sm text-muted-foreground">{t("adminPage.statNoData", locale)}</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
