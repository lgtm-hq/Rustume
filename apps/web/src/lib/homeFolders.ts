/**
 * The set of folders offered in the scope rail.
 *
 * Folder *assignment* lives on the resume itself (`metadata.folder`), so it
 * travels with the resume through both the local and the cloud save path. That
 * alone cannot represent a folder nobody has filed anything into yet, so the
 * names are additionally remembered here: without it, `+ New folder` would
 * create something that vanishes on the next render.
 *
 * The two sources are unioned on read, which keeps assignments authoritative —
 * a folder arriving from another device still appears even though this device
 * never stored its name.
 */
export const HOME_FOLDERS_STORAGE_KEY = "rustume:home-folders";

/** Long enough for a real label, short enough to stay one rail row. */
export const MAX_FOLDER_NAME_LENGTH = 60;

/**
 * Canonical form of a user-typed folder name.
 *
 * Interior runs of whitespace collapse so "Job  Search" and "Job Search" are
 * one folder rather than two that look identical in the rail.
 */
export function normalizeFolderName(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_FOLDER_NAME_LENGTH);
}

/** Read the remembered folder names. Unusable storage reads as "none". */
export function getStoredFolders(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HOME_FOLDERS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    // Corrupt or unavailable storage (private browsing, tests) — fall back to
    // the folders derivable from assignments rather than throwing on mount.
    return [];
  }
}

export function setStoredFolders(folders: readonly string[]): void {
  try {
    localStorage.setItem(HOME_FOLDERS_STORAGE_KEY, JSON.stringify([...folders]));
  } catch {
    // localStorage may be unavailable in private browsing or tests
  }
}

/**
 * Union folder names into one display order.
 *
 * Dedupes case-insensitively so "Applications" and "applications" collapse to
 * the first spelling seen rather than presenting the user two rows they cannot
 * tell apart. Sorted case-insensitively for the same reason.
 */
export function mergeFolderNames(...sources: readonly (readonly string[])[]): string[] {
  const seen = new Map<string, string>();
  for (const source of sources) {
    for (const entry of source) {
      const name = normalizeFolderName(entry);
      if (!name) continue;
      const key = name.toLocaleLowerCase();
      if (!seen.has(key)) seen.set(key, name);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}
