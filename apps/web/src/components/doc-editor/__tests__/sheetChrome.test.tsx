/**
 * Sheet root applies per-template chrome modifiers from TemplateLayout (#830).
 */

import { describe, expect, it, vi } from "vitest";
import { render } from "@solidjs/testing-library";
import { DocSheet } from "../DocSheet";
import {
  loadDocEditorFixture,
  SIDEBAR_TEMPLATE,
  SINGLE_TEMPLATE,
} from "../../../test/docEditorFixture";
import { bundledTemplateLayout } from "../../../lib/docLayout";

vi.mock("../../../stores/resume", () => ({
  resumeStore: {
    store: { resume: null },
    updateLayout: vi.fn(),
    updateBasics: vi.fn(),
    updateSection: vi.fn(),
    updateMetadata: vi.fn(),
  },
}));

describe("DocSheet chrome modifiers", () => {
  it("applies onyx underline / chips / header-rule modifiers", () => {
    const resume = loadDocEditorFixture();
    resume.metadata.template = "onyx";
    const layout = bundledTemplateLayout("onyx");
    render(() => <DocSheet resume={resume} templateLayout={layout} mode="done" />);
    const sheet = document.querySelector("[data-testid='doc-sheet']") as HTMLElement;
    expect(sheet.className).toContain("doc-sheet--heading-underline");
    expect(sheet.className).toContain("doc-sheet--keywords-chips");
    expect(sheet.classList.contains("doc-sheet--header-rule")).toBe(true);
    expect(sheet.getAttribute("data-font-body")).toBe("ibm-plex-sans");
  });

  it("applies pikachu band / plain / sidebar-tint modifiers", () => {
    const resume = loadDocEditorFixture();
    resume.metadata.template = "pikachu";
    const layout = bundledTemplateLayout("pikachu");
    render(() => <DocSheet resume={resume} templateLayout={layout} mode="done" />);
    const sheet = document.querySelector("[data-testid='doc-sheet']") as HTMLElement;
    expect(sheet.className).toContain("doc-sheet--heading-band");
    expect(sheet.className).toContain("doc-sheet--side-heading-plain");
    expect(sheet.classList.contains("doc-sheet--sidebar-tint")).toBe(true);
    expect(sheet.getAttribute("data-heading-style")).toBe("band");
  });

  it("applies nosepass rule / serif / as-written modifiers", () => {
    const resume = loadDocEditorFixture();
    resume.metadata.template = "nosepass";
    const layout = bundledTemplateLayout("nosepass");
    render(() => <DocSheet resume={resume} templateLayout={layout} mode="done" />);
    const sheet = document.querySelector("[data-testid='doc-sheet']") as HTMLElement;
    expect(sheet.className).toContain("doc-sheet--heading-rule");
    expect(sheet.className).toContain("doc-sheet--heading-case-as-written");
    expect(sheet.className).toContain("doc-sheet--font-ibm-plex-serif");
    expect(sheet.getAttribute("data-font-body")).toBe("ibm-plex-serif");
  });

  it("applies the fixture templates' declared chrome, not just any sheet node", () => {
    const resume = loadDocEditorFixture();

    render(() => <DocSheet resume={resume} templateLayout={SINGLE_TEMPLATE} mode="done" />);
    const single = document.querySelector("[data-testid='doc-sheet']") as HTMLElement;
    expect(single.className).toContain("doc-sheet--heading-underline");
    expect(single.className).toContain("doc-sheet--heading-case-upper");
    expect(single.classList.contains("doc-sheet--header-rule")).toBe(true);
    expect(single.classList.contains("doc-sheet--sidebar-tint")).toBe(false);

    render(() => <DocSheet resume={resume} templateLayout={SIDEBAR_TEMPLATE} mode="done" />);
    const sheets = document.querySelectorAll("[data-testid='doc-sheet']");
    const sidebar = sheets[sheets.length - 1] as HTMLElement;
    expect(sidebar.className).toContain("doc-sheet--heading-band");
    expect(sidebar.className).toContain("doc-sheet--side-heading-plain");
    expect(sidebar.classList.contains("doc-sheet--sidebar-tint")).toBe(true);
    expect(sidebar.classList.contains("doc-sheet--header-rule")).toBe(false);
  });
});
