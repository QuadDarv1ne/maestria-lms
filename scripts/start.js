#!/usr/bin/env node
/**
 * Cross-platform production start.
 *
 * Replaces the previous package.json inline command
 * ("NODE_ENV=production node .next/standalone/server.js | tee server.log"),
 * which only worked in bash and failed under PowerShell/cmd on Windows.
 */
const { spawn } = require("child_process");
const path = require("path");

const serverPath = path.join(process.cwd(), ".next", "standalone", "server.js");

const child = spawn(process.execPath, [serverPath], {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "production" },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});
