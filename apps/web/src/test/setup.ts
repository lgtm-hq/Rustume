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

// jsdom reports body padding/margin as unitless "0", where browsers report
// "0px". solid-prevent-scroll interpolates that value straight into
// `calc(<computed> + <scrollbar>px)`, producing `calc(0 + 1024px)` — invalid
// CSS, since calc() cannot add a unitless number to a length. jsdom 30's
// stricter CSS engine throws on it ("object null is not iterable") the moment
// anything calls getComputedStyle, which Kobalte's focus handling does on every
// dialog. Seeding explicit units keeps the generated calc() valid; real
// browsers are unaffected either way.
document.body.style.paddingRight = "0px";
document.body.style.marginRight = "0px";

// Mock crypto.randomUUID for deterministic IDs in tests
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: { randomUUID: () => "00000000-0000-4000-8000-000000000000" },
  });
} else if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = () =>
    "00000000-0000-4000-8000-000000000000" as `${string}-${string}-${string}-${string}-${string}`;
}
