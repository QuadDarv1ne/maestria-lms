"use client";

import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { DocumentPageLayout } from "@/components/DocumentPageLayout";
import { ShieldCheck } from "lucide-react";

export function PersonalDataConsentPage() {
  const locale = useAppStore((s) => s.locale);

  const tocItems = [
    { id: "pdc-1", label: t("pdc.toc1", locale) },
    { id: "pdc-2", label: t("pdc.toc2", locale) },
    { id: "pdc-3", label: t("pdc.toc3", locale) },
    { id: "pdc-4", label: t("pdc.toc4", locale) },
    { id: "pdc-5", label: t("pdc.toc5", locale) },
    { id: "pdc-6", label: t("pdc.toc6", locale) },
    { id: "pdc-7", label: t("pdc.toc7", locale) },
  ];

  return (
    <DocumentPageLayout
      icon={ShieldCheck}
      title={t("legal.personalDataConsent", locale)}
      tocItems={tocItems}
    >
      <section id="pdc-1">
        <h2 className="text-xl font-bold mb-4 text-primary">1. {tocItems[0].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>1.1. {t("pdc.s1_1", locale)}</p>
          <p>1.2. {t("pdc.s1_2", locale)}</p>
          <p>1.3. {t("pdc.s1_3", locale)}</p>
          <p>1.4. {t("pdc.s1_4", locale)}</p>
        </div>
      </section>

      <section id="pdc-2">
        <h2 className="text-xl font-bold mb-4 text-primary">2. {tocItems[1].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>2.1. {t("pdc.s2_1", locale)}</p>
          <ul>
            <li><strong>{t("pdc.s2_1a_label", locale)}</strong> {t("pdc.s2_1a", locale)}</li>
            <li><strong>{t("pdc.s2_1b_label", locale)}</strong> {t("pdc.s2_1b", locale)}</li>
            <li><strong>{t("pdc.s2_1c_label", locale)}</strong> {t("pdc.s2_1c", locale)}</li>
            <li><strong>{t("pdc.s2_1d_label", locale)}</strong> {t("pdc.s2_1d", locale)}</li>
            <li><strong>{t("pdc.s2_1e_label", locale)}</strong> {t("pdc.s2_1e", locale)}</li>
          </ul>
          <p>2.2. {t("pdc.s2_2", locale)}</p>
          <p>2.3. {t("pdc.s2_3", locale)}</p>
        </div>
      </section>

      <section id="pdc-3">
        <h2 className="text-xl font-bold mb-4 text-primary">3. {tocItems[2].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>3.1. {t("pdc.s3_1", locale)}</p>
          <ul>
            <li>{t("pdc.s3_1a", locale)}</li>
            <li>{t("pdc.s3_1b", locale)}</li>
            <li>{t("pdc.s3_1c", locale)}</li>
            <li>{t("pdc.s3_1d", locale)}</li>
            <li>{t("pdc.s3_1e", locale)}</li>
            <li>{t("pdc.s3_1f", locale)}</li>
            <li>{t("pdc.s3_1g", locale)}</li>
          </ul>
          <p>3.2. {t("pdc.s3_2", locale)}</p>
        </div>
      </section>

      <section id="pdc-4">
        <h2 className="text-xl font-bold mb-4 text-primary">4. {tocItems[3].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>4.1. {t("pdc.s4_1", locale)}</p>
          <p>4.2. {t("pdc.s4_2", locale)}</p>
          <p>4.3. {t("pdc.s4_3", locale)}</p>
          <p>4.4. {t("pdc.s4_4", locale)}</p>
        </div>
      </section>

      <section id="pdc-5">
        <h2 className="text-xl font-bold mb-4 text-primary">5. {tocItems[4].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>5.1. {t("pdc.s5_1", locale)}</p>
          <p>5.2. {t("pdc.s5_2", locale)}</p>
          <p>5.3. {t("pdc.s5_3", locale)}</p>
        </div>
      </section>

      <section id="pdc-6">
        <h2 className="text-xl font-bold mb-4 text-primary">6. {tocItems[5].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>6.1. {t("pdc.s6_1", locale)}</p>
          <ul>
            <li>{t("pdc.s6_1a", locale)}</li>
            <li>{t("pdc.s6_1b", locale)}</li>
            <li>{t("pdc.s6_1c", locale)}</li>
            <li>{t("pdc.s6_1d", locale)}</li>
            <li>{t("pdc.s6_1e", locale)}</li>
            <li>{t("pdc.s6_1f", locale)}</li>
          </ul>
          <p>6.2. {t("pdc.s6_2", locale)}</p>
          <p>6.3. {t("pdc.s6_3", locale)}</p>
        </div>
      </section>

      <section id="pdc-7">
        <h2 className="text-xl font-bold mb-4 text-primary">7. {tocItems[6].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>7.1. {t("pdc.s7_1", locale)}</p>
          <ul>
            <li><strong>{t("legal.company", locale)}</strong> Maestro7IT</li>
            <li><strong>{t("legal.head", locale)}</strong> {t("legal.headName", locale)}</li>
            <li><strong>Email:</strong> maksimqwe42@mail.ru</li>
            <li><strong>{t("legal.phone", locale)}</strong> +7 (915) 048-02-49</li>
            <li><strong>{t("legal.address", locale)}</strong> {t("legal.addressValue", locale)}</li>
          </ul>
          <p>7.2. {t("pdc.s7_2", locale)}</p>
        </div>
      </section>
    </DocumentPageLayout>
  );
}
