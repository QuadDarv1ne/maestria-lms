"use client";

import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { DocumentPageLayout } from "@/components/DocumentPageLayout";
import { FileText } from "lucide-react";

export function TermsPage() {
  const { locale } = useAppStore();

  const tocItems = [
    { id: "section-1", label: t("terms.toc1", locale) || "Общие положения" },
    { id: "section-2", label: t("terms.toc2", locale) || "Регистрация пользователя" },
    { id: "section-3", label: t("terms.toc3", locale) || "Использование платформы" },
    { id: "section-4", label: t("terms.toc4", locale) || "Интеллектуальная собственность" },
    { id: "section-5", label: t("terms.toc5", locale) || "Пользовательский контент (CC BY-SA 4.0)" },
    { id: "section-6", label: t("terms.toc6", locale) || "Ответственность сторон" },
    { id: "section-7", label: t("terms.toc7", locale) || "Разрешение споров" },
    { id: "section-8", label: t("terms.toc8", locale) || "Контактная информация" },
  ];

  return (
    <DocumentPageLayout
      icon={FileText}
      title={t("legal.terms", locale) || "Пользовательское соглашение"}
      tocItems={tocItems}
      footer={
        <div className="mt-12 pt-6 border-t text-center text-sm text-muted-foreground">
          <p>&copy; 2024-2026 Maestria by Maestro7IT. {t("footer.rights", locale)}</p>
          <p className="mt-1">
            {t("terms.userContentLicense", locale) || "Пользовательский контент доступен по лицензии"}{" "}
            <a
              href="https://creativecommons.org/licenses/by-sa/4.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline hover:no-underline"
            >
              CC BY-SA 4.0
            </a>
          </p>
        </div>
      }
    >
      {/* 1. Общие положения */}
      <section id="section-1">
        <h2 className="text-xl font-bold mb-4 text-primary">1. {tocItems[0].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>1.1. {t("terms.s1_1", locale)}</p>
          <p>1.2. {t("terms.s1_2", locale)}</p>
          <p>1.3. {t("terms.s1_3", locale)}</p>
          <p>1.4. {t("terms.s1_4", locale)}</p>
        </div>
      </section>

      {/* 2. Регистрация пользователя */}
      <section id="section-2">
        <h2 className="text-xl font-bold mb-4 text-primary">2. {tocItems[1].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>2.1. {t("terms.s2_1", locale)}</p>
          <p>2.2. {t("terms.s2_2", locale)}</p>
          <p>2.3. {t("terms.s2_3", locale)}</p>
          <p>2.4. {t("terms.s2_4", locale)}</p>
        </div>
      </section>

      {/* 3. Использование платформы */}
      <section id="section-3">
        <h2 className="text-xl font-bold mb-4 text-primary">3. {tocItems[2].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>3.1. {t("terms.s3_1", locale)}</p>
          <p>3.2. {t("terms.s3_2", locale)}</p>
          <p>3.3. {t("terms.s3_3", locale)}</p>
          <p>3.4. {t("terms.s3_4", locale)}</p>
          <p>3.5. {t("terms.s3_5", locale)}</p>
        </div>
      </section>

      {/* 4. Интеллектуальная собственность */}
      <section id="section-4">
        <h2 className="text-xl font-bold mb-4 text-primary">4. {tocItems[3].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>4.1. {t("terms.s4_1", locale)}</p>
          <p>4.2. {t("terms.s4_2", locale)}</p>
          <p>4.3. {t("terms.s4_3", locale)}</p>
        </div>
      </section>

      {/* 5. Пользовательский контент (CC BY-SA 4.0) */}
      <section id="section-5">
        <h2 className="text-xl font-bold mb-4 text-primary">5. {tocItems[4].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>5.1. {t("terms.s5_1", locale)}</p>
          <p>5.2. {t("terms.s5_2", locale)}</p>
          <p>5.3. {t("terms.s5_3", locale)}</p>
          <p>5.4. {t("terms.s5_4", locale)}</p>
          <p>5.5. {t("terms.s5_5", locale)}</p>
        </div>
      </section>

      {/* 6. Ответственность сторон */}
      <section id="section-6">
        <h2 className="text-xl font-bold mb-4 text-primary">6. {tocItems[5].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>6.1. {t("terms.s6_1", locale)}</p>
          <p>6.2. {t("terms.s6_2", locale)}</p>
          <p>6.3. {t("terms.s6_3", locale)}</p>
          <p>6.4. {t("terms.s6_4", locale)}</p>
        </div>
      </section>

      {/* 7. Разрешение споров */}
      <section id="section-7">
        <h2 className="text-xl font-bold mb-4 text-primary">7. {tocItems[6].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>7.1. {t("terms.s7_1", locale)}</p>
          <p>7.2. {t("terms.s7_2", locale)}</p>
          <p>7.3. {t("terms.s7_3", locale)}</p>
          <p>7.4. {t("terms.s7_4", locale)}</p>
        </div>
      </section>

      {/* 8. Контактная информация */}
      <section id="section-8">
        <h2 className="text-xl font-bold mb-4 text-primary">8. {tocItems[7].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>8.1. {t("terms.s8_1", locale)}</p>
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
