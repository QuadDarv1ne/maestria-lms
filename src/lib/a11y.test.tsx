import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SkipLink } from "@/components/SkipLink";
import { useAppStore } from "@/lib/store";

describe("Accessibility", () => {
  describe("SkipLink", () => {
    beforeEach(() => {
      useAppStore.setState({ locale: "ru" });
    });

    afterEach(() => {
      cleanup();
    });

    it("renders a link that targets the main content anchor", () => {
      render(<SkipLink />);
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "#main-content");
      expect(link.textContent).toBe("Перейти к основному содержимому");
    });

    it("renders the translated label for the english locale", () => {
      useAppStore.setState({ locale: "en" });
      render(<SkipLink />);
      expect(screen.getByRole("link")).toHaveTextContent("Skip to main content");
    });

    it("is hidden off-screen until focused", () => {
      render(<SkipLink />);
      const link = screen.getByRole("link");
      expect(link.className).toContain("-top-20");
      expect(link.className).toContain("focus-visible:top-4");
    });
  });

  describe("ErrorBoundary", () => {
    it("implements componentDidCatch for error recovery", async () => {
      const { ErrorBoundary } = await import("@/components/ErrorBoundary");
      expect(ErrorBoundary).toBeDefined();
      expect(typeof ErrorBoundary.prototype.componentDidCatch).toBe("function");
    });
  });
});
