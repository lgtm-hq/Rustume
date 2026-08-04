/**
 * The sections panel: chrome around the sheet for managing what the document
 * carries.
 *
 * Visibility toggles cover every fixed and custom section — including sections
 * currently hidden and therefore absent from the sheet, which is what makes a
 * hidden section recoverable. Custom sections can be added (through the same
 * dialog the sheet uses, so placement stays one undo entry) and removed. Notes
 * are private scratch text that never renders to the PDF, so they are a plain
 * text field — no rich editor, no markdown toolbar.
 *
 * Every mutation routes through `docEdits` (decision 4).
 */

import { For, Show, createSignal, type JSX } from "solid-js";
import { Button, Drawer, Switch, TextArea } from "../ui";
import { FIXED_SECTION_IDS, sectionTitle, sectionVisible } from "../../lib/docLayout";
import { CustomSectionDialog } from "./CustomSectionDialog";
import { removeSection, toggleSection, updateNotes } from "./docEdits";
import type { ResumeData } from "../../wasm/types";

export interface SectionsPanelProps {
  resume: ResumeData;
  /**
   * Controlled open state, so the sheet's Add-section blocks can open the
   * panel (#794). Leave both unset for the self-contained top-bar behaviour.
   */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SectionsPanel(props: SectionsPanelProps): JSX.Element {
  const [internalOpen, setInternalOpen] = createSignal(false);
  const [adding, setAdding] = createSignal(false);

  const open = (): boolean => props.open ?? internalOpen();
  const setOpen = (next: boolean): void => {
    if (props.onOpenChange) {
      props.onOpenChange(next);
      return;
    }
    setInternalOpen(next);
  };

  const customIds = (): string[] => Object.keys(props.resume.sections.custom ?? {});

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        Sections
      </Button>

      <Drawer
        open={open()}
        onOpenChange={setOpen}
        title="Sections"
        description="Show, hide and manage the document's sections."
        side="right"
      >
        <div class="flex flex-col gap-6" data-testid="sections-panel">
          <section aria-label="Section visibility">
            <h3 class="mb-2 font-mono text-xs uppercase tracking-wider text-stone">Sections</h3>
            <ul class="flex flex-col gap-2">
              <For each={FIXED_SECTION_IDS}>
                {(sectionId) => (
                  <li>
                    <Switch
                      label={sectionTitle(props.resume, sectionId)}
                      checked={sectionVisible(props.resume, sectionId)}
                      onChange={() => toggleSection(sectionId)}
                    />
                  </li>
                )}
              </For>
            </ul>
          </section>

          <section aria-label="Custom sections">
            <h3 class="mb-2 font-mono text-xs uppercase tracking-wider text-stone">
              Custom sections
            </h3>
            <Show
              when={customIds().length > 0}
              fallback={<p class="text-sm text-stone">No custom sections yet.</p>}
            >
              <ul class="flex flex-col gap-2">
                <For each={customIds()}>
                  {(sectionId) => (
                    <li class="flex items-center gap-2">
                      <Switch
                        class="flex-1"
                        label={sectionTitle(props.resume, sectionId)}
                        checked={sectionVisible(props.resume, sectionId)}
                        onChange={() => toggleSection(sectionId)}
                      />
                      <button
                        type="button"
                        class="focus-ring rounded-lg p-1.5 text-stone transition-colors
                          hover:bg-surface hover:text-red-600"
                        aria-label={`Delete ${sectionTitle(props.resume, sectionId)} section`}
                        onClick={() => removeSection(sectionId)}
                      >
                        <svg
                          class="h-4 w-4"
                          aria-hidden="true"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0
                              01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0
                              00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
            <Button variant="secondary" size="sm" class="mt-3" onClick={() => setAdding(true)}>
              Add section
            </Button>
          </section>

          <section aria-label="Notes">
            <TextArea
              label="Notes"
              description="Private scratch text. Never rendered to the PDF."
              placeholder="Interview prep, tailoring ideas, links..."
              rows={6}
              value={props.resume.metadata.notes}
              onInput={updateNotes}
            />
          </section>
        </div>
      </Drawer>

      <CustomSectionDialog open={adding()} onOpenChange={setAdding} />
    </>
  );
}
