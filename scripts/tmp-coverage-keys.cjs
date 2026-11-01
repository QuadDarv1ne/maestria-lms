// Temporary diagnostic: inspect coverage-summary keys for duplicated files.
const s = require("./coverage/coverage-summary.json");
const keys = Object.keys(s).filter((k) => k.toLowerCase().includes("mkb.ts"));
for (const k of keys) {
  console.log(JSON.stringify(k), "lines:", s[k].lines.pct);
}
