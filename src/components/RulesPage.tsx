"use client";

import React from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { DocumentPageLayout } from "@/components/DocumentPageLayout";
import { Scale } from "lucide-react";

export function RulesPage() {
  const { locale } = useAppStore();

  const tocItems = [
    { id: "rules-1", label: t("rules.toc1", locale) },
    { id: "rules-2", label: t("rules.toc2", locale) },
    { id: "rules-3", label: t("rules.toc3", locale) },
    { id: "rules-4", label: t("rules.toc4", locale) },
    { id: "rules-5", label: t("rules.toc5", locale) },
    { id: "rules-6", label: t("rules.toc6", locale) },
    { id: "rules-7", label: t("rules.toc7", locale) },
    { id: "rules-8", label: t("rules.toc8", locale) },
  ];

  return (
    <DocumentPageLayout
      icon={Scale}
      title={t("legal.platformRules", locale)}
      tocItems={tocItems}
    >
      <section id="rules-1">
        <h2 className="text-xl font-bold mb-4 text-primary">1. {tocItems[0].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>1.1. {t("rules.s1_1", locale)}</p>
          <p>1.2. {t("rules.s1_2", locale)}</p>
          <p>1.3. {t("rules.s1_3", locale)}</p>
        </div>
      </section>

      <section id="rules-2">
        <h2 className="text-xl font-bold mb-4 text-primary">2. {tocItems[1].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>2.1. {t("rules.s2_1", locale)}</p>
          <p>2.2. {t("rules.s2_2", locale)}</p>
          <p>2.3. {t("rules.s2_3", locale)}</p>
          <p>2.4. {t("rules.s2_4", locale)}</p>
        </div>
      </section>

      <section id="rules-3">
        <h2 className="text-xl font-bold mb-4 text-primary">3. {tocItems[2].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>3.1. {t("rules.s3_1", locale)}</p>
          <p>3.2. {t("rules.s3_2", locale)}</p>
          <p>3.3. {t("rules.s3_3", locale)}</p>
          <p>3.4. {t("rules.s3_4", locale)}</p>
        </div>
      </section>

      <section id="rules-4">
        <h2 className="text-xl font-bold mb-4 text-primary">4. {tocItems[3].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>4.1. {t("rules.s4_1", locale)}</p>
          <p>4.2. {t("rules.s4_2", locale)}</p>
          <p>4.3. {t("rules.s4_3", locale)}</p>
          <p>4.4. {t("rules.s4_4", locale)}</p>
        </div>
      </section>

      <section id="rules-5">
        <h2 className="text-xl font-bold mb-4 text-primary">5. {tocItems[4].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>5.1. {t("rules.s5_1", locale)}</p>
          <ul>
            <li>{t("rules.s5_1a", locale)}</li>
            <li>{t("rules.s5_1b", locale)}</li>
            <li>{t("rules.s5_1c", locale)}</li>
            <li>{t("rules.s5_1d", locale)}</li>
            <li>{t("rules.s5_1e", locale)}</li>
            <li>{t("rules.s5_1f", locale)}</li>
            <li>{t("rules.s5_1g", locale)}</li>
          </ul>
        </div>
      </section>

      <section id="rules-6">
        <h2 className="text-xl font-bold mb-4 text-primary">6. {tocItems[5].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>6.1. {t("rules.s6_1", locale)}</p>
          <p>6.2. {t("rules.s6_2", locale)}</p>
          <p>6.3. {t("rules.s6_3", locale)}</p>
          <p>6.4. {t("rules.s6_4", locale)}</p>
        </div>
      </section>

      <section id="rules-7">
        <h2 className="text-xl font-bold mb-4 text-primary">7. {tocItems[6].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>7.1. {t("rules.s7_1", locale)}</p>
          <p>7.2. {t("rules.s7_2", locale)}</p>
          <p>7.3. {t("rules.s7_3", locale)}</p>
        </div>
      </section>

      <section id="rules-8">
        <h2 className="text-xl font-bold mb-4 text-primary">8. {tocItems[7].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>8.1. {t("rules.s8_1", locale)}</p>
          <p>8.2. {t("rules.s8_2", locale)}</p>
        </div>
      </section>
    </DocumentPageLayout>
  );
}
