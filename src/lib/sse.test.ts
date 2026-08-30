/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, afterAll } from "vitest";
import {
  addClient,
  getTotalConnections,
  pushNotification,
  pushUnreadCount,
  stopCleanup,
} from "@/lib/sse";

vi.mock("@/lib/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

interface FakeController {
  enqueue: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  enqueuedTexts(): string[];
}

function makeController(): FakeController {
  const calls: Uint8Array[] = [];
  const enqueue = vi.fn((chunk?: Uint8Array) => {
    if (chunk) calls.push(chunk);
  });
  return {
    enqueue,
    close: vi.fn(),
    error: vi.fn(),
    enqueuedTexts() {
      return calls.map((c) => new TextDecoder().decode(c));
    },
  };
}

function register(userId: string, c: FakeController) {
  return addClient(userId, c as unknown as ReadableStreamDefaultController);
}

afterAll(() => {
  stopCleanup();
});

describe("SSE client registry", () => {
  it("should track total connections across users", () => {
    const before = getTotalConnections();
    const c1 = makeController();
    const c2 = makeController();
    register("user-1", c1);
    register("user-1", c2);
    expect(getTotalConnections()).toBe(before + 2);
    const cleanup = register("user-2", makeController());
    expect(getTotalConnections()).toBe(before + 3);
    cleanup();
    expect(getTotalConnections()).toBe(before + 2);
  });

  it("should enqueue a notification payload and clean up on close", () => {
    const c = makeController();
    register("user-n", c);
    pushNotification("user-n", { id: "n1" } as never);
    expect(c.enqueue).toHaveBeenCalledTimes(1);
    const text = c.enqueuedTexts()[0];
    expect(text.startsWith("data: ")).toBe(true);
    expect(text.endsWith("\n\n")).toBe(true);
    expect(text).toContain('"type":"notification"');
  });

  it("should enqueue an unread count payload", () => {
    const c = makeController();
    register("user-u", c);
    pushUnreadCount("user-u", 4);
    expect(c.enqueue).toHaveBeenCalledTimes(1);
    const text = c.enqueuedTexts()[0];
    expect(text).toContain('"type":"unreadCount"');
    expect(text).toContain('"count":4');
  });

  it("should not enqueue for a user with no connections", () => {
    const c = makeController();
    pushNotification("ghost", { id: "x" } as never);
    expect(c.enqueue).not.toHaveBeenCalled();
  });
});
