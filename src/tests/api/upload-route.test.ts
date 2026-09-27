// @vitest-environment node
/**
 * Route-level tests for POST /api/upload.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mockHandleApiError, mockUploadFileToS3 } = vi.hoisted(() => ({
  mockHandleApiError: vi.fn(),
  mockUploadFileToS3: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getAuthSession: vi.fn(),
  requireAuth: vi.fn((session: { user?: unknown } | null) => Boolean(session?.user)),
  authErrorResponse: vi.fn(
    () => new Response(JSON.stringify({ error: "Необходимо авторизоваться" }), { status: 401 }),
  ),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: () => () => null,
  RATE_LIMITS: { upload: { windowMs: 60_000, maxRequests: 10 } },
}));

vi.mock("@/lib/api-errors", () => ({
  handleApiError: (...args: unknown[]) => mockHandleApiError(...args),
}));

vi.mock("@/lib/file-upload", () => {
  class UploadError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.name = "UploadError";
      this.status = status;
    }
  }
  return {
    UploadError,
    uploadFileToS3: (...args: unknown[]) => mockUploadFileToS3(...args),
    deleteFileFromS3: vi.fn(),
    isAllowedUploadType: vi.fn(() => true),
    verifyFileMagicBytes: vi.fn(() => true),
    ALLOWED_UPLOAD_TYPES: ["image/png"],
    MAX_UPLOAD_SIZE: 1024,
  };
});

import { getAuthSession } from "@/lib/auth";
import { UploadError } from "@/lib/file-upload";
import { POST } from "@/app/api/upload/route";

const UPLOAD_URL = "http://localhost/api/upload";

const studentSession = { user: { id: "user-1", role: "student" } };

function uploadRequest(options: { file?: File; folder?: string; formData?: boolean } = {}) {
  const form = new FormData();
  if (options.formData !== false) {
    if (options.folder !== undefined) form.append("folder", options.folder);
    if (options.file) form.append("file", options.file);
  }
  return new NextRequest(UPLOAD_URL, { method: "POST", body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAuthSession).mockResolvedValue(studentSession as never);
  mockUploadFileToS3.mockResolvedValue({
    key: "uploads/lesson/file.png",
    url: "https://cdn.example.com/uploads/lesson/file.png",
    size: 1234,
    type: "image/png",
  });
  mockHandleApiError.mockReturnValue(new Response(JSON.stringify({ error: "internal" }), { status: 500 }));
});

describe("POST /api/upload", () => {
  it("requires authentication", async () => {
    vi.mocked(getAuthSession).mockResolvedValue(null);

    const res = await POST(uploadRequest({ file: new File(["x"], "a.png", { type: "image/png" }) }));
    expect(res.status).toBe(401);
    expect(mockUploadFileToS3).not.toHaveBeenCalled();
  });

  it("rejects a role that is not allowed to upload", async () => {
    vi.mocked(getAuthSession).mockResolvedValue({ user: { id: "user-9", role: "moderator" } } as never);

    const res = await POST(uploadRequest({ file: new File(["x"], "a.png", { type: "image/png" }) }));
    expect(res.status).toBe(403);
    expect(mockUploadFileToS3).not.toHaveBeenCalled();
  });

  it("rejects a folder name that could escape the upload root", async () => {
    const res = await POST(
      uploadRequest({ file: new File(["x"], "a.png", { type: "image/png" }), folder: "../../etc" }),
    );
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("папк");
    expect(mockUploadFileToS3).not.toHaveBeenCalled();
  });

  it("rejects a request without a file", async () => {
    const res = await POST(uploadRequest({ folder: "lesson" }));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain("Файл");
    expect(mockUploadFileToS3).not.toHaveBeenCalled();
  });

  it("uploads the file and returns the storage result", async () => {
    const file = new File(["binary"], "a.png", { type: "image/png" });

    const res = await POST(uploadRequest({ file, folder: "lesson" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.url).toBe("https://cdn.example.com/uploads/lesson/file.png");
    expect(mockUploadFileToS3).toHaveBeenCalledTimes(1);
    expect(mockUploadFileToS3.mock.calls[0][0]).toBe("lesson");
  });

  it("maps a storage UploadError to its status instead of a generic 500", async () => {
    mockUploadFileToS3.mockRejectedValue(new UploadError("Файл слишком большой", 413));

    const res = await POST(uploadRequest({ file: new File(["x"], "big.zip", { type: "application/zip" }) }));
    expect(res.status).toBe(413);

    const body = await res.json();
    expect(body.error).toContain("слишком большой");
    expect(mockHandleApiError).not.toHaveBeenCalled();
  });

  it("routes unexpected storage failures through handleApiError", async () => {
    mockUploadFileToS3.mockRejectedValue(new Error("s3 down"));

    const res = await POST(uploadRequest({ file: new File(["x"], "a.png", { type: "image/png" }) }));
    expect(res.status).toBe(500);
    expect(mockHandleApiError).toHaveBeenCalledTimes(1);
  });
});
