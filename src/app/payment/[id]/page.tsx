import type { Metadata } from "next";
import { PaymentPageClient } from "./PaymentPageClient";

export const metadata: Metadata = {
  title: "Payment | Maestria",
  robots: "noindex, nofollow",
};

export default async function PaymentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PaymentPageClient paymentId={id} />;
}
