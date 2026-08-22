/**
 * Page settings for the document editor's top bar.
 *
 * A modal matching ThemeDialog: one document-settings surface for the page
 * inset. Full-bleed templates ignore `metadata.page.margin` in Typst (#859),
 * so the control disables with an explanation rather than pretending to work.
 * Every write routes through `docEdits` (decision 4).
 */

import { Show, type JSX } from "solid-js";
import { Modal } from "../ui";
import { updatePageMargin } from "./docEdits";
import type { TemplateLayout } from "../../lib/docLayout";
import type { ResumeData } from "../../wasm/types";

export interface PageDialogProps {
  resume: ResumeData;
  templateLayout: TemplateLayout;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MARGIN_INPUT_ID = "page-margin";
const MARGIN_REASON_ID = "page-margin-full-bleed-reason";
const MARGIN_HINT_ID = "page-margin-hint";

const FULL_BLEED_REASON = "This template is full-bleed and does not use page margins";

export function PageDialog(props: PageDialogProps): JSX.Element {
  return (
    <Modal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title="Page"
      description="Page settings for the rendered document — the PDF uses them too."
      size="md"
    >
      <div class="flex flex-col gap-6" data-testid="page-dialog">
        <PageMarginField
          margin={props.resume.metadata.page.margin}
          enabled={props.templateLayout.supportsMargins}
        />
      </div>
    </Modal>
  );
}

function PageMarginField(props: { margin: number; enabled: boolean }): JSX.Element {
  const describedBy = (): string => (props.enabled ? MARGIN_HINT_ID : MARGIN_REASON_ID);

  function commit(raw: string): void {
    if (!props.enabled) return;
    const trimmed = raw.trim();
    // Empty is an in-progress edit (`Number("") === 0` would persist a
    // zero margin and mark the resume dirty while the user is still typing).
    if (trimmed === "") return;
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return;
    updatePageMargin(parsed);
  }

  return (
    <section aria-label="Page margins">
      <h3 class="mb-2 font-mono text-xs uppercase tracking-wider text-stone">Margins</h3>
      <div class="flex flex-col gap-1.5">
        <label
          for={MARGIN_INPUT_ID}
          class="block font-mono text-xs uppercase tracking-wider text-stone"
        >
          Page margin
        </label>
        <div class="flex items-center gap-2">
          {/*
            `aria-disabled` rather than native `disabled`: a disabled control
            leaves the accessibility tree, so the reason would never be read.
            Keep it focusable and block writes in the handler (#859 / #352).
          */}
          <input
            id={MARGIN_INPUT_ID}
            type="number"
            min={0}
            max={200}
            step={1}
            value={props.margin}
            inputMode="numeric"
            aria-disabled={!props.enabled || undefined}
            aria-describedby={describedBy()}
            readOnly={!props.enabled}
            data-testid="page-margin-input"
            class="focus-ring w-24 rounded-lg border border-border bg-surface px-2 py-1.5
              font-mono text-sm text-ink
              aria-disabled:cursor-not-allowed"
            onInput={(event) => {
              if (!props.enabled) {
                event.currentTarget.value = String(props.margin);
                return;
              }
              commit(event.currentTarget.value);
            }}
          />
          <span class="font-mono text-xs text-stone" aria-hidden="true">
            pt
          </span>
        </div>
        <Show
          when={props.enabled}
          fallback={
            <p id={MARGIN_REASON_ID} class="text-sm text-stone">
              {FULL_BLEED_REASON}
            </p>
          }
        >
          <p id={MARGIN_HINT_ID} class="text-sm text-stone">
            Inset around the page, in typographic points.
          </p>
        </Show>
      </div>
    </section>
  );
}
