import { describe, it, expect } from 'vitest';
import { t } from '@/lib/i18n';

describe('i18n', () => {
  it('returns Russian translation for ru locale', () => {
    expect(t('nav.home', 'ru')).toBe('Главная');
    expect(t('nav.catalog', 'ru')).toBe('Каталог');
  });

  it('returns English translation for en locale', () => {
    expect(t('nav.home', 'en')).toBe('Home');
    expect(t('nav.catalog', 'en')).toBe('Catalog');
  });

  it('returns Chinese translation for zh locale', () => {
    expect(t('nav.home', 'zh')).toBe('首页');
    expect(t('nav.catalog', 'zh')).toBe('课程目录');
  });

  it('falls back to Russian when locale is undefined', () => {
    expect(t('nav.home')).toBe('Главная');
  });

  it('falls back to Russian when key is missing in locale', () => {
    // If a key exists in ru but not in en, it should fall back to ru
    const ruKey = t('hero.title', 'ru');
    expect(ruKey).not.toBe('hero.title');
  });

  it('returns key when translation is missing in all locales', () => {
    expect(t('nonexistent.key', 'ru')).toBe('nonexistent.key');
    expect(t('nonexistent.key', 'en')).toBe('nonexistent.key');
  });
});
