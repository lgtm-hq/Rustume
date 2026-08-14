/**
 * Shared item-presentation contract (#829) — composition helpers mirrored by
 * Typst `_common.typ` (`profile-entry-label`, `education-degree` /
 * `education-school`, `name-initials`, `clamp-level`).
 *
 * Style may differ per template; field order, label preference, and fallbacks
 * must not. See `docs/design/item-presentation.md`.
 */

import type { Picture } from "../wasm/types";

/** Highest skill/language level (Typst `clamp-level` ceiling). */
export const MAX_LEVEL = 5;

/** Clamp a skill/language level to [0, MAX_LEVEL]. */
export function clampLevel(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(MAX_LEVEL, Math.max(0, Math.round(value)));
}

/**
 * Visible profile label: username first, then network, then URL.
 * Matches Typst `profile-entry-label` mode `"auto"` / `"username"`.
 */
export function profileEntryLabel(item: {
  username?: string | null;
  network?: string | null;
  url?: { href?: string | null } | null;
}): string {
  const username = (item.username ?? "").trim();
  if (username !== "") return username;
  const network = (item.network ?? "").trim();
  if (network !== "") return network;
  return (item.url?.href ?? "").trim();
}

/** Education primary line: study type / degree only. */
export function educationDegree(item: { studyType?: string | null }): string {
  return (item.studyType ?? "").trim();
}

/**
 * Education secondary line: `institution · area` (omit empty parts).
 * Never joins with `" in "`.
 */
export function educationSchool(item: {
  institution?: string | null;
  area?: string | null;
}): string {
  const institution = (item.institution ?? "").trim();
  const area = (item.area ?? "").trim();
  if (institution !== "" && area !== "") return `${institution} · ${area}`;
  if (institution !== "") return institution;
  return area;
}

/** Initials for the avatar disc (up to two words). Matches Typst `name-initials`. */
export function nameInitials(name: string, max = 2): string {
  const parts = name
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word !== "");
  if (parts.length === 0) return "";
  return parts
    .slice(0, max)
    .map((word) => (word[0] ?? "").toUpperCase())
    .join("");
}

/** Photo is set and not hidden. Matches Typst `has-visible-picture`. */
export function pictureVisible(picture: Picture | undefined): boolean {
  return picture !== undefined && picture.url.trim() !== "" && !picture.effects.hidden;
}

/** Initials disc when there is no photo URL and the user opted in (#857).
 * A hidden photo is still "photo set" and stays collapsed.
 */
export function avatarShowsInitials(picture: Picture | undefined): boolean {
  if (picture === undefined) return false;
  return picture.url.trim() === "" && picture.effects.showInitials;
}
