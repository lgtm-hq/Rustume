/**
 * The document sheet: A4 page frames, the template's column grid, the header
 * region, and an editable view of every placed section.
 *
 * The page/column structure comes straight from `renderPages()` and
 * `layoutColumns()` — this component draws that model and nothing else. Editing
 * is click-to-edit in place (`InlineText`, `InlineMarkdown`) plus the item,
 * section and photo dialogs; every one of them writes through a `resumeStore`
 * action, never `setStore` (see `docEdits.ts`). Structural editing — moving or
 * reordering sections — is #729 and is not here.
 *
 * Overflow is *reported*, never absorbed. A column that cannot fit its sections
 * is clipped and flagged; moving a section to another page is a `metadata.layout`
 * decision the user makes elsewhere, so nothing here reflows.
 */

import { For, Show, createEffect, createMemo, createSignal, onCleanup, type JSX } from "solid-js";
import { CustomSectionDialog } from "./CustomSectionDialog";
import { DocHeader } from "./DocHeader";
import { DocSection } from "./DocSection";
import {
  layoutColumns,
  renderPages,
  type LayoutColumn,
  type TemplateLayout,
} from "../../lib/docLayout";
import type { ResumeData } from "../../wasm/types";
import "./docSheet.css";

/** A page's columns in the order the template paints them, left to right. */
function visualColumns(columns: LayoutColumn[]): LayoutColumn[] {
  return [...columns].sort((a, b) => a.order - b.order);
}

/**
 * Where the name block and the contact details are drawn.
 *
 * `headerStyle: "sidebar"` is the only style that puts the name block inside a
 * column; every other style draws it above the columns. Contact details follow
 * `contactIn` independently, so the two can land in different regions.
 */
type HeaderRegion = "top" | "sidebar";

function identityRegion(layout: TemplateLayout, hasSidebar: boolean): HeaderRegion {
  return layout.headerStyle === "sidebar" && hasSidebar ? "sidebar" : "top";
}

function contactRegion(layout: TemplateLayout, hasSidebar: boolean): HeaderRegion {
  return layout.contactIn === "sidebar" && hasSidebar ? "sidebar" : "top";
}

/** Profile links for the header, as `Network — username`. */
function profileLinks(resume: ResumeData): { id: string; label: string }[] {
  return (resume.sections.profiles?.items ?? [])
    .filter((item) => item.visible)
    .map((item) => ({
      id: item.id,
      label: [item.network, item.username].filter((part) => part.trim() !== "").join(" — "),
    }))
    .filter((link) => link.label !== "");
}

export interface DocSheetProps {
  resume: ResumeData;
  /** Structural layout metadata for the resume's template. */
  templateLayout: TemplateLayout;
  /** Reports the 0-based indices of pages whose content is clipped. */
  onOverflowChange?: (pages: number[]) => void;
  /** Reports the number of page frames drawn. */
  onPageCountChange?: (count: number) => void;
}

