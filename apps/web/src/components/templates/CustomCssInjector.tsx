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
    // Inject unconditionally, even if no `[data-custom-css-root]` element is
    // mounted yet: the CSS is wrapped in `@scope ([data-custom-css-root])`,
    // so without a matching root it simply applies to nothing. This keeps the
    // injector safe against pathological rules while staying render-order
    // independent.
    syncCustomCssStyle(css.visible, css.value);
  });

  onCleanup(() => {
    clearCustomCssStyle();
  });

  return null;
}
