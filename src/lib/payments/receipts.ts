/**
 * 54-ФЗ online receipt builder.
 *
 * Russian Federal Law 54-ФЗ requires every B2C online payment to be
 * accompanied by a fiscal cheque registered via an accredited Fiscal Data
 * Operator (ОФД). YooKassa, Tinkoff Kassa and CloudPayments act as fiscal
 * agents — they send the receipt to ОФД on your behalf if you pass a `receipt`
 * object when creating a payment.
 *
 * For online courses the correct `payment_subject` is `service` (or
 * `intellectual_activity` for content you own the IP rights to).
 */

import type { Receipt, ReceiptItem } from "./types";

export interface BuildReceiptInput {
  courseTitle: string;
  /**
   * RUB, the amount actually charged — i.e. already net of any promo-code
   * discount. YooKassa and friends have no per-item discount field, so the
   * caller must pass the discounted figure; a separate `discountAmount` would
   * only invite receipts whose total disagrees with the money captured.
   */
  amount: number;
  customer: {
    email?: string;
    phone?: string;
    fullName?: string;
  };
  /**
   * VAT code (НДС).
   *   1 = 20%       — standard rate, used by most LLCs
   *   2 = 10%       — food / kids / medical
   *   3 = 0%        — exported services / specific
   *   4 = no VAT    — simplified tax regime (УСН) — common for small EdTech
   *   5 = 20/120    — mixed
   *   6 = 10/110    — mixed
   * Default: 4 (no VAT) — safest for УСН-only sellers.
   */
  vatCode?: 1 | 2 | 3 | 4 | 5 | 6;
  /**
   * Tax system code (СНО).
   *   1 = Общая СН (ОСН)
   *   2 = Упрощённая СН (доходы)
   *   3 = Упрощённая СН (доходы минус расходы)
   *   4 = Единый налог на вменённый доход (ЕНВД)
   *   5 = Единый сельскохозяйственный налог (ЕСХН)
   *   6 = Патентная СН (ПСН)
   */
  taxSystemCode?: 1 | 2 | 3 | 4 | 5 | 6;
}

/**
 * Build a receipt describing a single course purchase.
 * Discount is split proportionally onto the item amount (YooKassa requires
 * the item's `amount` to already reflect the discount — they don't accept
 * a separate discount field per item).
 */
export function buildCourseReceipt(input: BuildReceiptInput): Receipt {
  const item: ReceiptItem = {
    description: input.courseTitle,
    amount: round2(input.amount),
    quantity: 1,
    vatCode: input.vatCode ?? 4, // default: no VAT (УСН)
    paymentMode: "full_payment",
    paymentSubject: "service", // online course = service
  };

  return {
    customer: {
      email: input.customer.email,
      phone: input.customer.phone,
      fullName: input.customer.fullName,
    },
    items: [item],
    taxSystemCode: input.taxSystemCode,
  };
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}
