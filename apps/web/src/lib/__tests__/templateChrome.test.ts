/**
 * Per-template chrome metadata selection for the document sheet (#830).
 */

import { describe, expect, it } from "vitest";
import { bundledTemplateLayout, docFontStack } from "../docLayout";

describe("template chrome metadata", () => {
  it("gives onyx underline headings, chip keywords, and a header rule", () => {
    const layout = bundledTemplateLayout("onyx");
    expect(layout.headingStyle).toBe("underline");
    expect(layout.keywordStyle).toBe("chips");
    expect(layout.headerRule).toBe(true);
    expect(layout.fontBody).toBe("ibm-plex-sans");
    expect(layout.sidebarTint).toBe(false);
  });

  it("gives pikachu band main headings and plain sidebar headings", () => {
    const layout = bundledTemplateLayout("pikachu");
    expect(layout.headingStyle).toBe("band");
    expect(layout.sidebarHeadingStyle).toBe("plain");
    expect(layout.sidebarTint).toBe(true);
    expect(layout.keywordStyle).toBe("plain");
  });

  it("gives nosepass rule headings, serif face, and as-written case", () => {
    const layout = bundledTemplateLayout("nosepass");
    expect(layout.headingStyle).toBe("rule");
    expect(layout.headingCase).toBe("as-written");
    expect(layout.fontBody).toBe("ibm-plex-serif");
    expect(docFontStack(layout.fontBody)).toContain("IBM Plex Serif");
  });

  it("gives gengar text-ink main headings and accent sidebar headings", () => {
    const layout = bundledTemplateLayout("gengar");
    expect(layout.headingInk).toBe("text");
    expect(layout.sidebarHeadingInk).toBe("accent");
    expect(layout.sidebarTint).toBe(true);
  });

  it("leaves azurill sidebar untinted (proportional, no fill)", () => {
    expect(bundledTemplateLayout("azurill").sidebarTint).toBe(false);
  });

  it("covers every gallery template with chrome fields", () => {
    const ids = [
      "rhyhorn",
      "onyx",
      "nosepass",
      "bronzor",
      "kakuna",
      "azurill",
      "chikorita",
      "ditto",
      "gengar",
      "glalie",
      "pikachu",
      "leafish",
    ];
    for (const id of ids) {
      const layout = bundledTemplateLayout(id);
      expect(layout.headingStyle).toBeTruthy();
      expect(layout.sidebarHeadingStyle).toBeTruthy();
      expect(layout.fontBody).toMatch(/^ibm-plex-/);
      expect(["chips", "plain"]).toContain(layout.keywordStyle);
    }
  });
});
