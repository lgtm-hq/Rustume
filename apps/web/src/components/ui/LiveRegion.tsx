export interface LiveRegionProps {
  message: string;
  politeness?: "polite" | "assertive";
}

/** Screen-reader-only live region for accessibility announcements. */
export function LiveRegion(props: LiveRegionProps) {
  return (
    <div aria-live={props.politeness ?? "polite"} aria-atomic="true" class="sr-only">
      {props.message}
    </div>
  );
}

/** Announce a message by clearing then re-setting (forces re-read). */
export function announceLive(setMessage: (message: string) => void, message: string): void {
  setMessage("");
  requestAnimationFrame(() => setMessage(message));
}
