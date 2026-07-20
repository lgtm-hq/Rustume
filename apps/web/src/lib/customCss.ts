export const CUSTOM_CSS_STYLE_ID = "rustume-custom-css";

/** Inject or remove resume custom CSS on the document for HTML and print surfaces. */
export function syncCustomCssStyle(visible: boolean, value: string): void {
  const existing = document.getElementById(CUSTOM_CSS_STYLE_ID);

  if (!visible || value.trim() === "") {
    existing?.remove();
    return;
  }

  if (existing instanceof HTMLStyleElement) {
    if (existing.textContent !== value) {
      existing.textContent = value;
    }
    return;
  }

  existing?.remove();

  const style = document.createElement("style");
  style.id = CUSTOM_CSS_STYLE_ID;
  style.textContent = value;
  document.head.appendChild(style);
}

export function clearCustomCssStyle(): void {
  document.getElementById(CUSTOM_CSS_STYLE_ID)?.remove();
}
