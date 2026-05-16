"use client";

import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { DocumentPageLayout } from "@/components/DocumentPageLayout";
import { Cookie } from "lucide-react";

export function CookiePage() {
  const { locale } = useAppStore();

  const tocItems = [
    { id: "cookie-1", label: t("cookie.toc1", locale) },
    { id: "cookie-2", label: t("cookie.toc2", locale) },
    { id: "cookie-3", label: t("cookie.toc3", locale) },
    { id: "cookie-4", label: t("cookie.toc4", locale) },
    { id: "cookie-5", label: t("cookie.toc5", locale) },
    { id: "cookie-6", label: t("cookie.toc6", locale) },
  ];

  return (
    <DocumentPageLayout
      icon={Cookie}
      title={t("legal.cookiePolicy", locale)}
      tocItems={tocItems}
    >
      <section id="cookie-1">
        <h2 className="text-xl font-bold mb-4 text-primary">1. {tocItems[0].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>1.1. {t("cookie.s1_1", locale)}</p>
          <p>1.2. {t("cookie.s1_2", locale)}</p>
          <p>1.3. {t("cookie.s1_3", locale)}</p>
        </div>
      </section>

      <section id="cookie-2">
        <h2 className="text-xl font-bold mb-4 text-primary">2. {tocItems[1].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>2.1. {t("cookie.s2_1", locale)}</p>
          <ul>
            <li><strong>{t("cookie.s2_1a_label", locale)}</strong> {t("cookie.s2_1a", locale)}</li>
            <li><strong>{t("cookie.s2_1b_label", locale)}</strong> {t("cookie.s2_1b", locale)}</li>
            <li><strong>{t("cookie.s2_1c_label", locale)}</strong> {t("cookie.s2_1c", locale)}</li>
            <li><strong>{t("cookie.s2_1d_label", locale)}</strong> {t("cookie.s2_1d", locale)}</li>
          </ul>
        </div>
      </section>

      <section id="cookie-3">
        <h2 className="text-xl font-bold mb-4 text-primary">3. {tocItems[2].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>3.1. {t("cookie.s3_1", locale)}</p>
          <ul>
            <li>{t("cookie.s3_1a", locale)}</li>
            <li>{t("cookie.s3_1b", locale)}</li>
            <li>{t("cookie.s3_1c", locale)}</li>
            <li>{t("cookie.s3_1d", locale)}</li>
            <li>{t("cookie.s3_1e", locale)}</li>
            <li>{t("cookie.s3_1f", locale)}</li>
          </ul>
        </div>
      </section>

      <section id="cookie-4">
        <h2 className="text-xl font-bold mb-4 text-primary">4. {tocItems[3].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>4.1. {t("cookie.s4_1", locale)}</p>
          <p>4.2. {t("cookie.s4_2", locale)}</p>
          <p>4.3. {t("cookie.s4_3", locale)}</p>
        </div>
      </section>

      <section id="cookie-5">
        <h2 className="text-xl font-bold mb-4 text-primary">5. {tocItems[4].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>5.1. {t("cookie.s5_1", locale)}</p>
          <p>5.2. {t("cookie.s5_2", locale)}</p>
          <p>5.3. {t("cookie.s5_3", locale)}</p>
        </div>
      </section>

      <section id="cookie-6">
        <h2 className="text-xl font-bold mb-4 text-primary">6. {tocItems[5].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>6.1. {t("cookie.s6_1", locale)}</p>
          <p>6.2. {t("cookie.s6_2", locale)}</p>
        </div>
      </section>
    </DocumentPageLayout>
  );
}
