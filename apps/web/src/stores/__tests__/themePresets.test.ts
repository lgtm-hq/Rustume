import { THEME_PRESETS, getThemePresets, getThemePresetById } from "../themePresets";
import type { ThemePresetInfo } from "../../wasm/types";

describe("themePresets – single source of truth", () => {
  // -------------------------------------------------------------------
  // getThemePresets
  // -------------------------------------------------------------------

  it("returns the full list of presets synchronously", () => {
    const presets = getThemePresets();
    expect(Array.isArray(presets)).toBe(true);
    expect(presets.length).toBeGreaterThan(0);
  });

  it("returns at least one light and one dark preset", () => {
    const presets = getThemePresets();
    const light = presets.filter((p) => !p.isDark);
    const dark = presets.filter((p) => p.isDark);

    expect(light.length).toBeGreaterThanOrEqual(1);
    expect(dark.length).toBeGreaterThanOrEqual(1);
  });

  it("every preset has a unique id", () => {
    const ids = THEME_PRESETS.map((p) => p.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("every preset conforms to ThemePresetInfo shape", () => {
    for (const p of THEME_PRESETS) {
      expect(typeof p.id).toBe("string");
      expect(p.id.length).toBeGreaterThan(0);
      expect(typeof p.name).toBe("string");
      expect(p.name.length).toBeGreaterThan(0);
      expect(typeof p.isDark).toBe("boolean");
      expect(typeof p.colors.background).toBe("string");
      expect(typeof p.colors.text).toBe("string");
      expect(typeof p.colors.primary).toBe("string");
    }
  });

  it("all color values are valid 7-char hex strings", () => {
    const hexRegex = /^#[0-9A-Fa-f]{6}$/;
    for (const p of THEME_PRESETS) {
      expect(p.colors.background).toMatch(hexRegex);
      expect(p.colors.text).toMatch(hexRegex);
      expect(p.colors.primary).toMatch(hexRegex);
    }
  });

  // -------------------------------------------------------------------
  // getThemePresetById
  // -------------------------------------------------------------------

  it("finds an existing preset by id", () => {
    const preset = getThemePresetById("light-default");
    expect(preset).toBeDefined();
    expect(preset!.name).toBe("Default");
    expect(preset!.isDark).toBe(false);
  });

  it("returns undefined for an unknown id", () => {
    expect(getThemePresetById("nonexistent-theme")).toBeUndefined();
  });

  // -------------------------------------------------------------------
  // Offline-first guarantee
  // -------------------------------------------------------------------

  it("works without any network/fetch dependency", () => {
    // The fact that we can call getThemePresets() in a test environment
    // (no server running, no fetch mock) proves it is offline-first.
    const presets = getThemePresets();
    expect(presets.length).toBeGreaterThan(0);
  });

  it("returns the same reference on repeated calls (no re-creation)", () => {
    const first = getThemePresets();
    const second = getThemePresets();
    expect(first).toBe(second);
  });

  // -------------------------------------------------------------------
  // Light / dark partitioning
  // -------------------------------------------------------------------

  it("light presets have light backgrounds", () => {
    const light = THEME_PRESETS.filter((p) => !p.isDark);
    for (const p of light) {
      // Light backgrounds should be high-luminance (start with #f or #e or #d or #c or #ffffff)
      expect(p.colors.background).toBe("#ffffff");
    }
  });

  it("dark presets have dark backgrounds", () => {
    const dark = THEME_PRESETS.filter((p) => p.isDark);
    for (const p of dark) {
      // Dark backgrounds should NOT be #ffffff
      expect(p.colors.background).not.toBe("#ffffff");
    }
  });

  // -------------------------------------------------------------------
  // Specific preset spot-checks
  // -------------------------------------------------------------------

  it("contains the expected number of presets (10 light + 4 dark)", () => {
    const light = THEME_PRESETS.filter((p) => !p.isDark);
    const dark = THEME_PRESETS.filter((p) => p.isDark);
    expect(light).toHaveLength(10);
    expect(dark).toHaveLength(4);
    expect(THEME_PRESETS).toHaveLength(14);
  });

  it("light-emerald has the correct primary color", () => {
    const preset = getThemePresetById("light-emerald") as ThemePresetInfo;
    expect(preset.colors.primary).toBe("#65a30d");
  });

  it("dark-midnight has the correct colors", () => {
    const preset = getThemePresetById("dark-midnight") as ThemePresetInfo;
    expect(preset.colors.background).toBe("#0f172a");
    expect(preset.colors.text).toBe("#e2e8f0");
    expect(preset.colors.primary).toBe("#3b82f6");
  });
});
