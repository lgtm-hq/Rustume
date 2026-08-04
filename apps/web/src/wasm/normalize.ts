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

/** `value` as a plain object: `Map` entries copied over, objects untouched. */
function asPlainRecord(value: unknown): unknown {
  return value instanceof Map ? Object.fromEntries(value) : value;
}

/**
 * Convert any map-typed resume field that arrived as a JS `Map` into the
 * plain object the TypeScript types declare. Mutates and returns `resume`.
 */
export function resumeMapsToObjects(resume: ResumeData): ResumeData {
  const sections = resume.sections as unknown as Record<string, unknown> | undefined;
  if (sections) {
    sections.custom = asPlainRecord(sections.custom);
  }
  const metadata = resume.metadata as unknown as Record<string, unknown> | undefined;
  if (metadata && metadata.itemBreaks !== undefined) {
    metadata.itemBreaks = asPlainRecord(metadata.itemBreaks);
  }
  return resume;
}
