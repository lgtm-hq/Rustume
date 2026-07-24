import type { PreviewResult } from "../../api/render";

export type RenderPreviewPage = (page: number) => Promise<PreviewResult>;

export function isMissingPageError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /page \d+ not found/i.test(err.message);
}

export interface PrefetchPrintStackOptions {
  pageCount: number;
  currentPage: number;
  currentUrl: string;
  renderPage: RenderPreviewPage;
  shouldCancel?: () => boolean;
}

export interface PrefetchPrintStackResult {
  /** Contiguous page URLs from 0..length-1 (may be shorter than pageCount). */
  urls: string[];
  /** True when at least one non-missing-page render failed. */
  hasHardFailure: boolean;
  /** Updated page count when a missing-page error or smaller X-Total-Pages was observed. */
  reconciledPageCount?: number;
}

/**
 * Prefetch preview PNGs for browser print, sequentially, preserving page order.
 * Stops early on out-of-range pages so a stale totalPages after a template switch
 * does not surface as a hard error toast.
 */
export async function prefetchPrintStackPages(
  options: PrefetchPrintStackOptions,
): Promise<PrefetchPrintStackResult> {
  const { pageCount, currentPage, currentUrl, renderPage, shouldCancel } = options;
  const urls: Array<string | undefined> = Array.from({ length: pageCount });
  let hasHardFailure = false;
  let reconciledPageCount: number | undefined;

  for (let page = 0; page < pageCount; page++) {
    if (shouldCancel?.()) {
      break;
    }

    if (page === currentPage) {
      urls[page] = currentUrl;
      continue;
    }

    try {
      const result = await renderPage(page);
      urls[page] = result.url;

      if (shouldCancel?.()) {
        break;
      }

      if (result.totalPages < pageCount) {
        reconciledPageCount = result.totalPages;
        break;
      }
    } catch (err: unknown) {
      if (isMissingPageError(err)) {
        reconciledPageCount = page;
        break;
      }
      hasHardFailure = true;
    }
  }

  const effectiveCount = reconciledPageCount ?? pageCount;
  const compact: string[] = [];
  for (let page = 0; page < effectiveCount; page++) {
    const url = urls[page];
    if (!url) {
      break;
    }
    compact.push(url);
  }

  return { urls: compact, hasHardFailure, reconciledPageCount };
}
