import { createStore } from "solid-js/store";
import type { ResumeData } from "../wasm/types";

const HISTORY_LIMIT = 50;
const DEBOUNCE_MS = 500;

interface UndoHistoryState {
  past: ResumeData[];
  future: ResumeData[];
  canUndo: boolean;
  canRedo: boolean;
}

const [history, setHistory] = createStore<UndoHistoryState>({
  past: [],
  future: [],
  canUndo: false,
  canRedo: false,
});

/** Last settled resume snapshot (pre-burst). */
let lastEmitted: ResumeData | null = null;
/** Snapshot captured at the start of the current edit burst. */
let pendingAnchor: ResumeData | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let applyingHistory = false;
/** Latest post-mutation resume, used when the debounce commits. */
let latestResume: ResumeData | null = null;

function cloneResume(data: ResumeData): ResumeData {
  return JSON.parse(JSON.stringify(data)) as ResumeData;
}

function syncFlags(): void {
  setHistory("canUndo", history.past.length > 0);
  setHistory("canRedo", history.future.length > 0);
}

function pushPast(snapshot: ResumeData): void {
  const next = [...history.past, snapshot];
  while (next.length > HISTORY_LIMIT) next.shift();
  setHistory("past", next);
  setHistory("future", []);
  syncFlags();
}

/** Reset history when switching resumes or creating a new one. */
export function clearUndoHistory(current: ResumeData | null = null): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  pendingAnchor = null;
  lastEmitted = current ? cloneResume(current) : null;
  latestResume = lastEmitted;
  setHistory({ past: [], future: [], canUndo: false, canRedo: false });
}

/**
 * Call from markDirty after a mutation. Debounces rapid edits into one entry.
 */
export function noteResumeChanged(current: ResumeData | null): void {
  if (applyingHistory || !current) return;
  latestResume = current;

  if (!pendingAnchor) {
    pendingAnchor = lastEmitted ? cloneResume(lastEmitted) : cloneResume(current);
  }

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    if (pendingAnchor) {
      pushPast(pendingAnchor);
      pendingAnchor = null;
    }
    lastEmitted = latestResume ? cloneResume(latestResume) : null;
  }, DEBOUNCE_MS);
}

function flushPending(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (pendingAnchor) {
    pushPast(pendingAnchor);
    pendingAnchor = null;
  }
  lastEmitted = latestResume ? cloneResume(latestResume) : lastEmitted;
}

/** Push an explicit snapshot (e.g. before version-history revert). */
export function pushUndoSnapshot(previous: ResumeData): void {
  if (applyingHistory) return;
  flushPending();
  pushPast(cloneResume(previous));
}

/** Align the settled anchor after an external replace (e.g. snapshot revert). */
export function syncUndoAnchor(current: ResumeData | null): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  pendingAnchor = null;
  lastEmitted = current ? cloneResume(current) : null;
  latestResume = lastEmitted;
}

export function undoResume(current: ResumeData | null): ResumeData | null {
  if (!current) return null;
  flushPending();
  if (history.past.length === 0) return null;

  applyingHistory = true;
  try {
    const past = [...history.past];
    const previous = past.pop()!;
    setHistory("past", past);
    setHistory("future", [...history.future, cloneResume(current)]);
    syncFlags();
    lastEmitted = cloneResume(previous);
    latestResume = lastEmitted;
    return previous;
  } finally {
    applyingHistory = false;
  }
}

export function redoResume(current: ResumeData | null): ResumeData | null {
  if (!current) return null;
  // Flush first — pending edits clear `future`, matching undoResume's guard order.
  flushPending();
  if (history.future.length === 0) return null;

  applyingHistory = true;
  try {
    const future = [...history.future];
    const next = future.pop()!;
    setHistory("future", future);
    setHistory("past", [...history.past, cloneResume(current)]);
    syncFlags();
    lastEmitted = cloneResume(next);
    latestResume = lastEmitted;
    return next;
  } finally {
    applyingHistory = false;
  }
}

export const undoHistoryStore = {
  get state() {
    return history;
  },
};
