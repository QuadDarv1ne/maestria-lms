#!/usr/bin/env node
/**
 * Обёртка над tsc для lint-staged.
 *
 * Проблема: `tsc --noEmit file1.ts file2.ts` (файлы как аргументы CLI)
 * полностью игнорирует tsconfig.json — не работают path-алиасы (`@/*`)
 * и esModuleInterop, что даёт ложные ошибки TS2307/TS1192 на pre-commit.
 *
 * Решение: генерируем временный tsconfig рядом с корневым (чтобы
 * относительные `paths` резолвились корректно), который расширяет
 * корневой tsconfig.json и включает только переданные файлы.
 */
import { spawnSync } from "node:child_process";
import { existsSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const cwd = process.cwd();
const tsConfigPath = resolve(cwd, "tsconfig.json");
const tempConfigPath = resolve(cwd, ".tsconfig.staged.tmp.json");

const tscBin = resolve(cwd, "node_modules", "typescript", "bin", "tsc");

const files = process.argv
  .slice(2)
  // lint-staged может передавать пути с \\ и / — нормализуем через resolve
  .map((file) => resolve(cwd, file))
  .filter((file) => /\.(ts|tsx)$/i.test(file) && existsSync(file));

if (files.length === 0) {
  process.exit(0);
}

if (!existsSync(tscBin)) {
  console.error("tsc-staged: не найден typescript в node_modules");
  process.exit(1);
}

// Временный конфиг лежит в корне проекта, поэтому extends и include
// с относительными путями работают как обычно.
const config = {
  extends: "./tsconfig.json",
  compilerOptions: {
    // incremental пишет .tsbuildinfo рядом с временным конфигом — отключаем
    incremental: false,
    noEmit: true,
  },
  include: files,
};

writeFileSync(tempConfigPath, JSON.stringify(config, null, 2));

try {
  const result = spawnSync(process.execPath, [tscBin, "-p", tempConfigPath], {
    stdio: "inherit",
    cwd,
  });
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(tempConfigPath, { force: true });
}
