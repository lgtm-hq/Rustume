export const CUSTOM_CSS_STYLE_ID = "rustume-custom-css";

/** Attribute marking the container(s) that user CSS is allowed to style. */
export const CUSTOM_CSS_ROOT_ATTRIBUTE = "data-custom-css-root";

/**
 * Wrap user CSS in a native `@scope` block so selectors only match inside
 * elements marked with `data-custom-css-root`. This prevents pathological
 * rules (e.g. `* { display: none !important }`) from hiding the app UI —
 * including the toggle needed to disable the CSS again. Browsers without
 * `@scope` support ignore the whole block, so the feature degrades to a
 * no-op rather than an unscoped injection.
 */
function scopeCustomCss(value: string): string {
  return `@scope ([${CUSTOM_CSS_ROOT_ATTRIBUTE}]) {\n${value}\n}`;
}

/** Inject or remove resume custom CSS on the document for HTML and print surfaces. */
export function syncCustomCssStyle(visible: boolean, value: string): void {
  const existing = document.getElementById(CUSTOM_CSS_STYLE_ID);

  if (!visible || value.trim() === "") {
    existing?.remove();
    return;
  }

  const scoped = scopeCustomCss(value);

  if (existing instanceof HTMLStyleElement) {
    if (existing.textContent !== scoped) {
      existing.textContent = scoped;
    }
    return;
  }

  existing?.remove();

  const style = document.createElement("style");
  style.id = CUSTOM_CSS_STYLE_ID;
  style.textContent = scoped;
  document.head.appendChild(style);
}

export function clearCustomCssStyle(): void {
  document.getElementById(CUSTOM_CSS_STYLE_ID)?.remove();
}
