import { describe, expect, it } from "vitest";
import { createRoot, createSignal } from "solid-js";
import { usePageTitle } from "../usePageTitle";

/** Effects flush after the synchronous createRoot body completes. */
const flushEffects = () => Promise.resolve();

describe("usePageTitle", () => {
  it("sets a static title with the base suffix", async () => {
    const dispose = createRoot((d) => {
      usePageTitle("Account");
      return d;
    });
    await flushEffects();
    expect(document.title).toBe("Account — Rustume");
    dispose();
  });

  it("tracks a reactive title accessor", async () => {
    const [name, setName] = createSignal<string | undefined>("Ada Lovelace");
    const dispose = createRoot((d) => {
      usePageTitle(() => name());
      return d;
    });
    await flushEffects();
    expect(document.title).toBe("Ada Lovelace — Rustume");

    setName("Grace Hopper");
    await flushEffects();
    expect(document.title).toBe("Grace Hopper — Rustume");

    dispose();
  });

  it("falls back to the base title for empty values", async () => {
    const dispose = createRoot((d) => {
      usePageTitle(() => undefined);
      return d;
    });
    await flushEffects();
    expect(document.title).toBe("Rustume");
    dispose();
  });
});
