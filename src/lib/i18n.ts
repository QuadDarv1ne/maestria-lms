import type { Locale } from "./store";
import { useAppStore } from "./store";
import ruLocale from "./locales/ru.json";
import enLocale from "./locales/en.json";
import zhLocale from "./locales/zh.json";

const translationCache: Partial<Record<Locale, Record<string, string>>> = {
  ru: ruLocale as Record<string, string>,
  en: enLocale as Record<string, string>,
  zh: zhLocale as Record<string, string>,
};
const loadingPromises: Partial<Record<Locale, Promise<void>>> = {};

async function loadLocale(locale: Locale): Promise<void> {
  if (translationCache[locale]) return;
  if (loadingPromises[locale]) return loadingPromises[locale];

  loadingPromises[locale] = (async () => {
    try {
      const data = await import(`./locales/${locale}.json`);
      translationCache[locale] = data.default || data;
    } catch {
      if (locale !== "ru") {
        await loadLocale("ru");
      }
    }
    delete loadingPromises[locale];
  })();

  return loadingPromises[locale];
}

function ensureLocaleLoadedSync(locale: Locale): Record<string, string> | null {
  return translationCache[locale] ?? null;
}

export function t(key: string, locale?: Locale): string {
  const loc = locale || "ru";
  let dict = translationCache[loc];
  if (!dict) {
    const fallback = ensureLocaleLoadedSync(loc);
    if (fallback) {
      translationCache[loc] = fallback;
      dict = fallback;
    }
  }
  if (dict) return dict[key] ?? key;
  if (loc !== "ru") {
    const ruFallback = ensureLocaleLoadedSync("ru");
    if (ruFallback) return ruFallback[key] ?? key;
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

export { loadLocale };
