import { describe, expect, it } from "vitest";
import { FEATURE_FLAGS, isFlagEnabled } from "../flags";

const DOC_EDITOR_KEY = "ff.doc-editor";

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

describe("isFlagEnabled", () => {
  it("defaults to off with no query parameter and nothing persisted", () => {
    expect(isFlagEnabled(FEATURE_FLAGS.docEditor, { search: "", storage: createStorage() })).toBe(
      false,
    );
  });

  it("enables and persists the flag when ?ff=<flag> is requested", () => {
    const storage = createStorage();

    expect(isFlagEnabled(FEATURE_FLAGS.docEditor, { search: "?ff=doc-editor", storage })).toBe(
      true,
    );
    expect(storage.getItem(DOC_EDITOR_KEY)).toBe("true");
  });

  it("keeps the persisted choice for a later visit with no query parameter", () => {
    const storage = createStorage();
    isFlagEnabled(FEATURE_FLAGS.docEditor, { search: "?ff=doc-editor", storage });

    expect(isFlagEnabled(FEATURE_FLAGS.docEditor, { search: "", storage })).toBe(true);
  });

  it("clears every registered flag on ?ff=off", () => {
    const storage = createStorage({ [DOC_EDITOR_KEY]: "true" });

    expect(isFlagEnabled(FEATURE_FLAGS.docEditor, { search: "?ff=off", storage })).toBe(false);
    expect(storage.getItem(DOC_EDITOR_KEY)).toBeNull();
  });

  it("lets ?ff=off win over a simultaneous flag request", () => {
    const storage = createStorage({ [DOC_EDITOR_KEY]: "true" });

    expect(
      isFlagEnabled(FEATURE_FLAGS.docEditor, { search: "?ff=doc-editor&ff=off", storage }),
    ).toBe(false);
    expect(storage.getItem(DOC_EDITOR_KEY)).toBeNull();
  });

  it("stays off despite unrelated query parameters and unknown flag tokens", () => {
    const storage = createStorage();

    expect(
      isFlagEnabled(FEATURE_FLAGS.docEditor, { search: "?page=2&ff=some-other-flag", storage }),
    ).toBe(false);
    expect(storage.getItem(DOC_EDITOR_KEY)).toBeNull();
  });

  it("treats a malformed stored value as off without throwing", () => {
    const storage = createStorage({ [DOC_EDITOR_KEY]: "{not-json" });

    expect(() => isFlagEnabled(FEATURE_FLAGS.docEditor, { search: "", storage })).not.toThrow();
    expect(isFlagEnabled(FEATURE_FLAGS.docEditor, { search: "", storage })).toBe(false);
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

    expect(isFlagEnabled(FEATURE_FLAGS.docEditor, { search: "", storage: denied })).toBe(false);
    expect(
      isFlagEnabled(FEATURE_FLAGS.docEditor, { search: "?ff=doc-editor", storage: denied }),
    ).toBe(true);
  });

  it("resolves without persistence when storage is null", () => {
    expect(
      isFlagEnabled(FEATURE_FLAGS.docEditor, { search: "?ff=doc-editor", storage: null }),
    ).toBe(true);
    expect(isFlagEnabled(FEATURE_FLAGS.docEditor, { search: "", storage: null })).toBe(false);
  });

  it("falls back to the live location and localStorage when no environment is given", () => {
    const original = `${window.location.pathname}${window.location.search}`;
    const storedBefore = localStorage.getItem(DOC_EDITOR_KEY);
    try {
      window.history.replaceState(null, "", "/edit/abc?ff=doc-editor");

      expect(isFlagEnabled(FEATURE_FLAGS.docEditor)).toBe(true);
      expect(localStorage.getItem(DOC_EDITOR_KEY)).toBe("true");

      window.history.replaceState(null, "", "/edit/abc");
      expect(isFlagEnabled(FEATURE_FLAGS.docEditor)).toBe(true);

      window.history.replaceState(null, "", "/edit/abc?ff=off");
      expect(isFlagEnabled(FEATURE_FLAGS.docEditor)).toBe(false);
      expect(localStorage.getItem(DOC_EDITOR_KEY)).toBeNull();
    } finally {
      window.history.replaceState(null, "", original);
      if (storedBefore === null) {
        localStorage.removeItem(DOC_EDITOR_KEY);
      } else {
        localStorage.setItem(DOC_EDITOR_KEY, storedBefore);
      }
    }
  });
});
