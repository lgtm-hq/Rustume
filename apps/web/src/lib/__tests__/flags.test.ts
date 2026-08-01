import { beforeEach, describe, expect, it } from "vitest";
import { FEATURE_FLAGS, isDocEditorEnabled, isFlagEnabled } from "../flags";

const KEY = "ff.doc-editor";

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

  it("defaults to off with no query parameter and nothing persisted", () => {
    expect(isDocEditorEnabled({ search: "", storage: createStorage() })).toBe(false);
  });

  it("enables and persists when the flag is requested", () => {
    const storage = createStorage();

    expect(isDocEditorEnabled({ search: "?ff=doc-editor", storage })).toBe(true);
    expect(storage.getItem(KEY)).toBe("true");
  });

  it("stays on for a later visit with no query parameter", () => {
    const storage = createStorage();
    isDocEditorEnabled({ search: "?ff=doc-editor", storage });

    expect(isDocEditorEnabled({ search: "", storage })).toBe(true);
  });

  it("clears the persisted value on ?ff=off", () => {
    const storage = createStorage({ [KEY]: "true" });

    expect(isDocEditorEnabled({ search: "?ff=off", storage })).toBe(false);
    expect(storage.getItem(KEY)).toBeNull();
  });

  it("lets ?ff=off win over a simultaneous enable request", () => {
    const storage = createStorage({ [KEY]: "true" });

    expect(isDocEditorEnabled({ search: "?ff=doc-editor&ff=off", storage })).toBe(false);
    expect(storage.getItem(KEY)).toBeNull();
  });

  it("ignores unrelated query parameters and unknown flag tokens", () => {
    const storage = createStorage();

    expect(isDocEditorEnabled({ search: "?page=2&ff=some-other-flag", storage })).toBe(false);
    expect(storage.getItem(KEY)).toBeNull();
  });

  it("treats a malformed stored value as off without throwing", () => {
    const storage = createStorage({ [KEY]: "{not-json" });

    expect(() => isDocEditorEnabled({ search: "", storage })).not.toThrow();
    expect(isDocEditorEnabled({ search: "", storage })).toBe(false);
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

    expect(isDocEditorEnabled({ search: "", storage: denied })).toBe(false);
    expect(isDocEditorEnabled({ search: "?ff=doc-editor", storage: denied })).toBe(true);
  });

  it("resolves without persistence when storage is null", () => {
    expect(isDocEditorEnabled({ search: "?ff=doc-editor", storage: null })).toBe(true);
    expect(isDocEditorEnabled({ search: "", storage: null })).toBe(false);
  });

  it("falls back to the live location and localStorage when no environment is given", () => {
    const original = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, "", "/edit/abc?ff=doc-editor");

    expect(isDocEditorEnabled()).toBe(true);
    expect(localStorage.getItem(KEY)).toBe("true");

    window.history.replaceState(null, "", "/edit/abc");
    expect(isDocEditorEnabled()).toBe(true);

    window.history.replaceState(null, "", original);
  });
});

describe("isFlagEnabled", () => {
  it("is the general primitive the named accessors delegate to", () => {
    const storage = createStorage();

    expect(isFlagEnabled(FEATURE_FLAGS.docEditor, { search: "?ff=doc-editor", storage })).toBe(
      true,
    );
    expect(isDocEditorEnabled({ search: "", storage })).toBe(true);
  });
});
