import { describe, expect, it } from "vitest";
import { ALLOWED_EMBED_HOSTS, resolveVideoEmbed } from "./video-embed";

describe("resolveVideoEmbed — невалидный ввод", () => {
  it("null → kind none", () => {
    const r = resolveVideoEmbed(null);
    expect(r.kind).toBe("none");
    expect(r.src).toBeNull();
    expect(r.provider).toBeNull();
  });

  it("undefined → kind none", () => {
    expect(resolveVideoEmbed(undefined).kind).toBe("none");
  });

  it("пустая строка и пробелы → none", () => {
    expect(resolveVideoEmbed("").kind).toBe("none");
    expect(resolveVideoEmbed("   ").kind).toBe("none");
  });

  it("произвольный текст → none", () => {
    const r = resolveVideoEmbed("это не ссылка");
    expect(r.kind).toBe("none");
    expect(r.original).toBe("это не ссылка");
  });

  it("не-http(s) протокол → none", () => {
    expect(resolveVideoEmbed("ftp://example.com/video.mp4").kind).toBe("none");
    expect(resolveVideoEmbed("javascript:alert(1)").kind).toBe("none");
  });

  it("original сохраняется без trim-артефактов", () => {
    const r = resolveVideoEmbed("  https://example.com/page  ");
    expect(r.original).toBe("https://example.com/page");
  });
});

