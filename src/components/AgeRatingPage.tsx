"use client";

import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { DocumentPageLayout } from "@/components/DocumentPageLayout";
import { Baby } from "lucide-react";

export function AgeRatingPage() {
  const locale = useAppStore((s) => s.locale);

  const tocItems = [
    { id: "age-1", label: t("age.toc1", locale) },
    { id: "age-2", label: t("age.toc2", locale) },
    { id: "age-3", label: t("age.toc3", locale) },
    { id: "age-4", label: t("age.toc4", locale) },
    { id: "age-5", label: t("age.toc5", locale) },
    { id: "age-6", label: t("age.toc6", locale) },
  ];

  return (
    <DocumentPageLayout
      icon={Baby}
      title={t("legal.ageRating", locale)}
      tocItems={tocItems}
    >
      <section id="age-1">
        <h2 className="text-xl font-bold mb-4 text-primary">1. {tocItems[0].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>1.1. {t("age.s1_1", locale)}</p>
          <p>1.2. {t("age.s1_2", locale)}</p>
          <p>1.3. {t("age.s1_3", locale)}</p>
        </div>
      </section>

      <section id="age-2">
        <h2 className="text-xl font-bold mb-4 text-primary">2. {tocItems[1].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>2.1. {t("age.s2_1", locale)}</p>
          <ul>
            <li><strong>0+:</strong> {t("age.s2_1a", locale)}</li>
            <li><strong>6+:</strong> {t("age.s2_1b", locale)}</li>
            <li><strong>12+:</strong> {t("age.s2_1c", locale)}</li>
            <li><strong>16+:</strong> {t("age.s2_1d", locale)}</li>
            <li><strong>18+:</strong> {t("age.s2_1e", locale)}</li>
          </ul>
          <p>2.2. {t("age.s2_2", locale)}</p>
        </div>
      </section>

      <section id="age-3">
        <h2 className="text-xl font-bold mb-4 text-primary">3. {tocItems[2].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>3.1. {t("age.s3_1", locale)}</p>
          <p>3.2. {t("age.s3_2", locale)}</p>
          <p>3.3. {t("age.s3_3", locale)}</p>
        </div>
      </section>

      <section id="age-4">
        <h2 className="text-xl font-bold mb-4 text-primary">4. {tocItems[3].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>4.1. {t("age.s4_1", locale)}</p>
          <p>4.2. {t("age.s4_2", locale)}</p>
          <p>4.3. {t("age.s4_3", locale)}</p>
          <p>4.4. {t("age.s4_4", locale)}</p>
        </div>
      </section>

      <section id="age-5">
        <h2 className="text-xl font-bold mb-4 text-primary">5. {tocItems[4].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>5.1. {t("age.s5_1", locale)}</p>
          <p>5.2. {t("age.s5_2", locale)}</p>
          <p>5.3. {t("age.s5_3", locale)}</p>
        </div>
      </section>

      <section id="age-6">
        <h2 className="text-xl font-bold mb-4 text-primary">6. {tocItems[5].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <ul>
            <li><strong>{t("legal.company", locale)}</strong> Maestro7IT</li>
            <li><strong>Email:</strong> maksimqwe42@mail.ru</li>
            <li><strong>{t("legal.phone", locale)}</strong> +7 (915) 048-02-49</li>
          </ul>
        </div>
      </section>
    </DocumentPageLayout>
  );
}
