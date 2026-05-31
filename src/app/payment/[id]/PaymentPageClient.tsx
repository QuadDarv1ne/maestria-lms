"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
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
} from "lucide-react";
import { toast } from "sonner";

interface PaymentData {
  payment: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    paymentMethod: string;
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

const methodIcons: Record<string, React.ReactNode> = {
  yookassa: <CreditCard className="w-5 h-5" />,
};

export function PaymentPageClient({
  paymentId,
}: {
  paymentId: string;
}) {
  const router = useRouter();
  const { user, locale } = useAppStore();
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
    } catch {
      setError(t("payment.loadError", locale));
      return null;
    } finally {
      setLoading(false);
    }
  }, [paymentId, locale]);

  useEffect(() => {
    fetchPayment();
  }, [fetchPayment]);

  useEffect(() => {
    let isMounted = true;
    const startTime = Date.now();
    const interval = setInterval(async () => {
      if (Date.now() - startTime > MAX_POLL_TIME) {
        clearInterval(interval);
        return;
      }
      const updated = await fetchPayment();
      if (!isMounted) return;
      if (updated && updated.status !== "pending") {
        clearInterval(interval);
      }
    }, POLL_INTERVAL);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInitYooKassa = async () => {
    setInitiating(true);
    try {
      const res = await fetch(`/api/payments/${paymentId}/init-yookassa`, {
        method: "POST",
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || t("payment.initError", locale));
        return;
      }

      if (data.testMode) {
        toast.info(t("payment.notYooKassa", locale));
        return;
      }

      if (data.confirmationUrl) {
        window.location.href = data.confirmationUrl;
      }
    } catch {
      toast.error(t("payment.initError", locale));
    } finally {
      setInitiating(false);
    }
  };

  const handleSimulateComplete = async () => {
    setInitiating(true);
    try {
      const res = await fetch(`/api/payments/${paymentId}/simulate-complete`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(t("payment.simulateSuccess", locale));
        await fetchPayment();
      } else {
        toast.error(data.error || t("payment.simulateError", locale));
      }
    } catch {
      toast.error(t("payment.simulateError", locale));
    } finally {
      setInitiating(false);
    }
  };

  const statusConfig: Record<string, { label: string; color: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
    pending: {
      label: t("payment.pending", locale),
      color: "secondary",
      icon: <Clock className="w-4 h-4" />,
    },
    completed: {
      label: t("payment.completed", locale),
      color: "default",
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
    failed: {
      label: t("payment.failed", locale),
      color: "destructive",
      icon: <XCircle className="w-4 h-4" />,
    },
    refunded: {
      label: t("payment.refunded", locale),
      color: "outline",
      icon: <XCircle className="w-4 h-4" />,
    },
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-muted-foreground">{t("payment.authRequired", locale)}</p>
            <Button onClick={() => router.push("?dialog=login")}>
              {t("payment.login", locale)}
            </Button>
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
  const titleKey = payment.status === "completed"
    ? "payment.success"
    : payment.status === "failed"
    ? "payment.failed"
    : payment.status === "refunded"
    ? "payment.refunded"
    : "payment.title";

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
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                {methodIcons[payment.paymentMethod] || <CreditCard className="w-8 h-8 text-primary" />}
              </div>
            )}
          </div>
          <CardTitle className="text-xl">{t(titleKey, locale)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t("payment.course", locale)}</span>
              <span className="font-medium text-right max-w-[60%] truncate">
                {payment.course.title}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t("payment.amount", locale)}</span>
              <span className="font-semibold text-lg">
                {payment.amount.toLocaleString("ru-RU", {
                  style: "currency",
                  currency: payment.currency || "RUB",
                })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t("payment.method", locale)}</span>
              <Badge variant="outline" className="gap-1.5">
                {methodIcons[payment.paymentMethod]}
                {payment.paymentMethod === "yookassa"
                  ? "ЮKassa"
                  : payment.paymentMethod === "sbp"
                  ? "СБП"
                  : payment.paymentMethod === "tinkoff"
                  ? "Тинькофф"
                  : payment.paymentMethod === "card"
                  ? t("payment.method", locale)
                  : payment.paymentMethod}
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
              <p className="text-sm text-muted-foreground">
                {t("payment.courseAccess", locale)}
              </p>
              <Button
                className="w-full"
                onClick={() => router.push(`/course/${payment.course.id}`)}
              >
                {t("payment.toCourse", locale)}
              </Button>
            </div>
          )}

          {payment.status === "pending" && (
            <div className="space-y-3">
              {payment.paymentMethod === "yookassa" && (
                <Button
                  className="w-full gap-2"
                  onClick={handleInitYooKassa}
                  disabled={initiating}
                >
                  {initiating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4" />
                  )}
                  {initiating
                    ? t("payment.initYooKassaLoading", locale)
                    : t("payment.initYooKassa", locale)}
                </Button>
              )}

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleSimulateComplete}
                disabled={initiating}
              >
                {initiating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {initiating
                  ? t("payment.simulateProcessing", locale)
                  : t("payment.simulateComplete", locale)}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                {t("payment.autoRefresh", locale)}
              </p>
            </div>
          )}

          {payment.status === "failed" && (
            <div className="text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                {t("payment.needRetry", locale)}
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push(`/course/${payment.course.id}`)}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t("payment.returnToCourse", locale)}
              </Button>
            </div>
          )}

          {payment.status === "refunded" && (
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                {t("payment.refundInfo", locale)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
