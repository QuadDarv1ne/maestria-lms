import Database from "better-sqlite3";

const db = new Database("prisma/data.db", { readonly: true });
const rows = db.prepare("SELECT slug, content FROM Article").all();

const iframeHosts = new Set();
const tagCounts = new Map();
let withIframe = 0;

for (const r of rows) {
  const c = String(r.content || "");
  const iframes = c.match(/<iframe[^>]*>/gi) || [];
  if (iframes.length) withIframe++;
  for (const tag of iframes) {
    const m = tag.match(/src="([^"]+)"/i);
    if (!m) continue;
    try { iframeHosts.add(new URL(m[1], "http://x").host); } catch { /* ignore */ }
  }
  for (const t of c.matchAll(/<([a-z][a-z0-9]*)/gi)) {
    const name = t[1].toLowerCase();
    tagCounts.set(name, (tagCounts.get(name) ?? 0) + 1);
  }
}

console.log("articles with iframe:", withIframe);
console.log("iframe hosts:", [...iframeHosts].join(", ") || "(none)");
const sorted = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
console.log("all tags used:", sorted.map(([k, v]) => `${k}:${v}`).join(" "));
