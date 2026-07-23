import { describe, expect, it } from "vitest";
import type { ResumeListItem } from "../../stores/persistence";
import { createResumeSearchIndex, filterResumes } from "../resumeSearch";

const sampleResumes: ResumeListItem[] = [
  { id: "1", name: "Software Engineer", updatedAt: new Date("2025-01-01") },
  { id: "2", name: "Product Manager", updatedAt: new Date("2025-02-01") },
  { id: "3", name: "Jane Doe — Designer", updatedAt: new Date("2025-03-01") },
];

function search(resumes: ResumeListItem[], query: string) {
  return filterResumes(createResumeSearchIndex(resumes), query);
}

describe("filterResumes", () => {
  it("returns all resumes when the query is empty", () => {
    const results = search(sampleResumes, "");
    expect(results).toHaveLength(3);
    expect(results.map((item) => item.resume.name)).toEqual([
      "Software Engineer",
      "Product Manager",
      "Jane Doe — Designer",
    ]);
  });

  it("fuzzy-matches resume titles", () => {
    const results = search(sampleResumes, "enginer");
    expect(results).toHaveLength(1);
    expect(results[0].resume.name).toBe("Software Engineer");
  });

  it("matches by person name in the title", () => {
    const results = search(sampleResumes, "jane");
    expect(results).toHaveLength(1);
    expect(results[0].resume.name).toBe("Jane Doe — Designer");
  });

  it("returns no results when nothing matches", () => {
    expect(search(sampleResumes, "zzzznotfound")).toHaveLength(0);
  });

  it("marks matched substrings for highlighting", () => {
    const results = search(sampleResumes, "product");
    expect(results[0].nameSegments).toEqual([
      { text: "Product", highlighted: true },
      { text: " Manager", highlighted: false },
    ]);
  });

  it("matches on basics.name metadata without highlighting the title", () => {
    const resumes: ResumeListItem[] = [
      {
        id: "1",
        name: "Backend CV",
        basicsName: "Maria Silva",
        updatedAt: new Date("2025-01-01"),
      },
      { id: "2", name: "Frontend CV", updatedAt: new Date("2025-02-01") },
    ];
    const results = search(resumes, "maria");
    expect(results).toHaveLength(1);
    expect(results[0].resume.name).toBe("Backend CV");
    // Highlighting stays on the displayed name only — no marks here
    expect(results[0].nameSegments).toEqual([{ text: "Backend CV", highlighted: false }]);
  });

  it("matches on headline metadata", () => {
    const resumes: ResumeListItem[] = [
      {
        id: "1",
        name: "My Resume",
        headline: "Staff Platform Engineer",
        updatedAt: new Date("2025-01-01"),
      },
      { id: "2", name: "Other Resume", updatedAt: new Date("2025-02-01") },
    ];
    const results = search(resumes, "platform");
    expect(results).toHaveLength(1);
    expect(results[0].resume.name).toBe("My Resume");
  });

  it("ignores diacritics so 'jose' matches 'José'", () => {
    const resumes: ResumeListItem[] = [
      { id: "1", name: "José García", updatedAt: new Date("2025-01-01") },
      { id: "2", name: "Product Manager", updatedAt: new Date("2025-02-01") },
    ];
    const results = search(resumes, "jose");
    expect(results).toHaveLength(1);
    expect(results[0].resume.name).toBe("José García");
  });

  it("does not highlight single-character matches", () => {
    const results = search(sampleResumes, "e");
    for (const item of results) {
      const highlighted = item.nameSegments.filter((segment) => segment.highlighted);
      for (const segment of highlighted) {
        expect(segment.text.length).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
