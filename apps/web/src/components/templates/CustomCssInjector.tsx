import { createEffect, onCleanup } from "solid-js";
import { resumeStore } from "../../stores/resume";
import { clearCustomCssStyle, syncCustomCssStyle } from "../../lib/customCss";

/** Keeps document-level custom CSS in sync with the active resume metadata. */
export function CustomCssInjector() {
  const { store } = resumeStore;

  createEffect(() => {
    const css = store.resume?.metadata.css;
    if (!css) {
      clearCustomCssStyle();
      return;
    }
    syncCustomCssStyle(css.visible, css.value);
  });

  onCleanup(() => {
    clearCustomCssStyle();
  });

  return null;
}
