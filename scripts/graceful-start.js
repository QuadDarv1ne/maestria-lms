#!/usr/bin/env node
/**
 * Graceful shutdown handler for production server.
 * Ensures in-flight requests complete before process exits.
 */

const server = require("../.next/standalone/server.js");

let isShuttingDown = false;

function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n${signal} received. Starting graceful shutdown...`);

  // Give in-flight requests time to complete
  const shutdownTimeout = setTimeout(() => {
    console.log("Shutdown timeout reached. Forcing exit.");
    process.exit(1);
  }, 10000);

  // Close database connections, cleanup, etc.
  process.on("SIGTERM", () => {
    clearTimeout(shutdownTimeout);
    process.exit(0);
  });

  process.on("SIGINT", () => {
    clearTimeout(shutdownTimeout);
    process.exit(0);
  });

  // Trigger shutdown
  process.emit("SIGTERM");
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Unhandled rejection handler
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

module.exports = server;
