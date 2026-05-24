import { describe, it, expect } from "vitest";
import { sanitizeContent } from "@/lib/sanitize";

describe("sanitizeContent", () => {
  describe("XSS prevention", () => {
    it("should remove script tags", () => {
      const input = '<p>Hello</p><script>alert("xss")</script>';
      const result = sanitizeContent(input);
      expect(result).toContain("<p>Hello</p>");
      expect(result).not.toContain("<script>");
    });

    it("should remove event handlers", () => {
      const input = '<img src="test.jpg" onerror="alert(1)">';
      const result = sanitizeContent(input);
      expect(result).toContain('src="test.jpg"');
      expect(result).not.toContain("onerror");
    });

    it("should remove javascript: URLs", () => {
      const input = '<a href="javascript:alert(1)">Click</a>';
      const result = sanitizeContent(input);
      expect(result).not.toContain("javascript:");
    });

    it("should remove iframe with javascript src", () => {
      const input = '<iframe src="javascript:alert(1)"></iframe>';
      const result = sanitizeContent(input);
      expect(result).not.toContain("javascript:");
    });

    it("should remove SVG-based XSS", () => {
      const input = '<svg onload="alert(1)"><rect width="100" height="100"/></svg>';
      const result = sanitizeContent(input);
      expect(result).not.toContain("onload");
      expect(result).not.toContain("<svg>");
    });
  });

  describe("allowed content", () => {
    it("should allow safe HTML tags", () => {
      const input = "<h1>Title</h1><p>Paragraph</p><strong>Bold</strong>";
      const result = sanitizeContent(input);
      expect(result).toBe(input);
    });

    it("should allow links with href", () => {
      const input = '<a href="https://example.com" target="_blank">Link</a>';
      const result = sanitizeContent(input);
      expect(result).toContain('href="https://example.com"');
      expect(result).toContain("Link");
    });

    it("should allow images with alt", () => {
      const input = '<img src="test.jpg" alt="Test image">';
      const result = sanitizeContent(input);
      expect(result).toContain('src="test.jpg"');
      expect(result).toContain('alt="Test image"');
    });

    it("should allow tables", () => {
      const input = "<table><tr><th>Header</th></tr><tr><td>Cell</td></tr></table>";
      const result = sanitizeContent(input);
      expect(result).toContain("<table>");
      expect(result).toContain("<th>Header</th>");
      expect(result).toContain("<td>Cell</td>");
    });

    it("should allow aria attributes", () => {
      const input = '<div aria-label="test" role="button">Content</div>';
      const result = sanitizeContent(input);
      expect(result).toContain('aria-label="test"');
      expect(result).toContain('role="button"');
    });

    it("should allow data attributes", () => {
      const input = '<div data-testid="my-test" data-id="123">Content</div>';
      const result = sanitizeContent(input);
      expect(result).toContain('data-testid="my-test"');
      expect(result).toContain('data-id="123"');
    });
  });

  describe("custom options", () => {
    it("should allow custom tag restrictions", () => {
      const input = "<h1>Title</h1><p>Paragraph</p>";
      const result = sanitizeContent(input, { allowedTags: ["p"] });
      expect(result).toContain("<p>Paragraph</p>");
      expect(result).not.toContain("<h1>");
    });

    it("should allow custom attribute restrictions", () => {
      const input = '<a href="https://example.com" title="Test">Link</a>';
      const result = sanitizeContent(input, {
        allowedAttributes: { a: ["href"] },
      });
      expect(result).toContain('href="https://example.com"');
      expect(result).not.toContain("title");
    });
  });

  describe("edge cases", () => {
    it("should handle empty input", () => {
      expect(sanitizeContent("")).toBe("");
    });

    it("should handle plain text", () => {
      const input = "Just plain text with no HTML";
      expect(sanitizeContent(input)).toBe(input);
    });

    it("should handle nested malicious tags", () => {
      const input = "<p>Text<script>alert(1)</script>more</p>";
      const result = sanitizeContent(input);
      expect(result).toContain("<p>Text");
      expect(result).toContain("more</p>");
      expect(result).not.toContain("<script>");
    });

    it("should handle encoded XSS payloads", () => {
      const input = '<img src="x" onerror="&#97;&#108;&#101;&#114;&#116;(1)">';
      const result = sanitizeContent(input);
      expect(result).not.toContain("onerror");
    });
  });
});
