"use client";

import React from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { DocumentPageLayout } from "@/components/DocumentPageLayout";
import { Shield } from "lucide-react";

export function PrivacyPage() {
  const { locale } = useAppStore();

  const tocItems = [
    { id: "privacy-1", label: t("privacy.toc1", locale) || "Общие сведения" },
    { id: "privacy-2", label: t("privacy.toc2", locale) || "Сбор данных" },
    { id: "privacy-3", label: t("privacy.toc3", locale) || "Использование данных" },
    { id: "privacy-4", label: t("privacy.toc4", locale) || "Хранение данных" },
    { id: "privacy-5", label: t("privacy.toc5", locale) || "Права пользователя" },
    { id: "privacy-6", label: t("privacy.toc6", locale) || "Файлы cookie" },
    { id: "privacy-7", label: t("privacy.toc7", locale) || "Сторонние сервисы" },
    { id: "privacy-8", label: t("privacy.toc8", locale) || "Конфиденциальность детей" },
    { id: "privacy-9", label: t("privacy.toc9", locale) || "Контактная информация" },
  ];

  return (
    <DocumentPageLayout
      icon={Shield}
      title={t("legal.privacy", locale) || "Политика конфиденциальности"}
      tocItems={tocItems}
    >
      {/* 1. Общие сведения */}
      <section id="privacy-1">
        <h2 className="text-xl font-bold mb-4 text-primary">1. {tocItems[0].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>1.1. {t("privacy.s1_1", locale)}</p>
          <p>1.2. {t("privacy.s1_2", locale)}</p>
          <p>1.3. {t("privacy.s1_3", locale)}</p>
          <p>1.4. {t("privacy.s1_4", locale)}</p>
        </div>
      </section>

      {/* 2. Сбор данных */}
      <section id="privacy-2">
        <h2 className="text-xl font-bold mb-4 text-primary">2. {tocItems[1].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>2.1. {t("privacy.s2_1", locale)}</p>
          <ul>
            <li><strong>{t("privacy.s2_1a_label", locale)}</strong> {t("privacy.s2_1a", locale)}</li>
            <li><strong>{t("privacy.s2_1b_label", locale)}</strong> {t("privacy.s2_1b", locale)}</li>
            <li><strong>{t("privacy.s2_1c_label", locale)}</strong> {t("privacy.s2_1c", locale)}</li>
            <li><strong>{t("privacy.s2_1d_label", locale)}</strong> {t("privacy.s2_1d", locale)}</li>
            <li><strong>{t("privacy.s2_1e_label", locale)}</strong> {t("privacy.s2_1e", locale)}</li>
          </ul>
          <p>2.2. {t("privacy.s2_2", locale)}</p>
          <p>2.3. {t("privacy.s2_3", locale)}</p>
        </div>
      </section>

      {/* 3. Использование данных */}
      <section id="privacy-3">
        <h2 className="text-xl font-bold mb-4 text-primary">3. {tocItems[2].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>3.1. {t("privacy.s3_1", locale)}</p>
          <ul>
            <li>{t("privacy.s3_1a", locale)}</li>
            <li>{t("privacy.s3_1b", locale)}</li>
            <li>{t("privacy.s3_1c", locale)}</li>
            <li>{t("privacy.s3_1d", locale)}</li>
            <li>{t("privacy.s3_1e", locale)}</li>
            <li>{t("privacy.s3_1f", locale)}</li>
            <li>{t("privacy.s3_1g", locale)}</li>
            <li>{t("privacy.s3_1h", locale)}</li>
          </ul>
          <p>3.2. {t("privacy.s3_2", locale)}</p>
        </div>
      </section>

      {/* 4. Хранение данных */}
      <section id="privacy-4">
        <h2 className="text-xl font-bold mb-4 text-primary">4. {tocItems[3].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>4.1. {t("privacy.s4_1", locale)}</p>
          <p>4.2. {t("privacy.s4_2", locale)}</p>
          <p>4.3. {t("privacy.s4_3", locale)}</p>
          <p>4.4. {t("privacy.s4_4", locale)}</p>
        </div>
      </section>

      {/* 5. Права пользователя */}
      <section id="privacy-5">
        <h2 className="text-xl font-bold mb-4 text-primary">5. {tocItems[4].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>5.1. {t("privacy.s5_1", locale)}</p>
          <ul>
            <li>{t("privacy.s5_1a", locale)}</li>
            <li>{t("privacy.s5_1b", locale)}</li>
            <li>{t("privacy.s5_1c", locale)}</li>
            <li>{t("privacy.s5_1d", locale)}</li>
            <li>{t("privacy.s5_1e", locale)}</li>
            <li>{t("privacy.s5_1f", locale)}</li>
          </ul>
          <p>5.2. {t("privacy.s5_2", locale)}</p>
          <p>5.3. {t("privacy.s5_3", locale)}</p>
        </div>
      </section>

      {/* 6. Файлы cookie */}
      <section id="privacy-6">
        <h2 className="text-xl font-bold mb-4 text-primary">6. {tocItems[5].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>6.1. {t("privacy.s6_1", locale)}</p>
          <p>6.2. {t("privacy.s6_2", locale)}</p>
          <ul>
            <li><strong>{t("privacy.s6_2a_label", locale)}</strong> {t("privacy.s6_2a", locale)}</li>
            <li><strong>{t("privacy.s6_2b_label", locale)}</strong> {t("privacy.s6_2b", locale)}</li>
            <li><strong>{t("privacy.s6_2c_label", locale)}</strong> {t("privacy.s6_2c", locale)}</li>
          </ul>
          <p>6.3. {t("privacy.s6_3", locale)}</p>
        </div>
      </section>

      {/* 7. Сторонние сервисы */}
      <section id="privacy-7">
        <h2 className="text-xl font-bold mb-4 text-primary">7. {tocItems[6].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>7.1. {t("privacy.s7_1", locale)}</p>
          <p>7.2. {t("privacy.s7_2", locale)}</p>
          <p>7.3. {t("privacy.s7_3", locale)}</p>
        </div>
      </section>

      {/* 8. Конфиденциальность детей */}
      <section id="privacy-8">
        <h2 className="text-xl font-bold mb-4 text-primary">8. {tocItems[7].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>8.1. {t("privacy.s8_1", locale)}</p>
          <p>8.2. {t("privacy.s8_2", locale)}</p>
          <p>8.3. {t("privacy.s8_3", locale)}</p>
        </div>
      </section>

      {/* 9. Контактная информация */}
      <section id="privacy-9">
        <h2 className="text-xl font-bold mb-4 text-primary">9. {tocItems[8].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>9.1. {t("privacy.s9_1", locale)}</p>
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
