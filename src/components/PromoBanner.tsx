"use client";

import { useAppStore } from "@/lib/store";
import { t } from "@/lib/i18n";
import Image from "next/image";
import { Phone, Mail, Globe, ExternalLink } from "lucide-react";

export function PromoBanner() {
  const locale = useAppStore((s) => s.locale);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white mb-8">
      {/* Decorative background elements */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      </div>

      <div className="relative grid md:grid-cols-2 gap-6 p-6 md:p-8">
        {/* Left side - Image and title */}
        <div className="flex flex-col justify-center">
          <div className="relative aspect-video rounded-xl overflow-hidden mb-4 md:mb-0 bg-blue-800/30">
            <Image
              src="/banners/vst-plugins.jpg"
              alt={t("banner.vstTitle", locale)}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
          <h2 className="text-xl md:text-2xl font-bold mb-2">
            {t("banner.vstTitle", locale)}
          </h2>
          <p className="text-blue-100 text-sm md:text-base">
            {t("banner.vstDescription", locale)}
          </p>
        </div>

        {/* Right side - Contact info */}
        <div className="flex flex-col justify-center">
          <h3 className="text-lg font-semibold mb-4">
            {t("banner.contactTitle", locale)}
          </h3>
          <div className="space-y-3">
            <a
              href="https://max.ru/u/f9LHodD0cOKYE1iUcgI67Bd7NBQzc7sggqIpDuY7GxL9dubrD9GbwcQbuPw"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors group"
            >
              <Globe className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium group-hover:underline">
                {t("banner.contactProfile", locale)}
              </span>
              <ExternalLink className="w-4 h-4 ml-auto opacity-60 group-hover:opacity-100 transition-opacity" />
            </a>
            <a
              href="mailto:contact@maestro7it.com"
              className="flex items-center gap-3 p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors group"
            >
              <Mail className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium group-hover:underline">
                contact@maestro7it.com
              </span>
            </a>
            <a
              href="tel:+78001234567"
              className="flex items-center gap-3 p-3 rounded-lg bg-white/10 hover:bg-white/20 transition-colors group"
            >
              <Phone className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium group-hover:underline">
                +7 (800) 123-45-67
              </span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
