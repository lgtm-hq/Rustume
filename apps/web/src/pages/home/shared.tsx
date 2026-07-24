import { For } from "solid-js";
import type { TextSegment } from "../../lib/resumeSearch";
import { formatRelativeTime } from "../../lib/formatRelativeTime";

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

/** Format a Date as a human-readable relative time string. */
export function formatUpdatedAt(date: Date): string {
  return formatRelativeTime(date.getTime());
}
