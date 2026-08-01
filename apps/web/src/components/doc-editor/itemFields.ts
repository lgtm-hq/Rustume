/**
 * The editable shape of a section's items, per section type.
 *
 * One descriptor list per section drives both the item dialog's form and the
 * labels the inline editors announce, so a field is described in exactly one
 * place. The lists mirror the item interfaces in `wasm/types.ts` and the blanks
 * `emptyItemFor()` seeds in `lib/docLayout.ts` — every writable key of an item
 * appears here except `id` and `visible`, which the editor owns rather than the
 * user.
 */

import { isCustomId } from "../../lib/docLayout";

/** How a field is edited. */
export type ItemFieldKind = "text" | "markdown" | "keywords" | "level" | "url";

/** One editable field of an item. */
export interface ItemFieldSpec {
  /** Key on the item object. */
  key: string;
  /** Human label, used by the dialog and by the inline editors. */
  label: string;
  kind: ItemFieldKind;
  placeholder?: string;
}

function text(key: string, label: string, placeholder?: string): ItemFieldSpec {
  return { key, label, kind: "text", placeholder };
}

function markdown(key: string, label: string): ItemFieldSpec {
  return { key, label, kind: "markdown" };
}

const KEYWORDS = {
  key: "keywords",
  label: "Keywords",
  kind: "keywords",
} as const satisfies ItemFieldSpec;
const LEVEL = { key: "level", label: "Level", kind: "level" } as const satisfies ItemFieldSpec;
const URL_FIELD = { key: "url", label: "Link", kind: "url" } as const satisfies ItemFieldSpec;

/** Editable fields of a custom section's items. */
export const CUSTOM_ITEM_FIELDS: readonly ItemFieldSpec[] = [
  text("name", "Name"),
  text("description", "Description"),
  text("date", "Date"),
  text("location", "Location"),
  markdown("summary", "Summary"),
  KEYWORDS,
  URL_FIELD,
];

/** Editable fields of every fixed, item-bearing section. */
export const FIXED_ITEM_FIELDS: Readonly<Record<string, readonly ItemFieldSpec[]>> = {
  experience: [
    text("company", "Company"),
    text("position", "Position"),
    text("location", "Location"),
    text("date", "Date", "March 2022 - Present"),
    markdown("summary", "Summary"),
    URL_FIELD,
  ],
  education: [
    text("institution", "Institution"),
    text("studyType", "Study type", "Bachelor's"),
    text("area", "Area of study"),
    text("date", "Date", "2016 - 2020"),
    text("score", "Score"),
    markdown("summary", "Summary"),
    URL_FIELD,
  ],
  skills: [text("name", "Name"), text("description", "Description"), LEVEL, KEYWORDS],
  projects: [
    text("name", "Name"),
    text("description", "Description"),
    text("date", "Date"),
    markdown("summary", "Summary"),
    KEYWORDS,
    URL_FIELD,
  ],
  profiles: [
    text("network", "Network", "GitHub"),
    text("username", "Username"),
    text("icon", "Icon"),
    URL_FIELD,
  ],
  awards: [
    text("title", "Title"),
    text("awarder", "Awarder"),
    text("date", "Date"),
    markdown("summary", "Summary"),
    URL_FIELD,
  ],
  certifications: [
    text("name", "Name"),
    text("issuer", "Issuer"),
    text("date", "Date"),
    markdown("summary", "Summary"),
    URL_FIELD,
  ],
  publications: [
    text("name", "Name"),
    text("publisher", "Publisher"),
    text("date", "Date"),
    markdown("summary", "Summary"),
    URL_FIELD,
  ],
  languages: [text("name", "Name"), text("description", "Description"), LEVEL],
  interests: [text("name", "Name"), KEYWORDS],
  volunteer: [
    text("organization", "Organization"),
    text("position", "Position"),
    text("location", "Location"),
    text("date", "Date"),
    markdown("summary", "Summary"),
    URL_FIELD,
  ],
  references: [
    text("name", "Name"),
    text("description", "Description"),
    markdown("summary", "Summary"),
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
  return FIXED_ITEM_FIELDS[sectionId] ?? [];
}

/** Singular noun for a section's items, used in dialog titles and buttons. */
export function itemNoun(sectionTitle: string): string {
  const lower = sectionTitle.toLowerCase();
  if (lower.endsWith("ies")) return `${lower.slice(0, -3)}y`;
  if (lower.endsWith("ses")) return lower.slice(0, -2);
  if (lower.endsWith("s")) return lower.slice(0, -1);
  return lower;
}
