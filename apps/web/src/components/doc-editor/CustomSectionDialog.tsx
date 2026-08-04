/**
 * Create a custom section, or rename an existing one.
 *
 * Creating goes through `addCustomSection`, which also places the new section
 * in `metadata.layout` — that placement is part of the same store action, so
 * creating a section stays one undo entry.
 */

import { createEffect, createSignal, type JSX } from "solid-js";
import { Button, Input, Modal } from "../ui";
import { addCustomSection, renameSection } from "./docEdits";

export interface CustomSectionDialogProps {
  open: boolean;
  /** Id of the section being renamed. Absent when creating one. */
  sectionId?: string;
  /** Current name, when renaming. */
  name?: string;
  onOpenChange: (open: boolean) => void;
}

export function CustomSectionDialog(props: CustomSectionDialogProps): JSX.Element {
  const [draft, setDraft] = createSignal("");

  const isCreating = () => props.sectionId === undefined;

  createEffect(() => {
    if (!props.open) return;
    setDraft(props.name ?? "");
  });

  function save(): void {
    const name = draft().trim();
    if (name === "") return;
    if (isCreating()) {
      addCustomSection(name);
    } else {
      renameSection(props.sectionId as string, name);
    }
    props.onOpenChange(false);
  }

  return (
    <Modal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={isCreating() ? "Add section" : "Rename section"}
      description={
        isCreating()
          ? "Placed in the side column by default. Toggle visibility anytime in Sections."
          : undefined
      }
    >
      <Input
        label="Section title"
        placeholder="e.g. AI Tooling"
        value={draft()}
        onInput={setDraft}
      />

      <div class="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={() => props.onOpenChange(false)}>
          Cancel
        </Button>
        <Button disabled={draft().trim() === ""} onClick={save}>
          {isCreating() ? "Add section" : "Rename"}
        </Button>
      </div>
    </Modal>
  );
}
