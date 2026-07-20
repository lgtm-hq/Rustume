import { afterEach, describe, expect, it } from "vitest";
import { CUSTOM_CSS_STYLE_ID, clearCustomCssStyle, syncCustomCssStyle } from "../customCss";

describe("customCss", () => {
  afterEach(() => {
    clearCustomCssStyle();
  });

  it("injects a style element when visible with non-empty CSS", () => {
    syncCustomCssStyle(true, ".resume { color: red; }");

    const style = document.getElementById(CUSTOM_CSS_STYLE_ID);
    expect(style).toBeInstanceOf(HTMLStyleElement);
    expect(style?.textContent).toBe(".resume { color: red; }");
  });

  it("removes the style element when disabled or empty", () => {
    syncCustomCssStyle(true, "body { margin: 0; }");
    syncCustomCssStyle(false, "body { margin: 0; }");
    expect(document.getElementById(CUSTOM_CSS_STYLE_ID)).toBeNull();

    syncCustomCssStyle(true, "body { margin: 0; }");
    syncCustomCssStyle(true, "   ");
    expect(document.getElementById(CUSTOM_CSS_STYLE_ID)).toBeNull();
  });

  it("updates existing style content in place", () => {
    syncCustomCssStyle(true, "a { color: blue; }");
    syncCustomCssStyle(true, "a { color: green; }");

    const styles = document.querySelectorAll(`#${CUSTOM_CSS_STYLE_ID}`);
    expect(styles.length).toBe(1);
    expect(styles[0]?.textContent).toBe("a { color: green; }");
  });
});
