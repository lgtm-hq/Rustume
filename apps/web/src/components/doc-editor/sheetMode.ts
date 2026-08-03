/**
 * The sheet's Edit/Done mode (#785), shared by every component on the surface.
 *
 * `DocSheet` provides it; the inline editors, the header and the section cards
 * consume it. The default is editable so components rendered outside a sheet
 * (unit tests, future embeddings) keep today's behaviour without wiring.
 *
 * Done mode is not merely hidden chrome: consumers must render plain document
 * content — no buttons, no placeholders for empty fields, no dialogs — so the
 * surface reads (and tabs) exactly like the rendered document.
 */

import { createContext, useContext } from "solid-js";

export type SheetMode = "edit" | "done";

const DEFAULT_MODE: () => SheetMode = () => "edit";

export const SheetModeContext = createContext<() => SheetMode>(DEFAULT_MODE);

/** Whether the surrounding sheet is in Edit mode. */
export function useSheetEditable(): () => boolean {
  const mode = useContext(SheetModeContext) ?? DEFAULT_MODE;
  return () => mode() === "edit";
}
