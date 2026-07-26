import { createSignal, onCleanup, onMount } from "solid-js";

function readMatches(query: string): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia(query).matches;
  } catch {
    // matchMedia is unavailable or the query is unsupported in this environment
    return false;
  }
}

/**
 * Reactive `window.matchMedia`. Reports false wherever matchMedia is
 * unavailable, so callers get the non-matching branch rather than a crash.
 */
export function useMediaQuery(query: string) {
  const [matches, setMatches] = createSignal(readMatches(query));

  onMount(() => {
    if (typeof window.matchMedia !== "function") return;
    const list = window.matchMedia(query);
    const handleChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener("change", handleChange);
    onCleanup(() => list.removeEventListener("change", handleChange));
  });

  return matches;
}
