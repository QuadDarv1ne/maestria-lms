import { describe, it, expect } from "vitest";
import { gradeAssignment } from "./assignment-grading";

describe("gradeAssignment", () => {
  describe("quiz (single choice)", () => {
    it("scores 100 for the correct single answer", () => {
      expect(gradeAssignment("quiz", 2, "2")).toEqual({ status: "graded", score: 100 });
    });

    it("scores 0 for a wrong single answer", () => {
      expect(gradeAssignment("quiz", 1, "2")).toEqual({ status: "graded", score: 0 });
    });

    it("accepts an array with the single correct answer", () => {
      expect(gradeAssignment("quiz", [2], "2")).toEqual({ status: "graded", score: 100 });
    });

    it("accepts a JSON string answer", () => {
      expect(gradeAssignment("quiz", "2", "2")).toEqual({ status: "graded", score: 100 });
    });
  });

  describe("quiz (multiple choice)", () => {
    it("scores 100 for an exact set match", () => {
      expect(gradeAssignment("quiz", [1, 2, 3], "[1,2,3]")).toEqual({ status: "graded", score: 100 });
    });

    it("is order-insensitive for multiple choice", () => {
      expect(gradeAssignment("quiz", [3, 1, 2], "[1,2,3]")).toEqual({ status: "graded", score: 100 });
    });

    it("applies penalty for wrong picks", () => {
      // 2 correct, 1 wrong: (2 - 1) / 3 = 33%
      expect(gradeAssignment("quiz", [1, 2, 9], "[1,2,3]")).toEqual({ status: "graded", score: 33 });
    });

    it("clamps negative results to 0", () => {
      // 1 correct, 2 wrong: (1 - 2) / 3 = -33% -> 0
      expect(gradeAssignment("quiz", [1, 8, 9], "[1,2,3]").score).toBe(0);
    });
  });

  describe("matching", () => {
    const correct = JSON.stringify([
      { left: "a", right: "1" },
      { left: "b", right: "2" },
      { left: "c", right: "3" },
    ]);

    it("scores 100 when all pairs match", () => {
      expect(gradeAssignment("matching", [{ left: "a", right: "1" }, { left: "b", right: "2" }, { left: "c", right: "3" }], correct))
        .toEqual({ status: "graded", score: 100 });
    });

    it("gives partial credit for some correct pairs", () => {
      expect(gradeAssignment("matching", [{ left: "a", right: "1" }, { left: "b", right: "9" }, { left: "c", right: "3" }], correct))
        .toEqual({ status: "graded", score: 67 });
    });

    it("scores 0 when nothing matches", () => {
      expect(gradeAssignment("matching", [{ left: "x", right: "9" }, { left: "y", right: "8" }, { left: "z", right: "7" }], correct))
        .toEqual({ status: "graded", score: 0 });
    });

    it("returns not graded for non-array answers", () => {
      expect(gradeAssignment("matching", "oops", correct)).toEqual({ status: "submitted", score: null });
    });
  });

  describe("ordering", () => {
    const correct = JSON.stringify(["a", "b", "c", "d"]);

    it("scores 100 for the exact order", () => {
      expect(gradeAssignment("ordering", ["a", "b", "c", "d"], correct)).toEqual({ status: "graded", score: 100 });
    });

    it("gives partial credit for correct positions", () => {
      // "a" and "c" are in the correct positions: 2/4 = 50%
      expect(gradeAssignment("ordering", ["a", "c", "b", "d"], correct)).toEqual({ status: "graded", score: 50 });
    });

    it("scores 0 for a fully reversed order", () => {
      expect(gradeAssignment("ordering", ["d", "c", "b", "a"], correct)).toEqual({ status: "graded", score: 0 });
    });

    it("accepts a JSON string answer", () => {
      expect(gradeAssignment("ordering", '["a","b","c","d"]', correct)).toEqual({ status: "graded", score: 100 });
    });
  });

  describe("drag_drop", () => {
    const correct = JSON.stringify({ item1: "g1", item2: "g1", item3: "g2" });

    it("scores 100 when all items are in the right groups", () => {
      expect(gradeAssignment("drag_drop", { item1: "g1", item2: "g1", item3: "g2" }, correct))
        .toEqual({ status: "graded", score: 100 });
    });

    it("gives partial credit for partially correct placement", () => {
      expect(gradeAssignment("drag_drop", { item1: "g1", item2: "g2", item3: "g2" }, correct))
        .toEqual({ status: "graded", score: 67 });
    });

    it("scores 0 when all items are misplaced", () => {
      expect(gradeAssignment("drag_drop", { item1: "g2", item2: "g2", item3: "g1" }, correct))
        .toEqual({ status: "graded", score: 0 });
    });

    it("accepts a JSON string answer", () => {
      expect(gradeAssignment("drag_drop", '{"item1":"g1","item2":"g1","item3":"g2"}', correct))
        .toEqual({ status: "graded", score: 100 });
    });

    it("returns not graded for array answers", () => {
      expect(gradeAssignment("drag_drop", ["a"], correct)).toEqual({ status: "submitted", score: null });
    });
  });

  describe("common cases", () => {
    it("returns not graded for unknown types", () => {
      expect(gradeAssignment("essay", "some text", null)).toEqual({ status: "submitted", score: null });
    });

    it("returns not graded when correctAnswer is missing", () => {
      expect(gradeAssignment("quiz", 1, null)).toEqual({ status: "submitted", score: null });
      expect(gradeAssignment("matching", [], "")).toEqual({ status: "submitted", score: null });
    });

    it("returns not graded on malformed correctAnswer instead of throwing", () => {
      expect(gradeAssignment("quiz", 1, "{not json")).toEqual({ status: "submitted", score: null });
      expect(gradeAssignment("drag_drop", { a: "b" }, "not json")).toEqual({ status: "submitted", score: null });
    });
  });
});
