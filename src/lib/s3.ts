import { S3Client } from "@aws-sdk/client-s3";

/**
 * S3 client configured for the project's object storage.
 * Endpoint: s3c3.001.gpucloud.ru
 * CDN for delivery: https://ui3adtb308.a.trbcdn.net
 */
export const s3Client = new S3Client({
  region: process.env.S3_REGION || "auto",
  endpoint: process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "",
    secretAccessKey: process.env.S3_SECRET_KEY || "",
  },
  forcePathStyle: true,
});

export const S3_BUCKET = process.env.S3_BUCKET || "maestria-lms";

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
 */
export function makeFileKey(folder: string, originalName: string): string {
  const ext = originalName.split(".").pop() || "bin";
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return `${folder}/${timestamp}-${random}.${ext}`;
}
