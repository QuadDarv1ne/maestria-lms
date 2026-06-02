/**
 * Centralized environment configuration with validation.
 * Provides type-safe access to environment variables across the application.
 */

function getRequiredEnv(key: string, fallback?: string): string {
  const value = process.env[key];
  if (!value) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getOptionalEnv(key: string, fallback?: string): string | undefined {
  return process.env[key] ?? fallback;
}

export const env = {
  // Site configuration
  get siteUrl(): string {
    // In production, NEXT_PUBLIC_SITE_URL must be explicitly set to avoid broken links
    if (this.isProduction) {
      return getRequiredEnv("NEXT_PUBLIC_SITE_URL");
    }
    return getOptionalEnv("NEXT_PUBLIC_SITE_URL") ?? "http://localhost:3000";
  },

  // Database
  get databaseUrl(): string {
    return getRequiredEnv("DATABASE_URL");
  },

  // NextAuth
  get nextAuthSecret(): string {
    return getRequiredEnv("NEXTAUTH_SECRET");
  },

  get nextAuthUrl(): string | undefined {
    return getOptionalEnv("NEXTAUTH_URL");
  },

  // Email (Resend)
  get resendApiKey(): string | undefined {
    return getOptionalEnv("RESEND_API_KEY");
  },

  get emailFrom(): string {
    return getOptionalEnv("EMAIL_FROM") ?? "Maestria LMS <noreply@maestria.edu>";
  },

  // Redis
  get redisUrl(): string | undefined {
    return getOptionalEnv("REDIS_URL");
  },

  // S3 Storage
  get s3Endpoint(): string | undefined {
    return getOptionalEnv("S3_ENDPOINT");
  },

  get s3AccessKeyId(): string | undefined {
    return getOptionalEnv("S3_ACCESS_KEY_ID");
  },

  get s3SecretAccessKey(): string | undefined {
    return getOptionalEnv("S3_SECRET_ACCESS_KEY");
  },

  get s3BucketName(): string | undefined {
    return getOptionalEnv("S3_BUCKET_NAME");
  },

  get s3Region(): string {
    return getOptionalEnv("S3_REGION") ?? "auto";
  },

  get cdnUrl(): string | undefined {
    return getOptionalEnv("NEXT_PUBLIC_CDN_URL");
  },

  // Logging
  get logLevel(): string {
    return getOptionalEnv("LOG_LEVEL") ?? "info";
  },

  // Payment webhook
  get paymentWebhookSecret(): string | undefined {
    return getOptionalEnv("PAYMENT_WEBHOOK_SECRET");
  },

  // YooKassa
  get yooKassaShopId(): string | undefined {
    return getOptionalEnv("YOOKASSA_SHOP_ID");
  },

  get yooKassaSecretKey(): string | undefined {
    return getOptionalEnv("YOOKASSA_SECRET_KEY");
  },

  // Seed
  get allowSeedData(): boolean {
    return process.env.ALLOW_SEED_DATA === "true";
  },

  // Node environment
  get nodeEnv(): string {
    return process.env.NODE_ENV || "development";
  },

  get isDevelopment(): boolean {
    return this.nodeEnv === "development";
  },

  get isProduction(): boolean {
    return this.nodeEnv === "production";
  },

  get isTest(): boolean {
    return this.nodeEnv === "test";
  },
} as const;

// Type for environment variable keys (useful for documentation)
export type EnvKey = keyof typeof env;
