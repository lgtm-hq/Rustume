/**
 * Chip editor for an item's tags (spec §1.13 `TagInput`).
 *
 * A chip box: Enter or comma commits the draft as a chip (commas stripped,
 * duplicates dropped, whitespace trimmed), Backspace on an empty draft pops
 * the last chip, blur commits what was typed, and every chip carries its own
 * remove button.
 *
 * Controlled: every change flows out through `onChange`; the surrounding
 * dialog owns the draft and commits once, on save.
 */

import { For, Show, createSignal, type JSX } from "solid-js";

const DEFAULT_HINT = "Press Enter to add. Shown as chips on the resume.";

export interface TagInputProps {
  /** Field name, e.g. "Tags". Labels the input. */
  label: string;
  /** The committed chips. */
  values: string[];
  /** Called with the new chip list on every change. */
  onChange: (values: string[]) => void;
  /** Hint line under the box. */
  hint?: string;
}

export function TagInput(props: TagInputProps): JSX.Element {
  const [draft, setDraft] = createSignal("");

  /** Commit the draft as a chip: strip commas, trim, drop empties and dupes. */
  function commitDraft(): void {
    const tag = draft().replaceAll(",", "").trim();
    setDraft("");
    if (tag === "" || props.values.includes(tag)) return;
    props.onChange([...props.values, tag]);
  }

  function removeAt(index: number): void {
    props.onChange(props.values.filter((_, each) => each !== index));
  }

  function handleKeyDown(event: KeyboardEvent): void {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commitDraft();
      return;
    }
    if (event.key === "Backspace" && draft() === "" && props.values.length > 0) {
      event.preventDefault();
      removeAt(props.values.length - 1);
    }
  }

  return (
    <div class="flex flex-col gap-1.5">
      <span class="font-mono text-xs uppercase tracking-wider text-stone">{props.label}</span>

      <div class="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-paper px-2 py-1.5 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
        <For each={props.values}>
          {(tag, index) => (
            <span class="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-0.5 font-body text-sm text-ink">
              {tag}
              <button
                type="button"
                class="text-stone hover:text-ink"
                aria-label={`Remove ${tag}`}
                onClick={() => removeAt(index())}
              >
                ×
              </button>
            </span>
          )}
        </For>
        <input
          type="text"
          class="min-w-24 flex-1 bg-transparent py-0.5 font-body text-ink placeholder:text-stone/50 focus:outline-none"
          aria-label={props.label}
          placeholder={props.values.length === 0 ? "Add a tag" : ""}
          value={draft()}
          onInput={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitDraft}
        />
      </div>

      <Show when={(props.hint ?? DEFAULT_HINT) !== ""}>
        <span class="text-xs text-stone">{props.hint ?? DEFAULT_HINT}</span>
      </Show>
    </div>
  );
}
