import Redis from "ioredis";
import { log } from "@/lib/logger";
import { env } from "@/lib/env";

let client: Redis | null = null;
let connectionFailed = false;
let reconnectTimeout: NodeJS.Timeout | null = null;
const RECONNECT_DELAY_MS = 30_000;

function scheduleReconnect(): void {
  if (reconnectTimeout) return;
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    connectionFailed = false;
    log.info("Attempting to reconnect Redis");
    if (client) {
      client.disconnect();
      client = null;
    }
  }, RECONNECT_DELAY_MS);
}

export function getRedisClient(): Redis | null {
  if (connectionFailed) return null;
  if (client) return client;

  const redisUrl = env.redisUrl;
  if (!redisUrl) return null;

  try {
    client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
      lazyConnect: true,
    });

    client.on("error", (error) => {
      log.warn("Redis connection error, scheduling reconnect", {
        error: error.message,
      });
      connectionFailed = true;
      client?.disconnect();
      client = null;
      scheduleReconnect();
    });

    client.on("ready", () => {
      if (connectionFailed) {
        log.info("Redis connection restored");
        connectionFailed = false;
      }
    });

    return client;
  } catch {
    connectionFailed = true;
    scheduleReconnect();
    return null;
  }
}
