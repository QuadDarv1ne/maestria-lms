import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import {
  PROVIDER_CAPABILITIES,
  detectProviderFromUrl,
  isRunnableProvider,
} from "@/lib/db-provider";

const require = createRequire(import.meta.url);

/**
 * The CLI tooling (scripts/lib/env-manager.js) keeps its own copy of the
 * capability matrix because it runs in plain CommonJS before any bundling.
 * A divergence means a script happily configures an engine the application
 * cannot open — which is exactly how MongoDB/MySQL "support" used to be
 * advertised while every query failed at runtime.
 */
describe("provider capability parity between runtime and CLI", () => {
  const cli = require("../../scripts/lib/env-manager.js");

  it("declares the same providers in both places", () => {
    expect(Object.keys(cli.PROVIDER_CAPABILITIES).sort()).toEqual(
      Object.keys(PROVIDER_CAPABILITIES).sort(),
    );
  });

  it("agrees on which providers are runnable", () => {
    for (const provider of Object.keys(PROVIDER_CAPABILITIES)) {
      expect(cli.isRunnableProvider(provider), `runnable: ${provider}`).toBe(
        isRunnableProvider(provider as keyof typeof PROVIDER_CAPABILITIES),
      );
    }
  });

  it("agrees on the status of every provider", () => {
    for (const [provider, capability] of Object.entries(PROVIDER_CAPABILITIES)) {
      expect(cli.PROVIDER_CAPABILITIES[provider].status, provider).toBe(capability.status);
    }
  });

  it("agrees on provider detection for the supported URL schemes", () => {
    const urls = [
      "postgresql://host/db",
      "postgres://host/db",
      "cockroachdb://host/db",
      "mysql://host/db",
      "mariadb://host/db",
      "mongodb://host/db",
      "mongodb+srv://host/db",
      "file:./dev.db",
      "/data/app.sqlite",
      "/data/app.sqlite3",
      "libsql://host/db",
    ];

    for (const url of urls) {
      expect(cli.detectProvider(url), url).toBe(detectProviderFromUrl(url));
    }
  });
});
