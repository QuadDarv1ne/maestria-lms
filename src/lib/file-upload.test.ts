// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockS3 } = vi.hoisted(() => ({
  mockS3: {
    isS3Available: vi.fn(() => true),
    s3Client: { send: vi.fn().mockResolvedValue({}) },
    S3_BUCKET: "test-bucket",
    toCdnUrl: (key: string) => `https://cdn.example.com/${key}`,
    makeFileKey: (folder: string, name: string) => `${folder}/file.${name.split(".").pop()}`,
  },
}));

vi.mock("@/lib/s3", () => mockS3);

import {
  ALLOWED_UPLOAD_TYPES,
  MAX_UPLOAD_SIZE,
  UploadError,
  isAllowedUploadType,
  verifyFileMagicBytes,
  uploadFileToS3,
  deleteFileFromS3,
} from "@/lib/file-upload";

function fakeFile(name: string, type: string, content: Uint8Array): File {
  const copy = new Uint8Array(content.byteLength);
  copy.set(content);
  return new File([copy as BlobPart], name, { type });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockS3.isS3Available.mockReturnValue(true);
});

describe("isAllowedUploadType", () => {
  it("accepts common document and media types", () => {
    expect(isAllowedUploadType("application/pdf")).toBe(true);
    expect(isAllowedUploadType("image/png")).toBe(true);
    expect(isAllowedUploadType("video/mp4")).toBe(true);
    expect(isAllowedUploadType("application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(true);
    expect(isAllowedUploadType("application/zip")).toBe(true);
    expect(isAllowedUploadType("text/plain")).toBe(true);
  });

  it("rejects unsupported types", () => {
    expect(isAllowedUploadType("text/html")).toBe(false);
    expect(isAllowedUploadType("application/x-executable")).toBe(false);
    expect(isAllowedUploadType("image/svg+xml")).toBe(false);
  });
});

describe("verifyFileMagicBytes", () => {
  it("accepts a valid JPEG header", () => {
    const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]);
    expect(verifyFileMagicBytes(buffer, "image/jpeg")).toBe(true);
  });

  it("accepts a valid PDF header", () => {
    expect(verifyFileMagicBytes(Buffer.from("%PDF-1.4"), "application/pdf")).toBe(true);
  });

  it("accepts a DOCX/ZIP container (PK header)", () => {
    const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    expect(verifyFileMagicBytes(buffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(true);
    expect(verifyFileMagicBytes(buffer, "application/zip")).toBe(true);
  });

  it("rejects a spoofed JPEG", () => {
    expect(verifyFileMagicBytes(Buffer.from("%PDF-1.4"), "image/jpeg")).toBe(false);
  });

  it("accepts types without a registered signature", () => {
    expect(verifyFileMagicBytes(Buffer.from("hello world"), "text/plain")).toBe(true);
    expect(verifyFileMagicBytes(Buffer.from([0x00, 0x01]), "application/octet-stream")).toBe(true);
  });
});

describe("uploadFileToS3", () => {
  it("throws 503 when storage is not configured", async () => {
    mockS3.isS3Available.mockReturnValue(false);
    const file = fakeFile("a.pdf", "application/pdf", new Uint8Array([0x25, 0x50]));
    await expect(uploadFileToS3("docs", file)).rejects.toMatchObject({ status: 503 });
  });

  it("throws 400 for an unsupported type", async () => {
    const file = fakeFile("page.html", "text/html", new Uint8Array([0x3c, 0x68]));
    await expect(uploadFileToS3("docs", file)).rejects.toMatchObject({ status: 400 });
  });

  it("throws 400 for a file over the size limit", async () => {
    const file = {
      name: "big.bin",
      type: "application/octet-stream",
      size: MAX_UPLOAD_SIZE + 1,
      arrayBuffer: async () => new Uint8Array(0),
    } as unknown as File;
    await expect(uploadFileToS3("docs", file)).rejects.toMatchObject({ status: 400 });
  });

  it("throws 400 when magic bytes do not match the declared type", async () => {
    const file = fakeFile("fake.jpg", "image/jpeg", new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    await expect(uploadFileToS3("docs", file)).rejects.toMatchObject({ status: 400 });
  });

  it("uploads a valid file and returns key/url/size/type", async () => {
    const file = fakeFile("notes.pdf", "application/pdf", new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    const result = await uploadFileToS3("attachments/lesson", file);
    expect(mockS3.s3Client.send).toHaveBeenCalledOnce();
    expect(result).toEqual({
      key: "attachments/lesson/file.pdf",
      url: "https://cdn.example.com/attachments/lesson/file.pdf",
      size: file.size,
      type: "application/pdf",
    });
  });

  it("rejects a non-File input", async () => {
    const file = null as unknown as File;
    await expect(uploadFileToS3("docs", file)).rejects.toThrow(UploadError);
  });
});

describe("deleteFileFromS3", () => {
  it("sends a DeleteObjectCommand when storage is configured", async () => {
    await deleteFileFromS3("attachments/lesson/file.pdf");
    expect(mockS3.s3Client.send).toHaveBeenCalledOnce();
  });
});

describe("ALLOWED_UPLOAD_TYPES / MAX_UPLOAD_SIZE", () => {
  it("keeps the max size at 100MB", () => {
    expect(MAX_UPLOAD_SIZE).toBe(100 * 1024 * 1024);
  });

  it("includes the original media types for backward compatibility", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "video/webm", "application/pdf"]) {
      expect(ALLOWED_UPLOAD_TYPES).toContain(type);
    }
  });
});
