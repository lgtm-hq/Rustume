/**
 * Resume section primitives shared by the store and the pure layout model.
 *
 * These live outside `stores/resume` so that store-agnostic modules can use
 * them without pulling in the Solid store, the wasm bindings, or the UI
 * toaster that the store module constructs at import time.
 */

import type { Sections } from "../wasm/types";

/**
 * The item-bearing fixed sections, in canonical layout order.
 *
 * Excludes `summary` and `coverLetter` (rich text rather than items) and
 * `custom` (keyed by the resume's own ids).
 */
export const FIXED_LAYOUT_SECTION_KEYS: (keyof Omit<
  Sections,
  "summary" | "custom" | "coverLetter"
>)[] = [
  "experience",
  "education",
  "skills",
  "projects",
  "profiles",
  "awards",
  "certifications",
  "publications",
  "languages",
  "interests",
  "volunteer",
  "references",
];

/** Check if an HTML string is effectively empty (plain empty or TipTap empty editor). */
export function isHtmlEmpty(html: string): boolean {
  const trimmed = html.trim();
  if (trimmed === "") return true;
  // Normalize common HTML whitespace entities to regular spaces.
  const normalized = trimmed.replace(/&nbsp;|&#160;|&#xa0;|&ensp;|&#8194;|&emsp;|&#8195;/gi, " ");
  // Strip all HTML tags and check if any visible text remains.
  const textContent = normalized.replace(/<[^>]*>/g, "").trim();
  return textContent === "";
}
