import type { Locale } from "./store";
import { useAppStore } from "./store";
import ru from "./locales/ru.json";
import en from "./locales/en.json";
import zh from "./locales/zh.json";

const translations: Record<Locale, Record<string, string>> = { ru, en, zh };

export function t(key: string, locale?: Locale): string {
  const loc = locale || "ru";
  return translations[loc]?.[key] || translations.ru[key] || key;
}

export function useLocale() {
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  return { locale, setLocale };
}
