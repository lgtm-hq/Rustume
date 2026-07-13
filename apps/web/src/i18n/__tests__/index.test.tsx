import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@solidjs/testing-library";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  REGION_FALLBACKS,
  detectLocale,
  getLocaleEntry,
} from "../config";
import { I18nProvider, useI18n } from "../index";

describe("i18n config", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("navigator", { language: "en-US" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prefers saved locale over navigator", () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, "ar-SA");
    vi.stubGlobal("navigator", { language: "en-US" });
    expect(detectLocale()).toBe("ar-SA");
  });

  it("falls back from region to mapped locale when registered", () => {
    expect(REGION_FALLBACKS["fr-CA"]).toBe("fr-FR");
    expect(detectLocale()).toBe(DEFAULT_LOCALE);
  });

  it("defaults to en-US when nothing matches", () => {
    vi.stubGlobal("navigator", { language: "zz-ZZ" });
    expect(detectLocale()).toBe(DEFAULT_LOCALE);
  });

  it("sets rtl direction for rtl locales", () => {
    expect(getLocaleEntry("ar-SA")?.dir).toBe("rtl");
    expect(getLocaleEntry("en-US")?.dir).toBe("ltr");
  });
});

describe("I18nProvider", () => {
  function Probe() {
    const { t } = useI18n();
    return <p data-testid="probe">{t("home.hero.title")}</p>;
  }

  it("renders translated catalog text", () => {
    render(() => (
      <I18nProvider>
        <Probe />
      </I18nProvider>
    ));
    expect(screen.getByTestId("probe")).toHaveTextContent("Build your resume");
  });

  it("falls back to key string for missing keys", () => {
    function MissingKeyProbe() {
      const { t } = useI18n();
      return <p data-testid="missing">{t("missing.key" as "home.hero.title")}</p>;
    }

    render(() => (
      <I18nProvider>
        <MissingKeyProbe />
      </I18nProvider>
    ));
    expect(screen.getByTestId("missing")).toHaveTextContent("missing.key");
  });
});
