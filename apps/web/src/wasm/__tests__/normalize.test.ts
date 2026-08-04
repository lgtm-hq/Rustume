import { describe, expect, it } from "vitest";
import { resumeMapsToObjects } from "../normalize";
import type { ResumeData, Section, CustomItem } from "../types";

/** A minimal resume shell carrying whatever `sections`/`metadata` the test needs. */
function shell(sections: unknown, metadata: unknown): ResumeData {
  return { basics: {}, sections, metadata } as unknown as ResumeData;
}

function customSection(name: string): Section<CustomItem> {
  return {
    id: "c1",
    name,
    columns: 1,
    separateLinks: false,
    visible: true,
    items: [],
  } as unknown as Section<CustomItem>;
}

describe("resumeMapsToObjects", () => {
  it("converts a Map-shaped sections.custom into a plain object, losslessly", () => {
    const section = customSection("Speaking");
    const resume = shell({ custom: new Map([["speaking", section]]) }, {});

    const result = resumeMapsToObjects(resume);

    expect(result.sections.custom).not.toBeInstanceOf(Map);
    expect(Object.keys(result.sections.custom)).toEqual(["speaking"]);
    expect(result.sections.custom.speaking).toBe(section);
  });

  it("converts a Map-shaped metadata.itemBreaks", () => {
    const resume = shell({ custom: {} }, { itemBreaks: new Map([["experience", ["item-2"]]]) });

    const result = resumeMapsToObjects(resume);

    expect(result.metadata.itemBreaks).toEqual({ experience: ["item-2"] });
  });

  it("survives the JSON clone that used to wipe custom sections", () => {
    // The data-loss vector: a JS Map stringifies to {}, so the first
    // cloneAndNormalize after a reload erased every custom section from the
    // resume the next autosave persisted. Normalized first, the clone keeps
    // the data.
    const resume = shell({ custom: new Map([["speaking", customSection("Speaking")]]) }, {});

    const result = resumeMapsToObjects(resume);
    const cloned = JSON.parse(JSON.stringify(result)) as ResumeData;

    expect(Object.keys(cloned.sections.custom)).toEqual(["speaking"]);
    expect(cloned.sections.custom.speaking.name).toBe("Speaking");
  });

  it("returns the input untouched when nothing is Map-shaped", () => {
    const custom = { speaking: customSection("Speaking") };
    const itemBreaks = { experience: ["item-2"] };
    const resume = shell({ custom }, { itemBreaks });

    const result = resumeMapsToObjects(resume);

    expect(result).toBe(resume);
    expect(result.sections.custom).toBe(custom);
    expect(result.metadata.itemBreaks).toBe(itemBreaks);
  });

  it("never mutates its input, even when frozen", () => {
    const map = new Map([["speaking", customSection("Speaking")]]);
    const sections = Object.freeze({ custom: map });
    const metadata = Object.freeze({ itemBreaks: new Map([["experience", ["item-2"]]]) });
    const resume = Object.freeze(shell(sections, metadata)) as ResumeData;

    const result = resumeMapsToObjects(resume);

    expect(resume.sections.custom).toBe(map);
    expect(result).not.toBe(resume);
    expect(Object.keys(result.sections.custom)).toEqual(["speaking"]);
    expect(result.metadata.itemBreaks).toEqual({ experience: ["item-2"] });
  });

  it("tolerates resumes with no custom map or itemBreaks at all", () => {
    const resume = shell({}, {});
    expect(() => resumeMapsToObjects(resume)).not.toThrow();
    expect(resumeMapsToObjects(resume)).toBe(resume);
  });
});
