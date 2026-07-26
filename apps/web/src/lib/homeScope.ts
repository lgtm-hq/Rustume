import type { ResumeListItem } from "../stores/persistence";

/**
 * Which slice of the library is visible.
 *
 * Discriminated on `kind` so additional scopes can be added without widening an
 * existing variant. Every variant is backed by a field that already exists on
 * `ResumeListItem`.
 */
export type HomeScope =
  | { readonly kind: "all" }
  | { readonly kind: "locked" }
  | { readonly kind: "tag"; readonly tag: string };

/** The whole library — the default, and the state every other scope clears to. */
export const SCOPE_ALL: HomeScope = { kind: "all" };

/** Resumes the user has locked against edits. */
export const SCOPE_LOCKED: HomeScope = { kind: "locked" };

/** Narrow the library to a single tag. */
export function tagScope(tag: string): HomeScope {
  return { kind: "tag", tag };
}

/** Structural equality, so a control can tell whether it is the active scope. */
export function isSameScope(a: HomeScope, b: HomeScope): boolean {
  if (a.kind === "tag" || b.kind === "tag") {
    return a.kind === "tag" && b.kind === "tag" && a.tag === b.tag;
  }
  return a.kind === b.kind;
}

/** Whether a resume belongs to the given scope. */
export function matchesScope(resume: ResumeListItem, scope: HomeScope): boolean {
  switch (scope.kind) {
    case "all":
      return true;
    case "locked":
      return Boolean(resume.locked);
    case "tag":
      return (resume.tags ?? []).includes(scope.tag);
  }
}

/** Terminal-register label for the status strip's `scope:` slot. */
export function scopeLabel(scope: HomeScope): string {
  switch (scope.kind) {
    case "all":
      return "all";
    case "locked":
      return "locked";
    case "tag":
      return `#${scope.tag}`;
  }
}
