const fs = require("fs");
const path = require("path");

// Load all locale keys
const ru = JSON.parse(fs.readFileSync("src/lib/locales/ru.json", "utf-8"));
const en = JSON.parse(fs.readFileSync("src/lib/locales/en.json", "utf-8"));
const zh = JSON.parse(fs.readFileSync("src/lib/locales/zh.json", "utf-8"));

// Walk through files and find t("key") patterns
const usedKeys = new Set();
function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && !e.name.startsWith("node_modules") && !e.name.startsWith(".git")) walk(p);
    else if (e.isFile() && (e.name.endsWith(".tsx") || e.name.endsWith(".ts"))) {
      const content = fs.readFileSync(p, "utf-8");
      const regex = /t\("([a-z_]+\.[a-zA-Z._]+)"/g;
      let m;
      while ((m = regex.exec(content)) !== null) {
        usedKeys.add(m[1]);
      }
    }
  }
}
walk("src/components");
walk("src/app");
walk("src/lib");

const keys = [...usedKeys].sort();

// Check which keys are missing from each locale
function checkMissing(locale, name) {
  const missing = keys.filter(k => !(k in locale));
  if (missing.length > 0) {
    console.log("=== Missing from " + name + " (" + missing.length + ") ===");
    missing.forEach(k => console.log("  " + k));
  } else {
    console.log("=== " + name + ": ALL KEYS PRESENT ===");
  }
}

checkMissing(ru, "ru.json");
checkMissing(en, "en.json");
checkMissing(zh, "zh.json");

// Check keys that are in locale files but not used anymore
const localeKeys = Object.keys(ru);
const unused = localeKeys.filter(k => !keys.includes(k));
console.log("\n=== Unused keys in ru.json (" + unused.length + ") ===");
unused.slice(0, 50).forEach(k => console.log("  " + k));
if (unused.length > 50) console.log("  ... and " + (unused.length - 50) + " more");