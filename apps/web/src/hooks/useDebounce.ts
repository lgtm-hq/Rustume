import { createSignal, createEffect, onCleanup, type Accessor } from "solid-js";

export function useDebounce<T>(value: Accessor<T>, delay: number): Accessor<T> {
  const [debouncedValue, setDebouncedValue] = createSignal<T>(value());

  createEffect(() => {
    const currentValue = value();
    const timer = setTimeout(() => {
      setDebouncedValue(() => currentValue);
    }, delay);

    onCleanup(() => clearTimeout(timer));
  });

  return debouncedValue;
}

export function useDebouncedCallback<T extends (...args: unknown[]) => void>(
  callback: T,
  delay: number
): T {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debouncedFn = ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      callback(...args);
    }, delay);
  }) as T;

  onCleanup(() => {
    if (timer) clearTimeout(timer);
  });

  return debouncedFn;
}
