/**
 * @vitest-environment node
 */
import { describe, it, expect } from "vitest";

import {
  decodeAwayTarget,
  normalizeArticleHref,
  normalizeArticleLinks,
} from "@/lib/vk-link-normalize";

const slugs = new Set(["python-315-lenivye-importy", "nikkolo-makiavelli-gosudar-chast-number-one"]);

describe("decodeAwayTarget", () => {
  it("decodes a percent-encoded target", () => {
    expect(
      decodeAwayTarget("to=https%3A%2F%2Fexample.com%2Fpage&amp;cc_key=")
    ).toBe("https://example.com/page");
  });

  it("keeps an already plain target and strips the trailing cc_key", () => {
    expect(decodeAwayTarget("to=https://t.me/channel&cc_key=")).toBe("https://t.me/channel");
  });

  it("unescapes &amp; inside the target query string", () => {
    expect(decodeAwayTarget("to=https%3A%2F%2Fa.io%2F%3Fx%3D1%26amp%3By%3D2")).toBe(
      "https://a.io/?x=1&y=2"
    );
  });

  it("rejects a missing to= parameter", () => {
    expect(decodeAwayTarget("cc_key=")).toBeNull();
  });

  it("rejects a non-http target", () => {
    expect(decodeAwayTarget("to=javascript%3Aalert(1)")).toBeNull();
  });

  it("rejects malformed percent-encoding instead of throwing", () => {
    expect(decodeAwayTarget("to=%E0%A4%A")).toBeNull();
  });
});

describe("normalizeArticleHref", () => {
  it("rewrites a relative away.php link to its target", () => {
    expect(
      normalizeArticleHref("/away.php?to=https%3A%2F%2Frosstat.gov.ru%2Fx.html&amp;cc_key=", slugs)
    ).toBe("https://rosstat.gov.ru/x.html");
  });

  it("rewrites an absolute vk.ru away.php link", () => {
    expect(
      normalizeArticleHref("https://vk.ru/away.php?to=https://school-maestro7it.ru/&amp;cc_key=", slugs)
    ).toBe("https://school-maestro7it.ru/");
  });

  it("maps a group article to the internal blog route when imported", () => {
    expect(normalizeArticleHref("/@science_geeks-python-315-lenivye-importy", slugs)).toBe(
      "/blog/python-315-lenivye-importy"
    );
  });

  it("falls back to the VK article URL for a not-yet-imported group article", () => {
    expect(normalizeArticleHref("/@science_geeks-smeshannye-film-2014", slugs)).toBe(
      "https://vk.com/@science_geeks-smeshannye-film-2014"
    );
  });

  it("strips a trailing slash from a group article slug", () => {
    expect(normalizeArticleHref("/@science_geeks-python-315-lenivye-importy/", slugs)).toBe(
      "/blog/python-315-lenivye-importy"
    );
  });

  it("leaves unrelated links untouched", () => {
    expect(normalizeArticleHref("https://example.com/", slugs)).toBeNull();
    expect(normalizeArticleHref("/blog/other-article", slugs)).toBeNull();
    expect(normalizeArticleHref("#section", slugs)).toBeNull();
  });
});

describe("normalizeArticleLinks", () => {
  it("rewrites both href and title attributes", () => {
    const html =
      '<a href="https://school-maestro7it.ru/" title="https://vk.com/away.php?to=https://school-maestro7it.ru/&amp;cc_key=">link</a>';
    expect(normalizeArticleLinks(html, slugs)).toBe(
      '<a href="https://school-maestro7it.ru/" title="https://school-maestro7it.ru/">link</a>'
    );
  });

  it("rewrites every occurrence in a body with mixed links", () => {
    const html =
      '<p><a href="/away.php?to=https%3A%2F%2Fa.io%2F&amp;cc_key=">a</a>' +
      '<a href="/@science_geeks-python-315-lenivye-importy">b</a>' +
      '<a href="https://example.com">c</a></p>';
    const result = normalizeArticleLinks(html, slugs);
    expect(result).toContain('href="https://a.io/"');
    expect(result).toContain('href="/blog/python-315-lenivye-importy"');
    expect(result).toContain('href="https://example.com"');
    expect(result).not.toContain("away.php");
  });

  it("returns an empty string unchanged", () => {
    expect(normalizeArticleLinks("", slugs)).toBe("");
  });

  it("is idempotent for already normalised content", () => {
    const html = '<a href="https://a.io/" title="https://a.io/">a</a>';
    expect(normalizeArticleLinks(html, slugs)).toBe(html);
  });
});
