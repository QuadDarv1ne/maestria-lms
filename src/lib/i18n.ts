import type { Locale } from "./store";
import { useAppStore } from "./store";
import ruLocale from "./locales/ru.json";
import enLocale from "./locales/en.json";
import zhLocale from "./locales/zh.json";

const translationCache: Record<Locale, Record<string, string>> = {
  ru: ruLocale as Record<string, string>,
  en: enLocale as Record<string, string>,
  zh: zhLocale as Record<string, string>,
};

export function t(key: string, locale?: Locale): string {
  const loc = locale || "ru";
  const dict = translationCache[loc];
  if (dict) return dict[key] ?? key;
  if (loc !== "ru") {
    const ruDict = translationCache["ru"];
    if (ruDict) return ruDict[key] ?? key;
  }
  return key;
}

export function useLocale() {
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);

  return { locale, setLocale };
}

/**
 * @deprecated Locales are loaded statically at module level.
 * This function is kept as a no-op for backward compatibility.
 */
export async function loadLocale(_locale: Locale): Promise<void> {
  // All locales are already loaded via static imports
}
