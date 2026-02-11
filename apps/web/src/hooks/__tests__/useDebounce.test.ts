import { createRoot, createSignal, type Accessor } from "solid-js";
import { render, cleanup } from "@solidjs/testing-library";
import { useDebounce, useDebouncedCallback } from "../useDebounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("returns initial value immediately", () => {
    let debounced!: Accessor<string>;

    render(() => {
      const [value] = createSignal("hello");
      debounced = useDebounce(value, 300);
      return null;
    });

    expect(debounced()).toBe("hello");
  });

  it("updates value after delay", () => {
    let debounced!: Accessor<string>;
    let setValue!: (v: string) => void;

    render(() => {
      const [value, _setValue] = createSignal("initial");
      setValue = _setValue;
      debounced = useDebounce(value, 300);
      return null;
    });

    expect(debounced()).toBe("initial");

    setValue("updated");

    // Value should not have changed yet
    expect(debounced()).toBe("initial");

    vi.advanceTimersByTime(300);

    expect(debounced()).toBe("updated");
  });

  it("only propagates last value on rapid changes", () => {
    let debounced!: Accessor<string>;
    let setValue!: (v: string) => void;

    render(() => {
      const [value, _setValue] = createSignal("a");
      setValue = _setValue;
      debounced = useDebounce(value, 300);
      return null;
    });

    expect(debounced()).toBe("a");

    setValue("b");
    vi.advanceTimersByTime(100);

    setValue("c");
    vi.advanceTimersByTime(100);

    setValue("d");
    vi.advanceTimersByTime(100);

    // Each createEffect re-run clears the previous timer via onCleanup.
    // Only "d"'s timer is active, needing 200 more ms from when it was set.
    expect(debounced()).not.toBe("d");

    vi.advanceTimersByTime(200);

    expect(debounced()).toBe("d");
  });
});

describe("useDebouncedCallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calls callback after delay", () => {
    createRoot((dispose) => {
      const callback = vi.fn();
      const debounced = useDebouncedCallback(callback, 200);

      debounced("arg1");

      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(200);

      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledWith("arg1");
      dispose();
    });
  });

  it("cancels previous call on rapid invocations", () => {
    createRoot((dispose) => {
      const callback = vi.fn();
      const debounced = useDebouncedCallback(callback, 200);

      debounced("first");
      vi.advanceTimersByTime(50);

      debounced("second");
      vi.advanceTimersByTime(50);

      debounced("third");
      vi.advanceTimersByTime(200);

      expect(callback).toHaveBeenCalledOnce();
      expect(callback).toHaveBeenCalledWith("third");
      dispose();
    });
  });
});
