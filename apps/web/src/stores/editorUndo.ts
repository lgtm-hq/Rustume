import { unwrap } from "solid-js/store";
import type { ResumeData } from "../wasm/types";

export type UndoRecorder = (previous: ResumeData) => void;

let undoRecorder: UndoRecorder | null = null;

/** Register the in-session undo recorder (wired by #22 when available). */
export function setUndoRecorder(recorder: UndoRecorder | null): void {
  undoRecorder = recorder;
}

/** Capture resume state before a destructive action such as version revert. */
export function recordUndo(previous: ResumeData | null): void {
  if (!previous || !undoRecorder) return;
  // `previous` is usually the live Solid store proxy; `structuredClone` throws
  // a DataCloneError on proxies, so unwrap to the raw tree first.
  undoRecorder(structuredClone(unwrap(previous)));
}
