"use client";

/**
 * Payment method selector — radio group with icons.
 *
 * Reads the list of available (provider, method) options from the API
 * (only methods backed by a configured provider are shown).
 * Used inside the course checkout dialog/modal.
 */

import { useEffect, useState } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CreditCard, QrCode, Wallet, Landmark, Building2, Sparkles } from "lucide-react";
import { log } from "@/lib/logger";

export interface PaymentOption {
  provider: string;
  method: string;
  label: string;
}

interface PaymentOptionWithIcon extends PaymentOption {
  icon: typeof CreditCard;
  description: string;
}

const METHOD_META: Record<string, { icon: typeof CreditCard; description: string }> = {
  SBP: { icon: QrCode, description: "Система быстрых платежей — мгновенно по QR" },
  CARD: { icon: CreditCard, description: "Visa, Mastercard, МИР" },
  YOOMONEY: { icon: Wallet, description: "Электронный кошелёк ЮMoney" },
  SBERPAY: { icon: Landmark, description: "Оплата в приложении Сбербанка" },
  TPAY: { icon: Landmark, description: "T-Pay — кнопка оплаты Т-Банка" },
  YANDEX_PAY: { icon: Sparkles, description: "Yandex Pay" },
  OZON_CARD: { icon: Building2, description: "Ozon Card — без комиссии для клиента" },
  WALLET: { icon: Wallet, description: "Электронный кошелёк" },
};

export function PaymentMethodSelector({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: PaymentOption[];
}) {
  // Annotate options with icons / descriptions
  const annotated: PaymentOptionWithIcon[] = options.map((opt) => {
    const meta = METHOD_META[opt.method] ?? METHOD_META.CARD;
    return { ...opt, icon: meta.icon, description: meta.description };
  });

  if (annotated.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Платёжные системы не настроены.
        <br />
        Обратитесь к администратору.
      </div>
    );
  }

  return (
    <RadioGroup
      value={value}
      onValueChange={onChange}
      className="grid grid-cols-1 sm:grid-cols-2 gap-3"
    >
      {annotated.map(({ provider, method, label, icon: Icon, description }) => {
        const id = `${provider}:${method}`;
        const selected = value === id;
        return (
          <Label
            key={id}
            htmlFor={id}
            data-selected={selected}
            className="flex items-center gap-3 rounded-lg border p-4 cursor-pointer hover:bg-accent transition-colors
                       data-[selected=true]:border-primary data-[selected=true]:bg-accent"
          >
            <RadioGroupItem value={id} id={id} />
            <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{label}</div>
              <div className="text-xs text-muted-foreground truncate">{description}</div>
            </div>
          </Label>
        );
      })}
    </RadioGroup>
  );
}

/**
 * Hook that fetches the list of available payment options from the server.
 * Returns `loading`, `options` and `error` state.
 *
 * Usage:
 *   const { options, loading } = useAvailablePaymentMethods();
 *   const [selected, setSelected] = useState("");
 *   useEffect(() => { if (options[0]) setSelected(`${options[0].provider}:${options[0].method}`); }, [options]);
 */
export function useAvailablePaymentMethods() {
  const [options, setOptions] = useState<PaymentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Use the GET /api/payments endpoint which returns availableMethods
        // (works for both authenticated and anonymous users — the GET route
        // doesn't require auth for the availableMethods field).
        const res = await fetch("/api/payments?limit=1", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setOptions(data.availableMethods ?? []);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load payment methods");
          log.error("useAvailablePaymentMethods failed", { error: e instanceof Error ? e.message : String(e) });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { options, loading, error };
}
