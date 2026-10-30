/**
 * Provider registry — central lookup that returns a configured provider
 * instance by name. All providers are lazy singletons (constructed on first
 * use, cached afterwards) so we don't read env vars at module load time.
 */

import type { IPaymentProvider, ProviderName, PaymentMethod } from "./types";
import { YooKassaProvider } from "./providers/yookassa";
import { TinkoffProvider } from "./providers/tinkoff";
import { OzonProvider } from "./providers/ozon";
import { SberbankProvider } from "./providers/sberbank";
import { VtbProvider } from "./providers/vtb";
import { MkbProvider } from "./providers/mkb";
import { CloudPaymentsProvider } from "./providers/cloudpayments";

const factories: Record<ProviderName, () => IPaymentProvider> = {
  YOOKASSA: () => new YooKassaProvider(),
  TINKOFF: () => new TinkoffProvider(),
  CLOUDPAYMENTS: () => new CloudPaymentsProvider(),
  SBER: () => new SberbankProvider(),
  OZON: () => new OzonProvider(),
  VTB: () => new VtbProvider(),
  MKB: () => new MkbProvider(),
};

const cache = new Map<ProviderName, IPaymentProvider>();

/** Get a provider instance (cached). Throws if name is unknown. */
export function getProvider(name: ProviderName): IPaymentProvider {
  let instance = cache.get(name);
  if (!instance) {
    const factory = factories[name];
    if (!factory) throw new Error(`Unknown payment provider: ${name}`);
    instance = factory();
    cache.set(name, instance);
  }
  return instance;
}

/** Safely parse a string into ProviderName, returns null on invalid input. */
export function parseProviderName(value: string | null | undefined): ProviderName | null {
  if (!value) return null;
  const upper = value.toUpperCase();
  return (upper in factories) ? (upper as ProviderName) : null;
}

/**
 * Pick the best provider for a given payment method.
 * Some methods are bound to a specific provider (e.g. OZON_CARD → OZON),
 * others may be served by any configured provider (CARD, SBP).
 *
 * Order of preference mirrors the typical Russian market reality:
 * YooKassa > Tinkoff > CloudPayments for general methods.
 */
export function pickProviderForMethod(
  method: PaymentMethod,
  configuredOnly = true,
): ProviderName {
  const bindings: Partial<Record<PaymentMethod, ProviderName>> = {
    YOOMONEY: "YOOKASSA",
    YANDEX_PAY: "YOOKASSA",
    SBERPAY: "SBER",
    TPAY: "TINKOFF",
    OZON_CARD: "OZON",
    // CARD / SBP / WALLET — served by any provider (default YooKassa)
  };

  const preferred = bindings[method] ?? "YOOKASSA";
  if (!configuredOnly) return preferred;

  // If preferred provider isn't configured, fall back to any configured one.
  if (getProvider(preferred).isConfigured()) return preferred;

  const all: ProviderName[] = ["YOOKASSA", "TINKOFF", "CLOUDPAYMENTS", "OZON", "SBER"];
  for (const name of all) {
    if (getProvider(name).isConfigured()) return name;
  }
  return preferred; // nothing configured — return preferred so caller gets a meaningful error
}

/** Return all providers that are currently configured (env vars present). */
export function getConfiguredProviders(): ProviderName[] {
  return (Object.keys(factories) as ProviderName[]).filter((n) => getProvider(n).isConfigured());
}

/**
 * Return all (provider, method) pairs currently available to the user.
 * Used by the UI to render the payment method selector.
 */
export function getAvailablePaymentOptions(): Array<{
  provider: ProviderName;
  method: PaymentMethod;
  label: string;
}> {
  const result: Array<{ provider: ProviderName; method: PaymentMethod; label: string }> = [];
  for (const name of Object.keys(factories) as ProviderName[]) {
    const provider = getProvider(name);
    if (!provider.isConfigured()) continue;
    for (const method of provider.supportedMethods) {
      // De-duplicate: if a method is already supported by an earlier provider, skip.
      if (result.some((r) => r.method === method)) continue;
      result.push({ provider: name, method, label: methodLabel(method) });
    }
  }
  return result;
}

/** Human-readable Russian label for a payment method. */
export function methodLabel(method: PaymentMethod): string {
  const labels: Record<PaymentMethod, string> = {
    CARD: "Банковская карта",
    SBP: "СБП — Система быстрых платежей",
    YOOMONEY: "ЮMoney",
    SBERPAY: "SberPay",
    TPAY: "T-Pay (Т-Банк)",
    YANDEX_PAY: "Yandex Pay",
    OZON_CARD: "Ozon Card",
    WALLET: "Электронный кошелёк",
  };
  return labels[method] ?? method;
}

/**
 * Determine which provider sent a webhook when the request has no
 * `x-payment-provider` header and no `?provider=` query param.
 *
 * Most gateways post to the same URL without identifying themselves, so we
 * have to recognise their payload shape. Returns null when the body doesn't
 * match any known provider.
 */
export function detectProviderFromWebhook(
  headers: Record<string, string>,
  body: unknown,
): ProviderName | null {
  if (headers["x-content-hmac"]) return "CLOUDPAYMENTS";
  if (headers["x-ozon-signature"]) return "OZON";

  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;

  // T-Bank: every notification carries TerminalKey + Token.
  if (typeof b.TerminalKey === "string" && typeof b.Token === "string") return "TINKOFF";

  // CloudPayments: InvoiceId (our payment id) + Status/TransactionId.
  if (typeof b.InvoiceId === "string" && (b.Status !== undefined || b.TransactionId !== undefined)) {
    return "CLOUDPAYMENTS";
  }

  // Ozon Pay: snake_case payload with payment_id.
  if (typeof b.payment_id === "string" && (b.webhook_id !== undefined || b.order_id !== undefined)) {
    return "OZON";
  }

  // Sberbank: mdOrder (provider order id) + orderNumber (our payment id).
  if (typeof b.mdOrder === "string") return "SBER";

  // ВТБ / МКБ — merchant-specific payloads, only reachable via ?provider=.
  if (typeof b.transaction_id === "string" && typeof b.order_id === "string") return "VTB";

  // ЮKassa (и legacy-формат `{ status, object }`) — единственный с полем object.
  if (b.object && typeof b.object === "object") return "YOOKASSA";

  return null;
}
