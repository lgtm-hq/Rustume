/**
 * Add or edit one item of a section — the typed item modal (spec §1.13).
 *
 * The form is generated from the section's descriptors in `itemFields.ts`, so
 * every section type — fixed or custom — gets every one of its fields with the
 * spec's per-type layout: paired half-width rows, the markdown mini editor for
 * rich fields, the tag-chip box, the proficiency picker, and custom-field
 * rows. A blank item comes from `emptyItemFor()`, the same seed the layout
 * model defines.
 *
 * The dialog holds a draft and commits **once**, on save: one item edit is one
 * store action and therefore one undo entry. Closing by any other path —
 * Cancel, the backdrop, Escape, the ✕ — discards the draft without a confirm.
 * Save-time rules from the spec: headline fields fall back to a placeholder
 * name rather than saving blank ("Company"/"Role", "Institution", "Network"),
 * a proficiency save clamps to 1–5 and auto-fills the description with the
 * level's label unless the user wrote their own, and custom-field rows left
 * entirely blank are dropped.
 */

import { For, Match, Show, Switch, createEffect, createSignal, on, type JSX } from "solid-js";
import { Button, Input, Modal, TextArea } from "../ui";
import { emptyItemFor } from "../../lib/docLayout";
import { addItem, updateItem, type ItemUpdates } from "./docEdits";
import { ExtraFieldsEditor } from "./ExtraFieldsEditor";
import { MiniRichEditor } from "./MiniRichEditor";
import { TagInput } from "./TagInput";
import { itemFieldsFor, type ItemFieldSpec } from "./itemFields";
import { generateId } from "../../wasm/types";
import type { CustomField, Url } from "../../wasm/types";

/** Highest level a skill or language can carry. Mirrors `clamp-level`. */
const MAX_LEVEL = 5;
/** What an untouched proficiency saves as (spec §4.2: UI default 3). */
const DEFAULT_LEVEL = 3;

/**
 * The level picker's cards, 1–5. Numbers only — proficiency wording was
 * removed by owner decision (post-§1.13): word labels only made sense for
 * languages, and the picker serves every levelled section.
 */
const LEVELS = [1, 2, 3, 4, 5] as const;

/**
 * Blank headline fields fall back to these on save (spec §1.13), so a
 * half-filled item still draws as a recognisable row on the sheet.
 */
const SAVE_FALLBACKS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  experience: { company: "Company", position: "Role" },
  education: { institution: "Institution" },
  profiles: { network: "Network" },
};

export interface ItemDialogProps {
  open: boolean;
  /** A fixed section id, or a custom section's own id. */
  sectionId: string;
  /** The section's drawn heading, used in the dialog's title. */
  sectionTitle: string;
  /**
   * Index of the item being edited in the section's own `items` array. Absent
   * when adding.
   */
  index?: number;
  /** The item being edited. Absent when adding. */
  item?: Readonly<Record<string, unknown>>;
  onOpenChange: (open: boolean) => void;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asLevel(value: unknown): number {
  return typeof value === "number" ? value : 0;
}

function asKeywords(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function asCustomFields(value: unknown): CustomField[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const field = entry as Partial<CustomField>;
    return {
      id: field.id ?? generateId(),
      icon: field.icon ?? "",
      name: field.name ?? "",
      value: field.value ?? "",
    };
  });
}

function asUrl(value: unknown): Url {
  const url = value as Partial<Url> | undefined;
  return { label: url?.label ?? "", href: url?.href ?? "" };
}

/** Consecutive `half` specs paired into two-column rows (spec's field-row). */
function fieldRows(specs: readonly ItemFieldSpec[]): ItemFieldSpec[][] {
  const rows: ItemFieldSpec[][] = [];
  for (const spec of specs) {
    const previous = rows.at(-1);
    if (spec.half === true && previous?.length === 1 && previous[0].half === true) {
      previous.push(spec);
      continue;
    }
    rows.push([spec]);
  }
  return rows;
}

