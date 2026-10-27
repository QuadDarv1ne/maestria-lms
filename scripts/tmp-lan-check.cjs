const { chromium } = require("playwright");

const BASE = "http://192.168.31.65:3000";
const articleCards = (page) => page.locator('article a[href^="/blog/"], [data-slot="card"]').filter({ has: page.locator("h3") });

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  const bad = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message.slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 250)); });
  page.on("response", (r) => { if (r.status() >= 400) bad.push(r.status() + " " + r.url().slice(0, 100)); });

  const state = () => page.evaluate(() => ({
    titles: Array.from(document.querySelectorAll("h3")).map((h) => h.textContent.slice(0, 34)),
    found: (Array.from(document.querySelectorAll("div,p,span")).find((s) => /Найдено/.test(s.textContent)) || {}).textContent,
    pageLabel: (Array.from(document.querySelectorAll("span")).find((s) => /Стр\./.test(s.textContent)) || {}).textContent,
  }));

  await page.goto(BASE + "/blog", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const s0 = await state();
  console.log("BASE: cards=%d found=%s label=%s", s0.titles.length, s0.found, s0.pageLabel);

  // Category filter
  await page.click('[data-slot="select-trigger"]');
  await page.waitForTimeout(500);
  await page.locator('[role="option"]').filter({ hasText: "Разработка" }).click();
  await page.waitForTimeout(2500);
  const s1 = await state();
  console.log("CATEGORY=development: cards=%d found=%s label=%s", s1.titles.length, s1.found, s1.pageLabel);

  // Sort by popular
  await page.locator('[data-slot="select-trigger"]').nth(1).click();
  await page.waitForTimeout(500);
  await page.locator('[role="option"]').filter({ hasText: "По популярности" }).click();
  await page.waitForTimeout(2500);
  const s2 = await state();
  console.log("SORT=popular: cards=%d found=%s first=%s", s2.titles.length, s2.found, s2.titles[0]);

  // Search
  await page.fill('input:not([type])', "python");
  await page.waitForTimeout(3000);
  const s3 = await state();
  console.log("SEARCH=python: cards=%d found=%s titles=%j", s3.titles.length, s3.found, s3.titles.slice(0, 4));

  // Clear filters
  const clear = page.getByRole("button", { name: /Сбросить/ });
  if (await clear.count()) { await clear.click(); await page.waitForTimeout(2500); }
  const s4 = await state();
  console.log("CLEARED: cards=%d found=%s label=%s", s4.titles.length, s4.found, s4.pageLabel);

  // Pagination (exact button name)
  for (let i = 1; i <= 3; i++) {
    const btn = page.getByRole("button", { name: "Далее", exact: true });
    if (!(await btn.count()) || await btn.isDisabled()) { console.log("no further pages at", i); break; }
    await btn.click();
    await page.waitForTimeout(2200);
    const s = await state();
    console.log("PAGER -> %s cards=%d first=%s", s.pageLabel, s.titles.length, s.titles[0]);
  }
  const back = page.getByRole("button", { name: "Назад", exact: true });
  console.log("Назад disabled on last page:", await back.isDisabled());
  await back.click();
  await page.waitForTimeout(2200);
  console.log("after Назад:", (await state()).pageLabel);

  // Open article by clicking a card
  await page.goto(BASE + "/blog", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await articleCards(page).first().click();
  await page.waitForTimeout(3000);
  const art = await page.evaluate(() => ({
    path: location.pathname,
    h1: ((document.querySelector("h1") || {}).textContent || "").slice(0, 60),
    p: document.querySelectorAll(".article-content p").length,
    strong: document.querySelectorAll(".article-content strong").length,
    toc: document.querySelectorAll('aside a[href^="#"]').length,
    progress: !!document.querySelector('[role="progressbar"]'),
    share: !!document.querySelector('a[href*="t.me/share"]'),
    jsonLd: !!document.querySelector('script[type="application/ld+json"]'),
    related: document.querySelectorAll('section[aria-labelledby="related-articles-heading"] a').length,
  }));
  console.log("ARTICLE:", JSON.stringify(art));

  console.log("HTTP >=400:", bad.length ? bad.slice(0, 6) : "none");
  console.log("JS ERRORS:", errors.length ? errors.slice(0, 4) : "none");
  await browser.close();
})();

