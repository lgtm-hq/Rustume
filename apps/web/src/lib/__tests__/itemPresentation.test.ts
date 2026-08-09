import { describe, expect, it } from "vitest";
import {
  MAX_LEVEL,
  clampLevel,
  educationDegree,
  educationSchool,
  nameInitials,
  profileEntryLabel,
} from "../itemPresentation";

describe("itemPresentation contract (#829)", () => {
  it("prefers username over network for profile labels", () => {
    expect(
      profileEntryLabel({
        username: "TurboCoder13",
        network: "GitHub",
        url: { href: "https://github.com/TurboCoder13" },
      }),
    ).toBe("TurboCoder13");
    expect(profileEntryLabel({ username: "", network: "GitHub" })).toBe("GitHub");
    expect(profileEntryLabel({ username: "", network: "", url: { href: "https://x.test" } })).toBe(
      "https://x.test",
    );
  });

  it("composes education degree-first with institution · area", () => {
    expect(educationDegree({ studyType: "Diploma" })).toBe("Diploma");
    expect(
      educationSchool({
        institution: "Cape Town, South Africa",
        area: "Software Development",
      }),
    ).toBe("Cape Town, South Africa · Software Development");
    expect(educationSchool({ institution: "MIT", area: "" })).toBe("MIT");
    expect(educationSchool({ institution: "", area: "CS" })).toBe("CS");
    const joined = [
      educationDegree({ studyType: "Diploma" }),
      educationSchool({
        institution: "Cape Town, South Africa",
        area: "Software Development",
      }),
    ].join(" ");
    expect(joined).not.toMatch(/\bin\b/);
  });

  it("clamps levels to 0–5", () => {
    expect(MAX_LEVEL).toBe(5);
    expect(clampLevel(-1)).toBe(0);
    expect(clampLevel(3.6)).toBe(4);
    expect(clampLevel(99)).toBe(5);
  });

  it("builds up to two initials for the avatar disc", () => {
    expect(nameInitials("John Doe")).toBe("JD");
    expect(nameInitials("Alice Bob Charlie")).toBe("AB");
    expect(nameInitials("")).toBe("");
  });
});
