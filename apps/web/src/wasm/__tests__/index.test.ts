// The WASM binary cannot load in a jsdom environment, so all exported
// functions will follow their fallback code-paths.  We use vi.resetModules()
// + dynamic import to get a fresh copy of the singleton module state for
// every test, ensuring no leakage between cases.

vi.mock("../../../wasm/rustume_wasm", () => {
  throw new Error("WASM not available in test environment");
});

// Type alias so we don't have to repeat the import shape everywhere.
type WasmIndex = typeof import("../index");

async function loadModule(): Promise<WasmIndex> {
  return (await import("../index")) as WasmIndex;
}

describe("WASM wrapper – fallback behaviour (WASM not loaded)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  // -------------------------------------------------------------------
  // isWasmReady
  // -------------------------------------------------------------------

  it("isWasmReady returns false when WASM is not loaded", async () => {
    const { isWasmReady } = await loadModule();
    expect(isWasmReady()).toBe(false);
  });

  // -------------------------------------------------------------------
  // listTemplates
  // -------------------------------------------------------------------

  it("listTemplates returns all 12 template names in fallback mode", async () => {
    const { listTemplates } = await loadModule();
    const templates = listTemplates();
    expect(templates).toHaveLength(12);
  });

  it("listTemplates returns exactly the expected template names", async () => {
    const { listTemplates } = await loadModule();
    const templates = listTemplates();

    const expected = [
      "rhyhorn",
      "azurill",
      "pikachu",
      "nosepass",
      "bronzor",
      "chikorita",
      "ditto",
      "gengar",
      "glalie",
      "kakuna",
      "leafish",
      "onyx",
    ];

    expect(templates).toEqual(expected);
  });

  // -------------------------------------------------------------------
  // getTemplateTheme
  // -------------------------------------------------------------------

  it("getTemplateTheme returns correct theme for rhyhorn", async () => {
    const { getTemplateTheme } = await loadModule();
    expect(getTemplateTheme("rhyhorn")).toEqual({
      background: "#ffffff",
      text: "#000000",
      primary: "#65a30d",
    });
  });

  it("getTemplateTheme returns correct theme for pikachu", async () => {
    const { getTemplateTheme } = await loadModule();
    expect(getTemplateTheme("pikachu")).toEqual({
      background: "#ffffff",
      text: "#1c1917",
      primary: "#ca8a04",
    });
  });

  it("getTemplateTheme returns correct theme for onyx", async () => {
    const { getTemplateTheme } = await loadModule();
    expect(getTemplateTheme("onyx")).toEqual({
      background: "#ffffff",
      text: "#111827",
      primary: "#dc2626",
    });
  });

  it("getTemplateTheme returns correct theme for gengar", async () => {
    const { getTemplateTheme } = await loadModule();
    expect(getTemplateTheme("gengar")).toEqual({
      background: "#ffffff",
      text: "#1f2937",
      primary: "#67b8c8",
    });
  });

  it("getTemplateTheme returns null for unknown template", async () => {
    const { getTemplateTheme } = await loadModule();
    expect(getTemplateTheme("nonexistent-template")).toBeNull();
  });

  // -------------------------------------------------------------------
  // createEmptyResume
  // -------------------------------------------------------------------

  it("createEmptyResume returns valid default resume with expected structure", async () => {
    const { createEmptyResume } = await loadModule();
    const resume = createEmptyResume();

    // Top-level keys
    expect(resume).toHaveProperty("basics");
    expect(resume).toHaveProperty("sections");
    expect(resume).toHaveProperty("metadata");

    // Basics shape
    expect(resume.basics).toHaveProperty("name");
    expect(resume.basics).toHaveProperty("headline");
    expect(resume.basics).toHaveProperty("email");
    expect(resume.basics).toHaveProperty("phone");
    expect(resume.basics).toHaveProperty("location");
    expect(resume.basics).toHaveProperty("url");
    expect(resume.basics).toHaveProperty("picture");

    // Sections shape – should contain the core section keys
    const sectionKeys = Object.keys(resume.sections);
    expect(sectionKeys).toContain("summary");
    expect(sectionKeys).toContain("experience");
    expect(sectionKeys).toContain("education");
    expect(sectionKeys).toContain("skills");

    // Metadata shape
    expect(resume.metadata).toHaveProperty("template");
    expect(resume.metadata).toHaveProperty("theme");
    expect(resume.metadata).toHaveProperty("typography");
    expect(resume.metadata).toHaveProperty("page");
    expect(resume.metadata.template).toBe("rhyhorn");
  });

  // -------------------------------------------------------------------
  // resumeToJson
  // -------------------------------------------------------------------

  it("resumeToJson returns JSON string in fallback mode", async () => {
    const { createEmptyResume, resumeToJson } = await loadModule();
    const resume = createEmptyResume();
    const json = resumeToJson(resume);

    expect(typeof json).toBe("string");

    // Should be valid JSON that round-trips back to the same structure
    const parsed = JSON.parse(json);
    expect(parsed.basics.name).toBe(resume.basics.name);
    expect(parsed.metadata.template).toBe(resume.metadata.template);
  });

  // -------------------------------------------------------------------
  // parseJsonResume – throws when WASM not loaded
  // -------------------------------------------------------------------

  it('parseJsonResume throws "WASM not initialized" when not loaded', async () => {
    const { parseJsonResume } = await loadModule();
    expect(() => parseJsonResume("{}")).toThrow("WASM not initialized");
  });

  // -------------------------------------------------------------------
  // parseLinkedInExport – throws when WASM not loaded
  // -------------------------------------------------------------------

  it('parseLinkedInExport throws "WASM not initialized" when not loaded', async () => {
    const { parseLinkedInExport } = await loadModule();
    expect(() => parseLinkedInExport(new Uint8Array())).toThrow("WASM not initialized");
  });

  // -------------------------------------------------------------------
  // parseReactiveResumeV3 – throws when WASM not loaded
  // -------------------------------------------------------------------

  it('parseReactiveResumeV3 throws "WASM not initialized" when not loaded', async () => {
    const { parseReactiveResumeV3 } = await loadModule();
    expect(() => parseReactiveResumeV3("{}")).toThrow("WASM not initialized");
  });
});
