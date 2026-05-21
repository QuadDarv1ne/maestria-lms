import { t } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CheckCircle2, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import type { AdminTabProps } from "./types";

export function AdminReports(props: AdminTabProps) {
  const { locale, reports } = props;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 bg-red-50 dark:bg-red-950/30 rounded-xl">
            <p className="text-3xl font-bold text-red-600">{reports.filter(r => r.status === "pending").length}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("adminPage.statReportPending", locale)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-xl">
            <p className="text-3xl font-bold text-amber-600">{reports.filter(r => r.status === "reviewed").length}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("adminPage.statReportInProgress", locale)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 bg-green-50 dark:bg-green-950/30 rounded-xl">
            <p className="text-3xl font-bold text-green-600">{reports.filter(r => r.status === "resolved").length}</p>
            <p className="text-xs text-muted-foreground mt-1">{t("adminPage.statReportResolved", locale)}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("adminPage.thType", locale)}</TableHead>
                  <TableHead>{t("adminPage.thReporter", locale)}</TableHead>
                  <TableHead>{t("adminPage.thDescription", locale)}</TableHead>
                  <TableHead>{t("adminPage.thDate", locale)}</TableHead>
                  <TableHead>{t("adminPage.thStatus", locale)}</TableHead>
                  <TableHead>{t("adminPage.thActions", locale)}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {report.type === "content" ? t("adminPage.reportTypeContent", locale) : report.type === "user" ? t("adminPage.reportTypeUser", locale) : report.type === "bug" ? t("adminPage.reportTypeBug", locale) : t("adminPage.reportTypeOther", locale)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{report.userName}</TableCell>
                    <TableCell className="text-sm max-w-[300px] truncate">{report.description}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{report.createdAt}</TableCell>
                    <TableCell>
                      {report.status === "pending" ? <Badge className="bg-red-100 text-red-700 border-0 text-xs">{t("adminPage.statReportPending", locale)}</Badge> :
                       report.status === "reviewed" ? <Badge className="bg-yellow-100 text-yellow-700 border-0 text-xs">{t("adminPage.statReportInProgress", locale)}</Badge> :
                       <Badge className="bg-green-100 text-green-700 border-0 text-xs">{t("adminPage.statReportResolved", locale)}</Badge>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => toast.success(t("adminPage.reportMarkReviewed", locale))}>
                          <CheckCircle2 className="w-4 h-4 text-green-600" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => toast.success(t("adminPage.reportRejected", locale))}>
                          <XCircle className="w-4 h-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
