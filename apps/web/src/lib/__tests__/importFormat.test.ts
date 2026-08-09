import { describe, expect, it } from "vitest";
import { detectResumeJsonFormat, isNativeRustumeJson } from "../importFormat";

describe("detectResumeJsonFormat", () => {
  it("classifies native Rustume (sections.summary + metadata) before anything else", () => {
    const native = {
      basics: { name: "Ada" },
      sections: { summary: { content: "" } },
      metadata: { template: "rhyhorn" },
    };
    expect(isNativeRustumeJson(native)).toBe(true);
    expect(detectResumeJsonFormat(native)).toBe("rustume");
  });

  it("classifies RR v3 with the current `metadata` wrapper (doc-editor fixture shape)", () => {
    const rrv3 = {
      basics: { name: "Ada", email: "ada@example.com" },
      sections: { work: [] },
      metadata: { template: "ditto" },
    };
    // No sections.summary → not native, but basics + metadata → RR v3.
    expect(detectResumeJsonFormat(rrv3)).toBe("rrv3");
  });

  it("classifies older RR v3 exports that use `meta`", () => {
    expect(detectResumeJsonFormat({ basics: { name: "Ada" }, meta: { version: "v3" } })).toBe(
      "rrv3",
    );
  });

  it("classifies plain `basics` as JSON Resume", () => {
    expect(detectResumeJsonFormat({ basics: { name: "Ada" }, work: [] })).toBe("json-resume");
  });

  it("returns null for unrecognized payloads", () => {
    expect(detectResumeJsonFormat({ foo: 1 })).toBeNull();
    expect(detectResumeJsonFormat({})).toBeNull();
  });

  it("does not treat sections without summary as native", () => {
    expect(
      detectResumeJsonFormat({
        basics: { name: "Ada" },
        sections: { work: [] },
        metadata: {},
      }),
    ).toBe("rrv3");
  });
});
