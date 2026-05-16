"use client";

import React from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { DocumentPageLayout } from "@/components/DocumentPageLayout";
import { School } from "lucide-react";

export function EduInfoPage() {
  const { locale } = useAppStore();

  const tocItems = [
    { id: "edu-1", label: t("eduinfo.toc1", locale) },
    { id: "edu-2", label: t("eduinfo.toc2", locale) },
    { id: "edu-3", label: t("eduinfo.toc3", locale) },
    { id: "edu-4", label: t("eduinfo.toc4", locale) },
    { id: "edu-5", label: t("eduinfo.toc5", locale) },
    { id: "edu-6", label: t("eduinfo.toc6", locale) },
    { id: "edu-7", label: t("eduinfo.toc7", locale) },
  ];

  return (
    <DocumentPageLayout
      icon={School}
      title={t("legal.educationInfo", locale)}
      tocItems={tocItems}
      headerExtra={
        <Card className="border-blue-700/30 bg-blue-700/5">
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">{t("eduinfo.disclaimer", locale)}</p>
          </CardContent>
        </Card>
      }
    >
      <section id="edu-1">
        <h2 className="text-xl font-bold mb-4 text-primary">1. {tocItems[0].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <table className="w-full text-sm border-collapse">
            <tbody>
              <tr className="border-b border-border"><td className="py-2 pr-4 font-medium text-foreground w-1/3">{t("eduinfo.orgName", locale)}</td><td className="py-2">Maestro7IT</td></tr>
              <tr className="border-b border-border"><td className="py-2 pr-4 font-medium text-foreground">{t("eduinfo.orgForm", locale)}</td><td className="py-2">{t("eduinfo.orgFormValue", locale)}</td></tr>
              <tr className="border-b border-border"><td className="py-2 pr-4 font-medium text-foreground">{t("legal.head", locale)}</td><td className="py-2">{t("legal.headName", locale)}</td></tr>
              <tr className="border-b border-border"><td className="py-2 pr-4 font-medium text-foreground">{t("eduinfo.yearFound", locale)}</td><td className="py-2">2024</td></tr>
              <tr className="border-b border-border"><td className="py-2 pr-4 font-medium text-foreground">{t("legal.address", locale)}</td><td className="py-2">{t("legal.addressValue", locale)}</td></tr>
              <tr className="border-b border-border"><td className="py-2 pr-4 font-medium text-foreground">{t("legal.phone", locale)}</td><td className="py-2">+7 (915) 048-02-49</td></tr>
              <tr className="border-b border-border"><td className="py-2 pr-4 font-medium text-foreground">Email</td><td className="py-2">maksimqwe42@mail.ru</td></tr>
              <tr><td className="py-2 pr-4 font-medium text-foreground">{t("eduinfo.website", locale)}</td><td className="py-2">Maestria</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <section id="edu-2">
        <h2 className="text-xl font-bold mb-4 text-primary">2. {tocItems[1].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>2.1. {t("eduinfo.s2_1", locale)}</p>
          <p>2.2. {t("eduinfo.s2_2", locale)}</p>
          <p>2.3. {t("eduinfo.s2_3", locale)}</p>
        </div>
      </section>

      <section id="edu-3">
        <h2 className="text-xl font-bold mb-4 text-primary">3. {tocItems[2].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>3.1. {t("eduinfo.s3_1", locale)}</p>
          <p>3.2. {t("eduinfo.s3_2", locale)}</p>
          <p>3.3. {t("eduinfo.s3_3", locale)}</p>
          <p>3.4. {t("eduinfo.s3_4", locale)}</p>
          <p>3.5. {t("eduinfo.s3_5", locale)}</p>
        </div>
      </section>

      <section id="edu-4">
        <h2 className="text-xl font-bold mb-4 text-primary">4. {tocItems[3].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>4.1. {t("eduinfo.s4_1", locale)}</p>
          <p>4.2. {t("eduinfo.s4_2", locale)}</p>
          <p>4.3. {t("eduinfo.s4_3", locale)}</p>
        </div>
      </section>

      <section id="edu-5">
        <h2 className="text-xl font-bold mb-4 text-primary">5. {tocItems[4].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>5.1. {t("eduinfo.s5_1", locale)}</p>
          <p>5.2. {t("eduinfo.s5_2", locale)}</p>
          <p>5.3. {t("eduinfo.s5_3", locale)}</p>
        </div>
      </section>

      <section id="edu-6">
        <h2 className="text-xl font-bold mb-4 text-primary">6. {tocItems[5].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>6.1. {t("eduinfo.s6_1", locale)}</p>
          <p>6.2. {t("eduinfo.s6_2", locale)}</p>
        </div>
      </section>

      <section id="edu-7">
        <h2 className="text-xl font-bold mb-4 text-primary">7. {tocItems[6].label}</h2>
        <div className="prose text-sm space-y-3 text-muted-foreground">
          <p>7.1. {t("eduinfo.s7_1", locale)}</p>
          <p>7.2. {t("eduinfo.s7_2", locale)}</p>
          <p>7.3. {t("eduinfo.s7_3", locale)}</p>
        </div>
      </section>
    </DocumentPageLayout>
  );
}
