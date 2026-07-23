import type { ResumeData } from "../wasm/types";

export type UndoRecorder = (previous: ResumeData) => void;

let undoRecorder: UndoRecorder | null = null;

function cloneResume(data: ResumeData): ResumeData {
  return JSON.parse(JSON.stringify(data)) as ResumeData;
}

/** Register the in-session undo recorder. */
export function setUndoRecorder(recorder: UndoRecorder | null): void {
  undoRecorder = recorder;
}

/** Capture resume state before a destructive action such as version revert. */
export function recordUndo(previous: ResumeData | null): void {
  if (!previous || !undoRecorder) return;
  undoRecorder(cloneResume(previous));
}
