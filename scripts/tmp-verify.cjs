const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 400)); });
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message.slice(0, 300)));

  const slug = "python-315-lenivye-importy-utf-8-po-umolchaniu-i-profailer";
  await page.goto(`http://localhost:3000/blog/${slug}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const art = await page.evaluate(() => {
    const body = document.querySelector(".article-content");
    const imgs = body ? Array.from(body.querySelectorAll("img")) : [];
    const ldScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
    const articleLd = ldScripts.map((s) => s.textContent).find((t) => t && t.includes("BreadcrumbList"));
    let ldTypes = [];
    try { ldTypes = JSON.parse(articleLd)["@graph"].map((g) => g["@type"]); } catch (e) { ldTypes = ["PARSE_ERR: " + e.message]; }
    return {
      h1Count: document.querySelectorAll("h1").length,
      contentH1: body ? body.querySelectorAll("h1").length : -1,
      contentH2: body ? body.querySelectorAll("h2").length : -1,
      strong: body ? body.querySelectorAll("strong").length : -1,
      blockquote: body ? body.querySelectorAll("blockquote").length : -1,
      table: body ? body.querySelectorAll("table").length : -1,
      img: imgs.length,
      imgLazy: imgs.filter((i) => i.loading === "lazy").length,
      imgCursor: imgs.filter((i) => getComputedStyle(i).cursor === "zoom-in").length,
      tocLinks: document.querySelectorAll('a[href^="#"]').length,
      breadcrumbs: !!document.querySelector("nav ol li a[href='/blog']"),
      readingProgress: !!document.querySelector('[role="progressbar"]'),
      shareAbsUrl: (document.querySelector('a[href*="t.me/share"]') || {}).href || null,
      jsonLdCount: ldScripts.length,
      jsonLdTypes: ldTypes,
      related: document.querySelectorAll('a[href^="/blog/"]').length,
    };
  });
  console.log("ARTICLE:", JSON.stringify(art, null, 1));

  const imgHandle = page.locator(".article-content img").nth(2);
  await imgHandle.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await imgHandle.click({ force: true });
  await page.waitForTimeout(900);
  const lb = await page.evaluate(() => {
    const d = document.querySelector('[role="dialog"]');
    const i = d && d.querySelector("img");
    return { open: !!d, imgLoaded: i ? i.naturalWidth > 0 : false, caption: d ? (d.querySelector("figcaption") || {}).textContent : null };
  });
  console.log("LIGHTBOX:", JSON.stringify(lb));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  await page.evaluate(() => window.scrollTo(0, 0));
  const tocHref = await page.locator('aside a[href^="#"]').first().getAttribute("href");
  await page.locator('aside a[href^="#"]').first().click();
  await page.waitForTimeout(1000);
  const scrolled = await page.evaluate((h) => {
    const el = document.getElementById(h.slice(1));
    return { targetExists: !!el, y: Math.round(window.scrollY), rectTop: el ? Math.round(el.getBoundingClientRect().top) : null };
  }, tocHref);
  console.log("TOC CLICK", tocHref, JSON.stringify(scrolled));

  const v = await page.evaluate(async (s) => {
    const r1 = await fetch(`/api/articles/${s}/view`, { method: "POST" }).then((r) => r.json());
    const r2 = await fetch(`/api/articles/${s}/view`, { method: "POST" }).then((r) => r.json());
    return { first: r1, second: r2 };
  }, slug);
  console.log("VIEW COUNT:", JSON.stringify(v));

  await page.goto("http://localhost:3000/blog", { waitUntil: "networkidle" });
  const list = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll("img"));
    return {
      cards: document.querySelectorAll("[role='button']").length,
      imgs: imgs.length,
      optimized: imgs.filter((i) => i.currentSrc.includes("_next/image")).length,
      format: imgs[0] ? new URL(imgs[0].currentSrc, location.origin).searchParams.get("fm") : null,
      title: document.title,
      canonical: (document.querySelector('link[rel="canonical"]') || {}).href,
      robots: (document.querySelector('meta[name="robots"]') || {}).content || "(none)",
    };
  });
  console.log("BLOG LIST:", JSON.stringify(list, null, 1));

  await page.goto("http://localhost:3000/blog?page=2", { waitUntil: "networkidle" });
  const p2 = await page.evaluate(() => ({
    title: document.title,
    robots: (document.querySelector('meta[name="robots"]') || {}).content || "(none)",
  }));
  console.log("BLOG PAGE 2:", JSON.stringify(p2));

  console.log("CONSOLE ERRORS:", errors.length ? errors : "none");
  await browser.close();
})();
