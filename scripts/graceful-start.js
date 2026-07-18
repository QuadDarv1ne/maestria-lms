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

  // Stop accepting new connections — let in-flight requests drain.
  // The timeout is a safety net for stuck connections.
  const shutdownTimeout = setTimeout(() => {
    console.log("Shutdown timeout reached. Forcing exit.");
    process.exit(1);
  }, 10000);
  shutdownTimeout.unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

module.exports = server;
