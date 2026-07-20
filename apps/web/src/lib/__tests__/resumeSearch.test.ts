import { describe, expect, it } from "vitest";
import type { ResumeListItem } from "../../stores/persistence";
import { filterResumes } from "../resumeSearch";

const sampleResumes: ResumeListItem[] = [
  { id: "1", name: "Software Engineer", updatedAt: new Date("2025-01-01") },
  { id: "2", name: "Product Manager", updatedAt: new Date("2025-02-01") },
  { id: "3", name: "Jane Doe — Designer", updatedAt: new Date("2025-03-01") },
];

describe("filterResumes", () => {
  it("returns all resumes when the query is empty", () => {
    const results = filterResumes(sampleResumes, "");
    expect(results).toHaveLength(3);
    expect(results.map((item) => item.resume.name)).toEqual([
      "Software Engineer",
      "Product Manager",
      "Jane Doe — Designer",
    ]);
  });

  it("fuzzy-matches resume titles", () => {
    const results = filterResumes(sampleResumes, "enginer");
    expect(results).toHaveLength(1);
    expect(results[0].resume.name).toBe("Software Engineer");
  });

  it("matches by person name in the title", () => {
    const results = filterResumes(sampleResumes, "jane");
    expect(results).toHaveLength(1);
    expect(results[0].resume.name).toBe("Jane Doe — Designer");
  });

  it("returns no results when nothing matches", () => {
    expect(filterResumes(sampleResumes, "zzzznotfound")).toHaveLength(0);
  });

  it("marks matched substrings for highlighting", () => {
    const results = filterResumes(sampleResumes, "product");
    expect(results[0].nameSegments).toEqual([
      { text: "Product", highlighted: true },
      { text: " Manager", highlighted: false },
    ]);
  });
});
