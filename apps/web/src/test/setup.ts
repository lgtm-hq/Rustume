import "@testing-library/jest-dom/vitest";
import * as axeMatchers from "vitest-axe/matchers";
import { expect } from "vitest";
import "vitest-axe/extend-expect";

expect.extend(axeMatchers);

// Provide a full localStorage mock — Node.js's built-in localStorage
// (visible from the --localstorage-file warnings) lacks clear().
const createStorageMock = (): Storage => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    get length() {
      return Object.keys(store).length;
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
};

Object.defineProperty(globalThis, "localStorage", {
  value: createStorageMock(),
  writable: true,
  configurable: true,
});

Object.defineProperty(globalThis, "scrollTo", {
  value: () => undefined,
  writable: true,
  configurable: true,
});

if (!globalThis.ResizeObserver) {
  class ResizeObserverMock implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      void callback;
    }

    observe(target: Element, options?: ResizeObserverOptions) {
      void target;
      void options;
    }

    unobserve(target: Element) {
      void target;
    }

    disconnect() {
      return undefined;
    }
  }

  Object.defineProperty(globalThis, "ResizeObserver", {
    value: ResizeObserverMock,
    writable: true,
    configurable: true,
  });
}

// Mock crypto.randomUUID for deterministic IDs in tests
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: { randomUUID: () => "00000000-0000-4000-8000-000000000000" },
  });
} else if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = () =>
    "00000000-0000-4000-8000-000000000000" as `${string}-${string}-${string}-${string}-${string}`;
}
