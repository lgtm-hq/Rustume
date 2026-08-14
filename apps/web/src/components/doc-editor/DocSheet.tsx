/**
 * The document sheet engine (#794 / #813): content-sized sheets composed from
 * the template's layout metadata.
 *
 * Sheets no longer clip to fixed A4 frames — each `.doc-sheet__page` sizes to
 * its content, and A4 boundaries are communicated by dashed overflow guides at
 * 1122px intervals plus the floating page-count pill (spec §3.1, §3.5).
 * Explicit `metadata.layout` pages — and `metadata.itemBreaks` continuation
 * slices (#796, spec §3.3) — draw as separate sheets divided by page-break
 * rules with "Page N" labels and (edit mode) a "Remove page break" action
 * that prefers clearing the item-break shared across the boundary and falls
 * back to merging the raw pages (spec §3.4). Explicit "insert page break"
 * affordances live in the section pencil menu and the entry action pill
 * (owner decision, umbrella Q6).
 *
 * On canvases narrower than the 860px design width the whole sheet stack is
 * painted as a faithful miniature via `transform: scale(k)` (#813) — layout
 * never reflows. Hit areas inverse-scale (`--sheet-k`) so SC 2.5.8 holds for
 * every interactive k; below the usability floor the sheet forces Done.
 *
 * The page body is composed per the template's `layoutMode` (spec §1.4,
 * §3.6): `SingleColumn`, `MainColumn` + `SideColumn` grids, or the
 * header-split banner over two columns. The template layer only picks the
 * compositor and the palette; all behaviour lives in the shared components.
 *
 * Editing chrome — the whole-surface HTML5 drag channels (spec §2.4–§2.5,
 * provided through `SheetDndContext`), drop resolution, announcements, and
 * the end-of-column Add-section blocks — is owned here; every mutation writes
 * through a `resumeStore` action (see `docEdits.ts`).
 */

import { For, Show, createEffect, createMemo, createSignal, onCleanup, type JSX } from "solid-js";
import { CustomSectionDialog } from "./CustomSectionDialog";
import { ContactBlock, NameHeader, SheetAvatar } from "./DocHeader";
import { DocSection } from "./DocSection";
import {
  applyItemBreaks,
  applyLayout,
  applyPagination,
  reorderItem,
  updateSidebarRatio,
} from "./docEdits";
import { PlusIcon } from "./icons";
import { SheetModeContext, type SheetMode } from "./sheetMode";
import type { InsertBreakAction } from "./SortableEntry";
import {
  SECTION_DRAG_MIME,
  SheetDndContext,
  readDragPayload,
  type EntryDragPayload,
  type SectionDropTarget,
  type SheetDndValue,
} from "./sheetDnd";
import {
  drawnSectionPosition,
  entryDisplayLabel,
  entryStep,
  moveSectionInLayout,
  moveSectionStep,
  resolveEntryDropIndex,
  resolveSectionDropOnColumn,
  sectionItemList,
  type MoveStep,
} from "../../lib/docDnd";
import {
  PAGE_HEIGHT_PX,
  PAGE_WIDTH_PX,
  SHEET_CONTENT_WIDTH_PX,
  SHEET_PX_PER_PT,
  docFontStack,
  findSectionPlacement,
  layoutColumns,
  layoutPages,
  sectionTitle,
  type TemplateLayout,
} from "../../lib/docLayout";
import { SHEET_SCALE_CSS_VAR, sheetScaleForWidth } from "../../lib/sheetScale";
import {
  ITEM_BREAK_TEMPLATE_DISABLED_REASON,
  editorSheetPages,
  expandItemBreakPages,
  itemBreaksWithBreakBefore,
  itemBreaksWithoutSection,
  renderSheetPages,
  resolvePageBreakRemoval,
  sectionSliceAt,
  sectionSupportsItemBreaks,
  splitLayoutBeforeSection,
  templateSupportsItemBreaks,
} from "../../lib/docPagination";
import { reorderAnnouncement } from "../../lib/reorderAnnounce";
import { LiveRegion, announceLive } from "../ui/LiveRegion";
import type { ResumeData } from "../../wasm/types";
import "./docSheet.css";

/** Sidebar width bounds for the resize handle (spec §3.2). */
const SIDEBAR_MIN_PX = 160;
const SIDEBAR_MAX_PX = 360;
/** Fallback sidebar width when the template declares none: a third of A4. */
const SIDEBAR_DEFAULT_PX = 287;
/** Keyboard resize step for the handle. */
const SIDEBAR_KEY_STEP_PX = 8;

/** A short human name for an entry, for announcements. */
function entryLabel(resume: ResumeData, sectionId: string, itemId: string): string {
  const item = sectionItemList(resume, sectionId).find((entry) => entry.id === itemId);
  return entryDisplayLabel(item, "Item");
}

function clampSidebarWidth(px: number): number {
  return Math.min(SIDEBAR_MAX_PX, Math.max(SIDEBAR_MIN_PX, Math.round(px)));
}

