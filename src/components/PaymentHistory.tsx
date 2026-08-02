"use client";
import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { log } from "@/lib/logger";
import { formatDate, formatNumber } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Receipt, CreditCard, Loader2, Tag } from "lucide-react";

interface PaymentRecord {
  id: string;
  amount: number;
  discountAmount: number | null;
  currency: string;
  status: "paid" | "pending" | "failed" | "refunded" | "cancelled";
  paymentMethod: string;
  createdAt: string;
  course: { id: string; title: string } | null;
}

const statusKeys: Record<string, string> = {
  paid: "profile.paymentStatusPaid",
  pending: "profile.paymentStatusPending",
  failed: "profile.paymentStatusFailed",
  refunded: "profile.paymentStatusRefunded",
  cancelled: "profile.paymentStatusCancelled",
};

export function PaymentHistory() {
  const locale = useAppStore((s) => s.locale);
  const [payments, setPayments] = useState<PaymentRecord[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/payments?limit=20");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setPayments(data.payments ?? []);
        } else if (!cancelled) {
          setPayments([]);
        }
      } catch (e: unknown) {
        log.error("Failed to load payment history", { error: e instanceof Error ? e.message : String(e) });
        if (!cancelled) setPayments([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        {t("profile.paymentsLoading", locale)}
      </div>
    );
  }

  if (!payments || payments.length === 0) {
    return (
      <div className="text-center py-12">
        <Receipt className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">{t("profile.paymentsEmptyTitle", locale)}</h3>
        <p className="text-muted-foreground text-sm">{t("profile.paymentsEmptyDesc", locale)}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {payments.map((p) => {
        const statusKey = statusKeys[p.status] || "profile.paymentStatusPending";
        const statusColor =
          p.status === "paid"
            ? "bg-green-100 text-green-700 border-0"
            : p.status === "refunded" || p.status === "cancelled"
              ? "bg-gray-100 text-gray-600 border-0"
              : p.status === "failed"
                ? "bg-red-100 text-red-700 border-0"
                : "bg-amber-100 text-amber-700 border-0";
        return (
          <Card key={p.id} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center shrink-0">
                    <CreditCard className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {p.course?.title || t("profile.paymentsUnknownCourse", locale)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(p.createdAt, locale)} · {t(`profile.paymentMethod_${p.paymentMethod}`, locale) as string}
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-center justify-end gap-1.5">
                    {p.discountAmount && p.discountAmount > 0 && (
                      <Tag className="w-3.5 h-3.5 text-amber-600" />
                    )}
                    <span className="font-bold">{formatNumber(p.amount, locale)} ₽</span>
                  </div>
                  {p.discountAmount && p.discountAmount > 0 && (
                    <p className="text-xs text-green-600">
                      −{formatNumber(p.discountAmount, locale)} ₽
                    </p>
                  )}
                  <Badge className={`mt-1 text-[10px] ${statusColor}`}>
                    {t(statusKey, locale)}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
