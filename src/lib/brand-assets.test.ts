import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { LOGO_ICON_SRC, LOGO_RASTER_SRC } from "@/components/Logo";

/**
 * Brand-asset integrity.
 *
 * The logo is referenced from four independent places (root metadata, the web
 * manifest, the service worker precache and React components). Before this test
 * existed, every one of them pointed at files that were never generated —
 * `/icons/icon-*.png`, `/og-image.png` and `/favicon.ico` were all missing, so
 * PWA install silently failed and social cards rendered without an image.
 */

const publicDir = join(process.cwd(), "public");
const layoutPath = join(process.cwd(), "src", "app", "layout.tsx");

function existsInPublic(webPath: string): boolean {
  return existsSync(join(publicDir, ...webPath.replace(/^\//, "").split("/")));
}

/** Absolute asset paths written as literals inside a source file. */
function assetPathsIn(source: string): string[] {
  const matches = source.matchAll(/\/[\w./-]+\.(?:png|svg|ico|jpe?g|webp)/g);
  return [...new Set([...matches].map((m) => m[0]))];
}

describe("brand assets exist on disk", () => {
  const canonical = [
    "/logo.svg",
    "/icon.svg",
    "/maestria-logo-icon.svg",
    "/maestria-logo-icon.png",
    "/maestria-logo-full.png",
    "/favicon.ico",
    "/og-image.png",
  ];

  it.each(canonical)("%s is present in public/", (asset) => {
    expect(existsInPublic(asset), asset).toBe(true);
  });

  it("keeps logo.svg and icon.svg in sync with the master SVG", () => {
    const master = readFileSync(join(publicDir, "maestria-logo-icon.svg"), "utf-8");
    for (const copy of ["logo.svg", "icon.svg"]) {
      expect(readFileSync(join(publicDir, copy), "utf-8"), copy).toBe(master);
    }
  });

  it("serves the brand mark as a square vector tile", () => {
    const svg = readFileSync(join(publicDir, "logo.svg"), "utf-8");
    expect(svg).toContain("<svg");
    expect(svg).toMatch(/viewBox="0 0 256 256"/);
  });
});

describe("favicon and og card are well formed", () => {
  it("favicon.ico carries an ICO header with embedded images", () => {
    const bytes = readFileSync(join(publicDir, "favicon.ico"));
    expect(bytes.readUInt16LE(0), "reserved").toBe(0);
    expect(bytes.readUInt16LE(2), "type").toBe(1);
    const entries = bytes.readUInt16LE(4);
    expect(entries).toBeGreaterThanOrEqual(3);
    // First directory entry must point past the header + entry table.
    expect(bytes.readUInt32LE(6 + 12), "first image offset").toBe(6 + 16 * entries);
  });

  it("og-image.png is a 1200x630 PNG", () => {
    const bytes = readFileSync(join(publicDir, "og-image.png"));
    expect([...bytes.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(bytes.readUInt32BE(16), "width").toBe(1200);
    expect(bytes.readUInt32BE(20), "height").toBe(630);
  });
});

describe("root metadata references only existing assets", () => {
  const referenced = assetPathsIn(readFileSync(layoutPath, "utf-8"));

  it("collects icon and image references from layout.tsx", () => {
    expect(referenced).toContain("/og-image.png");
    expect(referenced).toContain("/favicon.ico");
    expect(referenced).toContain("/icons/icon-180x180.png");
  });

  it.each(referenced)("%s exists in public/", (asset) => {
    expect(existsInPublic(asset), asset).toBe(true);
  });
});

describe("web manifest icons", () => {
  interface ManifestIcon {
    src: string;
    sizes: string;
    type: string;
    purpose?: string;
  }
  const manifest = JSON.parse(readFileSync(join(publicDir, "manifest.json"), "utf-8")) as {
    icons: ManifestIcon[];
    shortcuts?: Array<{ icons?: ManifestIcon[] }>;
    theme_color: string;
  };

  it("every declared icon file exists", () => {
    const all = [
      ...manifest.icons,
      ...(manifest.shortcuts ?? []).flatMap((s) => s.icons ?? []),
    ];
    for (const icon of all) {
      expect(existsInPublic(icon.src), icon.src).toBe(true);
    }
  });

  it("provides the sizes required for installability", () => {
    const sizes = manifest.icons.map((i) => `${i.sizes}:${i.purpose ?? "any"}`);
    expect(sizes).toContain("192x192:any");
    expect(sizes).toContain("512x512:any");
    expect(sizes.some((s) => s.endsWith(":maskable"))).toBe(true);
  });

  it("declares a hex theme_color matching the brand", () => {
    expect(manifest.theme_color.toLowerCase()).toMatch(/^#[0-9a-f]{6}$/);
    expect(manifest.theme_color.toLowerCase()).toBe("#7c3aed");
  });
});

describe("service worker precache", () => {
  const sw = readFileSync(join(publicDir, "sw.js"), "utf-8");
  const list = sw.slice(sw.indexOf("urlsToCache"), sw.indexOf("];", sw.indexOf("urlsToCache")));
  const files = assetPathsIn(list);

  it("precaches the brand mark", () => {
    expect(files).toContain("/logo.svg");
    expect(files).toContain("/maestria-logo-icon.png");
  });

  it.each(files)("%s exists in public/", (asset) => {
    expect(existsInPublic(asset), asset).toBe(true);
  });
});

describe("Logo component sources", () => {
  it("points both brand sources at real files", () => {
    expect(existsInPublic(LOGO_ICON_SRC), LOGO_ICON_SRC).toBe(true);
    expect(existsInPublic(LOGO_RASTER_SRC), LOGO_RASTER_SRC).toBe(true);
  });
});
