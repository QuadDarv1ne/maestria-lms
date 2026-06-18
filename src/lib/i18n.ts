import type { Locale } from "./store";
import { useAppStore } from "./store";

const translationCache: Partial<Record<Locale, Record<string, string>>> = {};
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

let ruFallback: Record<string, string> | null = null;

if (typeof window === "undefined") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ruFallback = require("./locales/ru.json");
  } catch {
    ruFallback = {};
  }
}

export function t(key: string, locale?: Locale): string {
  const loc = locale || "ru";
  const dict = translationCache[loc];
  if (dict) return dict[key] ?? key;
  if (loc === "ru" && ruFallback) return ruFallback[key] ?? key;
  if (loc !== "ru") {
    const ruDict = translationCache["ru"];
    if (ruDict) return ruDict[key] ?? key;
    if (ruFallback) return ruFallback[key] ?? key;
  }
  return key;
}

export async function ensureLocaleLoaded(locale: Locale): Promise<void> {
  await loadLocale(locale);
}

export function useLocale() {
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);

  return { locale, setLocale };
}

export { loadLocale };
