import type { Metadata } from "next";
import { RefundPage } from "@/components/RefundPage";
export const metadata: Metadata = {
  title: "Возврат средств — Maestria",
  description: "Условия и порядок возврата денежных средств за платные курсы на образовательной платформе Maestria.",
  openGraph: { title: "Возврат средств — Maestria", description: "Условия и порядок возврата денежных средств за платные курсы на образовательной платформе Maestria." },
};
export default function Page() {
  return <RefundPage />;
}
