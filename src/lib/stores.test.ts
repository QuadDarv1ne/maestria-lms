import { beforeEach, describe, expect, it, vi } from "vitest";
import { create } from "zustand";

const storageMocks = vi.hoisted(() => {
  const map = new Map<string, string>();
  return {
    map,
    load: vi.fn((key: string, fallback: unknown) => {
      const raw = map.get(key);
      if (raw === undefined) return fallback;
      try {
        return JSON.parse(raw);
      } catch {
        return fallback;
      }
    }),
    save: vi.fn((key: string, value: unknown) => {
      map.set(key, JSON.stringify(value));
    }),
    loadString: vi.fn((key: string, fallback: string) => map.get(key) ?? fallback),
    saveString: vi.fn((key: string, value: string) => {
      map.set(key, value);
    }),
    logWarn: vi.fn(),
  };
});

vi.mock("@/lib/storage", () => ({
  load: storageMocks.load,
  save: storageMocks.save,
  loadString: storageMocks.loadString,
  saveString: storageMocks.saveString,
}));

vi.mock("@/lib/logger", () => ({
  log: { warn: storageMocks.logWarn, error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { createAuthSlice } from "./stores/auth";
import { createCatalogSlice } from "./stores/catalog";
import { createFavoritesSlice } from "./stores/favorites";
import { createNotificationsSlice, type NotificationItem } from "./stores/notifications";
import { createUISlice } from "./stores/ui";

/** Распарсенное значение из фейкового storage (по ключу после save). */
function storedJSON(key: string): unknown {
  const raw = storageMocks.map.get(key);
  return raw === undefined ? undefined : JSON.parse(raw);
}

beforeEach(() => {
  storageMocks.map.clear();
  storageMocks.save.mockClear();
  storageMocks.load.mockClear();
  storageMocks.saveString.mockClear();
  storageMocks.logWarn.mockClear();
  vi.unstubAllGlobals();
  document.cookie = "";
});

describe("auth slice", () => {
  const useAuth = create(createAuthSlice);

  it("начальное состояние: user null, sessionReady false", () => {
    expect(useAuth.getState().user).toBeNull();
    expect(useAuth.getState().sessionReady).toBe(false);
  });

  it("setUser устанавливает и сбрасывает пользователя", () => {
    const user = { id: "u1", email: "a@b.ru", name: "Аня", image: null, role: "student" };
    useAuth.getState().setUser(user);
    expect(useAuth.getState().user).toEqual(user);
    useAuth.getState().setUser(null);
    expect(useAuth.getState().user).toBeNull();
  });

  it("setSessionReady переключает флаг один раз (true навсегда)", () => {
    useAuth.getState().setSessionReady();
    useAuth.getState().setSessionReady();
    expect(useAuth.getState().sessionReady).toBe(true);
  });
});

describe("ui slice", () => {
  const useUI = create(createUISlice);

  it("дефолты: light / ru / sidebar закрыт / не загружается", () => {
    const s = useUI.getState();
    expect(s.theme).toBe("light");
    expect(s.locale).toBe("ru");
    expect(s.sidebarOpen).toBe(false);
    expect(s.isLoading).toBe(false);
  });

  it("setTheme сохраняет в localStorage и стейт", () => {
    useUI.getState().setTheme("dark");
    expect(useUI.getState().theme).toBe("dark");
    expect(storageMocks.map.get("maestria-theme")).toBe("dark");
  });

  it("setLocale пишет cookie с Path, SameSite и без Secure на http", () => {
    // document.cookie getter в jsdom не возвращает атрибуты — перехватываем сырую строку
    const original = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
    if (!original) throw new Error("descriptor document.cookie не найден");
    let raw = "";
    Object.defineProperty(document, "cookie", {
      configurable: true,
      get: () => raw,
      set: (v: string) => { raw = v; },
    });

    try {
      useUI.getState().setLocale("en");
      expect(useUI.getState().locale).toBe("en");
      expect(raw).toContain("maestria-locale=en");
      expect(raw).toContain("Path=/");
      expect(raw).toContain("SameSite=Lax");
      expect(raw).toContain("Max-Age=31536000");
      expect(raw).not.toContain("Secure"); // jsdom — http
    } finally {
      delete (document as { cookie?: unknown }).cookie; // снимаем шадоу-свойство с инстанса
      Object.defineProperty(Document.prototype, "cookie", original);
    }
  });

  it("hydrate валидирует сохранённые значения", () => {
    storageMocks.map.set("maestria-theme", "amber");
    storageMocks.map.set("maestria-locale", "zh");
    useUI.getState().hydrate();
    expect(useUI.getState().theme).toBe("amber");
    expect(useUI.getState().locale).toBe("zh");
  });

  it("hydrate отбрасывает мусорные значения к дефолтам", () => {
    storageMocks.map.set("maestria-theme", "neon");
    storageMocks.map.set("maestria-locale", "de");
    useUI.getState().hydrate();
    expect(useUI.getState().theme).toBe("light");
    expect(useUI.getState().locale).toBe("ru");
  });

  it("setSidebarOpen / setIsLoading переключают флаги", () => {
    useUI.getState().setSidebarOpen(true);
    useUI.getState().setIsLoading(true);
    expect(useUI.getState().sidebarOpen).toBe(true);
    expect(useUI.getState().isLoading).toBe(true);
  });
});

describe("catalog slice", () => {
  const useCatalog = create(createCatalogSlice);

  it("дефолтные фильтры каталога", () => {
    const f = useCatalog.getState().courseFilters;
    expect(f).toEqual({ category: "", search: "", level: "", sortBy: "popular", freeOnly: false });
  });

  it("setCourseFilters мержит частичные обновления", () => {
    useCatalog.getState().setCourseFilters({ category: "web", freeOnly: true });
    expect(useCatalog.getState().courseFilters).toEqual({
      category: "web",
      search: "",
      level: "",
      sortBy: "popular",
      freeOnly: true,
    });
  });

  it("setCourseFilters принимает функцию от предыдущего состояния", () => {
    useCatalog.getState().setCourseFilters({ search: "react" });
    useCatalog.getState().setCourseFilters((prev) => ({ search: prev.search.toUpperCase() }));
    expect(useCatalog.getState().courseFilters.search).toBe("REACT");
  });

  it("setCurrentCourseId / setCurrentLessonId", () => {
    useCatalog.getState().setCurrentCourseId("c1");
    useCatalog.getState().setCurrentLessonId("l1");
    expect(useCatalog.getState().currentCourseId).toBe("c1");
    expect(useCatalog.getState().currentLessonId).toBe("l1");
    useCatalog.getState().setCurrentCourseId(null);
    expect(useCatalog.getState().currentCourseId).toBeNull();
  });
});

describe("favorites slice", () => {
  const useFav = create(createFavoritesSlice);

  it("toggleFavorite добавляет и убирает, синхронизируя storage", () => {
    useFav.getState().toggleFavorite("c1");
    expect(useFav.getState().favorites).toEqual(["c1"]);
    expect(useFav.getState().isFavorite("c1")).toBe(true);
    expect(storedJSON("maestria-favorites")).toEqual(["c1"]);

    useFav.getState().toggleFavorite("c1");
    expect(useFav.getState().favorites).toEqual([]);
    expect(useFav.getState().isFavorite("c1")).toBe(false);
  });

  it("isFavorite на незнакомом курсе → false", () => {
    expect(useFav.getState().isFavorite("nope")).toBe(false);
  });

  it("hydrateFavorites восстанавливает список из storage", () => {
    storageMocks.map.set("maestria-favorites", JSON.stringify(["a", "b"]));
    useFav.getState().hydrateFavorites();
    expect(useFav.getState().favorites).toEqual(["a", "b"]);
  });
});

const makeNotification = (id: string, read = false): NotificationItem => ({
  id,
  type: "system",
  title: `Уведомление ${id}`,
  message: "Текст",
  read,
  createdAt: 1000,
});

describe("notifications slice — локальные действия", () => {
  const useNotif = create(createNotificationsSlice);

  it("setNotifications сохраняет в storage и стейт", () => {
    const items = [makeNotification("n1")];
    useNotif.getState().setNotifications(items);
    expect(useNotif.getState().notifications).toEqual(items);
    expect(storedJSON("maestria-notifications")).toHaveLength(1);
  });

  it("addNotification добавляет в начало, без дубликатов по id", () => {
    useNotif.getState().addNotification(makeNotification("n1"));
    useNotif.getState().addNotification(makeNotification("n2"));
    useNotif.getState().addNotification(makeNotification("n1")); // дубль

    const ids = useNotif.getState().notifications.map((n) => n.id);
    expect(ids).toEqual(["n2", "n1"]);
  });

  it("addNotification ограничивает список 200 элементами", () => {
    for (let i = 0; i < 205; i++) {
      useNotif.getState().addNotification(makeNotification(`n${i}`));
    }
    expect(useNotif.getState().notifications).toHaveLength(200);
    expect(useNotif.getState().notifications[0].id).toBe("n204");
  });

  it("unreadNotificationsCount считает только непрочитанные", () => {
    useNotif.getState().setNotifications([
      makeNotification("a", false),
      makeNotification("b", true),
      makeNotification("c", false),
    ]);
    expect(useNotif.getState().unreadNotificationsCount()).toBe(2);
  });

  it("markAllNotificationsRead (ошибка сети) откатывает состояние", async () => {
    useNotif.getState().setNotifications([makeNotification("a")]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down"))
    );

    await useNotif.getState().markAllNotificationsRead();

    expect(useNotif.getState().notifications[0].read).toBe(false);
    expect(storageMocks.logWarn).toHaveBeenCalled();
  });
});

describe("notifications slice — серверная синхронизация", () => {
  const useNotif = create(createNotificationsSlice);

  it("fetchNotifications нормализует createdAt строку в timestamp", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            notifications: [
              { id: "s1", type: "system", title: "T", message: "M", read: false, createdAt: "2026-01-01T00:00:00Z" },
            ],
          }),
      })
    );

    await useNotif.getState().fetchNotifications();

    const first = useNotif.getState().notifications[0];
    expect(typeof first.createdAt).toBe("number");
    expect(first.createdAt).toBe(new Date("2026-01-01T00:00:00Z").getTime());
  });

  it("fetchNotifications при не-ok ответе не трогает кэш", async () => {
    useNotif.getState().setNotifications([makeNotification("cached")]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));

    await useNotif.getState().fetchNotifications();

    expect(useNotif.getState().notifications[0].id).toBe("cached");
    expect(storageMocks.logWarn).toHaveBeenCalledWith(
      "Server failed to fetch notifications",
      expect.objectContaining({ status: 500 })
    );
  });

  it("markNotificationRead: успех синхронизирует с сервером", async () => {
    useNotif.getState().setNotifications([makeNotification("a"), makeNotification("b", true)]);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    await useNotif.getState().markNotificationRead("a");

    expect(useNotif.getState().notifications.find((n) => n.id === "a")?.read).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/notifications/a",
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("markNotificationRead: отказ сервера откатывает оптимистичное обновление", async () => {
    useNotif.getState().setNotifications([makeNotification("a")]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));

    await useNotif.getState().markNotificationRead("a");

    expect(useNotif.getState().notifications[0].read).toBe(false);
    expect(storageMocks.logWarn).toHaveBeenCalledWith(
      "Server failed to mark notification as read",
      expect.objectContaining({ notificationId: "a", status: 403 })
    );
  });

  it("publishNotification: успешный ответ добавляет уведомление", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            notification: {
              id: "srv1",
              type: "comment",
              title: "Новый комментарий",
              message: "Привет",
              createdAt: "2026-02-01T10:00:00Z",
              link: "/courses/c1",
            },
          }),
      })
    );

    await useNotif.getState().publishNotification(
      { type: "comment", title: "Новый комментарий", message: "Привет", read: false },
      "user-1"
    );

    const added = useNotif.getState().notifications[0];
    expect(added.id).toBe("srv1");
    expect(added.read).toBe(false);
    expect(added.link).toBe("/courses/c1");
    expect(typeof added.createdAt).toBe("number");
  });

  it("publishNotification: ошибка сети → локальный fallback", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await useNotif.getState().publishNotification(
      { type: "system", title: "Локальное", message: "M", read: false },
      "user-1"
    );

    const added = useNotif.getState().notifications[0];
    expect(added.title).toBe("Локальное");
    expect(added.id).toBeTruthy();
    expect(typeof added.createdAt).toBe("number");
  });
});
