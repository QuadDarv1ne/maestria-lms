"use client";

/**
 * CheckoutDialog — modal that handles the full purchase flow:
 *
 *   1. Show course summary + price + promo code field
 *   2. Show payment method selector (only configured providers)
 *   3. On "Оплатить" click → POST /api/payments → redirect to confirmationUrl
 *      OR navigate to /payment/[id] (which shows QR for SBP)
 *
 * Usage:
 *   <CheckoutDialog course={course} open={open} onOpenChange={setOpen} />
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Tag, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { useAppStore } from "@/lib/store";
import { log } from "@/lib/logger";
import { t } from "@/lib/i18n";
import { formatCurrency } from "@/lib/utils";
import {
  PaymentMethodSelector,
  useAvailablePaymentMethods,
} from "./PaymentMethodSelector";

export interface CheckoutCourse {
  id: string;
  title: string;
  price: number;
  oldPrice?: number | null;
  currency: string;
  image?: string | null;
}

export function CheckoutDialog({
  course,
  open,
  onOpenChange,
}: {
  course: CheckoutCourse;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const router = useRouter();
  const user = useAppStore((s) => s.user);
  const locale = useAppStore((s) => s.locale);
  const { options, loading: methodsLoading } = useAvailablePaymentMethods();
  const [selected, setSelected] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoApplied, setPromoApplied] = useState<{ discount: number; finalPrice: number } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Auto-select first available method.
  useEffect(() => {
    if (!selected && options.length > 0) {
      setSelected(`${options[0].provider}:${options[0].method}`);
    }
  }, [options, selected]);

  // Apply promo code (calls /api/payments/promo/validate).
  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    try {
      const res = await fetch("/api/payments/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: promoCode.trim(),
          amount: course.price,
          courseId: course.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Промокод недействителен");
        setPromoApplied(null);
        return;
      }
      setPromoApplied({
        discount: data.discountAmount ?? 0,
        finalPrice: data.finalPrice ?? course.price,
      });
      toast.success(`Скидка применена: ${data.discountAmount ?? 0} ₽`);
    } catch (e) {
      log.error("Promo apply failed", { error: e instanceof Error ? e.message : String(e) });
      toast.error("Не удалось применить промокод");
    } finally {
      setPromoLoading(false);
    }
  };

  // Submit — create payment, redirect to confirmation URL or payment page.
  const handlePay = async () => {
    if (!user) {
      // Force login dialog
      window.location.href = "?dialog=login";
      return;
    }
    if (!selected) {
      toast.error("Выберите способ оплаты");
      return;
    }

    const [provider, method] = selected.split(":");
    setSubmitting(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: course.id,
          provider,
          method,
          promoCode: promoApplied ? promoCode : undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Ошибка при создании платежа");
        return;
      }

      // Redirect flow: card / e-wallet — go to provider's hosted page.
      if (data.confirmationUrl) {
        window.location.href = data.confirmationUrl;
        return;
      }

      // QR flow: SBP — go to our payment page which renders the QR.
      if (data.qrCode || data.payment?.paymentMethod?.toUpperCase() === "SBP") {
        onOpenChange(false);
        router.push(`/payment/${data.payment.id}`);
        return;
      }

      // Test mode (no provider configured) — go to payment page so the user
      // can simulate completion.
      if (data.testMode) {
        toast.info("Платёжный провайдер не настроен — тестовый режим");
        onOpenChange(false);
        router.push(`/payment/${data.payment.id}`);
        return;
      }

      // Fallback — go to payment page (will call init-provider).
      onOpenChange(false);
      router.push(`/payment/${data.payment.id}`);
    } catch (e) {
      log.error("Checkout failed", { error: e instanceof Error ? e.message : String(e) });
      toast.error("Не удалось начать оплату. Попробуйте позже.");
    } finally {
      setSubmitting(false);
    }
  };

  const finalPrice = promoApplied?.finalPrice ?? course.price;
  const discount = promoApplied?.discount ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Оформление заказа</DialogTitle>
          <DialogDescription>
            {course.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Order summary */}
          <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Стоимость курса</span>
              <span className="font-medium">
                {formatCurrency(course.price, course.currency || "RUB", locale)}
              </span>
            </div>
            {course.oldPrice && course.oldPrice > course.price && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Старая цена</span>
                <span className="line-through">
                  {formatCurrency(course.oldPrice, course.currency || "RUB", locale)}
                </span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                <span>Скидка по промокоду</span>
                <span>−{formatCurrency(discount, course.currency || "RUB", locale)}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t">
              <span className="font-semibold">Итого</span>
              <span className="font-bold text-lg">
                {formatCurrency(finalPrice, course.currency || "RUB", locale)}
              </span>
            </div>
          </div>

          {/* Promo code */}
          <div className="space-y-2">
            <Label htmlFor="promo" className="text-sm">Промокод</Label>
            <div className="flex gap-2">
              <Input
                id="promo"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="Введите промокод (необязательно)"
                disabled={promoLoading}
              />
              <Button
                variant="secondary"
                onClick={handleApplyPromo}
                disabled={promoLoading || !promoCode.trim()}
              >
                {promoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
                <span className="ml-1.5">Применить</span>
              </Button>
            </div>
          </div>

          {/* Payment method */}
          <div className="space-y-2">
            <Label className="text-sm">Способ оплаты</Label>
            {methodsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Загрузка способов оплаты...
              </div>
            ) : (
              <PaymentMethodSelector
                value={selected}
                onChange={setSelected}
                options={options}
              />
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Отмена
          </Button>
          <Button onClick={handlePay} disabled={submitting || methodsLoading || !selected}>
            {submitting ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Обработка...</>
            ) : (
              <><CreditCard className="w-4 h-4 mr-2" /> Оплатить {formatCurrency(finalPrice, course.currency || "RUB", locale)}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
