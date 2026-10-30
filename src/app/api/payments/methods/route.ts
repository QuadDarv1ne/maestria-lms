import { NextResponse } from "next/server";
import { getAvailablePaymentOptions } from "@/lib/payments/registry";

export const runtime = "nodejs";

/**
 * GET /api/payments/methods
 *
 * Public list of payment options backed by configured providers. Used by the
 * checkout dialog to render the method selector — must not require auth,
 * otherwise guests see an empty list instead of a login prompt.
 */
export async function GET() {
  return NextResponse.json(
    { methods: getAvailablePaymentOptions() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
