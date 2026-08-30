/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreate, mockPush } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockPush: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { notification: { create: mockCreate } },
}));

vi.mock("@/lib/sse", () => ({
  pushNotification: mockPush,
}));

import { createNotification } from "@/lib/notifications";

describe("createNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a notification record and push to SSE", async () => {
    const created = {
      id: "n-1",
      type: "comment",
      title: "New comment",
      message: "Someone replied",
      read: false,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      link: "/course/c-1/lesson/l-1",
    };
    mockCreate.mockResolvedValue(created);

    const result = await createNotification({
      userId: "u-1",
      type: "comment",
      title: "New comment",
      message: "Someone replied",
      link: "/course/c-1/lesson/l-1",
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        userId: "u-1",
        type: "comment",
        title: "New comment",
        message: "Someone replied",
        link: "/course/c-1/lesson/l-1",
      },
    });
    expect(result).toBe(created);
    expect(mockPush).toHaveBeenCalledWith("u-1", {
      id: "n-1",
      type: "comment",
      title: "New comment",
      message: "Someone replied",
      read: false,
      createdAt: created.createdAt.getTime(),
      link: "/course/c-1/lesson/l-1",
    });
  });

  it("should omit link from the payload when not provided", async () => {
    const created = {
      id: "n-2",
      type: "system",
      title: "T",
      message: "M",
      read: true,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      link: null,
    };
    mockCreate.mockResolvedValue(created);

    await createNotification({ userId: "u-2", type: "system", title: "T", message: "M" });

    const payload = mockPush.mock.calls[0][1];
    expect(payload.link).toBeUndefined();
    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        userId: "u-2",
        type: "system",
        title: "T",
        message: "M",
        link: undefined,
      },
    });
  });
});
