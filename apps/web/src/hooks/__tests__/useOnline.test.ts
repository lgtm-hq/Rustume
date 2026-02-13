/** @vitest-environment jsdom */
import { render, cleanup } from "@solidjs/testing-library";
import type { Accessor } from "solid-js";
import { useOnline } from "../useOnline";

describe("useOnline", () => {
  afterEach(() => {
    cleanup();
  });

  it("returns navigator.onLine as initial value", () => {
    // navigator.onLine defaults to true in jsdom
    let onlineSignal!: Accessor<boolean>;

    render(() => {
      onlineSignal = useOnline();
      return null;
    });

    expect(onlineSignal()).toBe(navigator.onLine);
  });

  it("updates to false on offline event", () => {
    let onlineSignal!: Accessor<boolean>;

    render(() => {
      onlineSignal = useOnline();
      return null;
    });

    window.dispatchEvent(new Event("offline"));

    expect(onlineSignal()).toBe(false);
  });

  it("updates to true on online event", () => {
    let onlineSignal!: Accessor<boolean>;

    render(() => {
      onlineSignal = useOnline();
      return null;
    });

    // First go offline
    window.dispatchEvent(new Event("offline"));
    expect(onlineSignal()).toBe(false);

    // Then come back online
    window.dispatchEvent(new Event("online"));
    expect(onlineSignal()).toBe(true);
  });
});
