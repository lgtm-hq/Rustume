import { For } from "solid-js";
import type { TextSegment } from "../../lib/resumeSearch";

export function HighlightedText(props: { segments: TextSegment[] }) {
  return (
    <For each={props.segments}>
      {(segment) =>
        segment.highlighted ? (
          <mark class="text-accent bg-accent/10 rounded-sm">{segment.text}</mark>
        ) : (
          <>{segment.text}</>
        )
      }
    </For>
  );
}

/** Format a Date as a human-readable relative or absolute string. */
export function formatUpdatedAt(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();

  // Guard against future dates (e.g. clock skew)
  if (diff < 0) return "just now";
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) {
    const mins = Math.floor(diff / 60_000);
    return `${mins}m ago`;
  }
  if (diff < 86_400_000) {
    const hrs = Math.floor(diff / 3_600_000);
    return `${hrs}h ago`;
  }
  if (diff < 604_800_000) {
    const days = Math.floor(diff / 86_400_000);
    return `${days}d ago`;
  }
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
