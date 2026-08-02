import { beforeEach, describe, expect, it } from "vitest";
import { FEATURE_FLAGS, isDocEditorEnabled, isFlagEnabled } from "../flags";

const DOC_EDITOR_KEY = "ff.doc-editor";
const FORM_BUILDER_KEY = "ff.form-builder";

/** An in-memory `Storage` so a test can assert on what was written. */
function createStorage(seed: Record<string, string> = {}): Storage {
  const store = new Map(Object.entries(seed));
  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, String(value));
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key: (index) => [...store.keys()][index] ?? null,
  };
}

describe("isDocEditorEnabled", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to on with no query parameter and nothing persisted", () => {
    expect(isDocEditorEnabled({ search: "", storage: createStorage() })).toBe(true);
  });

  it("disables and persists the override when ?ff=form-builder is requested", () => {
    const storage = createStorage();

    expect(isDocEditorEnabled({ search: "?ff=form-builder", storage })).toBe(false);
    expect(storage.getItem(FORM_BUILDER_KEY)).toBe("true");
  });

  it("keeps the form builder for a later visit with no query parameter", () => {
    const storage = createStorage();
    isDocEditorEnabled({ search: "?ff=form-builder", storage });

    expect(isDocEditorEnabled({ search: "", storage })).toBe(false);
  });

  it("restores the default (on) and clears the override on ?ff=off", () => {
    const storage = createStorage({ [FORM_BUILDER_KEY]: "true" });

    expect(isDocEditorEnabled({ search: "?ff=off", storage })).toBe(true);
    expect(storage.getItem(FORM_BUILDER_KEY)).toBeNull();
  });

  it("lets ?ff=off win over a simultaneous form-builder request", () => {
    const storage = createStorage({ [FORM_BUILDER_KEY]: "true" });

    expect(isDocEditorEnabled({ search: "?ff=form-builder&ff=off", storage })).toBe(true);
    expect(storage.getItem(FORM_BUILDER_KEY)).toBeNull();
  });

  it("still honors the transition-era ?ff=doc-editor and forgets the override", () => {
    const storage = createStorage({ [FORM_BUILDER_KEY]: "true" });

    expect(isDocEditorEnabled({ search: "?ff=doc-editor", storage })).toBe(true);
    expect(storage.getItem(FORM_BUILDER_KEY)).toBeNull();
    expect(storage.getItem(DOC_EDITOR_KEY)).toBe("true");
  });

  it("lets a form-builder request win over a simultaneous doc-editor request", () => {
    const storage = createStorage();

    expect(isDocEditorEnabled({ search: "?ff=doc-editor&ff=form-builder", storage })).toBe(false);
    expect(storage.getItem(FORM_BUILDER_KEY)).toBe("true");
  });

  it("stays on despite unrelated query parameters and unknown flag tokens", () => {
    const storage = createStorage();

    expect(isDocEditorEnabled({ search: "?page=2&ff=some-other-flag", storage })).toBe(true);
    expect(storage.getItem(FORM_BUILDER_KEY)).toBeNull();
  });

  it("treats a malformed stored override as absent without throwing", () => {
    const storage = createStorage({ [FORM_BUILDER_KEY]: "{not-json" });

    expect(() => isDocEditorEnabled({ search: "", storage })).not.toThrow();
    expect(isDocEditorEnabled({ search: "", storage })).toBe(true);
  });

  it("survives a storage that throws on every operation", () => {
    const denied: Storage = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
      clear: () => {
        throw new Error("denied");
      },
      length: 0,
      key: () => null,
    };

    expect(isDocEditorEnabled({ search: "", storage: denied })).toBe(true);
    expect(isDocEditorEnabled({ search: "?ff=form-builder", storage: denied })).toBe(false);
  });

  it("resolves without persistence when storage is null", () => {
    expect(isDocEditorEnabled({ search: "?ff=form-builder", storage: null })).toBe(false);
    expect(isDocEditorEnabled({ search: "", storage: null })).toBe(true);
  });

  it("falls back to the live location and localStorage when no environment is given", () => {
    const original = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, "", "/edit/abc?ff=form-builder");

    expect(isDocEditorEnabled()).toBe(false);
    expect(localStorage.getItem(FORM_BUILDER_KEY)).toBe("true");

    window.history.replaceState(null, "", "/edit/abc");
    expect(isDocEditorEnabled()).toBe(false);

    window.history.replaceState(null, "", "/edit/abc?ff=off");
    expect(isDocEditorEnabled()).toBe(true);
    expect(localStorage.getItem(FORM_BUILDER_KEY)).toBeNull();

    window.history.replaceState(null, "", original);
  });
});

describe("isFlagEnabled", () => {
  it("stays the default-off primitive for opt-in flags", () => {
    const storage = createStorage();

    expect(isFlagEnabled(FEATURE_FLAGS.formBuilder, { search: "", storage })).toBe(false);
    expect(isFlagEnabled(FEATURE_FLAGS.formBuilder, { search: "?ff=form-builder", storage })).toBe(
      true,
    );
    expect(isFlagEnabled(FEATURE_FLAGS.formBuilder, { search: "", storage })).toBe(true);
  });

  it("clears every registered flag on ?ff=off", () => {
    const storage = createStorage({
      [DOC_EDITOR_KEY]: "true",
      [FORM_BUILDER_KEY]: "true",
    });

    expect(isFlagEnabled(FEATURE_FLAGS.docEditor, { search: "?ff=off", storage })).toBe(false);
    expect(storage.getItem(DOC_EDITOR_KEY)).toBeNull();
    expect(storage.getItem(FORM_BUILDER_KEY)).toBeNull();
  });
});
