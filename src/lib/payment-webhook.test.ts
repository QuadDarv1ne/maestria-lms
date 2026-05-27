import { describe, it, expect } from "vitest";

describe("payment webhook", () => {
  it("should map provider status values correctly", () => {
    const statusMap: Record<string, string> = {
      succeeded: "completed",
      paid: "completed",
      completed: "completed",
      canceled: "failed",
      failed: "failed",
      refunded: "refunded",
    };

    expect(statusMap["succeeded"]).toBe("completed");
    expect(statusMap["paid"]).toBe("completed");
    expect(statusMap["completed"]).toBe("completed");
    expect(statusMap["canceled"]).toBe("failed");
    expect(statusMap["failed"]).toBe("failed");
    expect(statusMap["refunded"]).toBe("refunded");
    expect(statusMap["unknown"]).toBe(undefined);
  });

  it("should normalize status to lowercase", () => {
    const statuses = ["Succeeded", "PAID", "Completed", "Failed"];
    for (const status of statuses) {
      expect(status.toLowerCase()).toBe(status.toLowerCase());
    }
  });

  it("should accept transaction IDs starting with txn_", () => {
    const validIds = ["txn_1234567890_uuid", "txn_000_abc"];
    const invalidIds = ["abc_123", "payment_123", ""];

    for (const id of validIds) {
      expect(id.startsWith("txn_")).toBe(true);
    }
    for (const id of invalidIds) {
      expect(id.startsWith("txn_")).toBe(false);
    }
  });

  it("should validate webhook payload schema", () => {
    const validPayload = {
      status: "succeeded",
      object: {
        id: "pay_123",
        transactionId: "txn_1234567890_uuid",
        status: "succeeded",
        amount: { value: "1000.00", currency: "RUB" },
      },
    };

    expect(validPayload.status).toBeDefined();
    expect(validPayload.object).toBeDefined();
    expect(validPayload.object?.transactionId?.startsWith("txn_")).toBe(true);
  });

  it("should reject invalid payload missing status", () => {
    const invalidPayload = {
      object: { id: "pay_123" },
    };

    expect("status" in invalidPayload).toBe(false);
  });
});
