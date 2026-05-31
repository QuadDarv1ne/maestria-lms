import { env } from "@/lib/env";
import { log } from "@/lib/logger";

interface YooKassaPaymentResponse {
  id: string;
  status: string;
  confirmation?: {
    type: string;
    confirmation_url: string;
  };
  amount: {
    value: string;
    currency: string;
  };
  description?: string;
  metadata?: Record<string, string>;
}

interface YooKassaErrorResponse {
  type: string;
  id: string;
  code: string;
  description: string;
  parameter?: string;
}

const YOOKASSA_API_URL = "https://api.yookassa.ru/v3";

function getAuthHeader(): string | null {
  const shopId = env.yooKassaShopId;
  const secretKey = env.yooKassaSecretKey;
  if (!shopId || !secretKey) return null;
  const credentials = Buffer.from(`${shopId}:${secretKey}`).toString("base64");
  return `Basic ${credentials}`;
}

async function yooKassaRequest<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const auth = getAuthHeader();
  if (!auth) {
    throw new Error("YooKassa credentials not configured");
  }

  const res = await fetch(`${YOOKASSA_API_URL}${path}`, {
    method,
    headers: {
      "Authorization": auth,
      "Content-Type": "application/json",
      "Idempotence-Key": crypto.randomUUID(),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const errorBody: YooKassaErrorResponse = await res.json().catch(() => ({
      type: "error",
      id: "",
      code: "unknown",
      description: `HTTP ${res.status}`,
    }));
    log.error("YooKassa API error", {
      status: res.status,
      code: errorBody.code,
      description: errorBody.description,
    });
    throw new Error(`YooKassa: ${errorBody.code} — ${errorBody.description}`);
  }

  return res.json() as Promise<T>;
}

export interface CreatePaymentParams {
  amount: string;
  currency?: string;
  description: string;
  returnUrl: string;
  metadata?: Record<string, string>;
}

export interface CreatePaymentResult {
  yooKassaId: string;
  confirmationUrl: string;
  status: string;
}

export async function createPayment(
  params: CreatePaymentParams
): Promise<CreatePaymentResult> {
  const response = await yooKassaRequest<YooKassaPaymentResponse>("POST", "/payments", {
    amount: {
      value: params.amount,
      currency: params.currency || "RUB",
    },
    confirmation: {
      type: "redirect",
      return_url: params.returnUrl,
    },
    capture: true,
    description: params.description,
    metadata: params.metadata,
  });

  if (!response.confirmation?.confirmation_url) {
    log.error("YooKassa: no confirmation_url in response", { id: response.id, status: response.status });
    throw new Error("YooKassa: no confirmation URL returned");
  }

  return {
    yooKassaId: response.id,
    confirmationUrl: response.confirmation.confirmation_url,
    status: response.status,
  };
}

export interface PaymentStatusResult {
  status: string;
  paid: boolean;
}

export async function getPaymentStatus(
  yooKassaId: string
): Promise<PaymentStatusResult> {
  const response = await yooKassaRequest<YooKassaPaymentResponse>(
    "GET",
    `/payments/${yooKassaId}`
  );

  return {
    status: response.status,
    paid: response.status === "succeeded",
  };
}

export function isYooKassaConfigured(): boolean {
  return !!(env.yooKassaShopId && env.yooKassaSecretKey);
}
