import { beforeEach, describe, expect, it, vi } from "vitest";
import { axe } from "vitest-axe";
import { render } from "@solidjs/testing-library";
import { axeConfig } from "../../../test/a11y";
import { SectionPanel } from "../SectionPanel";
import { resumeStore } from "../../../stores/resume";
import { uiStore } from "../../../stores/ui";

vi.mock("../../../wasm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../wasm")>();
  return {
    ...actual,
    saveResume: vi.fn().mockResolvedValue(undefined),
    isWasmReady: () => false,
    ensureWasmReady: async () => false,
  };
});

describe("SectionPanel accessibility", () => {
  beforeEach(() => {
    resumeStore.createNewResume("section-panel-test");
    uiStore.setSectionPanelOpen(true);
  });

  it("has no axe violations when the panel is expanded", async () => {
    const { container } = render(() => <SectionPanel />);

    expect(await axe(container, axeConfig)).toHaveNoViolations();
  });
});
