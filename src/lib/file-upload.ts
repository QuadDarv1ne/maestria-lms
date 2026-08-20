import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, S3_BUCKET, toCdnUrl, makeFileKey, isS3Available } from "@/lib/s3";

export const ALLOWED_UPLOAD_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "video/mp4",
  "video/webm",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
  "application/octet-stream",
  "text/plain",
  "text/markdown",
  "text/csv",
];

export const MAX_UPLOAD_SIZE = 100 * 1024 * 1024; // 100MB

// Magic byte signatures keyed by MIME type (first N bytes of the file content).
// Provides defence against MIME-type spoofing. Types without a registered
// signature (text, archives detected via octet-stream) are accepted without a
// binary check.
const MAGIC_BYTES: Record<string, Uint8Array[]> = {
  "image/jpeg": [new Uint8Array([0xff, 0xd8, 0xff])],
  "image/png": [new Uint8Array([0x89, 0x50, 0x4e, 0x47])],
  "image/webp": [new Uint8Array([0x52, 0x49, 0x46, 0x46])],
  "image/gif": [new Uint8Array([0x47, 0x49, 0x46, 0x38])],
  "video/mp4": [
    new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]),
    new Uint8Array([0x00, 0x00, 0x00, 0x1c, 0x66, 0x74, 0x79, 0x70]),
  ],
  "video/webm": [new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])],
  "application/pdf": [new Uint8Array([0x25, 0x50, 0x44, 0x46])],
  // DOCX / PPTX / XLSX / ZIP share the ZIP container signature
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
  ],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [
    new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
  ],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
    new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
  ],
  "application/zip": [new Uint8Array([0x50, 0x4b, 0x03, 0x04])],
  // Legacy Office OLE2 container (DOC / PPT / XLS)
  "application/msword": [new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])],
  "application/vnd.ms-powerpoint": [
    new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
  ],
  "application/vnd.ms-excel": [new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])],
};

export class UploadError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "UploadError";
    this.status = status;
  }
}

export function isAllowedUploadType(type: string): boolean {
  return ALLOWED_UPLOAD_TYPES.includes(type);
}

/**
 * Verify the magic bytes of a buffer against the declared MIME type.
 * Returns true when no signature is registered for the type (text, octet-stream).
 */
export function verifyFileMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const signatures = MAGIC_BYTES[mimeType];
  if (!signatures) return true;
  return signatures.some((sig) => sig.every((byte, i) => buffer[i] === byte));
}

/**
 * Validate an uploaded file and push it to S3 under the given folder.
 * Throws UploadError (with an HTTP status) on any failure.
 */
export async function uploadFileToS3(
  folder: string,
  file: File,
): Promise<{ key: string; url: string; size: number; type: string }> {
  if (!isS3Available()) {
    throw new UploadError("Хранилище не настроено — обратитесь к администратору", 503);
  }
  if (!s3Client) {
    throw new UploadError("S3 клиент не инициализирован", 500);
  }
  if (!file) {
    throw new UploadError("Файл не выбран");
  }
  if (file.size > MAX_UPLOAD_SIZE) {
    throw new UploadError("Файл слишком большой (макс. 100 МБ)");
  }
  if (!isAllowedUploadType(file.type)) {
    throw new UploadError(`Тип ${file.type} не поддерживается`);
  }

  const key = makeFileKey(folder, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  // Verify actual size matches client-reported size (defense against tampered Content-Length)
  if (buffer.byteLength > MAX_UPLOAD_SIZE) {
    throw new UploadError("Файл слишком большой (макс. 100 МБ)");
  }

  // Server-side magic-byte signature check prevents MIME-type spoofing
  if (!verifyFileMagicBytes(buffer, file.type)) {
    throw new UploadError("Содержимое файла не соответствует указанному типу");
  }

  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    }),
  );

  return {
    key,
    url: toCdnUrl(key),
    size: file.size,
    type: file.type,
  };
}

/**
 * Remove an object from S3. No-op when the storage is not configured;
 * the caller decides how to treat S3 deletion failures.
 */
export async function deleteFileFromS3(key: string): Promise<void> {
  if (!s3Client) return;
  await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
}
