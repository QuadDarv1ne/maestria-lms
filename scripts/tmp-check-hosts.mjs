import Database from "better-sqlite3";

const db = new Database("prisma/data.db", { readonly: true });
const rows = db.prepare("SELECT image, content FROM Article").all();

const coverHosts = new Set();
const srcHosts = new Set();
let dataUri = 0;
let httpSrc = 0;
let relSrc = 0;

for (const r of rows) {
  if (r.image) {
    if (r.image.startsWith("http")) coverHosts.add(new URL(r.image).host);
    else coverHosts.add("SAME_ORIGIN");
  }
  const matches = String(r.content || "").match(/src="([^"]+)"/g) || [];
  for (const m of matches) {
    const u = m.slice(5, -1);
    if (u.startsWith("data:")) { dataUri++; continue; }
    if (u.startsWith("http")) { httpSrc++; try { srcHosts.add(new URL(u).host); } catch { /* ignore */ } }
    else { relSrc++; srcHosts.add("SAME_ORIGIN"); }
  }
}

console.log("articles:", rows.length);
console.log("cover hosts:", [...coverHosts].join(", "));
console.log("content src hosts:", [...srcHosts].join(", "));
console.log("content src counts -> http:", httpSrc, "relative:", relSrc, "dataURI:", dataUri);
