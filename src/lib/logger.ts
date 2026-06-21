/* eslint-disable no-console */

import { env } from "@/lib/env";

type LogLevel = "error" | "warn" | "info" | "debug";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
}

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

function getLogLevel(): LogLevel {
  return (env.logLevel as LogLevel) || "info";
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_ORDER[level] <= LOG_LEVEL_ORDER[getLogLevel()];
}

function formatLogEntry(entry: LogEntry): string {
  return JSON.stringify(entry);
}

function writeLog(entry: LogEntry): void {
  if (!shouldLog(entry.level)) return;

  const formatted = formatLogEntry(entry);

  switch (entry.level) {
    case "error":
      console.error(formatted);
      break;
    case "warn":
      console.warn(formatted);
      break;
    case "info":
      console.info(formatted);
      break;
    case "debug":
      console.debug(formatted);
      break;
  }
}

export function logger(
  level: LogLevel,
  message: string,
  context?: Record<string, unknown>,
): void {
  writeLog({
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  });
}

export const log = {
  error: (message: string, context?: Record<string, unknown>) =>
    logger("error", message, context),
  warn: (message: string, context?: Record<string, unknown>) =>
    logger("warn", message, context),
  info: (message: string, context?: Record<string, unknown>) =>
    logger("info", message, context),
  debug: (message: string, context?: Record<string, unknown>) =>
    logger("debug", message, context),
};
