/**
 * The editable shape of a section's items, per section type.
 *
 * One descriptor list per section drives both the item dialog's form and the
 * labels the inline editors announce, so a field is described in exactly one
 * place. The lists mirror the item interfaces in `wasm/types.ts` and the blanks
 * `emptyItemFor()` seeds in `lib/docLayout.ts` — every writable key of an item
 * appears here except `id` and `visible`, which the editor owns rather than the
 * user.
 *
 * Field order follows spec §1.13's per-type modal layouts; `half` pairs two
 * consecutive fields into one two-column row (the spec's `.field-row`). Where
 * the spec's prototype fields and the typed schema diverge, the schema wins
 * (§4.2: keep the typed items) — so awards keep title/awarder, tags exist only
 * where the schema carries `keywords`, and custom fields only where it carries
 * `customFields`.
 */

import { isCustomId } from "../../lib/docLayout";
import { FIXED_LAYOUT_SECTION_KEYS } from "../../lib/resumeSections";

/** The fixed sections that carry items, and therefore need descriptors. */
type FixedItemSectionKey = (typeof FIXED_LAYOUT_SECTION_KEYS)[number];

/**
 * How a field is edited: plain text, a markdown mini editor, the tag-chip
 * box, the proficiency picker, a label/href pair, or custom-field rows.
 */
export type ItemFieldKind = "text" | "markdown" | "keywords" | "level" | "url" | "extraFields";

/** One editable field of an item. */
export interface ItemFieldSpec {
  /** Key on the item object. */
  key: string;
  /** Human label, used by the dialog and by the inline editors. */
  label: string;
  kind: ItemFieldKind;
  placeholder?: string;
  /** Hint line drawn under the field. */
  hint?: string;
  /** Paired with the adjacent `half` field into one two-column row. */
  half?: boolean;
}

function text(key: string, label: string, placeholder?: string): ItemFieldSpec {
  return { key, label, kind: "text", placeholder };
}

function half(key: string, label: string, placeholder?: string): ItemFieldSpec {
  return { key, label, kind: "text", placeholder, half: true };
}

function markdown(key: string, label: string, hint?: string): ItemFieldSpec {
  return { key, label, kind: "markdown", hint };
}

/** The rich-editor hint of spec §1.13's experience modal, shared by all. */
const RICH_HINT = "Use the toolbar for bold, lists, and links.";

const TAGS = { key: "keywords", label: "Tags", kind: "keywords" } as const satisfies ItemFieldSpec;
const LEVEL = {
  key: "level",
  label: "Proficiency",
  kind: "level",
} as const satisfies ItemFieldSpec;
const URL_FIELD = { key: "url", label: "Link", kind: "url" } as const satisfies ItemFieldSpec;
const EXTRA_FIELDS = {
  key: "customFields",
  label: "Custom fields",
  kind: "extraFields",
} as const satisfies ItemFieldSpec;

/** Editable fields of a custom section's items. */
export const CUSTOM_ITEM_FIELDS: readonly ItemFieldSpec[] = [
  text("name", "Name"),
  text("description", "Description"),
  half("date", "Date"),
  half("location", "Location"),
  markdown("summary", "Summary", RICH_HINT),
  TAGS,
  URL_FIELD,
];

/**
 * Editable fields of every fixed, item-bearing section.
 *
 * Keyed by the section union rather than `string` so a new fixed section, or a
 * misspelled key, fails to compile instead of silently drawing an empty dialog.
 */
export const FIXED_ITEM_FIELDS: Readonly<Record<FixedItemSectionKey, readonly ItemFieldSpec[]>> = {
  experience: [
    text("position", "Position"),
    half("company", "Company"),
    half("location", "Location"),
    text("date", "Date", "March 2022 - Present"),
    markdown("summary", "Highlights", RICH_HINT),
    TAGS,
    EXTRA_FIELDS,
    URL_FIELD,
  ],
  education: [
    text("institution", "Institution"),
    half("studyType", "Degree", "Bachelor's"),
    half("area", "Area of study"),
    half("date", "Date", "2016 - 2020"),
    half("score", "Score"),
    markdown("summary", "Summary", RICH_HINT),
    TAGS,
    EXTRA_FIELDS,
    URL_FIELD,
  ],
  skills: [text("name", "Name"), text("description", "Description"), LEVEL, TAGS, EXTRA_FIELDS],
  projects: [
    text("name", "Name"),
    text("description", "Description"),
    text("date", "Date"),
    markdown("summary", "Highlights", RICH_HINT),
    TAGS,
    EXTRA_FIELDS,
    URL_FIELD,
  ],
  profiles: [
    half("network", "Network", "GitHub"),
    half("username", "Username"),
    text("icon", "Icon"),
    URL_FIELD,
  ],
  awards: [
    text("title", "Title"),
    text("awarder", "Awarder"),
    text("date", "Date"),
    markdown("summary", "Summary", RICH_HINT),
    URL_FIELD,
  ],
  certifications: [
    text("name", "Name"),
    text("issuer", "Issuer"),
    text("date", "Date"),
    markdown("summary", "Summary", RICH_HINT),
    URL_FIELD,
  ],
  publications: [
    text("name", "Name"),
    text("publisher", "Publisher"),
    text("date", "Date"),
    markdown("summary", "Summary", RICH_HINT),
    URL_FIELD,
  ],
  languages: [text("name", "Name"), text("description", "Description"), LEVEL],
  interests: [text("name", "Name"), TAGS],
  volunteer: [
    text("organization", "Organization"),
    half("position", "Position"),
    half("location", "Location"),
    text("date", "Date"),
    markdown("summary", "Summary", RICH_HINT),
    URL_FIELD,
  ],
  references: [
    text("name", "Name"),
    text("description", "Description"),
    markdown("summary", "Summary", RICH_HINT),
    URL_FIELD,
  ],
};

/**
 * Editable fields for `sectionId`.
 *
 * Any id that is not a fixed section is a custom section id — the same rule
 * `isCustomId()` applies — and carries the custom item shape.
 */
export function itemFieldsFor(sectionId: string): readonly ItemFieldSpec[] {
  if (isCustomId(sectionId)) return CUSTOM_ITEM_FIELDS;
  return FIXED_ITEM_FIELDS[sectionId as FixedItemSectionKey] ?? [];
}

/** Singular noun for a section's items, used by row chrome and add blocks. */
export function itemNoun(sectionTitle: string): string {
  const lower = sectionTitle.toLowerCase();
  if (lower.endsWith("ies")) return `${lower.slice(0, -3)}y`;
  if (lower.endsWith("ses")) return lower.slice(0, -2);
  if (lower.endsWith("s")) return lower.slice(0, -1);
  return lower;
}
