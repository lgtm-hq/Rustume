import { For, Show } from "solid-js";
import type { ResumeListItem } from "../../stores/persistence";

/**
 * Deterministic pseudo-random line widths for a resume's preview body.
 *
 * The library index stores metadata only (no section content), so previews are
 * typeset from the metadata we do have plus stable filler measures derived from
 * the resume id — the same resume always draws the same page.
 */
function lineWidths(seed: string, count: number): number[] {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619) >>> 0;
  }
  const widths: number[] = [];
  for (let i = 0; i < count; i++) {
    hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0;
    widths.push(52 + (hash % 44));
  }
  return widths;
}

/** Slugified resume name — the mono filename shown in the card's window bar. */
export function resumeSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "untitled";
}

function PreviewSection(props: { title: string; widths: number[]; compact: boolean }) {
  return (
    <div class={props.compact ? "mt-2" : "mt-3.5"}>
      <p
        class={`m-0 font-mono font-bold uppercase tracking-[0.16em] opacity-70 ${
          props.compact ? "text-[5px] leading-[1.4]" : "text-[7px] leading-[1.4]"
        }`}
      >
        {props.title}
      </p>
      <For each={props.widths}>
        {(width) => (
          <span
            class={`block rounded-full bg-current opacity-15 ${
              props.compact ? "mt-[3px] h-[2px]" : "mt-[4px] h-[3px]"
            }`}
            style={{ width: `${width}%` }}
            aria-hidden="true"
          />
        )}
      </For>
    </div>
  );
}

/**
 * A typeset page preview for a library entry: paper stock, serif name, italic
 * headline and small-caps section rules. Intentionally a document — never a
 * skeleton placeholder.
 */
export function DocumentPreview(props: { resume: ResumeListItem; size: "card" | "page" }) {
  const compact = () => props.size === "card";
  const widths = () => lineWidths(props.resume.id, 9);
  const displayName = () => props.resume.basicsName?.trim() || props.resume.name;
  const headline = () => props.resume.headline?.trim();

  return (
    <div
      class={`bg-sheet text-sheet-ink font-display overflow-hidden text-left
        shadow-[0_10px_24px_-16px_rgba(0,0,0,0.65)] ${
          compact() ? "rounded-sm px-3 py-2.5" : "aspect-[8.5/10.1] rounded-[3px] px-6 py-5"
        }`}
      data-testid="resume-card-preview"
      aria-hidden="true"
    >
      <p
        class={`m-0 font-bold leading-tight tracking-tight truncate ${
          compact() ? "text-[11px]" : "text-[19px]"
        }`}
      >
        {displayName()}
      </p>
      <Show when={headline()}>
        {(text) => (
          <p
            class={`m-0 mt-0.5 italic opacity-85 truncate ${
              compact() ? "text-[7px]" : "text-[11px]"
            }`}
          >
            {text()}
          </p>
        )}
      </Show>
      <div
        class={`border-t border-current opacity-25 ${compact() ? "mt-2" : "mt-3.5"}`}
        aria-hidden="true"
      />

      <PreviewSection title="Experience" widths={widths().slice(0, 4)} compact={compact()} />
      <PreviewSection title="Selected work" widths={widths().slice(4, 7)} compact={compact()} />
      <Show when={!compact()}>
        <PreviewSection title="Stack" widths={widths().slice(7)} compact={compact()} />
      </Show>
    </div>
  );
}
