"use client";

import React, { Fragment, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import {
  GraduationCap,
  Mail,
  Phone,
  MapPin,
  Crown,
  Play,
} from "lucide-react";
import type { Locale } from "@/lib/store";

export const Footer = React.memo(function Footer() {
  const navigate = useAppStore((s) => s.navigate);
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);

  const localeLabels = useMemo<{ value: Locale; flag: string; label: string }[]>(() => [
    { value: "ru", flag: "🇷🇺", label: t("locale.ru", locale) },
    { value: "en", flag: "🇬🇧", label: t("locale.en", locale) },
    { value: "zh", flag: "🇨🇳", label: t("locale.zh", locale) },
  ], [locale]);

  return (
    <footer className="border-t bg-muted/40 mt-auto">
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Колонка 1: О платформе */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-violet-600 rounded-lg flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold">Maestria</span>
            </div>
            <p className="text-sm text-muted-foreground max-w-md mb-3">
              {t("footer.aboutDesc", locale)}
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <Crown className="w-4 h-4 text-amber-500" />
              <span>{t("footer.manager", locale)}: <span className="font-medium text-foreground">Дуплей Максим Игоревич</span></span>
            </div>
            {/* VK Video и Rutube */}
            <div className="flex items-center gap-2">
              <a
                href="https://live.vkvideo.ru/quadd4rv1n7"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0077FF]/10 text-[#0077FF] text-xs font-medium hover:bg-[#0077FF]/20 transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                VK Video
              </a>
              <a
                href="https://rutube.ru/channel/4218729/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600/10 text-orange-600 text-xs font-medium hover:bg-orange-600/20 transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                Rutube
              </a>
            </div>
          </div>

          {/* Колонка 2: Обучение */}
          <div>
            <h3 className="font-semibold text-sm mb-3">{t("footer.learning", locale)}</h3>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li>
                <button
                  type="button"
                  aria-label={t("footer.catalogCourses", locale)}
                  onClick={() => navigate("catalog")}
                  className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded"
                >
                  {t("footer.catalogCourses", locale)}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  aria-label={t("nav.blog", locale)}
                  onClick={() => navigate("blog")}
                  className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded"
                >
                  {t("nav.blog", locale)}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  aria-label={t("footer.myCourses", locale)}
                  onClick={() => navigate("profile")}
                  className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded"
                >
                  {t("footer.myCourses", locale)}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  aria-label={t("footer.achievements", locale)}
                  onClick={() => navigate("achievements")}
                  className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded"
                >
                  {t("footer.achievements", locale)}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  aria-label={t("footer.certificates", locale)}
                  onClick={() => navigate("certificate/demo")}
                  className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded"
                >
                  {t("footer.certificates", locale)}
                </button>
              </li>
            </ul>
          </div>

          {/* Колонка 3: Правовая информация */}
          <div>
            <h3 className="font-semibold text-sm mb-3">{t("footer.legal", locale)}</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>
                <button type="button" aria-label={t("footer.userAgreement", locale)} onClick={() => navigate("terms")} className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded">
                  {t("footer.userAgreement", locale)}
                </button>
              </li>
              <li>
                <button type="button" aria-label={t("footer.privacyPolicy", locale)} onClick={() => navigate("privacy")} className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded">
                  {t("footer.privacyPolicy", locale)}
                </button>
              </li>
              <li>
                <button type="button" aria-label={t("legal.personalDataConsent", locale)} onClick={() => navigate("personal-data")} className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded">
                  {t("legal.personalDataConsent", locale)}
                </button>
              </li>
              <li>
                <button type="button" aria-label={t("legal.publicOffer", locale)} onClick={() => navigate("offer")} className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded">
                  {t("legal.publicOffer", locale)}
                </button>
              </li>
              <li>
                <button type="button" aria-label={t("legal.refundPolicy", locale)} onClick={() => navigate("refund")} className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded">
                  {t("legal.refundPolicy", locale)}
                </button>
              </li>
              <li>
                <button type="button" aria-label={t("legal.licenseAgreement", locale)} onClick={() => navigate("license")} className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded">
                  {t("legal.licenseAgreement", locale)}
                </button>
              </li>
              <li>
                <button type="button" aria-label={t("legal.platformRules", locale)} onClick={() => navigate("rules")} className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded">
                  {t("legal.platformRules", locale)}
                </button>
              </li>
              <li>
                <button type="button" aria-label={t("legal.cookiePolicy", locale)} onClick={() => navigate("cookies")} className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded">
                  {t("legal.cookiePolicy", locale)}
                </button>
              </li>
              <li>
                <button type="button" aria-label={t("legal.ageRating", locale)} onClick={() => navigate("age-rating")} className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded">
                  {t("legal.ageRating", locale)}
                </button>
              </li>
              <li>
                <button type="button" aria-label={t("legal.educationInfo", locale)} onClick={() => navigate("edu-info")} className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 rounded">
                  {t("legal.educationInfo", locale)}
                </button>
              </li>
            </ul>
          </div>

          {/* Колонка 4: Контакты */}
          <div>
            <h3 className="font-semibold text-sm mb-3">{t("footer.contacts", locale)}</h3>
            <ul className="space-y-2.5 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 shrink-0" />
                <a href="mailto:maksimqwe42@mail.ru" className="hover:text-foreground transition-colors">
                  maksimqwe42@mail.ru
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-4 h-4 shrink-0" />
                <a href="tel:+79150480249" className="hover:text-foreground transition-colors">
                  +7 (915) 048-02-49
                </a>
              </li>
              <li className="flex items-center gap-2">
                <MapPin className="w-4 h-4 shrink-0" />
                {t("footer.location", locale)}
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Нижняя панель */}
      <div className="border-t bg-muted/30">
        <div className="container mx-auto px-4 py-6">
          {/* Ряд бейджей магазинов приложений */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-5">
            {/* App Store badge */}
            <a
              href="#"
              className="inline-flex items-center gap-2 px-4 py-2 bg-black rounded-lg text-white hover:bg-gray-800 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              <div className="text-left leading-none">
                <div className="text-[8px] opacity-70">{t("footer.downloadOn", locale)}</div>
                <div className="text-xs font-semibold -mt-0.5">App Store</div>
              </div>
            </a>

            {/* Google Play badge */}
            <a
              href="#"
              className="inline-flex items-center gap-2 px-4 py-2 bg-black rounded-lg text-white hover:bg-gray-800 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 20.5v-17c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.24-.84-.76-.84-1.35m13.81-5.38L6.05 21.34l8.49-8.49 2.27 2.27m.91-.91L19.59 12l-1.87-1.21-2.27 2.27 2.27 1.15M6.05 2.66l10.76 6.22-2.27 2.27-8.49-8.49z"/>
              </svg>
              <div className="text-left leading-none">
                <div className="text-[8px] opacity-70">{t("footer.getItOn", locale)}</div>
                <div className="text-xs font-semibold -mt-0.5">Google Play</div>
              </div>
            </a>

            {/* RuStore badge */}
            <a
              href="#"
              className="inline-flex items-center gap-2 px-4 py-2 bg-black rounded-lg text-white hover:bg-gray-800 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
              <div className="text-left leading-none">
                <div className="text-[8px] opacity-70">{t("footer.ruStoreAvailable", locale)}</div>
                <div className="text-xs font-semibold -mt-0.5">RuStore</div>
              </div>
            </a>
          </div>

          {/* Копирайт и лицензия */}
          <div className="text-center space-y-1.5">
            <p className="text-xs text-muted-foreground">
              © 2024-2026 Maestria by Maestro7IT. {t("footer.rights", locale)}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("footer.contribution", locale)}
            </p>
            <p className="text-xs text-muted-foreground/50">
              v2.4.0
            </p>
          </div>

          {/* Переключатель языка */}
          <div className="flex justify-center mt-4">
            <div className="inline-flex items-center gap-1.5">
              {localeLabels.map((item, idx) => (
                <Fragment key={item.value}>
                  {idx > 0 && <span className="text-muted-foreground/40 text-xs">|</span>}
                  <button
                    type="button"
                    aria-label={`${t("nav.language", locale)}: ${item.label}`}
                    onClick={() => setLocale(item.value)}
                    className={`text-xs transition-colors px-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                      locale === item.value
                        ? "text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {item.flag} {item.label}
                  </button>
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = "Footer";
