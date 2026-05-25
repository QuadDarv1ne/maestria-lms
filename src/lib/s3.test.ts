import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("s3 utilities", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("toCdnUrl", () => {
    it("should return raw key when CDN_URL is not configured", async () => {
      delete process.env.NEXT_PUBLIC_CDN_URL;
      const { toCdnUrl } = await import("@/lib/s3");
      expect(toCdnUrl("uploads/image.png")).toBe("uploads/image.png");
    });

    it("should build CDN URL with clean base and key", async () => {
      process.env.NEXT_PUBLIC_CDN_URL = "https://cdn.example.com/";
      const { toCdnUrl } = await import("@/lib/s3");
      expect(toCdnUrl("/uploads/image.png")).toBe("https://cdn.example.com/uploads/image.png");
    });

    it("should handle keys without leading slash", async () => {
      process.env.NEXT_PUBLIC_CDN_URL = "https://cdn.example.com";
      const { toCdnUrl } = await import("@/lib/s3");
      expect(toCdnUrl("uploads/image.png")).toBe("https://cdn.example.com/uploads/image.png");
    });
  });

  describe("makeFileKey", () => {
    it("should generate a key with timestamp and random string", async () => {
      const { makeFileKey } = await import("@/lib/s3");
      const result = makeFileKey("avatars", "photo.jpg");
      expect(result).toMatch(/^avatars\/\d{13}-[a-z0-9]{6}\.jpg$/);
    });

    it("should sanitize special characters from extension", async () => {
      const { makeFileKey } = await import("@/lib/s3");
      const result = makeFileKey("uploads", "file.tar.gz");
      expect(result).toMatch(/\.(gz|tar)$/);
    });

    it("should handle filenames without extension", async () => {
      const { makeFileKey } = await import("@/lib/s3");
      const result = makeFileKey("docs", "README");
      // No dot means the whole name becomes the "extension" — sanitized to alphanumeric
      expect(result).toMatch(/^docs\/\d{13}-[a-z0-9]{6}\.README$/);
    });

    it("should truncate long extensions to 10 chars", async () => {
      const { makeFileKey } = await import("@/lib/s3");
      const result = makeFileKey("uploads", "file.verylongextension123");
      const ext = result.split(".").pop();
      expect(ext?.length).toBeLessThanOrEqual(10);
    });

    it("should handle path traversal attempts in filename", async () => {
      const { makeFileKey } = await import("@/lib/s3");
      const result = makeFileKey("uploads", "../../../etc/passwd");
      // The ".." parts become part of the "extension" and are stripped by sanitization
      // but "etcpasswd" remains as alphanumeric chars
      expect(result).toMatch(/^uploads\/\d{13}-[a-z0-9]{6}\./);
      expect(result).not.toContain("..");
      // The key itself only has one slash after the folder name
      const parts = result.split("/");
      expect(parts.length).toBe(2);
    });
  });

  describe("isS3Available", () => {
    it("should return false when credentials are not configured", async () => {
      delete process.env.S3_ACCESS_KEY_ID;
      delete process.env.S3_SECRET_ACCESS_KEY;
      const { isS3Available } = await import("@/lib/s3");
      expect(isS3Available()).toBe(false);
    });

    it("should return true when credentials are configured", async () => {
      process.env.S3_ACCESS_KEY_ID = "test-key";
      process.env.S3_SECRET_ACCESS_KEY = "test-secret";
      const { isS3Available } = await import("@/lib/s3");
      expect(isS3Available()).toBe(true);
    });
  });
});
