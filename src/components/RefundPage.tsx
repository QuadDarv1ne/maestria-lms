"use client";

import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { DocumentPageLayout } from "@/components/DocumentPageLayout";
import { RotateCcw } from "lucide-react";

export function RefundPage() {
  const locale = useAppStore((s) => s.locale);

  const tocItems = [
    { id: "refund-1", label: t("refund.toc1", locale) },
    { id: "refund-2", label: t("refund.toc2", locale) },
    { id: "refund-3", label: t("refund.toc3", locale) },
    { id: "refund-4", label: t("refund.toc4", locale) },
    { id: "refund-5", label: t("refund.toc5", locale) },
    { id: "refund-6", label: t("refund.toc6", locale) },
  ];

  return (
    <DocumentPageLayout
      icon={RotateCcw}
      title={t("legal.refundPolicy", locale)}
      tocItems={tocItems}
    >
      <section id="refund-1">
        <h2 className="text-xl font-bold mb-4 text-primary">1. {tocItems[0].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>1.1. {t("refund.s1_1", locale)}</p>
          <p>1.2. {t("refund.s1_2", locale)}</p>
          <p>1.3. {t("refund.s1_3", locale)}</p>
        </div>
      </section>

      <section id="refund-2">
        <h2 className="text-xl font-bold mb-4 text-primary">2. {tocItems[1].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>2.1. {t("refund.s2_1", locale)}</p>
          <p>2.2. {t("refund.s2_2", locale)}</p>
          <p>2.3. {t("refund.s2_3", locale)}</p>
          <p>2.4. {t("refund.s2_4", locale)}</p>
        </div>
      </section>

      <section id="refund-3">
        <h2 className="text-xl font-bold mb-4 text-primary">3. {tocItems[2].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>3.1. {t("refund.s3_1", locale)}</p>
          <p>3.2. {t("refund.s3_2", locale)}</p>
          <p>3.3. {t("refund.s3_3", locale)}</p>
          <p>3.4. {t("refund.s3_4", locale)}</p>
        </div>
      </section>

      <section id="refund-4">
        <h2 className="text-xl font-bold mb-4 text-primary">4. {tocItems[3].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>4.1. {t("refund.s4_1", locale)}</p>
          <p>4.2. {t("refund.s4_2", locale)}</p>
          <p>4.3. {t("refund.s4_3", locale)}</p>
          <p>4.4. {t("refund.s4_4", locale)}</p>
        </div>
      </section>

      <section id="refund-5">
        <h2 className="text-xl font-bold mb-4 text-primary">5. {tocItems[4].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>5.1. {t("refund.s5_1", locale)}</p>
          <ul>
            <li>{t("refund.s5_1a", locale)}</li>
            <li>{t("refund.s5_1b", locale)}</li>
            <li>{t("refund.s5_1c", locale)}</li>
            <li>{t("refund.s5_1d", locale)}</li>
          </ul>
        </div>
      </section>

      <section id="refund-6">
        <h2 className="text-xl font-bold mb-4 text-primary">6. {tocItems[5].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>6.1. {t("refund.s6_1", locale)}</p>
          <ul>
            <li><strong>Email:</strong> maksimqwe42@mail.ru</li>
            <li><strong>{t("legal.phone", locale)}</strong> +7 (915) 048-02-49</li>
            <li><strong>{t("legal.address", locale)}</strong> {t("legal.addressValue", locale)}</li>
          </ul>
        </div>
      </section>
    </DocumentPageLayout>
  );
}
