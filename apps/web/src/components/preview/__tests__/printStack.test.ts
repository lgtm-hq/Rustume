import { describe, expect, it, vi } from "vitest";
import { isMissingPageError, prefetchPrintStackPages, type RenderPreviewPage } from "../printStack";

describe("isMissingPageError", () => {
  it("detects Typst missing-page errors", () => {
    expect(isMissingPageError(new Error("Failed to render preview: Page 3 not found"))).toBe(true);
  });

  it("ignores unrelated errors", () => {
    expect(isMissingPageError(new Error("rate limited"))).toBe(false);
    expect(isMissingPageError("Page 3 not found")).toBe(false);
  });
});

describe("prefetchPrintStackPages", () => {
  it("fetches pages sequentially and preserves order", async () => {
    const calls: number[] = [];
    const renderPage: RenderPreviewPage = async (page) => {
      calls.push(page);
      return { url: `blob:page-${page}`, totalPages: 3 };
    };

    const result = await prefetchPrintStackPages({
      pageCount: 3,
      currentPage: 0,
      currentUrl: "blob:current",
      renderPage,
    });

    expect(calls).toEqual([1, 2]);
    expect(result.urls).toEqual(["blob:current", "blob:page-1", "blob:page-2"]);
    expect(result.hasHardFailure).toBe(false);
    expect(result.reconciledPageCount).toBeUndefined();
  });

  it("stops on missing-page errors without hard failure", async () => {
    const renderPage: RenderPreviewPage = async (page) => {
      if (page >= 2) {
        throw new Error("Failed to render preview: Page 2 not found");
      }
      return { url: `blob:page-${page}`, totalPages: 4 };
    };

    const result = await prefetchPrintStackPages({
      pageCount: 4,
      currentPage: 0,
      currentUrl: "blob:current",
      renderPage,
    });

    expect(result.urls).toEqual(["blob:current", "blob:page-1"]);
    expect(result.hasHardFailure).toBe(false);
    expect(result.reconciledPageCount).toBe(2);
  });

  it("reconciles when a later page reports a smaller totalPages", async () => {
    const renderPage: RenderPreviewPage = async (page) => {
      return { url: `blob:page-${page}`, totalPages: page === 1 ? 2 : 4 };
    };

    const result = await prefetchPrintStackPages({
      pageCount: 4,
      currentPage: 0,
      currentUrl: "blob:current",
      renderPage,
    });

    expect(result.urls).toEqual(["blob:current", "blob:page-1"]);
    expect(result.reconciledPageCount).toBe(2);
    expect(result.hasHardFailure).toBe(false);
  });

  it("records hard failures but keeps successful prefix", async () => {
    const renderPage: RenderPreviewPage = async (page) => {
      if (page === 1) {
        throw new Error("boom");
      }
      return { url: `blob:page-${page}`, totalPages: 3 };
    };

    const result = await prefetchPrintStackPages({
      pageCount: 3,
      currentPage: 0,
      currentUrl: "blob:current",
      renderPage,
    });

    expect(result.urls).toEqual(["blob:current"]);
    expect(result.hasHardFailure).toBe(true);
  });

  it("honors cancellation between pages", async () => {
    let cancel = false;
    const renderPage: RenderPreviewPage = vi.fn(async (page) => {
      if (page === 1) {
        cancel = true;
      }
      return { url: `blob:page-${page}`, totalPages: 3 };
    });

    const result = await prefetchPrintStackPages({
      pageCount: 3,
      currentPage: 0,
      currentUrl: "blob:current",
      renderPage,
      shouldCancel: () => cancel,
    });

    expect(renderPage).toHaveBeenCalledTimes(1);
    expect(result.urls).toEqual(["blob:current", "blob:page-1"]);
  });
});
