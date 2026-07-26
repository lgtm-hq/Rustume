import { beforeEach, describe, expect, it } from "vitest";
import {
  getStoredFolders,
  HOME_FOLDERS_STORAGE_KEY,
  MAX_FOLDER_NAME_LENGTH,
  mergeFolderNames,
  normalizeFolderName,
  setStoredFolders,
} from "../homeFolders";

describe("normalizeFolderName", () => {
  it.each([
    { input: "  Applications  ", expected: "Applications" },
    { input: "Job  Search", expected: "Job Search" },
    { input: "Job\tSearch", expected: "Job Search" },
    { input: "   ", expected: "" },
    { input: "", expected: "" },
  ])("normalizes '$input' to '$expected'", ({ input, expected }) => {
    expect(normalizeFolderName(input)).toBe(expected);
  });

  it("caps names at the maximum length so one folder stays one rail row", () => {
    const name = normalizeFolderName("x".repeat(MAX_FOLDER_NAME_LENGTH + 25));
    expect(name).toHaveLength(MAX_FOLDER_NAME_LENGTH);
  });
});

describe("mergeFolderNames", () => {
  it("unions the remembered names with the ones resumes are filed into", () => {
    expect(mergeFolderNames(["Consulting"], ["Applications"])).toEqual([
      "Applications",
      "Consulting",
    ]);
  });

  it("dedupes case-insensitively, keeping the first spelling seen", () => {
    expect(mergeFolderNames(["Applications"], ["applications", "APPLICATIONS"])).toEqual([
      "Applications",
    ]);
  });

  it("drops blank entries rather than offering an unnameable folder", () => {
    expect(mergeFolderNames(["", "   ", "Applications"])).toEqual(["Applications"]);
  });

  it("sorts for a stable rail order regardless of source order", () => {
    expect(mergeFolderNames(["Zeta", "alpha"], ["Mid"])).toEqual(["alpha", "Mid", "Zeta"]);
  });
});

describe("folder name storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips remembered folders", () => {
    setStoredFolders(["Applications", "Consulting"]);
    expect(getStoredFolders()).toEqual(["Applications", "Consulting"]);
  });

  it("reads no folders when nothing has been stored", () => {
    expect(getStoredFolders()).toEqual([]);
  });

  it("falls back to no folders when the stored value is corrupt", () => {
    localStorage.setItem(HOME_FOLDERS_STORAGE_KEY, "{not json");
    expect(getStoredFolders()).toEqual([]);
  });

  it("ignores non-string entries rather than surfacing them as folders", () => {
    localStorage.setItem(HOME_FOLDERS_STORAGE_KEY, JSON.stringify(["Applications", 7, null]));
    expect(getStoredFolders()).toEqual(["Applications"]);
  });
});
