import { describe, it, expect, afterEach } from "vitest";
import {
  detectProviderFromUrl,
  resolveDatabaseProvider,
  type DatabaseProvider,
} from "@/lib/db-provider";

const urlCases: Array<[string, DatabaseProvider]> = [
  ["postgresql://user:pass@host:5432/db", "postgresql"],
  ["postgres://host:5432/db", "postgresql"],
  ["POSTGRESQL://HOST/DB", "postgresql"],
  ["  postgresql://host/db  ", "postgresql"],
  ["mysql://host:3306/db", "mysql"],
  ["mariadb://host:3306/db", "mysql"],
  ["mongodb://host:27017/db", "mongodb"],
  ["mongodb+srv://host/db", "mongodb"],
  ["file:./prisma/dev.db", "sqlite"],
  ["file:/data/app.db", "sqlite"],
  ["/data/app.sqlite", "sqlite"],
];

describe("database provider resolution", () => {
  describe("detectProviderFromUrl", () => {
    for (const [url, expected] of urlCases) {
      it(`maps ${url} to ${expected}`, () => {
        expect(detectProviderFromUrl(url)).toBe(expected);
      });
    }

    it("returns null when there is no URL to inspect", () => {
      expect(detectProviderFromUrl(undefined)).toBeNull();
      expect(detectProviderFromUrl(null)).toBeNull();
      expect(detectProviderFromUrl("")).toBeNull();
      expect(detectProviderFromUrl("libsql://host/db")).toBeNull();
    });
  });

  describe("resolveDatabaseProvider", () => {
    it("resolves the production regression: PostgreSQL URL with DATABASE_PROVIDER unset", () => {
      expect(
        resolveDatabaseProvider({
          url: "postgresql://user:secret@db.example:5432/maestria",
          declared: undefined,
        }),
      ).toEqual({ provider: "postgresql", source: "url" });
    });

    it("lets the URL win over a conflicting DATABASE_PROVIDER, as scripts/prisma-auto.js does", () => {
      expect(resolveDatabaseProvider({ url: "postgresql://host/db", declared: "sqlite" })).toEqual({
        provider: "postgresql",
        source: "url",
      });
      expect(resolveDatabaseProvider({ url: "file:./dev.db", declared: "postgresql" })).toEqual({
        provider: "sqlite",
        source: "url",
      });
    });

    it("falls back to a declared provider when the URL is absent or unrecognised", () => {
      expect(resolveDatabaseProvider({ declared: "postgresql" })).toEqual({
        provider: "postgresql",
        source: "env",
      });
      expect(resolveDatabaseProvider({ declared: "postgres" })).toEqual({
        provider: "postgresql",
        source: "env",
      });
      expect(resolveDatabaseProvider({ declared: "  MariaDB  " })).toEqual({
        provider: "mysql",
        source: "env",
      });
      expect(resolveDatabaseProvider({ url: "libsql://host/db", declared: "postgres" })).toEqual({
        provider: "postgresql",
        source: "env",
      });
    });

    it("defaults to sqlite when neither a URL nor a known provider is configured", () => {
      expect(resolveDatabaseProvider({})).toEqual({ provider: "sqlite", source: "default" });
      expect(resolveDatabaseProvider({ url: "", declared: "" })).toEqual({
        provider: "sqlite",
        source: "default",
      });
      expect(resolveDatabaseProvider({ declared: "oracle" })).toEqual({
        provider: "sqlite",
        source: "default",
      });
    });
  });

  describe("getDatabaseProvider() at the client boundary", () => {
    const originalUrl = process.env.DATABASE_URL;
    const originalProvider = process.env.DATABASE_PROVIDER;

    afterEach(() => {
      if (originalUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalUrl;
      if (originalProvider === undefined) delete process.env.DATABASE_PROVIDER;
      else process.env.DATABASE_PROVIDER = originalProvider;
    });

    it("selects postgresql from DATABASE_URL when the runner exports no DATABASE_PROVIDER", async () => {
      delete process.env.DATABASE_PROVIDER;
      process.env.DATABASE_URL = "postgresql://user:secret@db.example:5432/maestria";

      const { getDatabaseProvider } = await import("@/lib/db");

      expect(getDatabaseProvider()).toBe("postgresql");
    }, 20000);
  });
});