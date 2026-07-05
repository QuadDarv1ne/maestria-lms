/**
 * Centralized environment configuration with validation.
 * Provides type-safe access to environment variables across the application.
 * Values are lazily cached on first access — env vars don't change at runtime.
 */

const cache = new Map<string, unknown>();

function cached<T>(key: string, compute: () => T): T {
  if (cache.has(key)) return cache.get(key) as T;
  const value = compute();
  cache.set(key, value);
  return value;
}

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const env = {
  get siteUrl(): string {
    return cached("siteUrl", () => {
      const url = process.env.NEXT_PUBLIC_SITE_URL;
      if (this.isProduction && !url) {
        throw new Error("Missing required environment variable: NEXT_PUBLIC_SITE_URL");
      }
      return url ?? "http://localhost:3000";
    });
  },

  get databaseUrl(): string {
    return cached("databaseUrl", () => getRequiredEnv("DATABASE_URL"));
  },

  get nextAuthSecret(): string {
    return cached("nextAuthSecret", () => getRequiredEnv("NEXTAUTH_SECRET"));
  },

  get nextAuthUrl(): string | undefined {
    return cached("nextAuthUrl", () => process.env.NEXTAUTH_URL);
  },

  get resendApiKey(): string | undefined {
    return cached("resendApiKey", () => process.env.RESEND_API_KEY);
  },

  get emailFrom(): string {
    return cached("emailFrom", () => process.env.EMAIL_FROM ?? "Maestria LMS <noreply@maestria.edu>");
  },

  get redisUrl(): string | undefined {
    return cached("redisUrl", () => process.env.REDIS_URL);
  },

  get s3Endpoint(): string | undefined {
    return cached("s3Endpoint", () => process.env.S3_ENDPOINT);
  },

  get s3AccessKeyId(): string | undefined {
    return cached("s3AccessKeyId", () => process.env.S3_ACCESS_KEY_ID);
  },

  get s3SecretAccessKey(): string | undefined {
    return cached("s3SecretAccessKey", () => process.env.S3_SECRET_ACCESS_KEY);
  },

  get s3BucketName(): string | undefined {
    return cached("s3BucketName", () => process.env.S3_BUCKET_NAME);
  },

  get s3Region(): string {
    return cached("s3Region", () => process.env.S3_REGION ?? "auto");
  },

  get cdnUrl(): string | undefined {
    return cached("cdnUrl", () => process.env.NEXT_PUBLIC_CDN_URL);
  },

  get logLevel(): string {
    return cached("logLevel", () => process.env.LOG_LEVEL ?? "info");
  },

  get paymentWebhookSecret(): string | undefined {
    return cached("paymentWebhookSecret", () => process.env.PAYMENT_WEBHOOK_SECRET);
  },

  get yooKassaShopId(): string | undefined {
    return cached("yooKassaShopId", () => process.env.YOOKASSA_SHOP_ID);
  },

  get yooKassaSecretKey(): string | undefined {
    return cached("yooKassaSecretKey", () => process.env.YOOKASSA_SECRET_KEY);
  },

  get allowSeedData(): boolean {
    return cached("allowSeedData", () => process.env.ALLOW_SEED_DATA === "true");
  },

  get nodeEnv(): string {
    return cached("nodeEnv", () => process.env.NODE_ENV || "development");
  },

  get isDevelopment(): boolean {
    return cached("isDevelopment", () => this.nodeEnv === "development");
  },

  get isProduction(): boolean {
    return cached("isProduction", () => this.nodeEnv === "production");
  },

  get isTest(): boolean {
    return cached("isTest", () => this.nodeEnv === "test");
  },
};

export type EnvKey = keyof typeof env;

/**
 * Clear the env cache. Only needed in tests that modify process.env.
 */
export function clearEnvCache(): void {
  cache.clear();
}
