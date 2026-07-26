import { describe, expect, it } from "vitest";
import {
  folderScope,
  isSameScope,
  matchesScope,
  scopeLabel,
  SCOPE_ALL,
  SCOPE_LOCKED,
  tagScope,
} from "../homeScope";
import type { ResumeListItem } from "../../stores/persistence";

function resume(overrides: Partial<ResumeListItem> = {}): ResumeListItem {
  return {
    id: "1",
    name: "Software Engineer",
    updatedAt: new Date("2025-01-01"),
    ...overrides,
  };
}

describe("homeScope membership", () => {
  it("keeps every resume in the all scope", () => {
    expect(matchesScope(resume(), SCOPE_ALL)).toBe(true);
    expect(matchesScope(resume({ locked: true }), SCOPE_ALL)).toBe(true);
  });

  it("keeps only locked resumes in the locked scope", () => {
    expect(matchesScope(resume({ locked: true }), SCOPE_LOCKED)).toBe(true);
    expect(matchesScope(resume({ locked: false }), SCOPE_LOCKED)).toBe(false);
    expect(matchesScope(resume(), SCOPE_LOCKED)).toBe(false);
  });

  it("keeps only tagged resumes in a tag scope", () => {
    expect(matchesScope(resume({ tags: ["backend"] }), tagScope("backend"))).toBe(true);
    expect(matchesScope(resume({ tags: ["design"] }), tagScope("backend"))).toBe(false);
    expect(matchesScope(resume(), tagScope("backend"))).toBe(false);
  });

  it("keeps only resumes filed in a folder in that folder scope", () => {
    expect(matchesScope(resume({ folder: "Applications" }), folderScope("Applications"))).toBe(
      true,
    );
    expect(matchesScope(resume({ folder: "Consulting" }), folderScope("Applications"))).toBe(false);
    // Unfiled resumes belong to no folder scope, only to All.
    expect(matchesScope(resume(), folderScope("Applications"))).toBe(false);
    expect(matchesScope(resume(), SCOPE_ALL)).toBe(true);
  });

  it("treats folders as mutually exclusive rather than tag-shaped", () => {
    const filed = resume({ folder: "Applications", tags: ["backend", "design"] });
    // A resume carries many tags but exactly one folder.
    expect(matchesScope(filed, tagScope("backend"))).toBe(true);
    expect(matchesScope(filed, tagScope("design"))).toBe(true);
    expect(matchesScope(filed, folderScope("Applications"))).toBe(true);
    expect(matchesScope(filed, folderScope("Consulting"))).toBe(false);
  });
});

describe("homeScope identity", () => {
  it.each([
    { a: SCOPE_ALL, b: SCOPE_ALL, expected: true },
    { a: SCOPE_LOCKED, b: SCOPE_LOCKED, expected: true },
    { a: SCOPE_ALL, b: SCOPE_LOCKED, expected: false },
    { a: tagScope("backend"), b: tagScope("backend"), expected: true },
    { a: tagScope("backend"), b: tagScope("design"), expected: false },
    { a: tagScope("backend"), b: SCOPE_ALL, expected: false },
    { a: folderScope("Applications"), b: folderScope("Applications"), expected: true },
    { a: folderScope("Applications"), b: folderScope("Consulting"), expected: false },
    { a: folderScope("Applications"), b: SCOPE_ALL, expected: false },
    // A folder and a tag of the same name are different scopes.
    { a: folderScope("backend"), b: tagScope("backend"), expected: false },
  ])("compares $a.kind with $b.kind as $expected", ({ a, b, expected }) => {
    expect(isSameScope(a, b)).toBe(expected);
  });
});

describe("homeScope labels", () => {
  it.each([
    { scope: SCOPE_ALL, expected: "all" },
    { scope: SCOPE_LOCKED, expected: "locked" },
    { scope: tagScope("backend"), expected: "#backend" },
    { scope: folderScope("Applications"), expected: "/Applications" },
  ])("labels $scope.kind as $expected", ({ scope, expected }) => {
    expect(scopeLabel(scope)).toBe(expected);
  });
});