/**
 * Dashed A4 cut marks across one sheet at page-height intervals, measured
 * from the sheet's own content height so the marks and the page-count pill
 * always agree (spec §3.3).
 */
function SheetOverflowGuides(props: { sheet: () => HTMLElement | undefined }): JSX.Element {
  const [lines, setLines] = createSignal<number[]>([]);

  createEffect(() => {
    const element = props.sheet();
    if (!element) return;
    const measure = (): void => {
      let height = 0;
      for (const child of element.children) {
        if (child.classList.contains("doc-sheet__page-guide")) continue;
        const box = child as HTMLElement;
        height = Math.max(height, box.offsetTop + box.offsetHeight);
      }
      if (height <= 0) height = element.scrollHeight;
      const count = height <= PAGE_HEIGHT_PX + 20 ? 0 : Math.ceil(height / PAGE_HEIGHT_PX) - 1;
      setLines(
        Array.from({ length: Math.max(0, count) }, (_, index) => (index + 1) * PAGE_HEIGHT_PX),
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    onCleanup(() => observer.disconnect());
  });

  return (
    <For each={lines()}>
      {(top) => (
        <div class="doc-sheet__page-guide" style={{ top: `${top}px` }} aria-hidden="true" />
      )}
    </For>
  );
}

/** The floating measured page count (spec §3.5). */
function PageCountPill(props: { count: number }): JSX.Element {
  const count = (): number => Math.max(1, props.count);
  return (
    <div class="doc-sheet__page-pill" data-testid="doc-sheet-page-count" aria-live="polite">
      <strong>{count()}</strong>
      <span>{count() === 1 ? "page" : "pages"}</span>
    </div>
  );
}

export interface DocSheetProps {
  resume: ResumeData;
  /** Structural layout metadata for the resume's template. */
  templateLayout: TemplateLayout;
  /**
   * Edit draws the in-place editable document; Done draws the clean rendered
   * document — no chrome, no placeholders, hidden and empty sections dropped
   * exactly as the PDF drops them. Defaults to Edit.
   *
   * When the miniature scale falls below the usability floor (#813), the
   * sheet forces Done regardless of this prop. SC 2.5.8 on this surface is
   * met by inverse-scaled hit areas, not by the floor.
   */
  mode?: SheetMode;
  /**
   * Opens the Sections panel (the Add-section blocks' target). Without it the
   * blocks fall back to the custom-section dialog, so a sheet rendered outside
   * the editor page keeps a working affordance.
   */
  onOpenSections?: () => void;
  /**
   * Fires whenever the live miniature scale changes, so the surrounding
   * chrome (mode toggle) can disable Edit below the interaction floor.
   */
  onScaleChange?: (info: { scale: number; interactive: boolean }) => void;
}

export function DocSheet(props: DocSheetProps): JSX.Element {
  // Miniature scale (#813): measure the canvas, keep layout at 860px, paint
  // with transform: scale(k). Below the usability floor the sheet is read-only.
  const [availableWidth, setAvailableWidth] = createSignal(PAGE_WIDTH_PX);
  const [contentHeight, setContentHeight] = createSignal(0);

  const scaleInfo = createMemo(() => sheetScaleForWidth(availableWidth()));
  const scale = (): number => scaleInfo().scale;
  const scaleInteractive = (): boolean => scaleInfo().interactive;

  const mode = (): SheetMode => {
    const requested = props.mode ?? "edit";
    return scaleInteractive() ? requested : "done";
  };
  const isEditable = (): boolean => mode() === "edit";

  createEffect(() => {
    props.onScaleChange?.({ scale: scale(), interactive: scaleInteractive() });
  });

  const widthObserver =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver((entries) => {
          const entry = entries[0];
          if (!entry) return;
          setAvailableWidth(entry.contentRect.width);
        });
  const heightObserver =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver((entries) => {
          const entry = entries[0];
          if (!entry) return;
          // offsetHeight of the transform child (= design-space height).
          const target = entry.target as HTMLElement;
          setContentHeight(target.offsetHeight);
        });
  onCleanup(() => {
    widthObserver?.disconnect();
    heightObserver?.disconnect();
  });

  // The raw layout the drops address, and the drawn view of it: expanded so
  // item-break continuations occupy their own sheets (spec §3.3). Drawn page
  // indices can exceed the raw page count; drop targets therefore address a
  // card's *raw* placement, and end-of-column drops auto-create the missing
  // raw pages.
  const layout = createMemo(() => layoutPages(props.resume, props.templateLayout));
  const pages = createMemo<string[][][]>(() => {
    const rendered = isEditable()
      ? editorSheetPages(props.resume, props.templateLayout)
      : renderSheetPages(props.resume, props.templateLayout);
    // An empty resume still gets one sheet, so the surface reads as a blank
    // page rather than as a failure to load.
    return rendered.length > 0 ? rendered : [[[]]];
  });
  // One expansion per render for every card's slice lookup to share.
  const expandedPages = createMemo(() =>
    expandItemBreakPages(props.resume, props.templateLayout, isEditable()),
  );

  const theme = (): ResumeData["metadata"]["theme"] => props.resume.metadata.theme;
  const layoutMode = (): TemplateLayout["layoutMode"] => props.templateLayout.layoutMode;
  const headerStyle = (): TemplateLayout["headerStyle"] => props.templateLayout.headerStyle;
  const contactIn = (): TemplateLayout["contactIn"] => props.templateLayout.contactIn;
  const chrome = (): TemplateLayout => props.templateLayout;
  /** Sheet face follows template chrome (`fontBody`), not the Typst inheritance map. */
  const docFont = createMemo(() => docFontStack(chrome().fontBody));

  const [focusedSection, setFocusedSection] = createSignal<string | null>(null);
  const [isSectionDialogOpen, setIsSectionDialogOpen] = createSignal(false);
  const [entryDrag, setEntryDrag] = createSignal<EntryDragPayload | null>(null);
  const [entryDropAt, setEntryDropAt] = createSignal<{ sectionId: string; index: number } | null>(
    null,
  );
  const [sectionDrag, setSectionDrag] = createSignal<string | null>(null);
  const [sectionDropAt, setSectionDropAt] = createSignal<SectionDropTarget | null>(null);
  const [announcement, setAnnouncement] = createSignal("");
  const [measuredPages, setMeasuredPages] = createSignal(1);
  // Live width while a resize drag is in flight; `null` between gestures.
  const [dragSidebarWidth, setDragSidebarWidth] = createSignal<number | null>(null);
  let root: HTMLDivElement | undefined;

  function announce(message: string): void {
    announceLive(setAnnouncement, message);
  }

  /**
   * The sidebar width in sheet pixels. The sidebar split is a **document
   * property** (owner decision, spec §4.2): `metadata.page.sidebarRatio`
   * overrides the template's declared width, so a resize follows the document
   * to every device and to the PDF. A drag in flight previews locally and
   * writes the ratio once, on release — one gesture, one undo entry.
   */
  const sidebarWidth = createMemo<number>(() => {
    const dragging = dragSidebarWidth();
    if (dragging !== null) return clampSidebarWidth(dragging);
    const ratio = props.resume.metadata.page.sidebarRatio;
    if (typeof ratio === "number" && Number.isFinite(ratio)) {
      return clampSidebarWidth(ratio * SHEET_CONTENT_WIDTH_PX);
    }
    const declared = props.templateLayout.sidebarWidth;
    if (declared === null || declared <= 0) return SIDEBAR_DEFAULT_PX;
    return clampSidebarWidth(declared * SHEET_PX_PER_PT);
  });

  /** Persist a settled width as the document's sidebar ratio. */
  function commitSidebarWidth(px: number): void {
    setDragSidebarWidth(null);
    const next = clampSidebarWidth(px);
    // A no-move release, or a keyboard step pinned at a clamp bound, must not
    // spend an undo entry on an unchanged width.
    if (next === sidebarWidth()) return;
    updateSidebarRatio(next / SHEET_CONTENT_WIDTH_PX);
  }

  /**
   * Measured page count (spec §3.5): per sheet, the taller of the two column
   * stacks; totals divided by the A4 height; never fewer than the number of
   * drawn sheets. No auto-fit and no orphan packing, deliberately.
   */
  function measurePages(): void {
    if (!root) return;
    const sheets = [...root.querySelectorAll<HTMLElement>(".doc-sheet__page")];
    if (sheets.length === 0) {
      setMeasuredPages(1);
      return;
    }
    const columnHeight = (column: HTMLElement | null): number => {
      if (!column) return 0;
      let height = 0;
      for (const child of column.children) {
        if (child.classList.contains("doc-sheet__page-guide")) continue;
        const box = child as HTMLElement;
        height = Math.max(height, box.offsetTop + box.offsetHeight);
      }
      return height > 0 ? height : column.scrollHeight;
    };
    let mainTotal = 0;
    let sideTotal = 0;
    for (const sheet of sheets) {
      mainTotal += columnHeight(
        sheet.querySelector<HTMLElement>(".doc-sheet__main, .doc-sheet__single"),
      );
      sideTotal += columnHeight(sheet.querySelector<HTMLElement>(".doc-sheet__side"));
      // Legacy >2-column pages: the tallest column stands for the page.
      const multiColumns = [...sheet.querySelectorAll<HTMLElement>(".doc-sheet__multi-col")].map(
        (column) => columnHeight(column),
      );
      if (multiColumns.length > 0) mainTotal += Math.max(...multiColumns);
    }
    const byHeight = Math.max(1, Math.ceil(Math.max(mainTotal, sideTotal) / PAGE_HEIGHT_PX));
    setMeasuredPages(Math.max(sheets.length, byHeight));
  }

  const observer =
    typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => measurePages());
  onCleanup(() => observer?.disconnect());

  createEffect(() => {
    // Re-measure whenever the drawn structure or geometry changes; the DOM for
    // the new structure only exists once the current render pass has flushed.
    void [pages(), mode(), sidebarWidth()];
    queueMicrotask(() => measurePages());
  });

  // The cards the sheet draws. Drawn-ness depends on visibility, never on
  // placement — so the set stays valid for a layout about to change.
  const drawnIds = createMemo(
    () => new Set(pages().flatMap((page) => page.flatMap((column) => column))),
  );
  const isDrawn = (id: string): boolean => drawnIds().has(id);

  /**
   * Announce where `sectionId` landed in `nextLayout`, in drawn-card terms:
   * what is spoken must match what is seen.
   */
  function announceSectionMove(sectionId: string, nextLayout: string[][][]): void {
    const position = drawnSectionPosition(nextLayout, sectionId, isDrawn);
    const title = sectionTitle(props.resume, sectionId);
    if (!position) {
      announce(`${title} section moved`);
      return;
    }
    const geometry = layoutColumns(nextLayout[position.page], props.templateLayout);
    const visualColumn =
      (geometry.find((column) => column.index === position.column)?.order ?? position.column) + 1;
    announce(
      `${title} section moved to position ${position.index + 1} of ${position.total} ` +
        `in column ${visualColumn} of page ${position.page + 1}`,
    );
  }

  const canMoveSection = (sectionId: string, step: MoveStep): boolean =>
    moveSectionStep(layout(), sectionId, step, isDrawn) !== null;

  /** One-step section move for the pencil menu (keyboard and pointer). */
  function moveSection(sectionId: string, step: MoveStep): void {
    const next = moveSectionStep(layout(), sectionId, step, isDrawn);
    if (!next) {
      announce(`${sectionTitle(props.resume, sectionId)} section did not move`);
      return;
    }
    applyLayout(next);
    announceSectionMove(sectionId, next);
  }

  /** The pencil menu's cross-column move: to the end of the other column. */
  function moveSectionToOtherColumn(sectionId: string): void {
    const placement = findSectionPlacement(layout(), sectionId);
    if (!placement) return;
    const other = placement.column === 0 ? 1 : 0;
    const next = resolveSectionDropOnColumn(layout(), sectionId, placement.page, other);
    if (!next) return;
    applyLayout(next);
    announceSectionMove(sectionId, next);
  }

  /** One-step entry move for the action pill. */
  function moveEntry(sectionId: string, itemId: string, step: MoveStep): void {
    if (step !== "up" && step !== "down") return;
    const label = entryLabel(props.resume, sectionId, itemId);
    const items = sectionItemList(props.resume, sectionId);
    const move = entryStep(items, itemId, step);
    if (!move) {
      announce(`${label} did not move`);
      return;
    }
    reorderItem(sectionId, move.fromIndex, move.toIndex);
    announce(reorderAnnouncement(label, move.toIndex, items.length));
  }

  /**
   * Resolve a finished item drop (spec §2.4): a reorder within the section's
   * own `items` array, one store action, no-op drops write nothing.
   */
  function onEntryDrop(payload: EntryDragPayload, dropIndex: number): void {
    const items = sectionItemList(props.resume, payload.sectionId);
    const resolved = resolveEntryDropIndex(items, payload.id, dropIndex);
    if (!resolved) return;
    reorderItem(payload.sectionId, resolved.fromIndex, resolved.toIndex);
    announce(
      reorderAnnouncement(
        entryLabel(props.resume, payload.sectionId, payload.id),
        resolved.toIndex,
        items.length,
      ),
    );
  }

  /**
   * Resolve a finished section drop (spec §2.5): exact insert at the target,
   * auto-created pages/columns, and the moved section's now-meaningless
   * mid-section breaks dropped in the same write.
   */
  function onSectionDrop(sectionId: string, target: SectionDropTarget): void {
    const next = moveSectionInLayout(layout(), sectionId, target);
    if (!next) return;
    const nextBreaks = itemBreaksWithoutSection(props.resume.metadata.itemBreaks, sectionId);
    if (nextBreaks === null) {
      applyLayout(next);
    } else {
      applyPagination(next, nextBreaks);
    }
    announceSectionMove(sectionId, next);
  }

  const dnd: SheetDndValue = {
    entryDrag,
    setEntryDrag,
    entryDropAt,
    setEntryDropAt,
    sectionDrag,
    setSectionDrag,
    sectionDropAt,
    setSectionDropAt,
    scale,
    sectionPlacement: (sectionId) => findSectionPlacement(layout(), sectionId),
    columnLength: (page, column) => layout()[page]?.[column]?.length ?? 0,
    onEntryDrop,
    onSectionDrop,
  };

  /**
   * Remove the rule between two drawn sheets (spec §3.4): prefer clearing the
   * item-break continuation shared across the boundary, else merge the raw
   * pages — either way one store write and one undo entry.
   */
  function removePageBreak(pageIndex: number): void {
    const removal = resolvePageBreakRemoval(props.resume, props.templateLayout, pageIndex);
    if (!removal) return;
    if (removal.kind === "itemBreaks") {
      applyItemBreaks(removal.itemBreaks);
    } else {
      applyLayout(removal.layout);
    }
    announce(`Page break removed; page ${pageIndex + 1} merged into page ${pageIndex}`);
  }

  /** Split the layout so `sectionId` starts a fresh page (spec §3.4). */
  function insertPageBreakBeforeSection(sectionId: string): void {
    const next = splitLayoutBeforeSection(layout(), sectionId);
    if (!next) return;
    applyLayout(next);
    announce(`Page break inserted before ${sectionTitle(props.resume, sectionId)}`);
  }

  const canInsertPageBreakBefore = (sectionId: string): boolean =>
    splitLayoutBeforeSection(layout(), sectionId) !== null;

  /**
   * The pill's "insert page break before this item" state (owner decisions):
   * `null` on sections that cannot carry breaks; greyed out with the
   * explanatory tooltip on templates whose layout cannot honor them; greyed
   * out with a short reason when the marker would be inert.
   */
  function itemBreakAction(sectionId: string, itemId: string): InsertBreakAction | null {
    if (!sectionSupportsItemBreaks(sectionId)) return null;
    if (!templateSupportsItemBreaks(props.templateLayout)) {
      return { onInsert: () => {}, disabledReason: ITEM_BREAK_TEMPLATE_DISABLED_REASON };
    }
    const nextBreaks = itemBreaksWithBreakBefore(
      props.resume,
      props.templateLayout,
      sectionId,
      itemId,
    );
    if (nextBreaks === null) {
      return { onInsert: () => {}, disabledReason: "This item already starts a page." };
    }
    return {
      onInsert: () => {
        applyItemBreaks(nextBreaks);
        announce(
          `Page break inserted before ${entryLabel(props.resume, sectionId, itemId)} ` +
            `in ${sectionTitle(props.resume, sectionId)}`,
        );
      },
      disabledReason: null,
    };
  }

  function openSections(): void {
    if (props.onOpenSections) {
      props.onOpenSections();
      return;
    }
    setIsSectionDialogOpen(true);
  }

  /** The sections of one column, then the end-of-column Add-section block. */
  function SectionList(listProps: {
    ids: string[];
    pageIndex: number;
    columnIndex: number;
    /** The cross-column move's target name, or `null` on single-column pages. */
    otherColumnLabel: string | null;
  }): JSX.Element {
    /**
     * The Add-section block is every column's end-of-column drop target
     * (spec §2.5): `MAX_SAFE_INTEGER` clamps to "after everything".
     */
    const endOfColumn = (): SectionDropTarget => ({
      page: listProps.pageIndex,
      column: listProps.columnIndex,
      index: Number.MAX_SAFE_INTEGER,
    });
    const isEndDropTarget = (): boolean => {
      const target = sectionDropAt();
      const end = endOfColumn();
      return (
        target !== null &&
        target.page === end.page &&
        target.column === end.column &&
        target.index === end.index
      );
    };
    const trackEndDrop = (event: DragEvent): void => {
      if (sectionDrag() === null) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      setSectionDropAt(endOfColumn());
    };
    return (
      <>
        <For each={listProps.ids}>
          {(sectionId) => (
            <DocSection
              resume={props.resume}
              sectionId={sectionId}
              focusedSection={focusedSection()}
              onFocusSection={setFocusedSection}
              canMoveSection={canMoveSection}
              onMoveSection={moveSection}
              otherColumnLabel={listProps.otherColumnLabel}
              onMoveSectionToOtherColumn={moveSectionToOtherColumn}
              onMoveEntry={moveEntry}
              onAnnounce={announce}
              slice={sectionSliceAt(
                props.resume,
                props.templateLayout,
                sectionId,
                listProps.pageIndex,
                listProps.columnIndex,
                isEditable(),
                expandedPages(),
              )}
              canInsertPageBreak={canInsertPageBreakBefore(sectionId)}
              onInsertPageBreak={insertPageBreakBeforeSection}
              itemBreakAction={itemBreakAction}
            />
          )}
        </For>
        <Show when={isEditable()}>
          <button
            type="button"
            class="doc-sheet__add-section-block"
            classList={{ "doc-sheet__add-section-block--drop-hint": isEndDropTarget() }}
            data-testid="doc-sheet-add-section"
            onClick={openSections}
            onDragEnter={trackEndDrop}
            onDragOver={trackEndDrop}
            onDrop={(event) => {
              const dragging = sectionDrag();
              if (dragging === null) return;
              event.preventDefault();
              const payload = readDragPayload<{ id?: string }>(event, SECTION_DRAG_MIME);
              onSectionDrop(payload?.id ?? dragging, endOfColumn());
              setSectionDrag(null);
              setSectionDropAt(null);
            }}
          >
            <PlusIcon /> Add section
          </button>
        </Show>
      </>
    );
  }

  /**
   * A column's frame. The column itself is not a drop target — the drag
   * catalog's targets are section cards and each column's Add-section block
   * (spec §2.5).
   */
  function ColumnFrame(frameProps: {
    pageIndex: number;
    columnIndex: number;
    class: string;
    /** How the column reads to tests and tools: `main` or `sidebar`. */
    role: "main" | "sidebar";
    isAside?: boolean;
    children: JSX.Element;
  }): JSX.Element {
    const classes = (): Record<string, boolean> => ({
      "doc-sheet__column": true,
      [frameProps.class]: true,
    });
    return (
      <Show
        when={frameProps.isAside === true}
        fallback={
          <div
            classList={classes()}
            data-testid="doc-sheet-column"
            data-column-role={frameProps.role}
            data-column-index={frameProps.columnIndex}
            data-page-index={frameProps.pageIndex}
          >
            {frameProps.children}
          </div>
        }
      >
        <aside
          classList={classes()}
          data-testid="doc-sheet-column"
          data-column-role={frameProps.role}
          data-column-index={frameProps.columnIndex}
          data-page-index={frameProps.pageIndex}
        >
          {frameProps.children}
        </aside>
      </Show>
    );
  }

  /** The sidebar's edge-drag resize handle (spec §3.2). */
  function SidebarResizeHandle(handleProps: { isRightSidebar: boolean }): JSX.Element {
    let dragOrigin: { x: number; width: number } | null = null;

    const widthFromPointer = (clientX: number): number => {
      if (!dragOrigin) return sidebarWidth();
      // Client deltas are in screen px; divide by the miniature scale so the
      // sidebar width stays in sheet design pixels (#813).
      const delta = (clientX - dragOrigin.x) / scale();
      // A right sidebar grows leftwards: dragging left widens it.
      return dragOrigin.width + (handleProps.isRightSidebar ? -delta : delta);
    };

    return (
      <div
        class="doc-sheet__side-resize"
        classList={{
          "doc-sheet__side-resize--right": handleProps.isRightSidebar,
        }}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-valuemin={SIDEBAR_MIN_PX}
        aria-valuemax={SIDEBAR_MAX_PX}
        aria-valuenow={sidebarWidth()}
        tabindex="0"
        onPointerDown={(event) => {
          event.preventDefault();
          dragOrigin = { x: event.clientX, width: sidebarWidth() };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!dragOrigin) return;
          setDragSidebarWidth(widthFromPointer(event.clientX));
        }}
        onPointerUp={(event) => {
          if (dragOrigin) commitSidebarWidth(widthFromPointer(event.clientX));
          dragOrigin = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={(event) => {
          // A cancelled press must not leave stray moves resizing the sidebar
          // — and must not write the half-finished width to the document.
          dragOrigin = null;
          setDragSidebarWidth(null);
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onKeyDown={(event) => {
          const grow = handleProps.isRightSidebar ? "ArrowLeft" : "ArrowRight";
          const shrink = handleProps.isRightSidebar ? "ArrowRight" : "ArrowLeft";
          if (event.key === grow) {
            event.preventDefault();
            commitSidebarWidth(sidebarWidth() + SIDEBAR_KEY_STEP_PX);
          } else if (event.key === shrink) {
            event.preventDefault();
            commitSidebarWidth(sidebarWidth() - SIDEBAR_KEY_STEP_PX);
          }
        }}
      />
    );
  }

  /** The sidebar column: page-0 identity chrome, sections, resize handle. */
  function SideColumn(columnProps: {
    pageIndex: number;
    page: string[][];
    isRightSidebar: boolean;
  }): JSX.Element {
    const isFirst = (): boolean => columnProps.pageIndex === 0;
    return (
      <ColumnFrame
        pageIndex={columnProps.pageIndex}
        columnIndex={1}
        class="doc-sheet__side"
        role="sidebar"
        isAside
      >
        <Show when={isFirst() && headerStyle() === "sidebar"}>
          <NameHeader basics={props.resume.basics} isInSidebar />
        </Show>
        <Show when={isFirst() && contactIn() === "sidebar"}>
          <ContactBlock basics={props.resume.basics} withAvatar />
        </Show>
        <SectionList
          ids={columnProps.page[1] ?? []}
          pageIndex={columnProps.pageIndex}
          columnIndex={1}
          otherColumnLabel="main column"
        />
        <Show when={isEditable()}>
          <SidebarResizeHandle isRightSidebar={columnProps.isRightSidebar} />
        </Show>
      </ColumnFrame>
    );
  }

  /** The main column: page-0 name header (unless the sidebar owns it). */
  function MainColumn(columnProps: {
    pageIndex: number;
    page: string[][];
    withHeader: boolean;
  }): JSX.Element {
    const isFirst = (): boolean => columnProps.pageIndex === 0;
    return (
      <ColumnFrame
        pageIndex={columnProps.pageIndex}
        columnIndex={0}
        class="doc-sheet__main"
        role="main"
      >
        <Show when={isFirst() && columnProps.withHeader}>
          <Show when={contactIn() !== "sidebar"}>
            <SheetAvatar basics={props.resume.basics} />
          </Show>
          <NameHeader basics={props.resume.basics} />
          <Show when={contactIn() === "header" && layoutMode() !== "single"}>
            <ContactBlock basics={props.resume.basics} isCompact />
          </Show>
        </Show>
        <SectionList
          ids={columnProps.page[0] ?? []}
          pageIndex={columnProps.pageIndex}
          columnIndex={0}
          otherColumnLabel="sidebar"
        />
      </ColumnFrame>
    );
  }

  /** Single-column pages: banner identity, then one continuous section list. */
  function SingleColumn(columnProps: { pageIndex: number; page: string[][] }): JSX.Element {
    const isFirst = (): boolean => columnProps.pageIndex === 0;
    const ids = (): string[] => columnProps.page.flat();
    return (
      <ColumnFrame
        pageIndex={columnProps.pageIndex}
        columnIndex={0}
        class="doc-sheet__single"
        role="main"
      >
        <Show when={isFirst()}>
          <div class="doc-sheet__banner">
            <SheetAvatar basics={props.resume.basics} />
            <NameHeader basics={props.resume.basics} />
            <ContactBlock basics={props.resume.basics} isCompact />
          </div>
        </Show>
        <SectionList
          ids={ids()}
          pageIndex={columnProps.pageIndex}
          columnIndex={0}
          otherColumnLabel={null}
        />
      </ColumnFrame>
    );
  }

  /** Legacy layouts with more than two columns: an even flex row. */
  function MultiColumn(columnProps: { pageIndex: number; page: string[][] }): JSX.Element {
    return (
      <div class="doc-sheet__multi">
        <For each={columnProps.page}>
          {(ids, columnIndex) => (
            <ColumnFrame
              pageIndex={columnProps.pageIndex}
              columnIndex={columnIndex()}
              class="doc-sheet__multi-col"
              role={columnIndex() === 0 ? "main" : "sidebar"}
            >
              <SectionList
                ids={ids}
                pageIndex={columnProps.pageIndex}
                columnIndex={columnIndex()}
                otherColumnLabel={null}
              />
            </ColumnFrame>
          )}
        </For>
      </div>
    );
  }

  /** One page's body, composed per the template's layout mode (spec §3.6). */
  function pageBody(pageIndex: number, page: string[][]): JSX.Element {
    if (page.length > 2) return <MultiColumn pageIndex={pageIndex} page={page} />;
    const isFirst = pageIndex === 0;

    if (layoutMode() === "single") return <SingleColumn pageIndex={pageIndex} page={page} />;

    if (layoutMode() === "header-split") {
      return (
        <div class="doc-sheet__split">
          <Show when={isFirst}>
            <div
              class="doc-sheet__banner"
              classList={{
                "doc-sheet__banner--tint": headerStyle() === "banner",
                "doc-sheet__banner--boxed": headerStyle() === "boxed",
              }}
            >
              <SheetAvatar basics={props.resume.basics} />
              <NameHeader basics={props.resume.basics} />
              <Show when={contactIn() === "banner" || contactIn() === "header"}>
                <ContactBlock basics={props.resume.basics} isCompact />
              </Show>
            </div>
          </Show>
          <div class="doc-sheet__grid doc-sheet__grid--split">
            <MainColumn pageIndex={pageIndex} page={page} withHeader={false} />
            <SideColumn pageIndex={pageIndex} page={page} isRightSidebar />
          </div>
        </div>
      );
    }

    const isLeft = layoutMode() === "sidebar-left";
    return (
      <div
        class="doc-sheet__grid"
        classList={{
          "doc-sheet__grid--side-left": isLeft,
          "doc-sheet__grid--side-right": !isLeft,
        }}
      >
        <Show
          when={isLeft}
          fallback={
            <>
              <MainColumn
                pageIndex={pageIndex}
                page={page}
                withHeader={headerStyle() !== "sidebar"}
              />
              <SideColumn pageIndex={pageIndex} page={page} isRightSidebar />
            </>
          }
        >
          <SideColumn pageIndex={pageIndex} page={page} isRightSidebar={false} />
          <MainColumn pageIndex={pageIndex} page={page} withHeader={headerStyle() !== "sidebar"} />
        </Show>
      </div>
    );
  }

  /** One content-sized sheet: overflow guides over the composed page body. */
  function SheetPage(pageProps: { pageIndex: number; page: string[][] }): JSX.Element {
    const [element, setElement] = createSignal<HTMLElement>();
    return (
      <article
        ref={setElement}
        class="doc-sheet__page"
        data-testid="doc-sheet-page"
        data-page={pageProps.pageIndex + 1}
        aria-label={`Page ${pageProps.pageIndex + 1} of ${pages().length}`}
      >
        <Show when={isEditable()}>
          <SheetOverflowGuides sheet={element} />
        </Show>
        {pageBody(pageProps.pageIndex, pageProps.page)}
      </article>
    );
  }

  return (
    <SheetModeContext.Provider value={mode}>
      <SheetDndContext.Provider value={dnd}>
        <div
          ref={(element) => {
            widthObserver?.observe(element);
            // First paint before the observer fires.
            setAvailableWidth(element.clientWidth || PAGE_WIDTH_PX);
          }}
          class="doc-sheet-scale"
          data-testid="doc-sheet-scale"
          data-sheet-scale={scale().toFixed(4)}
          data-sheet-interactive={scaleInteractive() ? "true" : "false"}
          style={{ "--doc-sheet-page-w": `${PAGE_WIDTH_PX}px` }}
        >
          <div
            class="doc-sheet-scale__viewport"
            data-testid="doc-sheet-scale-viewport"
            style={{
              width: `${PAGE_WIDTH_PX * scale()}px`,
              // Before the first height measurement, let content define height
              // so we do not collapse to zero; afterwards compensate so scroll
              // geometry matches the visual miniature.
              height: contentHeight() > 0 ? `${contentHeight() * scale()}px` : "auto",
            }}
          >
            <div
              ref={(element) => {
                heightObserver?.observe(element);
                setContentHeight(element.offsetHeight);
              }}
              class="doc-sheet-scale__transform"
              data-testid="doc-sheet-scale-transform"
              style={{
                [SHEET_SCALE_CSS_VAR]: String(scale()),
                transform: scale() === 1 ? undefined : `scale(${scale()})`,
                // Center the unscaled 860px layout box inside the narrower
                // viewport when origin is top center.
                "margin-left":
                  scale() === 1 ? undefined : `${(PAGE_WIDTH_PX * (scale() - 1)) / 2}px`,
              }}
            >
              <div
                ref={(element) => {
                  root = element;
                  observer?.observe(element);
                }}
                class={
                  `doc-sheet doc-sheet--tpl-${props.resume.metadata.template} ` +
                  `doc-sheet--layout-${layoutMode()} doc-sheet--head-${headerStyle()} ` +
                  `doc-sheet--heading-${chrome().headingStyle} ` +
                  `doc-sheet--side-heading-${chrome().sidebarHeadingStyle} ` +
                  `doc-sheet--heading-case-${chrome().headingCase} ` +
                  `doc-sheet--heading-ink-${chrome().headingInk} ` +
                  `doc-sheet--side-heading-ink-${chrome().sidebarHeadingInk} ` +
                  `doc-sheet--keywords-${chrome().keywordStyle} ` +
                  `doc-sheet--font-${chrome().fontBody}`
                }
                classList={{
                  "doc-sheet--editing": isEditable(),
                  "doc-sheet--done": !isEditable(),
                  "doc-sheet--sidebar-tint": chrome().sidebarTint,
                  "doc-sheet--header-rule": chrome().headerRule,
                }}
                data-testid="doc-sheet"
                data-sheet-mode={mode()}
                data-heading-style={chrome().headingStyle}
                data-sidebar-heading-style={chrome().sidebarHeadingStyle}
                data-font-body={chrome().fontBody}
                style={{
                  "--doc-sheet-bg": theme().background,
                  "--doc-sheet-text": theme().text,
                  "--doc-sheet-accent": theme().primary,
                  "--doc-sheet-side-w": `${sidebarWidth()}px`,
                  "--doc-sheet-page-h": `${PAGE_HEIGHT_PX}px`,
                  "--doc-font-body": docFont(),
                  "--doc-font-display": docFont(),
                }}
              >
                <For each={pages()}>
                  {(page, pageIndex) => (
                    <>
                      <Show when={pageIndex() > 0}>
                        <div class="doc-sheet__page-break" data-testid="doc-sheet-page-break">
                          <span class="doc-sheet__page-break-label">Page {pageIndex() + 1}</span>
                          <Show when={isEditable()}>
                            <button
                              type="button"
                              class="doc-sheet__page-break-remove"
                              onClick={() => removePageBreak(pageIndex())}
                            >
                              Remove page break
                            </button>
                          </Show>
                        </div>
                      </Show>
                      <SheetPage pageIndex={pageIndex()} page={page} />
                    </>
                  )}
                </For>

                {/* Dialogs are editing chrome: unmounted in Done mode even when an
                    open flag was left set by a mid-dialog mode switch. */}
                <Show when={isEditable()}>
                  <CustomSectionDialog
                    open={isSectionDialogOpen()}
                    onOpenChange={setIsSectionDialogOpen}
                  />
                </Show>

                <LiveRegion message={announcement()} politeness="polite" />
              </div>
            </div>
          </div>

          {/* Outside the scaled subtree (#813): stacked on the viewport so
              sticky can pin it to the visible bottom of the surface. Unscaled
              on purpose — the count must stay readable at any miniature k. */}
          <div class="doc-sheet-scale__pill-layer">
            <PageCountPill count={measuredPages()} />
          </div>
        </div>
      </SheetDndContext.Provider>
    </SheetModeContext.Provider>
  );
}
