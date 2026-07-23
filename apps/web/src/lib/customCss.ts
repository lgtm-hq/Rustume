export const CUSTOM_CSS_STYLE_ID = "rustume-custom-css";

/** Attribute marking the container(s) that user CSS is allowed to style. */
export const CUSTOM_CSS_ROOT_ATTRIBUTE = "data-custom-css-root";

/**
 * Drop brace characters that would escape the wrapping `@scope` block: an
 * unmatched `}` at nesting depth 0 would close the scope early and make
 * everything after it apply globally. Comments are stripped first so braces
 * inside them don't skew the depth count. Valid CSS is unaffected (its braces
 * are balanced); malformed CSS loses only the unmatched closers.
 */
export function stripUnmatchedClosers(value: string): string {
  const withoutComments = value.replace(/\/\*[\s\S]*?(?:\*\/|$)/g, "");
  let depth = 0;
  let out = "";
  for (const char of withoutComments) {
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      if (depth === 0) continue;
      depth -= 1;
    }
    out += char;
  }
  return out;
}

/**
 * Wrap user CSS in a native `@scope` block so selectors only match inside
 * elements marked with `data-custom-css-root`. This prevents pathological
 * rules (e.g. `* { display: none !important }`) from hiding the app UI —
 * including the toggle needed to disable the CSS again. Browsers without
 * `@scope` support ignore the whole block, so the feature degrades to a
 * no-op rather than an unscoped injection.
 */
function scopeCustomCss(value: string): string {
  return `@scope ([${CUSTOM_CSS_ROOT_ATTRIBUTE}]) {\n${stripUnmatchedClosers(value)}\n}`;
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
