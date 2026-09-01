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

const ALPHANUMERIC_RE = /^[a-zA-Z0-9.\-_]+$/;

/**
 * Validate a translation key: only allow safe characters (alphanumeric, dots, dashes, underscores).
 * Prevents prototype-pollution-style attacks via keys like "__proto__" or "constructor".
 */
function safeKey(key: string): string | null {
  if (typeof key !== "string" || !key.length) return null;
  // Reject keys that look like prototype injection
  if (key.includes("__") || key === "constructor" || key === "prototype") return null;
  return ALPHANUMERIC_RE.test(key) ? key : null;
}

export function t(key: string, locale?: Locale): string {
  const validated = safeKey(key);
  if (!validated) return key;

  const loc = locale || "ru";
  const dict = translationCache[loc];
  if (dict) return dict[validated] ?? validated;
  if (loc !== "ru") {
    const ruDict = translationCache["ru"];
    if (ruDict) return ruDict[validated] ?? validated;
  }
  return validated;
}

export function useLocale() {
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);

  return { locale, setLocale };
}