describe("resolveVideoEmbed — YouTube", () => {
  it("watch?v=", () => {
    const r = resolveVideoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(r).toMatchObject({
      kind: "iframe",
      provider: "youtube",
      src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    });
  });

  it("youtu.be короткая ссылка", () => {
    const r = resolveVideoEmbed("https://youtu.be/dQw4w9WgXcQ");
    expect(r).toMatchObject({ kind: "iframe", provider: "youtube" });
    expect(r.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("/embed/, /shorts/, /live/", () => {
    for (const path of ["embed", "shorts", "live"]) {
      const r = resolveVideoEmbed(`https://www.youtube.com/${path}/abcdefgh`);
      expect(r).toMatchObject({
        kind: "iframe",
        provider: "youtube",
        src: "https://www.youtube-nocookie.com/embed/abcdefgh",
      });
    }
  });

  it("youtube-nocookie домен", () => {
    const r = resolveVideoEmbed("https://www.youtube-nocookie.com/embed/abcdefgh");
    expect(r).toMatchObject({ kind: "iframe", provider: "youtube" });
  });

  it("m.youtube.com — мобильный префикс срезается", () => {
    const r = resolveVideoEmbed("https://m.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(r).toMatchObject({ kind: "iframe", provider: "youtube" });
  });

  it("/watch без v= → external (не распознан)", () => {
    const r = resolveVideoEmbed("https://www.youtube.com/watch");
    expect(r.kind).toBe("external");
  });
});

describe("resolveVideoEmbed — параметр начала (start/t)", () => {
  it("t=90 → ?start=90 в embed-URL", () => {
    const r = resolveVideoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90");
    expect(r.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?start=90");
  });

  it("t=1m30s → 90 секунд", () => {
    const r = resolveVideoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1m30s");
    expect(r.src).toContain("start=90");
  });

  it("t=1h2m3s → 3723 секунды", () => {
    const r = resolveVideoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1h2m3s");
    expect(r.src).toContain("start=3723");
  });

  it("start=45 на vimeo", () => {
    const r = resolveVideoEmbed("https://vimeo.com/123456789?start=45");
    expect(r.src).toBe("https://player.vimeo.com/video/123456789?start=45");
  });

  it("t=0 игнорируется", () => {
    const r = resolveVideoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=0");
    expect(r.src).not.toContain("start=");
  });

  it("мусорное значение t игнорируется", () => {
    const r = resolveVideoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90abc");
    expect(r.src).not.toContain("start=");
  });
});

describe("resolveVideoEmbed — Vimeo", () => {
  it("vimeo.com/<id>", () => {
    const r = resolveVideoEmbed("https://vimeo.com/123456789");
    expect(r).toMatchObject({
      kind: "iframe",
      provider: "vimeo",
      src: "https://player.vimeo.com/video/123456789",
    });
  });

  it("player.vimeo.com/video/<id>", () => {
    const r = resolveVideoEmbed("https://player.vimeo.com/video/987654321");
    expect(r).toMatchObject({ kind: "iframe", provider: "vimeo" });
    expect(r.src).toBe("https://player.vimeo.com/video/987654321");
  });

  it("не числовой путь → external", () => {
    expect(resolveVideoEmbed("https://vimeo.com/somechannel").kind).toBe("external");
  });
});

describe("resolveVideoEmbed — VK", () => {
  it("vk.com/video-123_456 → video_ext.php", () => {
    const r = resolveVideoEmbed("https://vk.com/video-123_456");
    expect(r).toMatchObject({
      kind: "iframe",
      provider: "vk",
      src: "https://vk.com/video_ext.php?oid=-123&id=456&hd=2",
    });
  });

  it("готовый video_ext.php сохраняет oid/id", () => {
    const r = resolveVideoEmbed("https://vk.com/video_ext.php?oid=-55&id=77");
    expect(r).toMatchObject({
      kind: "iframe",
      provider: "vk",
      src: "https://vk.com/video_ext.php?oid=-55&id=77&hd=2",
    });
  });

  it("vkvideo.ru — тот же формат", () => {
    const r = resolveVideoEmbed("https://vkvideo.ru/video-10_20");
    expect(r).toMatchObject({ kind: "iframe", provider: "vk" });
    expect(r.src).toBe("https://vk.com/video_ext.php?oid=-10&id=20&hd=2");
  });

  it("video_ext.php без oid → external", () => {
    expect(resolveVideoEmbed("https://vk.com/video_ext.php?id=77").kind).toBe("external");
  });
});

describe("resolveVideoEmbed — Rutube / Kinescope / Dailymotion", () => {
  it("rutube.ru/video/<hex>", () => {
    const r = resolveVideoEmbed("https://rutube.ru/video/0123456789abcdef/");
    expect(r).toMatchObject({
      kind: "iframe",
      provider: "rutube",
      src: "https://rutube.ru/play/embed/0123456789abcdef",
    });
  });

  it("rutube.ru/play/embed/<hex> — уже embed", () => {
    const r = resolveVideoEmbed("https://rutube.ru/play/embed/0123456789abcdef");
    expect(r).toMatchObject({ kind: "iframe", provider: "rutube" });
    expect(r.src).toBe("https://rutube.ru/play/embed/0123456789abcdef");
  });

  it("kinescope.io/<id> → embed/<id>", () => {
    const r = resolveVideoEmbed("https://kinescope.io/abcdef123");
    expect(r).toMatchObject({
      kind: "iframe",
      provider: "kinescope",
      src: "https://kinescope.io/embed/abcdef123",
    });
  });

  it("kinescope.io/embed/<id> — без дублирования", () => {
    const r = resolveVideoEmbed("https://kinescope.io/embed/abcdef123");
    expect(r.src).toBe("https://kinescope.io/embed/abcdef123");
  });

  it("dai.ly короткая ссылка", () => {
    const r = resolveVideoEmbed("https://dai.ly/x8abcde");
    expect(r).toMatchObject({
      kind: "iframe",
      provider: "dailymotion",
      src: "https://www.dailymotion.com/embed/video/x8abcde",
    });
  });

  it("dailymotion.com/video/<id>", () => {
    const r = resolveVideoEmbed("https://www.dailymotion.com/video/x8abcde");
    expect(r).toMatchObject({ kind: "iframe", provider: "dailymotion" });
  });
});

describe("resolveVideoEmbed — файлы, embed, external", () => {
  it(".mp4 → kind file", () => {
    const r = resolveVideoEmbed("https://cdn.example.com/lessons/01-intro.mp4");
    expect(r).toMatchObject({
      kind: "file",
      provider: "file",
      src: "https://cdn.example.com/lessons/01-intro.mp4",
    });
  });

  it("расширение в верхнем регистре (.MOV) тоже файл", () => {
    expect(resolveVideoEmbed("https://cdn.example.com/clip.MOV").kind).toBe("file");
  });

  it("webm/ogv/m4v — все видеоформаты", () => {
    for (const ext of [".webm", ".ogv", ".ogg", ".m4v"]) {
      expect(resolveVideoEmbed(`https://cdn.example.com/v${ext}`).kind).toBe("file");
    }
  });

  it("готовый embed-путь неизвестного сервиса → provider embed", () => {
    const r = resolveVideoEmbed("https://player.example.com/embed/abc123");
    expect(r).toMatchObject({
      kind: "iframe",
      provider: "embed",
      src: "https://player.example.com/embed/abc123",
    });
  });

  it("обычная страница → external", () => {
    const r = resolveVideoEmbed("https://example.com/some/page");
    expect(r).toMatchObject({
      kind: "external",
      provider: "external",
      src: "https://example.com/some/page",
    });
  });
});

describe("ALLOWED_EMBED_HOSTS", () => {
  it("содержит ключевые домены всех поддерживаемых провайдеров", () => {
    for (const host of [
      "www.youtube-nocookie.com",
      "player.vimeo.com",
      "vk.com",
      "vkvideo.ru",
      "rutube.ru",
      "kinescope.io",
      "www.dailymotion.com",
    ]) {
      expect(ALLOWED_EMBED_HOSTS).toContain(host);
    }
  });

  it("нет дубликатов", () => {
    expect(new Set(ALLOWED_EMBED_HOSTS).size).toBe(ALLOWED_EMBED_HOSTS.length);
  });
});