export function DocSheet(props: DocSheetProps): JSX.Element {
  const pages = createMemo(() => {
    const rendered = renderPages(props.resume, props.templateLayout);
    // An empty resume still gets one frame, so the sheet reads as a blank page
    // rather than as a failure to load.
    return rendered.length > 0 ? rendered : [[[]]];
  });

  const links = createMemo(() => {
    // `profiles` renders as a section wherever the layout places it; the header
    // only carries the links when no page does.
    const placed = pages().some((page) => page.some((column) => column.includes("profiles")));
    return placed ? [] : profileLinks(props.resume);
  });

  const theme = () => props.resume.metadata.theme;

  const [overflowing, setOverflowing] = createSignal<number[]>([]);
  const [isSectionDialogOpen, setIsSectionDialogOpen] = createSignal(false);
  let root: HTMLDivElement | undefined;

  /**
   * Flag every page holding a clipped column.
   *
   * The live DOM is the source of truth rather than a registry of refs: columns
   * come and go with the layout, and a stale ref would keep reporting overflow
   * for a page that no longer exists.
   */
  function measure(): void {
    if (!root) return;
    const clipped = new Set<number>();
    for (const element of root.querySelectorAll<HTMLElement>(".doc-sheet__column")) {
      // A sub-pixel difference is rounding, not overflow.
      if (element.scrollHeight - element.clientHeight > 1) {
        clipped.add(Number(element.dataset.pageIndex));
      }
    }
    const next = [...clipped].sort((a, b) => a - b);
    setOverflowing((previous) =>
      previous.length === next.length && previous.every((value, index) => value === next[index])
        ? previous
        : next,
    );
  }

  // A wider or narrower pane changes the page height, and with it what fits.
  const observer =
    typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => measure());
  onCleanup(() => observer?.disconnect());

  createEffect(() => {
    // Re-measure whenever the drawn structure changes; the DOM for the new
    // structure only exists once the current render pass has flushed.
    pages();
    queueMicrotask(() => measure());
  });

  createEffect(() => props.onOverflowChange?.(overflowing()));
  createEffect(() => props.onPageCountChange?.(pages().length));

  return (
    <div
      ref={(element) => {
        root = element;
        observer?.observe(element);
      }}
      class="doc-sheet"
      data-testid="doc-sheet"
      style={{
        "--doc-sheet-bg": theme().background,
        "--doc-sheet-text": theme().text,
        "--doc-sheet-accent": theme().primary,
      }}
    >
      <For each={pages()}>
        {(page, pageIndex) => {
          const geometry = createMemo(() => layoutColumns(page, props.templateLayout));
          const hasSidebar = () => geometry().some((column) => column.role === "sidebar");
          const isFirst = () => pageIndex() === 0;
          const identityIn = () => identityRegion(props.templateLayout, hasSidebar());
          const contactIn = () => contactRegion(props.templateLayout, hasSidebar());

          return (
            <article
              class="doc-sheet__page"
              data-testid="doc-sheet-page"
              aria-label={`Page ${pageIndex() + 1} of ${pages().length}`}
              data-overflowing={overflowing().includes(pageIndex()) ? "true" : undefined}
            >
              <Show when={isFirst() && identityIn() === "top"}>
                <DocHeader
                  basics={props.resume.basics}
                  headerStyle={props.templateLayout.headerStyle}
                  showContact={contactIn() === "top"}
                  profileLinks={links()}
                />
              </Show>
              <Show when={isFirst() && identityIn() !== "top" && contactIn() === "top"}>
                <DocHeader
                  basics={props.resume.basics}
                  headerStyle={props.templateLayout.headerStyle}
                  showIdentity={false}
                  showContact
                  profileLinks={links()}
                />
              </Show>

              <div class="doc-sheet__columns">
                <For each={visualColumns(geometry())}>
                  {(column) => (
                    <div
                      class="doc-sheet__column"
                      classList={{ "doc-sheet__column--sidebar": column.role === "sidebar" }}
                      data-testid="doc-sheet-column"
                      data-column-index={column.index}
                      data-column-role={column.role}
                      data-page-index={pageIndex()}
                      style={{ "flex-basis": `${column.width * 100}%` }}
                    >
                      <Show
                        when={isFirst() && column.role === "sidebar" && identityIn() === "sidebar"}
                      >
                        <DocHeader
                          basics={props.resume.basics}
                          headerStyle="sidebar"
                          showContact={contactIn() === "sidebar"}
                          profileLinks={links()}
                        />
                      </Show>
                      <Show
                        when={
                          isFirst() &&
                          column.role === "sidebar" &&
                          identityIn() !== "sidebar" &&
                          contactIn() === "sidebar"
                        }
                      >
                        <DocHeader
                          basics={props.resume.basics}
                          headerStyle="sidebar"
                          showIdentity={false}
                          showContact
                          profileLinks={links()}
                        />
                      </Show>

                      <For each={page[column.index] ?? []}>
                        {(sectionId) => <DocSection resume={props.resume} sectionId={sectionId} />}
                      </For>
                    </div>
                  )}
                </For>
              </div>
            </article>
          );
        }}
      </For>

      {/* Sheet-level chrome: creating a section is not part of any one page. */}
      <div class="doc-sheet__actions">
        <button
          type="button"
          class="doc-sheet__action"
          data-testid="doc-sheet-add-section"
          onClick={() => setIsSectionDialogOpen(true)}
        >
          Add section
        </button>
      </div>

      <CustomSectionDialog open={isSectionDialogOpen()} onOpenChange={setIsSectionDialogOpen} />
    </div>
  );
}
