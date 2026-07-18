import "@testing-library/jest-dom/vitest";
import * as axeMatchers from "vitest-axe/matchers";
import { expect, vi } from "vitest";
import "vitest-axe/extend-expect";
import * as i18n from "@solid-primitives/i18n";
import { Dynamic } from "solid-js/web";
import enUS from "../i18n/locales/en-US.json";
import { setActiveDictionary } from "../i18n/translate";

setActiveDictionary(i18n.flatten(enUS));

vi.mock("@solidjs/testing-library", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@solidjs/testing-library")>();
  const { I18nTestProvider } = await import("./i18n");
  return {
    ...actual,
    render: (
      ui: Parameters<typeof actual.render>[0],
      options?: Parameters<typeof actual.render>[1],
    ) =>
      actual.render(
        () => (
          <I18nTestProvider>
            <Dynamic component={ui} />
          </I18nTestProvider>
        ),
        options,
      ),
  };
});

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

// Mock crypto.randomUUID for deterministic IDs in tests
if (!globalThis.crypto) {
  Object.defineProperty(globalThis, "crypto", {
    value: { randomUUID: () => "00000000-0000-4000-8000-000000000000" },
  });
} else if (!globalThis.crypto.randomUUID) {
  globalThis.crypto.randomUUID = () =>
    "00000000-0000-4000-8000-000000000000" as `${string}-${string}-${string}-${string}-${string}`;
}
