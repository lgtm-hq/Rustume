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

/**
 * Classify a parsed resume JSON payload, or `null` when it matches nothing.
 *
 * RR v3 exports carry `metadata` (older samples use `meta`) beside `basics`;
 * plain `basics` without either wrapper reads as JSON Resume.
 */
export function detectResumeJsonFormat(json: Record<string, unknown>): ResumeJsonFormat | null {
  if (isNativeRustumeJson(json)) return "rustume";
  if (json.basics && (json.meta || json.metadata)) return "rrv3";
  if (json.basics) return "json-resume";
  return null;
}
