const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();

  // Clean context: view counter must count the very first visit.
  const ctx1 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p1 = await ctx1.newPage();
  const slug = "razbor-knigi-dzheka-londona-martin-iden";
  await p1.goto("http://localhost:3000/blog", { waitUntil: "domcontentloaded" });
  const before = await p1.evaluate(async (s) => (await fetch(`/api/articles/${s}`)).json().then((j) => j.views), slug);
  await p1.goto(`http://localhost:3000/blog/${slug}`, { waitUntil: "networkidle" });
  await p1.waitForTimeout(1500);
  const after = await p1.evaluate(async (s) => (await fetch(`/api/articles/${s}`)).json().then((j) => j.views), slug);
  const displayed = await p1.evaluate(() => {
    const el = Array.from(document.querySelectorAll("span")).find((s) => /просмотр/.test(s.textContent));
    return el ? el.textContent.trim() : null;
  });
  console.log("VIEWS before:", before, "after visit:", after, "displayed:", displayed);

  // Repeat visit in the same context must NOT count again (cookie dedup).
  await p1.reload({ waitUntil: "networkidle" });
  await p1.waitForTimeout(1200);
  const afterReload = await p1.evaluate(async (s) => (await fetch(`/api/articles/${s}`)).json().then((j) => j.views), slug);
  console.log("VIEWS after reload (should equal previous):", afterReload);

  // Image format negotiation on the blog list.
  const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p2 = await ctx2.newPage();
  await p2.goto("http://localhost:3000/blog", { waitUntil: "networkidle" });
  const imgInfo = await p2.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll("img")).slice(0, 3);
    return imgs.map((i) => ({
      src: i.getAttribute("src"),
      currentSrc: i.currentSrc.slice(0, 140),
      natural: i.naturalWidth + "x" + i.naturalHeight,
      rendered: Math.round(i.getBoundingClientRect().width) + "x" + Math.round(i.getBoundingClientRect().height),
      complete: i.complete,
    }));
  });
  console.log("IMAGES:");
  for (const i of imgInfo) console.log("  ", JSON.stringify(i));

  const lcp = await p2.evaluate(() => new Promise((res) => {
    new PerformanceObserver((l) => {
      const entries = l.getEntries();
      const last = entries[entries.length - 1];
      res({ value: Math.round(last.startTime), element: last.element ? last.element.tagName + "." + (last.element.className || "").slice(0, 40) : null, url: last.url ? last.url.slice(0, 90) : null });
    }).observe({ type: "largest-contentful-paint", buffered: true });
    setTimeout(() => res({ value: -1 }), 3000);
  }));
  console.log("LCP on /blog:", JSON.stringify(lcp));

  // Article page LCP
  await p2.goto("http://localhost:3000/blog/" + slug, { waitUntil: "networkidle" });
  await p2.waitForTimeout(1500);
  const lcp2 = await p2.evaluate(() => new Promise((res) => {
    new PerformanceObserver((l) => {
      const e = l.getEntries(); const last = e[e.length - 1];
      res({ value: Math.round(last.startTime), element: last.element ? last.element.tagName : null, url: last.url ? last.url.slice(0, 90) : null });
    }).observe({ type: "largest-contentful-paint", buffered: true });
    setTimeout(() => res({ value: -1 }), 3000);
  }));
  console.log("LCP on article:", JSON.stringify(lcp2));

  await browser.close();
})();
