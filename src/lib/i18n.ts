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

const fallbackCache: Partial<Record<Locale, Record<string, string>>> = {};

function ensureLocaleLoadedSync(locale: Locale): Record<string, string> | null {
  const cached = fallbackCache[locale];
  if (cached) return cached;
  const isNode = typeof process !== "undefined" && process.versions?.node;
  if (isNode) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const data = require(`./locales/${locale}.json`);
      const loaded = data.default || data;
      fallbackCache[locale] = loaded;
      return loaded;
    } catch {
      return null;
    }
  }
  return null;
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

export async function ensureLocaleLoaded(locale: Locale): Promise<void> {
  await loadLocale(locale);
}

export function useLocale() {
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);

  return { locale, setLocale };
}

export { loadLocale };
