"use client";

import React from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { DocumentPageLayout } from "@/components/DocumentPageLayout";
import { BookOpen } from "lucide-react";

export function LicensePage() {
  const { locale } = useAppStore();

  const tocItems = [
    { id: "license-1", label: t("license.toc1", locale) },
    { id: "license-2", label: t("license.toc2", locale) },
    { id: "license-3", label: t("license.toc3", locale) },
    { id: "license-4", label: t("license.toc4", locale) },
    { id: "license-5", label: t("license.toc5", locale) },
    { id: "license-6", label: t("license.toc6", locale) },
    { id: "license-7", label: t("license.toc7", locale) },
  ];

  return (
    <DocumentPageLayout
      icon={BookOpen}
      title={t("legal.licenseAgreement", locale)}
      tocItems={tocItems}
      footer={
        <div className="mt-12 pt-6 border-t text-center text-sm text-muted-foreground">
          <p>&copy; 2024-2026 Maestria by Maestro7IT. {t("footer.rights", locale)}</p>
          <p className="mt-1">
            <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">
              Creative Commons Attribution-ShareAlike 4.0 International
            </a>
          </p>
        </div>
      }
    >
      <section id="license-1">
        <h2 className="text-xl font-bold mb-4 text-primary">1. {tocItems[0].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>1.1. {t("license.s1_1", locale)}</p>
          <p>1.2. {t("license.s1_2", locale)}</p>
          <p>1.3. {t("license.s1_3", locale)}</p>
        </div>
      </section>

      <section id="license-2">
        <h2 className="text-xl font-bold mb-4 text-primary">2. {tocItems[1].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>2.1. {t("license.s2_1", locale)}</p>
          <p>2.2. {t("license.s2_2", locale)}</p>
          <p>2.3. {t("license.s2_3", locale)}</p>
        </div>
      </section>

      <section id="license-3">
        <h2 className="text-xl font-bold mb-4 text-primary">3. {tocItems[2].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>3.1. {t("license.s3_1", locale)}</p>
          <p>3.2. {t("license.s3_2", locale)}</p>
          <p>3.3. {t("license.s3_3", locale)}</p>
          <p>3.4. {t("license.s3_4", locale)}</p>
        </div>
      </section>

      <section id="license-4">
        <h2 className="text-xl font-bold mb-4 text-primary">4. {tocItems[3].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>4.1. {t("license.s4_1", locale)}</p>
          <p>4.2. {t("license.s4_2", locale)}</p>
        </div>
      </section>

      <section id="license-5">
        <h2 className="text-xl font-bold mb-4 text-primary">5. {tocItems[4].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>5.1. {t("license.s5_1", locale)}</p>
          <p>5.2. {t("license.s5_2", locale)}</p>
          <p>5.3. {t("license.s5_3", locale)}</p>
        </div>
      </section>

      <section id="license-6">
        <h2 className="text-xl font-bold mb-4 text-primary">6. {tocItems[5].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>6.1. {t("license.s6_1", locale)}</p>
          <p>6.2. {t("license.s6_2", locale)}</p>
        </div>
      </section>

      <section id="license-7">
        <h2 className="text-xl font-bold mb-4 text-primary">7. {tocItems[6].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>7.1. {t("license.s7_1", locale)}</p>
          <p>7.2. {t("license.s7_2", locale)}</p>
        </div>
      </section>
    </DocumentPageLayout>
  );
}
