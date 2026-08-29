import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { load, save, loadString, saveString } from "@/lib/storage";

function makeStorageMock(store: Record<string, string>) {
  return {
    getItem: vi.fn((key: string) => (key in store ? store[key] : null)),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = String(value);
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
  };
}

describe("storage localStorage helpers", () => {
  beforeEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("returns fallback when window is undefined (SSR)", () => {
    expect(load("key", { a: 1 })).toEqual({ a: 1 });
    expect(loadString("key", "fb")).toBe("fb");
    expect(save("key", 1)).toBeUndefined();
  });

  it("load parses stored JSON", () => {
    const store = { theme: '{"dark":true}' };
    (globalThis as { window?: unknown }).window = { localStorage: makeStorageMock(store) };

    expect(load<{ dark: boolean }>("theme", { dark: false })).toEqual({ dark: true });
  });

  it("load returns fallback on missing key", () => {
    (globalThis as { window?: unknown }).window = { localStorage: makeStorageMock({}) };
    expect(load("nope", 42)).toBe(42);
  });

  it("load returns fallback on invalid JSON", () => {
    const store = { broken: "{not json" };
    (globalThis as { window?: unknown }).window = { localStorage: makeStorageMock(store) };
    expect(load("broken", ["fb"])).toEqual(["fb"]);
  });

  it("loadString returns the raw stored value", () => {
    const store = { token: "abc" };
    (globalThis as { window?: unknown }).window = { localStorage: makeStorageMock(store) };
    expect(loadString("token", "default")).toBe("abc");
    expect(loadString("missing", "default")).toBe("default");
  });

  it("save stores the JSON-serialized value", () => {
    const store: Record<string, string> = {};
    const mock = makeStorageMock(store);
    (globalThis as { window?: unknown }).window = { localStorage: mock };

    save("profile", { name: "x", n: 1 });
    expect(store.profile).toBe('{"name":"x","n":1}');
    expect(mock.setItem).toHaveBeenCalledWith("profile", '{"name":"x","n":1}');
  });

  it("saveString stores the raw value", () => {
    const store: Record<string, string> = {};
    (globalThis as { window?: unknown }).window = { localStorage: makeStorageMock(store) };

    saveString("raw", "hello");
    expect(store.raw).toBe("hello");
  });

  it("does not throw when setItem fails (quota exceeded)", () => {
    const failingStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    (globalThis as { window?: unknown }).window = { localStorage: failingStorage };
    expect(() => save("key", "value")).not.toThrow();
  });

  it("does not throw when getItem fails (storage disabled)", () => {
    const failingStorage = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {},
    };
    (globalThis as { window?: unknown }).window = { localStorage: failingStorage };
    expect(load("key", "fb")).toBe("fb");
    expect(loadString("key", "fb")).toBe("fb");
  });
});