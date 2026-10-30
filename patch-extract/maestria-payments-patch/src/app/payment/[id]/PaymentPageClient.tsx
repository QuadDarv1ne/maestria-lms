"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useAppStore } from "@/lib/store";
import { log } from "@/lib/logger";
import { t } from "@/lib/i18n";
import { formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Loader2,
  ArrowLeft,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";

interface PaymentData {
  payment: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    paymentMethod: string;
    paymentProvider?: string | null;
    paymentData: string | null;
    course: {
      id: string;
      title: string;
      image: string | null;
    };
  };
}

const POLL_INTERVAL = 3000;
const MAX_POLL_TIME = 10 * 60 * 1000;

/** Decode confirmation data stored as JSON in `payment.paymentData`. */
function readPaymentData(raw: string | null): {
  confirmationUrl?: string;
  qrCode?: string;
  provider?: string;
  providerPaymentId?: string;
} {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** Human-readable label per (provider, method) for display. */
function methodLabel(provider: string | null | undefined, method: string): string {
  const m = method?.toUpperCase();
  const labels: Record<string, string> = {
    SBP: "СБП — Система быстрых платежей",
    CARD: "Банковская карта",
    YOOMONEY: "ЮMoney",
    SBERPAY: "SberPay",
    TPAY: "T-Pay (Т-Банк)",
    YANDEX_PAY: "Yandex Pay",
    OZON_CARD: "Ozon Card",
    // Legacy values:
    YOOKASSA: "ЮKassa",
    TINKOFF: "Т-Банк",
  };
  if (labels[m]) return labels[m];
  // Legacy lowercase values
  if (method === "yookassa") return "ЮKassa";
  if (method === "sbp") return "СБП";
  if (method === "tinkoff") return "Т-Банк";
  if (method === "card") return "Банковская карта";
  return method;
}

export function PaymentPageClient({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const locale = useAppStore((s) => s.locale);
  const [payment, setPayment] = useState<PaymentData["payment"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [initiating, setInitiating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPayment = useCallback(async () => {
    try {
      const res = await fetch(`/api/payments/${paymentId}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError(t("payment.notFound", locale));
          return null;
        }
        throw new Error("fetch failed");
      }
      const data: PaymentData = await res.json();
      setPayment(data.payment);
      setError(null);
      return data.payment;
    } catch (e: unknown) {
      log.error("Payment fetch failed", { paymentId, error: e instanceof Error ? e.message : String(e) });
      setError(t("payment.loadError", locale));
      return null;
    } finally {
      setLoading(false);
    }
  }, [paymentId, locale]);

  const fetchPaymentRef = useRef(fetchPayment);
  useEffect(() => { fetchPaymentRef.current = fetchPayment; }, [fetchPayment]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchPayment();
      if (!cancelled) setPayment(result);
    })();
    return () => { cancelled = true; };
  }, [fetchPayment]);

  // Poll for status updates (every 3s for 10 minutes).
  useEffect(() => {
    let isMounted = true;
    const startTime = Date.now();
    const interval = setInterval(async () => {
      if (Date.now() - startTime > MAX_POLL_TIME) {
        clearInterval(interval);
        return;
      }
      const updated = await fetchPaymentRef.current();
      if (!isMounted) return;
      if (updated && updated.status !== "pending") {
        clearInterval(interval);
      }
    }, POLL_INTERVAL);
    return () => { isMounted = false; clearInterval(interval); };
  }, []);

  /** Universal init — calls /api/payments/[id]/init-provider, works for any provider. */
  const handleInitProvider = async () => {
    setInitiating(true);
    try {
      const res = await fetch(`/api/payments/${paymentId}/init-provider`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || t("payment.initError", locale));
        return;
      }

      if (data.testMode) {
        toast.info(data.message || t("payment.notYooKassa", locale));
        return;
      }

      if (data.confirmationUrl) {
        window.location.href = data.confirmationUrl;
      } else if (data.qrCode) {
        // Refresh payment to fetch the stored QR payload.
        await fetchPayment();
      }
    } catch (e: unknown) {
      log.error("Provider init failed", { paymentId, error: e instanceof Error ? e.message : String(e) });
      toast.error(t("payment.initError", locale));
    } finally {
      setInitiating(false);
    }
  };

  const handleSimulateComplete = async () => {
    setInitiating(true);
    try {
      const res = await fetch(`/api/payments/${paymentId}/simulate-complete`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(t("payment.simulateSuccess", locale));
        await fetchPayment();
      } else {
        toast.error(data.error || t("payment.simulateError", locale));
      }
    } catch (e: unknown) {
      log.error("Payment simulate-complete failed", { paymentId, error: e instanceof Error ? e.message : String(e) });
      toast.error(t("payment.simulateError", locale));
    } finally {
      setInitiating(false);
    }
  };

  const statusConfig: Record<string, { label: string; color: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
    pending: { label: t("payment.pending", locale), color: "secondary", icon: <Clock className="w-4 h-4" /> },
    completed: { label: t("payment.completed", locale), color: "default", icon: <CheckCircle2 className="w-4 h-4" /> },
    failed: { label: t("payment.failed", locale), color: "destructive", icon: <XCircle className="w-4 h-4" /> },
    refunded: { label: t("payment.refunded", locale), color: "outline", icon: <XCircle className="w-4 h-4" /> },
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-muted-foreground">{t("payment.authRequired", locale)}</p>
            <Button onClick={() => router.push("?dialog=login")}>{t("payment.login", locale)}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">{t("payment.loading", locale)}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !payment) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <XCircle className="w-12 h-12 text-destructive mx-auto" />
            <p className="text-destructive font-medium">{error}</p>
            <Button variant="outline" onClick={() => router.push("/catalog")}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              {t("payment.returnToCatalog", locale)}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!payment) return null;

  const config = statusConfig[payment.status] || statusConfig.pending;
  const titleKey =
    payment.status === "completed" ? "payment.success"
    : payment.status === "failed" ? "payment.failed"
    : payment.status === "refunded" ? "payment.refunded"
    : "payment.title";

  // Decode stored confirmation data
  const stored = readPaymentData(payment.paymentData);
  const isSbpQr =
    (payment.paymentMethod?.toUpperCase() === "SBP" ||
     payment.paymentMethod?.toUpperCase() === "YOOMONEY" ||
     payment.paymentMethod?.toUpperCase() === "WALLET")
    && !!stored.qrCode;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            {payment.status === "completed" ? (
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            ) : payment.status === "failed" || payment.status === "refunded" ? (
              <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
            ) : isSbpQr ? (
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <QrCode className="w-8 h-8 text-primary" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CreditCard className="w-8 h-8 text-primary" />
              </div>
            )}
          </div>
          <CardTitle className="text-xl">{t(titleKey, locale)}</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t("payment.course", locale)}</span>
              <span className="font-medium text-right max-w-[60%] truncate">{payment.course.title}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t("payment.amount", locale)}</span>
              <span className="font-semibold text-lg">
                {formatNumber(payment.amount, locale, { style: "currency", currency: payment.currency || "RUB" })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t("payment.method", locale)}</span>
              <Badge variant="outline" className="gap-1.5">
                {methodLabel(payment.paymentProvider, payment.paymentMethod)}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t("payment.status", locale)}</span>
              <Badge variant={config.color} className="gap-1.5">
                {config.icon}
                {config.label}
              </Badge>
            </div>
          </div>

          {payment.status === "completed" && (
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">{t("payment.courseAccess", locale)}</p>
              <Button className="w-full" onClick={() => router.push(`/course/${payment.course.id}`)}>
                {t("payment.toCourse", locale)}
              </Button>
            </div>
          )}

          {payment.status === "pending" && (
            <div className="space-y-3">
              {/* SBP QR code display */}
              {isSbpQr && (
                <div className="flex flex-col items-center gap-3 p-4 border rounded-lg bg-white">
                  <p className="text-sm text-muted-foreground text-center">
                    Отсканируйте QR-код в приложении вашего банка для оплаты через СБП
                  </p>
                  <QRCodeSVG value={stored.qrCode!} size={240} includeMargin={true} />
                  <p className="text-xs text-muted-foreground text-center">
                    После оплаты страница обновится автоматически
                  </p>
                </div>
              )}

              {/* Universal init button — calls current provider */}
              {!isSbpQr && (
                <Button
                  className="w-full gap-2"
                  onClick={handleInitProvider}
                  disabled={initiating}
                >
                  {initiating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                  {initiating ? "Обработка..." : `Перейти к оплате (${methodLabel(payment.paymentProvider, payment.paymentMethod)})`}
                </Button>
              )}

              {/* Dev-only: simulate completion */}
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleSimulateComplete}
                disabled={initiating}
              >
                {initiating ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {initiating ? t("payment.simulateProcessing", locale) : t("payment.simulateComplete", locale)}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                {t("payment.autoRefresh", locale)}
              </p>
            </div>
          )}

          {payment.status === "failed" && (
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">{t("payment.needRetry", locale)}</p>
              <Button variant="outline" className="w-full" onClick={() => router.push(`/course/${payment.course.id}`)}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t("payment.returnToCourse", locale)}
              </Button>
            </div>
          )}

          {payment.status === "refunded" && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">{t("payment.refundInfo", locale)}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
