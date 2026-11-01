import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("react", () => ({
  // cache() в тестах — passthrough, чтобы можно было вызывать функции напрямую
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findUnique: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
  getDatabaseProvider: vi.fn(),
  logError: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    article: {
      findMany: mocks.findMany,
      findUnique: mocks.findUnique,
      count: mocks.count,
      update: mocks.update,
    },
  },
  Prisma: {},
  getDatabaseProvider: mocks.getDatabaseProvider,
}));

vi.mock("@/lib/logger", () => ({
  log: {
    error: mocks.logError,
    warn: mocks.logWarn,
  },
}));

import {
  getArticleBySlug,
  getArticlesPage,
  getRelatedArticles,
  incrementArticleViews,
} from "./articles";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getDatabaseProvider.mockReturnValue("postgresql");
});

describe("getArticlesPage", () => {
  it("базовый запрос: только опубликованные, пагинация, сортировка по дате", async () => {
    mocks.findMany.mockResolvedValue([{ id: "a1" }]);
    mocks.count.mockResolvedValue(12);

    const result = await getArticlesPage({ page: 2, limit: 10 });

    expect(result).toEqual({ articles: [{ id: "a1" }], total: 12, totalPages: 2 });
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isPublished: true },
        orderBy: [{ isFeatured: "desc" }, { createdAt: "desc" }],
        skip: 10,
        take: 10,
      })
    );
  });

  it("фильтр по категории", async () => {
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);

    await getArticlesPage({ page: 1, limit: 10, category: "web" });

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isPublished: true, category: "web" } })
    );
    expect(mocks.count).toHaveBeenCalledWith({ where: { isPublished: true, category: "web" } });
  });

  it("category=all не добавляет фильтр", async () => {
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);

    await getArticlesPage({ page: 1, limit: 10, category: "all" });

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isPublished: true } })
    );
  });

  it("поиск на PostgreSQL использует mode: insensitive", async () => {
    mocks.getDatabaseProvider.mockReturnValue("postgresql");
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);

    await getArticlesPage({ page: 1, limit: 10, search: "react" });

    const { where } = mocks.findMany.mock.calls[0][0];
    const filter = { contains: "react", mode: "insensitive" };
    expect(where.OR).toEqual([{ title: filter }, { excerpt: filter }]);
  });

  it("поиск на SQLite — без mode (LIKE регистронезависим нативно)", async () => {
    mocks.getDatabaseProvider.mockReturnValue("sqlite");
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);

    await getArticlesPage({ page: 1, limit: 10, search: "react" });

    const { where } = mocks.findMany.mock.calls[0][0];
    const filter = { contains: "react" };
    expect(where.OR).toEqual([{ title: filter }, { excerpt: filter }]);
  });

  it("sortBy=popular сортирует по views", async () => {
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);

    await getArticlesPage({ page: 1, limit: 10, sortBy: "popular" });

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ isFeatured: "desc" }, { views: "desc" }],
      })
    );
  });

  it("ошибка БД → пустой результат (не бросает)", async () => {
    mocks.findMany.mockRejectedValue(new Error("db down"));
    mocks.count.mockRejectedValue(new Error("db down"));

    const result = await getArticlesPage({ page: 1, limit: 10 });

    expect(result).toEqual({ articles: [], total: 0, totalPages: 0 });
    expect(mocks.logError).toHaveBeenCalledWith(
      "[articles] Failed to fetch article list",
      expect.objectContaining({ error: "db down" })
    );
  });
});

describe("getArticleBySlug", () => {
  it("находит статью по slug", async () => {
    const article = { id: "a1", slug: "intro", title: "Intro" };
    mocks.findUnique.mockResolvedValue(article);

    const result = await getArticleBySlug("intro");

    expect(result).toEqual(article);
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: { slug: "intro" },
      select: expect.any(Object),
    });
  });

  it("статьи нет → null", async () => {
    mocks.findUnique.mockResolvedValue(null);
    expect(await getArticleBySlug("missing")).toBeNull();
  });

  it("ошибка БД → null (не бросает)", async () => {
    mocks.findUnique.mockRejectedValue(new Error("timeout"));

    expect(await getArticleBySlug("intro")).toBeNull();
    expect(mocks.logError).toHaveBeenCalledWith(
      "[articles] Failed to fetch article",
      expect.objectContaining({ slug: "intro", error: "timeout" })
    );
  });
});

describe("getRelatedArticles", () => {
  const current = { id: "a1", category: "web" };

  it("полная выдача по категории — без фолбэка", async () => {
    const same = [{ id: "a2" }, { id: "a3" }, { id: "a4" }];
    mocks.findMany.mockResolvedValue(same);

    const result = await getRelatedArticles(current, 3);

    expect(result).toEqual(same);
    expect(mocks.findMany).toHaveBeenCalledTimes(1);
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isPublished: true, category: "web", id: { not: "a1" } },
        take: 3,
      })
    );
  });

  it("неполная категория дополняется из других категорий", async () => {
    const same = [{ id: "a2" }];
    const others = [{ id: "a5" }, { id: "a6" }];
    mocks.findMany
      .mockResolvedValueOnce(same)
      .mockResolvedValueOnce(others);

    const result = await getRelatedArticles(current, 3);

    expect(result).toEqual([...same, ...others]);
    expect(mocks.findMany).toHaveBeenCalledTimes(2);
    expect(mocks.findMany.mock.calls[1][0]).toMatchObject({
      where: {
        isPublished: true,
        id: { not: "a1" },
        NOT: { category: "web" },
      },
      take: 2,
    });
  });

  it("ошибка БД → пустой массив (не бросает)", async () => {
    mocks.findMany.mockRejectedValue(new Error("db down"));

    const result = await getRelatedArticles(current, 3);

    expect(result).toEqual([]);
    expect(mocks.logWarn).toHaveBeenCalledWith(
      "[articles] Failed to fetch related articles",
      expect.objectContaining({ articleId: "a1", error: "db down" })
    );
  });
});

describe("incrementArticleViews", () => {
  it("инкрементирует счётчик просмотров", async () => {
    mocks.update.mockResolvedValue({});
    await incrementArticleViews("a1");
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "a1" },
      data: { views: { increment: 1 } },
    });
  });

  it("ошибка обновления не ломает страницу", async () => {
    mocks.update.mockRejectedValue(new Error("write failed"));

    await expect(incrementArticleViews("a1")).resolves.toBeUndefined();
    expect(mocks.logWarn).toHaveBeenCalledWith(
      "[articles] Failed to increment views",
      expect.objectContaining({ articleId: "a1", error: "write failed" })
    );
  });
});
