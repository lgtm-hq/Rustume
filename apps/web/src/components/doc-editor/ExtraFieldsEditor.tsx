/**
 * Free-form label/value rows for one item (spec §1.13 `ExtraFieldsEditor`).
 *
 * Rows of `Field name | Value | remove` above a dashed "+ Add field" button.
 * Rows map onto the schema's `CustomField` — the schema's `name` carries the
 * label (§4.2: reuse `CustomField`, frontend maps label→name) and `icon`
 * stays empty for item-level fields. Rows left entirely blank are dropped by
 * the dialog on save, not here, so a row being typed never vanishes.
 *
 * Controlled: every change flows out through `onChange`; the surrounding
 * dialog owns the draft and commits once, on save.
 */

import { Index, type JSX } from "solid-js";
import { generateId } from "../../wasm/types";
import type { CustomField } from "../../wasm/types";

const HINT = "Add anything else for this item — e.g. URL label, role, stack note.";

export interface ExtraFieldsEditorProps {
  /** The rows as drafted, blank rows included. */
  fields: CustomField[];
  /** Called with the new rows on every change. */
  onChange: (fields: CustomField[]) => void;
}

export function ExtraFieldsEditor(props: ExtraFieldsEditorProps): JSX.Element {
  function patchAt(index: number, patch: Partial<CustomField>): void {
    props.onChange(
      props.fields.map((field, each) => (each === index ? { ...field, ...patch } : field)),
    );
  }

  function removeAt(index: number): void {
    props.onChange(props.fields.filter((_, each) => each !== index));
  }

  function addRow(): void {
    props.onChange([...props.fields, { id: generateId(), icon: "", name: "", value: "" }]);
  }

  return (
    <div class="flex flex-col gap-1.5">
      <span class="font-mono text-xs uppercase tracking-wider text-stone">Custom fields</span>

      {/* Position-keyed (`Index`), not reference-keyed: a keystroke patches
          its row into a fresh object, and reference keying would recreate the
          row's DOM and drop focus mid-word. */}
      <Index each={props.fields}>
        {(field, index) => (
          <div class="flex items-center gap-2">
            <input
              type="text"
              class="w-2/5 rounded-lg border border-border bg-paper px-3 py-2 font-body text-ink placeholder:text-stone/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              aria-label={`Field ${index + 1} name`}
              placeholder="Field name"
              value={field().name}
              onInput={(event) => patchAt(index, { name: event.currentTarget.value })}
            />
            <input
              type="text"
              class="flex-1 rounded-lg border border-border bg-paper px-3 py-2 font-body text-ink placeholder:text-stone/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              aria-label={`Field ${index + 1} value`}
              placeholder="Value"
              value={field().value}
              onInput={(event) => patchAt(index, { value: event.currentTarget.value })}
            />
            <button
              type="button"
              class="rounded-md px-2 py-1 text-stone hover:bg-surface hover:text-ink"
              aria-label={`Remove field ${field().name === "" ? index + 1 : field().name}`}
              onClick={() => removeAt(index)}
            >
              ×
            </button>
          </div>
        )}
      </Index>

      <button
        type="button"
        class="rounded-lg border border-dashed border-border px-3 py-2 font-body text-sm text-stone hover:border-accent hover:text-ink"
        onClick={addRow}
      >
        + Add field
      </button>

      <span class="text-xs text-stone">{HINT}</span>
    </div>
  );
}
