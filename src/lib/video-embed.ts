/**
 * Нормализация ссылок на видео для встраивания в урок.
 *
 * Авторы курсов вставляют ссылки в произвольном виде (страница просмотра,
 * короткая ссылка, уже готовый embed-URL). Плеер должен получить либо
 * embed-адрес для iframe, либо прямой файл для нативного <video>,
 * либо (если провайдер неизвестен) внешнюю ссылку.
 */

export type VideoEmbed =
  | { kind: "iframe"; src: string; provider: VideoProvider; original: string }
  | { kind: "file"; src: string; provider: "file"; original: string }
  | { kind: "external"; src: string; provider: "external"; original: string }
  | { kind: "none"; src: null; provider: null; original: string };

export type VideoProvider =
  | "youtube"
  | "vimeo"
  | "vk"
  | "rutube"
  | "kinescope"
  | "dailymotion"
  | "embed"
  | "file"
  | "external";

const FILE_EXTENSIONS = [".mp4", ".webm", ".ogv", ".ogg", ".mov", ".m4v"];

function parseUrl(raw: string): URL | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

/** Безопасно достаёт положительное число из query-параметра. */
function startSeconds(url: URL): number | null {
  const raw = url.searchParams.get("start") ?? url.searchParams.get("t");
  if (!raw) return null;
  // Поддерживаем форматы 90, "90s", "1m30s", "1h2m3s"
  const plain = Number(raw);
  if (Number.isFinite(plain) && plain > 0) return Math.floor(plain);
  const match = raw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (!match) return null;
  const [, h, m, s] = match;
  const total = Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0);
  return total > 0 ? total : null;
}

function withStart(base: string, seconds: number | null, param = "start"): string {
  if (!seconds) return base;
  return `${base}${base.includes("?") ? "&" : "?"}${param}=${seconds}`;
}

function youtubeId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  if (host === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id || null;
  }
  if (host !== "youtube.com" && host !== "youtube-nocookie.com") return null;
  if (url.pathname === "/watch") return url.searchParams.get("v");
  const match = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{6,})/);
  return match?.[1] ?? null;
}

function vimeoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host === "vimeo.com") {
    const match = url.pathname.match(/^\/(\d{5,})/);
    return match?.[1] ?? null;
  }
  if (host === "player.vimeo.com") {
    const match = url.pathname.match(/^\/video\/(\d{5,})/);
    return match?.[1] ?? null;
  }
  return null;
}

function vkEmbed(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "");
  if (!["vk.com", "vkvideo.ru", "live.vkvideo.ru"].includes(host)) return null;
  if (url.pathname.startsWith("/video_ext.php")) {
    const oid = url.searchParams.get("oid");
    const id = url.searchParams.get("id");
    return oid && id ? `https://vk.com/video_ext.php?oid=${oid}&id=${id}&hd=2` : null;
  }
  // vk.com/video-123_456 (в т.ч. с ?t=)
  const match = url.pathname.match(/^\/video(-?\d+)_(\d+)/);
  if (!match) return null;
  return `https://vk.com/video_ext.php?oid=${match[1]}&id=${match[2]}&hd=2`;
}

function rutubeEmbed(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "rutube.ru") return null;
  const match = url.pathname.match(/^\/(?:video|play\/embed)\/([a-f0-9]{16,})/i);
  return match ? `https://rutube.ru/play/embed/${match[1]}` : null;
}

function kinescopeEmbed(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host !== "kinescope.io") return null;
  const match = url.pathname.match(/^\/(?:embed\/)?([\w-]{8,})/);
  return match ? `https://kinescope.io/embed/${match[1]}` : null;
}

function dailymotionEmbed(url: URL): string | null {
  const host = url.hostname.replace(/^www\./, "");
  if (host === "dai.ly") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id ? `https://www.dailymotion.com/embed/video/${id}` : null;
  }
  if (host === "dailymotion.com") {
    const match = url.pathname.match(/^\/video\/([\w]+)/);
    return match ? `https://www.dailymotion.com/embed/video/${match[1]}` : null;
  }
  return null;
}

function isVideoFile(url: URL): boolean {
  const path = url.pathname.toLowerCase();
  return FILE_EXTENSIONS.some((ext) => path.endsWith(ext));
}

/**
 * Преобразует произвольную ссылку в структуру, пригодную для плеера.
 * Возвращает `none`, если ссылка пустая или не является http(s)-URL.
 */
export function resolveVideoEmbed(raw: string | null | undefined): VideoEmbed {
  const original = (raw ?? "").trim();
  const url = parseUrl(original);
  if (!url) return { kind: "none", src: null, provider: null, original };

  const start = startSeconds(url);

  const yt = youtubeId(url);
  if (yt) {
    return {
      kind: "iframe",
      src: withStart(`https://www.youtube-nocookie.com/embed/${yt}`, start),
      provider: "youtube",
      original,
    };
  }

  const vimeo = vimeoId(url);
  if (vimeo) {
    return {
      kind: "iframe",
      src: withStart(`https://player.vimeo.com/video/${vimeo}`, start),
      provider: "vimeo",
      original,
    };
  }

  const vk = vkEmbed(url);
  if (vk) {
    return { kind: "iframe", src: vk, provider: "vk", original };
  }

  const rutube = rutubeEmbed(url);
  if (rutube) {
    return {
      kind: "iframe",
      src: withStart(rutube, start),
      provider: "rutube",
      original,
    };
  }

  const kinescope = kinescopeEmbed(url);
  if (kinescope) {
    return { kind: "iframe", src: kinescope, provider: "kinescope", original };
  }

  const dailymotion = dailymotionEmbed(url);
  if (dailymotion) {
    return {
      kind: "iframe",
      src: withStart(dailymotion, start),
      provider: "dailymotion",
      original,
    };
  }

  if (isVideoFile(url)) {
    return { kind: "file", src: url.toString(), provider: "file", original };
  }

  // Уже готовый embed-адрес другого сервиса
  if (/\/(embed|player|iframe)(\/|$)/i.test(url.pathname)) {
    return { kind: "iframe", src: url.toString(), provider: "embed", original };
  }

  return { kind: "external", src: url.toString(), provider: "external", original };
}

/** Домены, которые разрешено встраивать через iframe в контенте урока. */
export const ALLOWED_EMBED_HOSTS = [
  "www.youtube.com",
  "youtube.com",
  "www.youtube-nocookie.com",
  "youtube-nocookie.com",
  "player.vimeo.com",
  "vk.com",
  "www.vk.com",
  "vkvideo.ru",
  "live.vkvideo.ru",
  "rutube.ru",
  "www.rutube.ru",
  "kinescope.io",
  "www.kinescope.io",
  "www.dailymotion.com",
  "dailymotion.com",
  "player.vkvideo.ru",
  "embed.vkvideo.ru",
];
