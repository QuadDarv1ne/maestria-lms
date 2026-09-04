"use client";
import { useState } from "react";
import { t } from "@/lib/i18n";
import { apiErrorMessage } from "@/lib/api-error-codes";
import { formatDate, formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Gift, Plus, Loader2, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";
import type { AdminTabProps } from "./types";
import type { AdminCourse } from "@/hooks/useAdmin";

interface PromoCodeRecord {
  id: string;
  code: string;
  description: string | null;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minAmount: number;
  maxDiscount: number | null;
  maxUses: number;
  maxUsesPerUser: number;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
  usedCount: number;
  courseId: string | null;
  course: { id: string; title: string } | null;
  createdAt: string;
}

const emptyForm = {
  code: "",
  description: "",
  discountType: "percentage" as "percentage" | "fixed",
  discountValue: "10",
  minAmount: "0",
  maxUses: "0",
  maxUsesPerUser: "1",
  validUntil: "",
  courseId: "all",
};

export function AdminPromoCodes(props: AdminTabProps) {
  const { locale, courses } = props;
  const [promoCodes, setPromoCodes] = useState<PromoCodeRecord[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/promo-codes?limit=100");
      const data = await res.json();
      if (!res.ok) {
        toast.error(apiErrorMessage(data, locale, "adminPromo.error"));
        return;
      }
      setPromoCodes(data.promoCodes ?? []);
    } catch {
      toast.error(t("adminPromo.error", locale));
    } finally {
      setLoading(false);
    }
  };

  const create = async () => {
    const discountValue = Number(form.discountValue);
    if (!discountValue || discountValue <= 0) {
      toast.error(t("adminPromo.invalidValue", locale));
      return;
    }
    if (form.discountType === "percentage" && discountValue > 100) {
      toast.error(t("adminPromo.invalidPercent", locale));
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code.trim() || undefined,
          description: form.description.trim() || undefined,
          discountType: form.discountType,
          discountValue,
          minAmount: Number(form.minAmount) || 0,
          maxUses: Number(form.maxUses) || 0,
          maxUsesPerUser: Math.max(1, Number(form.maxUsesPerUser) || 1),
          validUntil: form.validUntil
            ? new Date(`${form.validUntil}T23:59:59`).toISOString()
            : undefined,
          courseId: form.courseId === "all" ? undefined : form.courseId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(apiErrorMessage(data, locale, "adminPromo.error"));
        return;
      }
      toast.success(t("adminPromo.created", locale));
      setForm(emptyForm);
      load();
    } catch {
      toast.error(t("adminPromo.error", locale));
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (promo: PromoCodeRecord) => {
    try {
      const res = await fetch(`/api/admin/promo-codes/${promo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !promo.isActive }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(apiErrorMessage(data, locale, "adminPromo.error"));
        return;
      }
      toast.success(t("adminPromo.updated", locale));
      load();
    } catch {
      toast.error(t("adminPromo.error", locale));
    }
  };

  const remove = async (promo: PromoCodeRecord) => {
    if (!window.confirm(`${t("adminPromo.confirmDelete", locale)} ${promo.code}?`)) return;
    try {
      const res = await fetch(`/api/admin/promo-codes/${promo.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(apiErrorMessage(data, locale, "adminPromo.error"));
        return;
      }
      toast.success(promo.usedCount > 0 ? t("adminPromo.deactivated", locale) : t("adminPromo.deleted", locale));
      load();
    } catch {
      toast.error(t("adminPromo.error", locale));
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(t("adminPromo.copied", locale));
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Gift className="w-5 h-5 text-amber-600" />
            {t("adminPromo.title", locale)}
          </CardTitle>
          <Button size="sm" onClick={() => { if (promoCodes === null) load(); }}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t("adminPromo.load", locale)}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Create form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("adminPromo.code", locale)}</Label>
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder={t("adminPromo.codePlaceholder", locale)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("adminPromo.discountType", locale)}</Label>
            <Select
              value={form.discountType}
              onValueChange={(v) => setForm({ ...form, discountType: v as "percentage" | "fixed" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">{t("adminPromo.percentage", locale)}</SelectItem>
                <SelectItem value="fixed">{t("adminPromo.fixed", locale)}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("adminPromo.discountValue", locale)}</Label>
            <Input
              type="number"
              min="1"
              value={form.discountValue}
              onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("adminPromo.validUntil", locale)}</Label>
            <Input
              type="date"
              value={form.validUntil}
              onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("adminPromo.maxUses", locale)}</Label>
            <Input
              type="number"
              min="0"
              value={form.maxUses}
              onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("adminPromo.maxUsesPerUser", locale)}</Label>
            <Input
              type="number"
              min="1"
              value={form.maxUsesPerUser}
              onChange={(e) => setForm({ ...form, maxUsesPerUser: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("adminPromo.course", locale)}</Label>
            <Select
              value={form.courseId}
              onValueChange={(v) => setForm({ ...form, courseId: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("adminPromo.allCourses", locale)}</SelectItem>
                {courses.map((c: AdminCourse) => (
                  <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 flex items-end">
            <Button onClick={create} disabled={creating} className="w-full">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {t("adminPromo.create", locale)}
            </Button>
          </div>
        </div>

        {/* List */}
        {promoCodes === null ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {t("adminPromo.load", locale)}…
          </p>
        ) : promoCodes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{t("adminPromo.noCodes", locale)}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("adminPromo.code", locale)}</TableHead>
                  <TableHead>{t("adminPromo.discount", locale)}</TableHead>
                  <TableHead>{t("adminPromo.course", locale)}</TableHead>
                  <TableHead>{t("adminPromo.usedCount", locale)}</TableHead>
                  <TableHead>{t("adminPromo.validity", locale)}</TableHead>
                  <TableHead>{t("admin.status", locale)}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promoCodes.map((p) => {
                  const expired = p.validUntil && new Date(p.validUntil) < new Date();
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{p.code}</span>
                          <button
                            onClick={() => copyCode(p.code)}
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={t("adminPromo.copy", locale)}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {p.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-[220px]">{p.description}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {p.discountType === "percentage"
                            ? `${p.discountValue}%`
                            : formatCurrency(p.discountValue, "RUB", locale)}
                        </Badge>
                        {p.minAmount > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t("adminPromo.minAmount", locale)}: {formatCurrency(p.minAmount, "RUB", locale)}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.course ? p.course.title : t("adminPromo.allCourses", locale)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.usedCount}
                        {p.maxUses > 0 && <span className="text-muted-foreground"> / {p.maxUses}</span>}
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.validUntil ? (
                          <span className={expired ? "text-red-600" : undefined}>
                            {t("adminPromo.until", locale)} {formatDate(p.validUntil, locale)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{t("adminPromo.noExpiry", locale)}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {expired ? (
                          <Badge className="bg-red-100 text-red-700 border-0">{t("adminPromo.expired", locale)}</Badge>
                        ) : p.isActive ? (
                          <Badge className="bg-green-100 text-green-700 border-0">{t("adminPromo.active", locale)}</Badge>
                        ) : (
                          <Badge variant="secondary">{t("adminPromo.inactive", locale)}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-2">
                          <Switch
                            checked={p.isActive}
                            disabled={expired === true}
                            onCheckedChange={() => toggleActive(p)}
                            aria-label={t("adminPromo.toggle", locale)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => remove(p)}
                            aria-label={t("adminPromo.delete", locale)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
