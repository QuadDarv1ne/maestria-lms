import { describe, expect, it } from "vitest";
import { publicAssignmentOptions } from "./assignment-options";

const pairs = [
  { left: "HTTP", right: "протокол передачи" },
  { left: "TCP", right: "протокол транспорта" },
  { left: "DNS", right: "система имён" },
];

/** Project and fail loudly if the payload was rejected — null is its own case. */
function render(type: string, options: string): string {
  const projected = publicAssignmentOptions(type, options);
  if (projected === null) throw new Error(`expected ${type} to project, got null`);
  return projected;
}

describe("publicAssignmentOptions", () => {
  it("returns null for missing options", () => {
    expect(publicAssignmentOptions("matching", null)).toBeNull();
    expect(publicAssignmentOptions("ordering", "")).toBeNull();
  });

  it("keeps quiz options untouched — they are the question, not the key", () => {
    const options = JSON.stringify(["a", "b", "c"]);
    expect(publicAssignmentOptions("quiz", options)).toBe(options);
  });

  it("returns null for malformed payloads instead of throwing", () => {
    expect(publicAssignmentOptions("matching", "{not json")).toBeNull();
    expect(publicAssignmentOptions("ordering", "{not json")).toBeNull();
    expect(publicAssignmentOptions("drag_drop", "{not json")).toBeNull();
  });

  describe("matching", () => {
    it("splits pairs into two columns so no row carries its own answer", () => {
      const parsed = JSON.parse(render("matching", JSON.stringify(pairs)));

      expect(parsed.left).toEqual(["HTTP", "TCP", "DNS"]);
      expect(parsed.right).toHaveLength(3);
      expect([...parsed.right].sort()).toEqual(
        ["протокол передачи", "протокол транспорта", "система имён"].sort(),
      );
    });

    it("never leaves a right value in its original position", () => {
      const correctRights = pairs.map((p) => p.right);

      // A derangement is required, not just a shuffle: with a plain shuffle the
      // odds of at least one row keeping its answer grow with the list length.
      for (let run = 0; run < 50; run++) {
        const parsed = JSON.parse(render("matching", JSON.stringify(pairs)));
        parsed.right.forEach((right: string, idx: number) => {
          expect(right).not.toBe(correctRights[idx]);
        });
      }
    });

    it("does not leak the pair association anywhere in the payload", () => {
      const serialized = render("matching", JSON.stringify(pairs));

      // Columns are fine; the pairing is not. No object in the payload may
      // carry both halves of a row, and the stored pairs must not survive.
      expect(JSON.parse(serialized)).not.toHaveProperty("pairs");
      expect(serialized).not.toContain(JSON.stringify(pairs));
      expect(serialized).not.toContain("протокол передачи\"},\"right\":\"HTTP");
    });

    it("handles a single pair, which cannot be deranged", () => {
      const parsed = JSON.parse(render("matching", JSON.stringify([{ left: "a", right: "1" }])));
      expect(parsed.left).toEqual(["a"]);
      expect(parsed.right).toEqual(["1"]);
    });

    it("returns null when the array holds non-objects", () => {
      expect(publicAssignmentOptions("matching", JSON.stringify(["a", "b"]))).toBeNull();
    });

    it("returns null for an empty array", () => {
      expect(publicAssignmentOptions("matching", "[]")).toBeNull();
    });
  });

  describe("ordering", () => {
    const correct = ["first", "second", "third"];

    it("returns every item exactly once", () => {
      const parsed = JSON.parse(render("ordering", JSON.stringify(correct)));
      expect([...parsed].sort()).toEqual([...correct].sort());
    });

    it("never keeps an item in its correct position", () => {
      for (let run = 0; run < 50; run++) {
        const parsed: string[] = JSON.parse(render("ordering", JSON.stringify(correct)));
        parsed.forEach((item, idx) => expect(item).not.toBe(correct[idx]));
      }
    });

    it("does not return the stored order unchanged", () => {
      expect(render("ordering", JSON.stringify(correct))).not.toBe(JSON.stringify(correct));
    });

    it("handles a single item", () => {
      expect(publicAssignmentOptions("ordering", JSON.stringify(["only"]))).toBe('["only"]');
    });

    it("returns null for an empty array", () => {
      expect(publicAssignmentOptions("ordering", "[]")).toBeNull();
    });
  });

  describe("drag_drop", () => {
    const items = [
      { id: "1", text: "SELECT", group: "DML" },
      { id: "2", text: "CREATE", group: "DDL" },
      { id: "3", text: "INSERT", group: "DML" },
    ];

    it("drops the item's own bucket and keeps the bucket names", () => {
      const parsed = JSON.parse(render("drag_drop", JSON.stringify(items)));

      expect(parsed.items).toHaveLength(3);
      expect(parsed.items.map((i: { id: string }) => i.id).sort()).toEqual(["1", "2", "3"]);
      expect([...parsed.groups].sort()).toEqual(["DDL", "DML"]);
    });

    it("does not reveal which bucket an item belongs to", () => {
      const parsed = JSON.parse(render("drag_drop", JSON.stringify(items)));

      for (const item of parsed.items) {
        expect(item).not.toHaveProperty("group");
      }
      expect(parsed.items.find((i: { id: string }) => i.id === "1")).toEqual({
        id: "1",
        text: "SELECT",
      });
    });

    it("does not leak the answer map (the correctAnswer shape)", () => {
      const parsed = JSON.parse(render("drag_drop", JSON.stringify(items)));

      // The bucket names themselves are the drop zones and must stay, but no
      // element may tie an id to a bucket — that mapping *is* the answer key.
      expect([...parsed.groups].sort()).toEqual(["DDL", "DML"]);
      const answerMap = Object.fromEntries(items.map((i) => [i.id, i.group]));
      expect(parsed).not.toEqual(answerMap);
      expect(parsed.items.some((i: { id: string }) => "group" in i)).toBe(false);
    });

    it("returns null when an item is not an object", () => {
      expect(
        publicAssignmentOptions("drag_drop", JSON.stringify([{ id: "1", text: "x", group: "g" }, "nope"])),
      ).toBeNull();
    });

    it("returns null for an empty array", () => {
      expect(publicAssignmentOptions("drag_drop", "[]")).toBeNull();
    });
  });
});
