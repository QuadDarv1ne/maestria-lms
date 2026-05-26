import { S3Client } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

const s3AccessKey = env.s3AccessKeyId;
const s3SecretKey = env.s3SecretAccessKey;

const hasCredentials = !!(s3AccessKey && s3SecretKey);

/**
 * S3 client configured for the project's object storage.
 * Endpoint: s3c3.001.gpucloud.ru
 * CDN for delivery: https://ui3adtb308.a.trbcdn.net
 *
 * Returns null when credentials are not configured — use isS3Available()
 * to check before calling upload helpers.
 */
export const s3Client = hasCredentials
  ? new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: env.s3Endpoint,
      credentials: {
        accessKeyId: s3AccessKey,
        secretAccessKey: s3SecretKey,
      },
      forcePathStyle: true,
    })
  : null;

export const S3_BUCKET = env.s3BucketName || "maestria-lms";

/** Check whether S3 is configured and usable. */
export function isS3Available(): boolean {
  return hasCredentials;
}

/**
 * Build a CDN-deliverable URL from an S3 key.
 * Falls back to the raw S3 key if CDN_URL is not configured.
 */
export function toCdnUrl(key: string): string {
  const cdnBase = process.env.NEXT_PUBLIC_CDN_URL;
  if (!cdnBase) return key;
  const cleanBase = cdnBase.replace(/\/$/, "");
  const cleanKey = key.replace(/^\//, "");
  return `${cleanBase}/${cleanKey}`;
}

/**
 * Generate a unique S3 key for an uploaded file.
 * Pattern: {folder}/{timestamp}-{random}.{ext}
 * Sanitizes the original filename to prevent path traversal and special character issues.
 */
export function makeFileKey(folder: string, originalName: string): string {
  // Extract extension and sanitize it (alphanumeric only)
  const parts = originalName.split(".");
  const rawExt = parts.pop() || "bin";
  // Sanitize extension: remove any non-alphanumeric characters
  const ext = rawExt.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || "bin";

  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${folder}/${timestamp}-${random}.${ext}`;
}
