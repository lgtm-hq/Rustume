/**
 * Defence against JS `Map`s leaking out of the wasm boundary.
 *
 * `serde_wasm_bindgen` serialized Rust `HashMap` fields as JS `Map`
 * instances until the bindings switched to maps-as-objects. A `Map` is
 * invisible to the app's plain-object data model: `Object.keys` sees no
 * entries, property writes land as expandos beside the real entries, and a
 * `JSON.parse(JSON.stringify(...))` clone turns it into `{}` — which is how
 * custom sections were silently wiped on the first autosave after a reload.
 *
 * The Rust fix stops new `Map`s at the source; this normalizer catches
 * everything else — resumes already sitting in IndexedDB snapshots saved by
 * affected builds (`structuredClone` preserves `Map`s), or any future
 * boundary that slips through. It must run **before** any JSON clone.
 *
 * The schema has exactly two map-typed fields: `sections.custom`
 * (`HashMap<String, Section<CustomItem>>`) and `metadata.itemBreaks`
 * (`HashMap<String, Vec<String>>`). Keep this list in step with
 * `crates/schema`.
 */

import type { ResumeData } from "./types";

/**
 * Convert any map-typed resume field that arrived as a JS `Map` into the
 * plain object the TypeScript types declare.
 *
 * Non-mutating: when nothing needs converting the input is returned as-is;
 * otherwise a shallow copy of `resume` (and of the affected `sections` /
 * `metadata`) carries the converted field, so frozen or shared inputs are
 * never written to. Callers must use the return value.
 */
export function resumeMapsToObjects(resume: ResumeData): ResumeData {
  const tree = resume as unknown as Record<string, unknown>;
  const sections = tree.sections as Record<string, unknown> | undefined;
  const metadata = tree.metadata as Record<string, unknown> | undefined;
  const customIsMap = sections !== undefined && sections.custom instanceof Map;
  const breaksAreMap = metadata !== undefined && metadata.itemBreaks instanceof Map;
  if (!customIsMap && !breaksAreMap) {
    return resume;
  }

  const next: Record<string, unknown> = { ...tree };
  if (customIsMap) {
    next.sections = {
      ...sections,
      custom: Object.fromEntries(sections.custom as Map<string, unknown>),
    };
  }
  if (breaksAreMap) {
    next.metadata = {
      ...metadata,
      itemBreaks: Object.fromEntries(metadata.itemBreaks as Map<string, unknown>),
    };
  }
  return next as unknown as ResumeData;
}
