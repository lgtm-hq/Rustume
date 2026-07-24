import { describe, expect, it } from "vitest";
import { sortResumes, type ResumeSortMode } from "../resumeSort";
import type { ResumeListItem } from "../../stores/persistence";

function item(id: string, name: string, updatedAt: string, createdAt?: string): ResumeListItem {
  return {
    id,
    name,
    updatedAt: new Date(updatedAt),
    createdAt: new Date(createdAt ?? updatedAt),
  };
}

describe("sortResumes", () => {
  const items = [
    item("1", "Charlie", "2026-01-03T00:00:00Z", "2026-01-01T00:00:00Z"),
    item("2", "alpha", "2026-01-02T00:00:00Z", "2026-01-02T00:00:00Z"),
    item("3", "Bravo", "2026-01-01T00:00:00Z", "2026-01-03T00:00:00Z"),
  ];

  it.each<[ResumeSortMode, string[]]>([
    ["updated", ["1", "2", "3"]],
    ["created", ["3", "2", "1"]],
    ["name-asc", ["2", "3", "1"]],
    ["name-desc", ["1", "3", "2"]],
  ])("sorts by %s", (mode, expectedIds) => {
    expect(sortResumes(items, mode).map((r) => r.id)).toEqual(expectedIds);
  });
});
