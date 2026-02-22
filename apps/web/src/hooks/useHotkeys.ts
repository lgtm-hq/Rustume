import { onCleanup, onMount } from "solid-js";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);

export interface Shortcut {
  key: string;
  mod?: boolean;
  shift?: boolean;
  handler: (e: KeyboardEvent) => void;
  label: string;
  category: string;
}

/** Returns true when the event target is an editable element (inputs, textareas, contenteditable). */
function isEditable(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

/** Characters that inherently require the Shift key on standard keyboards. */
const SHIFTED_CHARS = new Set('~!@#$%^&*()_+{}|:"<>?');

/** Format a shortcut for display, e.g. "Cmd+S" or "Ctrl+S". */
export function formatShortcut(shortcut: Pick<Shortcut, "key" | "mod" | "shift">): string {
  const parts: string[] = [];
  if (shortcut.mod) parts.push(isMac ? "\u2318" : "Ctrl");
  // Skip the shift label when the key itself is a shifted character (e.g. "?", "!")
  if (shortcut.shift && !SHIFTED_CHARS.has(shortcut.key)) parts.push(isMac ? "\u21E7" : "Shift");
  const keyLabel = shortcut.key === "Escape" ? "Esc" : shortcut.key.toUpperCase();
  parts.push(keyLabel);
  return parts.join(isMac ? "" : "+");
}

/**
 * Registers global keyboard shortcuts that are active for the lifetime of the
 * calling component. Shortcuts with `mod` match Cmd on Mac and Ctrl elsewhere.
 * Shortcuts are suppressed when focus is inside an editable element, except for
 * mod-key combos (Cmd/Ctrl+key) which always fire (so Cmd+S works while typing).
 */
export function useHotkeys(shortcuts: Shortcut[]) {
  function handler(e: KeyboardEvent) {
    const modPressed = isMac ? e.metaKey : e.ctrlKey;

    for (const s of shortcuts) {
      const keyMatch = e.key.toLowerCase() === s.key.toLowerCase();
      if (!keyMatch) continue;

      const wantsMod = s.mod ?? false;
      const wantsShift = s.shift ?? false;

      if (wantsMod !== modPressed) continue;
      if (wantsShift !== e.shiftKey) continue;

      // Allow mod combos even in editable elements; suppress plain keys in editable
      if (!wantsMod && isEditable(e.target)) continue;

      e.preventDefault();
      s.handler(e);
      return;
    }
  }

  onMount(() => {
    document.addEventListener("keydown", handler);
  });

  onCleanup(() => {
    document.removeEventListener("keydown", handler);
  });
}
