/**
 * Resume JSON import-format detection (#831).
 *
 * One detection order for both import paths (WASM parse and server parse):
 * native Rustume must win before RR v3 / JSON Resume — all three can carry
 * `basics` + `metadata`.
 */

/** JSON resume formats the import modal can classify from content. */
export type ResumeJsonFormat = "rustume" | "rrv3" | "json-resume";

/** Native Rustume resume JSON has `sections.summary`; JSON Resume does not. */
export function isNativeRustumeJson(json: Record<string, unknown>): boolean {
  const sections = json.sections;
  const metadata = json.metadata;
  return (
    typeof sections === "object" &&
    sections !== null &&
    Object.prototype.hasOwnProperty.call(sections, "summary") &&
    typeof metadata === "object" &&
    metadata !== null
  );
}

/** True when `value` is a non-null, non-array object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Classify a parsed resume JSON payload, or `null` when it matches nothing.
 *
 * `JSON.parse` can return null, arrays, or primitives — those are unrecognized.
 * RR v3 exports carry `metadata` beside `basics`. JSON Resume may also have a
 * root-level `meta` object (canonical/version/lastModified); that is not RR v3.
 * Plain `basics` without `metadata` reads as JSON Resume.
 */
export function detectResumeJsonFormat(json: unknown): ResumeJsonFormat | null {
  if (!isRecord(json)) return null;
  if (isNativeRustumeJson(json)) return "rustume";
  if (json.basics && json.metadata) return "rrv3";
  if (json.basics) return "json-resume";
  return null;
}
