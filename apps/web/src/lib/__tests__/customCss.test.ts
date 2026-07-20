import { afterEach, describe, expect, it } from "vitest";
import {
  CUSTOM_CSS_ROOT_ATTRIBUTE,
  CUSTOM_CSS_STYLE_ID,
  clearCustomCssStyle,
  syncCustomCssStyle,
} from "../customCss";

const scoped = (value: string) => `@scope ([${CUSTOM_CSS_ROOT_ATTRIBUTE}]) {\n${value}\n}`;

describe("customCss", () => {
  afterEach(() => {
    clearCustomCssStyle();
  });

  it("injects a style element scoped to the custom CSS root when visible", () => {
    syncCustomCssStyle(true, ".resume { color: red; }");

    const style = document.getElementById(CUSTOM_CSS_STYLE_ID);
    expect(style).toBeInstanceOf(HTMLStyleElement);
    expect(style?.textContent).toBe(scoped(".resume { color: red; }"));
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
    expect(styles[0]?.textContent).toBe(scoped("a { color: green; }"));
  });

  it("strips unmatched closing braces so user CSS cannot escape the scope", () => {
    syncCustomCssStyle(true, "} * { display: none; }");
    const style = document.getElementById(CUSTOM_CSS_STYLE_ID);
    expect(style?.textContent).toBe(scoped(" * { display: none; }"));
  });

  it("keeps balanced braces and ignores braces inside comments", () => {
    syncCustomCssStyle(true, "/* } */ a { color: red; }");
    const style = document.getElementById(CUSTOM_CSS_STYLE_ID);
    expect(style?.textContent).toBe(scoped(" a { color: red; }"));
  });
});