export function ItemDialog(props: ItemDialogProps): JSX.Element {
  const [draft, setDraft] = createSignal<ItemUpdates>({});

  const fields = (): readonly ItemFieldSpec[] => itemFieldsFor(props.sectionId);
  const isAdding = (): boolean => props.index === undefined;
  const hasLevel = (): boolean => fields().some((spec) => spec.kind === "level");

  let body: HTMLDivElement | undefined;

  // Reseed every time the dialog opens, so a cancelled edit leaves nothing
  // behind for the next one. Tracked on `open` alone: the sheet rebuilds the
  // item object as it redraws, and reseeding from that would throw away
  // whatever the user had typed but not yet saved.
  createEffect(
    on(
      () => props.open,
      (open) => {
        if (!open) return;
        const seed =
          props.item ?? (emptyItemFor(props.sectionId) as Record<string, unknown> | null);
        const next = { ...(seed ?? {}) };
        // A level-0 item — fresh or pre-modal legacy data — seeds at the UI
        // default rather than the schema's 0, so the picker opens with a
        // selection that matches what save would write anyway (spec §4.2;
        // save clamps 0 to the default).
        if (hasLevel() && asLevel(next.level) === 0) next.level = DEFAULT_LEVEL;
        // Normalise custom-field rows once, at seeding — normalising per
        // render would hand the row editor fresh objects every keystroke and
        // the recreated inputs would drop focus mid-word.
        if (fields().some((spec) => spec.kind === "extraFields")) {
          next.customFields = asCustomFields(next.customFields);
        }
        setDraft(next);
        // The first field takes focus (spec §1.13).
        queueMicrotask(() => body?.querySelector<HTMLElement>("input, textarea")?.focus());
      },
    ),
  );

  function setField(key: string, value: unknown): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  /** The spec's save-time rules; see the module note. */
  function withSaveRules(updates: ItemUpdates): ItemUpdates {
    const next = { ...updates };

    const fallbacks = SAVE_FALLBACKS[props.sectionId] ?? {};
    for (const [key, fallback] of Object.entries(fallbacks)) {
      if (asText(next[key]).trim() === "") next[key] = fallback;
    }

    if (hasLevel()) {
      // Clamp only — the description is never auto-written (owner decision:
      // proficiency wording is gone; free text stays the user's own).
      next.level = Math.min(MAX_LEVEL, Math.max(1, asLevel(next.level) || DEFAULT_LEVEL));
    }

    if (Array.isArray(next.customFields)) {
      next.customFields = asCustomFields(next.customFields).filter(
        (field) => field.name.trim() !== "" || field.value.trim() !== "",
      );
    }

    return next;
  }

  function save(): void {
    const next = withSaveRules(draft());
    if (isAdding()) {
      addItem(props.sectionId, { ...next, id: generateId(), visible: true });
    } else {
      updateItem(props.sectionId, props.index as number, next);
    }
    props.onOpenChange(false);
  }

  function Field(fieldProps: { spec: ItemFieldSpec }): JSX.Element {
    const spec = (): ItemFieldSpec => fieldProps.spec;
    const value = (): unknown => draft()[spec().key];

    return (
      <Switch>
        <Match when={spec().kind === "text" && spec().multiline !== true}>
          <Input
            label={spec().label}
            placeholder={spec().placeholder}
            value={asText(value())}
            onInput={(next) => setField(spec().key, next)}
          />
        </Match>

        <Match when={spec().kind === "text" && spec().multiline === true}>
          <TextArea
            label={spec().label}
            placeholder={spec().placeholder}
            rows={2}
            value={asText(value())}
            onInput={(next) => setField(spec().key, next)}
          />
        </Match>

        <Match when={spec().kind === "markdown"}>
          <MiniRichEditor
            label={spec().label}
            hint={spec().hint}
            value={asText(value())}
            onInput={(next) => setField(spec().key, next)}
          />
        </Match>

        <Match when={spec().kind === "keywords"}>
          <TagInput
            label={spec().label}
            hint={spec().hint}
            values={asKeywords(value())}
            onChange={(next) => setField(spec().key, next)}
          />
        </Match>

        <Match when={spec().kind === "extraFields"}>
          <ExtraFieldsEditor
            // Seeded normalised above; passing it through untouched keeps row
            // identity stable across keystrokes.
            fields={(value() as CustomField[] | undefined) ?? []}
            onChange={(next) => setField(spec().key, next)}
          />
        </Match>

        <Match when={spec().kind === "level"}>
          <div class="flex flex-col gap-1.5">
            <span
              class="font-mono text-xs uppercase tracking-wider text-stone"
              id={`doc-item-level-${spec().key}`}
            >
              {spec().label}
            </span>
            {/* Five equal-width cards, number over label (spec §1.13). One
                roving tab stop; arrows move the selection (radiogroup
                pattern). */}
            <div
              class="grid grid-cols-5 gap-2"
              role="radiogroup"
              aria-labelledby={`doc-item-level-${spec().key}`}
              onKeyDown={(event) => {
                const step =
                  event.key === "ArrowRight" || event.key === "ArrowDown"
                    ? 1
                    : event.key === "ArrowLeft" || event.key === "ArrowUp"
                      ? -1
                      : 0;
                if (step === 0) return;
                event.preventDefault();
                // With no selection the first arrow press selects level 1 —
                // the card holding the roving tab stop — not a preset jump.
                const current = asLevel(value()) || 1 - step;
                const next = Math.min(MAX_LEVEL, Math.max(1, current + step));
                setField(spec().key, next);
                const cards =
                  event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]');
                cards[next - 1]?.focus();
              }}
            >
              <For each={[...LEVELS]}>
                {(level) => {
                  const isSelected = (): boolean => asLevel(value()) === level;
                  return (
                    <button
                      type="button"
                      role="radio"
                      aria-checked={isSelected()}
                      aria-label={`Level ${level} of 5`}
                      tabindex={isSelected() || (asLevel(value()) === 0 && level === 1) ? 0 : -1}
                      class="flex flex-col items-center gap-0.5 rounded-lg border px-1 py-2"
                      classList={{
                        "border-accent bg-accent/10 text-ink": isSelected(),
                        "border-border text-stone hover:border-accent/50": !isSelected(),
                      }}
                      onClick={() => setField(spec().key, level)}
                    >
                      <span class="font-body text-base font-semibold">{level}</span>
                    </button>
                  );
                }}
              </For>
            </div>
          </div>
        </Match>

        <Match when={spec().kind === "url"}>
          <div class="grid grid-cols-2 gap-4">
            <Input
              label={`${spec().label} label`}
              value={asUrl(value()).label}
              onInput={(next) => setField(spec().key, { ...asUrl(value()), label: next })}
            />
            <Input
              label={`${spec().label} URL`}
              type="url"
              placeholder="https://"
              value={asUrl(value()).href}
              onInput={(next) => setField(spec().key, { ...asUrl(value()), href: next })}
            />
          </div>
        </Match>
      </Switch>
    );
  }

  return (
    <Modal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={`${isAdding() ? "Add" : "Edit"} · ${props.sectionTitle}`}
      size="2xl"
    >
      <Show
        when={fields().length > 0}
        fallback={<p class="text-sm text-stone">Nothing to edit.</p>}
      >
        <div ref={(element) => (body = element)} class="flex flex-col gap-4">
          <For each={fieldRows(fields())}>
            {(row) => (
              <Show when={row.length === 2} fallback={<Field spec={row[0]} />}>
                <div class="grid grid-cols-2 gap-4">
                  <Field spec={row[0]} />
                  <Field spec={row[1]} />
                </div>
              </Show>
            )}
          </For>
        </div>
      </Show>

      <div class="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={() => props.onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={save}>{isAdding() ? "Add" : "Save"}</Button>
      </div>
    </Modal>
  );
}
