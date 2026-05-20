#!/usr/bin/env node
const { copyFileSync, mkdirSync, readdirSync, statSync, existsSync } = require("fs");
const { join } = require("path");

const ROOT = join(__dirname, "..");
const NEXT_DIR = join(ROOT, ".next");

function copyDir(src, dest) {
  if (!existsSync(src)) {
    console.error(`Source directory not found: ${src}`);
    process.exit(1);
  }
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) {
    const srcPath = join(src, entry);
    const destPath = join(dest, entry);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

const standaloneDir = join(NEXT_DIR, "standalone");
mkdirSync(join(standaloneDir, ".next"), { recursive: true });

copyDir(join(NEXT_DIR, "static"), join(standaloneDir, ".next", "static"));
copyDir(join(ROOT, "public"), join(standaloneDir, "public"));

console.log("Build assets copied successfully.");
