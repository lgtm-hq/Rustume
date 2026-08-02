/**
 * Which surface `/edit/:id` serves.
 *
 * Both candidates stay lazy, so whichever the flag does not pick is never
 * pulled into the initial bundle.
 */

import { lazy, type Component } from "solid-js";
import { isDocEditorEnabled } from "../lib/flags";

const Editor = lazy(() => import("./Editor"));
const DocEditor = lazy(() => import("./DocEditor"));

/**
 * The document sheet by default, the form editor only while the temporary
 * `?ff=form-builder` override is active (removed by #735). Resolved once at
 * startup, from the URL the app was opened with.
 */
export function resolveEditRoute(): Component {
  return isDocEditorEnabled() ? DocEditor : Editor;
}
