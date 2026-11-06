/**
 * Нормализация ссылок в контенте статей, импортированных из VK.
 *
 * VK отдаёт ссылки в двух форматах, которые внутри LMS ведут в никуда:
 *
 *   1. `/away.php?to=<urlencoded>&cc_key=` (иногда с префиксом `https://vk.ru`)
 *      — редирект-обёртка ВКонтакте. В LMS такого маршрута нет → 404.
 *      Заменяем на декодированный целевой адрес.
 *
 *   2. `/@science_geeks-<slug>` — ссылка на другую статью той же группы.
 *      Если статья с таким slug уже импортирована, ведём на `/blog/<slug>`,
 *      иначе оставляем внешнюю ссылку на VK (тоже без 404).
 */

/** `away.php` с необязательным префиксом домена VK. */
const AWAY_PATTERN = /^(?:https?:\/\/(?:vk\.(?:com|ru)|m\.vk\.com))?\/away\.php\?([^"']*)$/i;

/** Ссылка на статью группы: `/@science_geeks-<slug>`. */
const GROUP_ARTICLE_PATTERN =
  /^(?:https?:\/\/(?:vk\.(?:com|ru)|m\.vk\.com))?\/@science_geeks[-_]([^"']+)$/i;

/**
 * Достаёт целевой адрес из query-строки `away.php`.
 * Возвращает null, если параметр отсутствует или адрес не http(s).
 */
export function decodeAwayTarget(query: string): string | null {
  const match = /(?:^|&)to=([^&]*)/.exec(query);
  if (!match) return null;

  let target = match[1].replace(/&amp;/g, "&");
  try {
    target = decodeURIComponent(target);
  } catch {
    return null;
  }

  target = target.replace(/&amp;/g, "&").trim();
  return /^https?:\/\//i.test(target) ? target : null;
}

/**
 * Нормализует один адрес.
 *
 * @param href — значение атрибута (может содержать `&amp;`)
 * @param knownSlugs — slug'и статей, существующих в базе
 * @returns новое значение или null, если ссылку менять не нужно
 */
export function normalizeArticleHref(
  href: string,
  knownSlugs: ReadonlySet<string>
): string | null {
  const raw = href.replace(/&amp;/g, "&");

  const away = AWAY_PATTERN.exec(raw);
  if (away) return decodeAwayTarget(away[1]);

  const groupArticle = GROUP_ARTICLE_PATTERN.exec(raw);
  if (groupArticle) {
    const slug = groupArticle[1].replace(/\/+$/, "");
    return knownSlugs.has(slug) ? `/blog/${slug}` : `https://vk.com/@science_geeks-${slug}`;
  }

  return null;
}

/**
 * Нормализует все ссылки в HTML-фрагменте статьи — и в `href`, и в `title`.
 *
 * VK дублирует адрес в `title` (тултип), поэтому одной замены `href`
 * недостаточно: иначе в разметке остаются URL с `away.php`.
 */
export function normalizeArticleLinks(html: string, knownSlugs: ReadonlySet<string>): string {
  if (!html) return html;
  return html.replace(/\b(href|title)="([^"]*)"/gi, (full, attr, value) => {
    const next = normalizeArticleHref(value, knownSlugs);
    return next ? `${attr}="${next}"` : full;
  });
}
