import { createSignal, onMount, onCleanup } from "solid-js";

export function useOnline() {
  const [isOnline, setIsOnline] = createSignal(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  onMount(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    onCleanup(() => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    });
  });

  return isOnline;
}
