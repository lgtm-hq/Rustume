/**
 * Runtime feature flags.
 *
 * A flag is off for everyone until a URL opts in: `?ff=<flag>` turns it on and
 * remembers the choice, `?ff=off` clears every persisted choice and returns
 * everything to its default. That is the whole mechanism — it exists so
 * unfinished surfaces can ship to `main` in small reviewable slices while
 * staying invisible to normal traffic.
 *
 * The document editor has graduated: it is on by default, and the flag that
 * remains is the temporary `?ff=form-builder` escape hatch back to the legacy
 * form editor (see {@link isDocEditorEnabled}).
 *
 * Nothing here runs at import time: every resolution reads `location` and
 * `localStorage` through {@link FlagEnvironment}, which tests supply directly.
 * Adding a flag is one entry in {@link FEATURE_FLAGS} plus a one-line accessor.
 */

/** Query parameter that carries flag requests. */
const FLAG_PARAM = "ff";

/** `?ff=off` — turn every flag off and forget the persisted choices. */
const OFF_TOKEN = "off";

/** Prefix for the `localStorage` keys a flag persists under. */
const STORAGE_PREFIX = "ff.";

/** The only stored value that counts as "on"; anything else reads as off. */
const ENABLED_VALUE = "true";

/**
 * Every runtime flag, keyed by the token used in `?ff=<token>` and in the
 * `ff.<token>` storage key.
 */
export const FEATURE_FLAGS = {
  /**
   * The document sheet at `/edit/:id` (#727). Default on since #734; the
   * token is still recognized so transition-era URLs keep working.
   */
  docEditor: "doc-editor",
  /**
   * Escape hatch back to the legacy form editor at `/edit/:id`.
   * TODO(v0.62.0): remove the form-builder override once the doc editor has
   * held the default for a milestone (#735 retires the form builder).
   */
  formBuilder: "form-builder",
} as const;

/** A flag's wire token, e.g. `"doc-editor"`. */
export type FeatureFlag = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

/**
 * The ambient state a flag resolves against.
 *
 * Both fields are optional so a caller can stub one and let the other default:
 * an absent `search` reads as "no flag requested", an absent `storage` as "no
 * persistence available".
 */
export interface FlagEnvironment {
  /** A `location.search` string, with or without the leading `?`. */
  search?: string;
  /** Where the decision persists. `null` disables persistence entirely. */
  storage?: Storage | null;
}

/** `localStorage`, or `null` where it is missing or blocked (private mode). */
function defaultStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    // Some browsers throw on the property access itself when storage is denied.
    return null;
  }
}

/** The live browser environment, read fresh on every resolution. */
function defaultEnvironment(): FlagEnvironment {
  return {
    search: typeof window === "undefined" ? "" : window.location.search,
    storage: defaultStorage(),
  };
}

function storageKey(flag: FeatureFlag): string {
  return `${STORAGE_PREFIX}${flag}`;
}

function readStored(storage: Storage | null, flag: FeatureFlag): boolean {
  if (!storage) return false;
  try {
    // Any value that is not exactly ENABLED_VALUE — stale, hand-edited, or
    // written by an older build — reads as off rather than throwing.
    return storage.getItem(storageKey(flag)) === ENABLED_VALUE;
  } catch {
    return false;
  }
}

function writeStored(storage: Storage | null, flag: FeatureFlag, enabled: boolean): void {
  if (!storage) return;
  try {
    if (enabled) {
      storage.setItem(storageKey(flag), ENABLED_VALUE);
    } else {
      storage.removeItem(storageKey(flag));
    }
  } catch {
    // A full or blocked quota must never break the surface asking for a flag;
    // the flag simply does not stick past this page load.
  }
}

/** Flag tokens requested by the query string, in the order they appear. */
function requestedFlags(search: string | undefined): string[] {
  try {
    return new URLSearchParams(search ?? "").getAll(FLAG_PARAM);
  } catch {
    return [];
  }
}

/**
 * Whether `flag` is on.
 *
 * Resolution order: `?ff=off` wins and clears every persisted flag; then
 * `?ff=<flag>` turns this flag on and persists it; otherwise the persisted
 * value decides; otherwise off.
 */
export function isFlagEnabled(
  flag: FeatureFlag,
  env: FlagEnvironment = defaultEnvironment(),
): boolean {
  const storage = env.storage === undefined ? defaultStorage() : env.storage;
  const requested = requestedFlags(env.search);

  if (requested.includes(OFF_TOKEN)) {
    for (const known of Object.values(FEATURE_FLAGS)) {
      writeStored(storage, known, false);
    }
    return false;
  }

  if (requested.includes(flag)) {
    writeStored(storage, flag, true);
    return true;
  }

  return readStored(storage, flag);
}

/**
 * Whether the document sheet serves `/edit/:id`. On by default since #734.
 *
 * Resolution order: `?ff=off` clears every persisted flag and restores the
 * default (on); `?ff=form-builder` opts back into the legacy form editor and
 * persists that choice; `?ff=doc-editor` — kept for transition-era URLs —
 * re-enables the sheet and forgets a persisted form-builder override;
 * otherwise a persisted override decides; otherwise on.
 *
 * TODO(v0.62.0): remove the form-builder override (and this bespoke
 * resolution) when #735 retires the form builder.
 */
export function isDocEditorEnabled(env: FlagEnvironment = defaultEnvironment()): boolean {
  const storage = env.storage === undefined ? defaultStorage() : env.storage;
  const requested = requestedFlags(env.search);

  if (requested.includes(OFF_TOKEN)) {
    for (const known of Object.values(FEATURE_FLAGS)) {
      writeStored(storage, known, false);
    }
    return true;
  }

  if (requested.includes(FEATURE_FLAGS.formBuilder)) {
    writeStored(storage, FEATURE_FLAGS.formBuilder, true);
    return false;
  }

  if (requested.includes(FEATURE_FLAGS.docEditor)) {
    writeStored(storage, FEATURE_FLAGS.docEditor, true);
    writeStored(storage, FEATURE_FLAGS.formBuilder, false);
    return true;
  }

  return !readStored(storage, FEATURE_FLAGS.formBuilder);
}
