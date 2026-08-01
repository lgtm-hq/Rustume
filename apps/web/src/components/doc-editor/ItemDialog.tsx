/**
 * Add or edit one item of a section.
 *
 * The form is generated from the section's descriptors in `itemFields.ts`, so
 * every section type — fixed or custom — gets every one of its fields, including
 * the ones the sheet has no room to draw inline. A blank item comes from
 * `emptyItemFor()`, the same seed the layout model defines.
 *
 * The dialog holds a draft and commits **once**, on save: one item edit is one
 * store action and therefore one undo entry.
 */

import { For, Match, Show, Switch, createEffect, createSignal, on, type JSX } from "solid-js";
import { Button, Input, Modal, TextArea } from "../ui";
import { emptyItemFor } from "../../lib/docLayout";
import { addItem, updateItem, type ItemUpdates } from "./docEdits";
import { itemFieldsFor, itemNoun, type ItemFieldSpec } from "./itemFields";
import { generateId } from "../../wasm/types";
import type { Url } from "../../wasm/types";

/** Highest level a skill or language can carry. Mirrors `clamp-level`. */
const MAX_LEVEL = 5;

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

function asUrl(value: unknown): Url {
  const url = value as Partial<Url> | undefined;
  return { label: url?.label ?? "", href: url?.href ?? "" };
}

function parseKeywords(raw: string): string[] {
  return raw
    .split(",")
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword !== "");
}

export function ItemDialog(props: ItemDialogProps): JSX.Element {
  const [draft, setDraft] = createSignal<ItemUpdates>({});
  // `Input` is controlled, so rendering the parsed list back would erase the
  // separator the moment it is typed — "rust," reads back as "rust" and a
  // second keyword can never be started. Keep the raw text the user typed and
  // parse alongside it; the draft still holds the array the store wants.
  const [keywordText, setKeywordText] = createSignal<Record<string, string>>({});

  const fields = () => itemFieldsFor(props.sectionId);
  const isAdding = () => props.index === undefined;
  const noun = () => itemNoun(props.sectionTitle);

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
        setDraft({ ...(seed ?? {}) });
        setKeywordText({});
      },
    ),
  );

  function setField(key: string, value: unknown): void {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function save(): void {
    const next = draft();
    if (isAdding()) {
      addItem(props.sectionId, { ...next, id: generateId(), visible: true });
    } else {
      updateItem(props.sectionId, props.index as number, next);
    }
    props.onOpenChange(false);
  }

  function Field(fieldProps: { spec: ItemFieldSpec }): JSX.Element {
    const spec = () => fieldProps.spec;
    const value = () => draft()[spec().key];

    return (
      <Switch>
        <Match when={spec().kind === "text"}>
          <Input
            label={spec().label}
            placeholder={spec().placeholder}
            value={asText(value())}
            onInput={(next) => setField(spec().key, next)}
          />
        </Match>

        <Match when={spec().kind === "markdown"}>
          <TextArea
            label={spec().label}
            description="Markdown — **bold**, *italic*, [label](href), - item, 1. item"
            value={asText(value())}
            onInput={(next) => setField(spec().key, next)}
          />
        </Match>

        <Match when={spec().kind === "keywords"}>
          <Input
            label={spec().label}
            description="Comma separated"
            value={keywordText()[spec().key] ?? asKeywords(value()).join(", ")}
            onInput={(next) => {
              setKeywordText((current) => ({ ...current, [spec().key]: next }));
              setField(spec().key, parseKeywords(next));
            }}
          />
        </Match>

        <Match when={spec().kind === "level"}>
          <div class="flex flex-col gap-1.5">
            <label
              class="font-mono text-xs uppercase tracking-wider text-stone"
              for={`doc-item-level-${spec().key}`}
            >
              {spec().label} ({asLevel(value())}/{MAX_LEVEL})
            </label>
            <input
              id={`doc-item-level-${spec().key}`}
              type="range"
              min="0"
              max={MAX_LEVEL}
              step="1"
              value={asLevel(value())}
              onInput={(event) => setField(spec().key, parseInt(event.currentTarget.value, 10))}
              class="w-full accent-accent"
            />
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
      title={isAdding() ? `Add ${noun()}` : `Edit ${noun()}`}
      size="lg"
    >
      <Show
        when={fields().length > 0}
        fallback={<p class="text-sm text-stone">Nothing to edit.</p>}
      >
        <div class="flex flex-col gap-4">
          <For each={fields()}>{(spec) => <Field spec={spec} />}</For>
        </div>
      </Show>

      <div class="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={() => props.onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={save}>{isAdding() ? `Add ${noun()}` : "Save"}</Button>
      </div>
    </Modal>
  );
}
