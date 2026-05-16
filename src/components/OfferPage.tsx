"use client";

import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { DocumentPageLayout } from "@/components/DocumentPageLayout";
import { FileSignature } from "lucide-react";

export function OfferPage() {
  const { locale } = useAppStore();

  const tocItems = [
    { id: "offer-1", label: t("offer.toc1", locale) },
    { id: "offer-2", label: t("offer.toc2", locale) },
    { id: "offer-3", label: t("offer.toc3", locale) },
    { id: "offer-4", label: t("offer.toc4", locale) },
    { id: "offer-5", label: t("offer.toc5", locale) },
    { id: "offer-6", label: t("offer.toc6", locale) },
    { id: "offer-7", label: t("offer.toc7", locale) },
    { id: "offer-8", label: t("offer.toc8", locale) },
  ];

  return (
    <DocumentPageLayout
      icon={FileSignature}
      title={t("legal.publicOffer", locale)}
      tocItems={tocItems}
    >
      <section id="offer-1">
        <h2 className="text-xl font-bold mb-4 text-primary">1. {tocItems[0].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>1.1. {t("offer.s1_1", locale)}</p>
          <p>1.2. {t("offer.s1_2", locale)}</p>
          <p>1.3. {t("offer.s1_3", locale)}</p>
          <p>1.4. {t("offer.s1_4", locale)}</p>
        </div>
      </section>

      <section id="offer-2">
        <h2 className="text-xl font-bold mb-4 text-primary">2. {tocItems[1].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>2.1. {t("offer.s2_1", locale)}</p>
          <p>2.2. {t("offer.s2_2", locale)}</p>
          <p>2.3. {t("offer.s2_3", locale)}</p>
          <p>2.4. {t("offer.s2_4", locale)}</p>
        </div>
      </section>

      <section id="offer-3">
        <h2 className="text-xl font-bold mb-4 text-primary">3. {tocItems[2].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>3.1. {t("offer.s3_1", locale)}</p>
          <p>3.2. {t("offer.s3_2", locale)}</p>
          <p>3.3. {t("offer.s3_3", locale)}</p>
        </div>
      </section>

      <section id="offer-4">
        <h2 className="text-xl font-bold mb-4 text-primary">4. {tocItems[3].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>4.1. {t("offer.s4_1", locale)}</p>
          <p>4.2. {t("offer.s4_2", locale)}</p>
          <p>4.3. {t("offer.s4_3", locale)}</p>
          <p>4.4. {t("offer.s4_4", locale)}</p>
          <p>4.5. {t("offer.s4_5", locale)}</p>
        </div>
      </section>

      <section id="offer-5">
        <h2 className="text-xl font-bold mb-4 text-primary">5. {tocItems[4].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>5.1. {t("offer.s5_1", locale)}</p>
          <p>5.2. {t("offer.s5_2", locale)}</p>
          <p>5.3. {t("offer.s5_3", locale)}</p>
          <p>5.4. {t("offer.s5_4", locale)}</p>
        </div>
      </section>

      <section id="offer-6">
        <h2 className="text-xl font-bold mb-4 text-primary">6. {tocItems[5].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>6.1. {t("offer.s6_1", locale)}</p>
          <p>6.2. {t("offer.s6_2", locale)}</p>
          <p>6.3. {t("offer.s6_3", locale)}</p>
          <p>6.4. {t("offer.s6_4", locale)}</p>
          <p>6.5. {t("offer.s6_5", locale)}</p>
        </div>
      </section>

      <section id="offer-7">
        <h2 className="text-xl font-bold mb-4 text-primary">7. {tocItems[6].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>7.1. {t("offer.s7_1", locale)}</p>
          <p>7.2. {t("offer.s7_2", locale)}</p>
          <p>7.3. {t("offer.s7_3", locale)}</p>
          <p>7.4. {t("offer.s7_4", locale)}</p>
        </div>
      </section>

      <section id="offer-8">
        <h2 className="text-xl font-bold mb-4 text-primary">8. {tocItems[7].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <ul>
            <li><strong>{t("legal.company", locale)}</strong> Maestro7IT</li>
            <li><strong>{t("legal.head", locale)}</strong> {t("legal.headName", locale)}</li>
            <li><strong>Email:</strong> maksimqwe42@mail.ru</li>
            <li><strong>{t("legal.phone", locale)}</strong> +7 (915) 048-02-49</li>
            <li><strong>{t("legal.address", locale)}</strong> {t("legal.addressValue", locale)}</li>
          </ul>
        </div>
      </section>
    </DocumentPageLayout>
  );
}
