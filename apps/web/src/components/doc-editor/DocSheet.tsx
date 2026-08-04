/**
 * The document sheet engine (#794): content-sized sheets composed from the
 * template's layout metadata.
 *
 * Sheets no longer clip to fixed A4 frames — each `.doc-sheet__page` sizes to
 * its content, and A4 boundaries are communicated by dashed overflow guides at
 * 1122px intervals plus the floating page-count pill (spec §3.1, §3.5).
 * Explicit `metadata.layout` pages draw as separate sheets divided by
 * page-break rules with "Page N" labels and (edit mode) a "Remove page break"
 * action that merges the page into the one before it — the simple layout
 * merge; `itemBreaks`-aware semantics arrive with #796.
 *
 * The page body is composed per the template's `layoutMode` (spec §1.4,
 * §3.6): `SingleColumn`, `MainColumn` + `SideColumn` grids, or the
 * header-split banner over two columns. The template layer only picks the
 * compositor and the palette; all behaviour lives in the shared components.
 *
 * Editing chrome — the drag-drop context, drop resolution, announcements, and
 * the end-of-column Add-section blocks — is owned here; every mutation writes
 * through a `resumeStore` action (see `docEdits.ts`). Drags start from grips
 * only, never from the surface, so text selection and inline editing keep
 * working; #796 replaces the drag mechanism wholesale.
 */

import { For, Show, createEffect, createMemo, createSignal, onCleanup, type JSX } from "solid-js";
import {
  DragDropProvider,
  DragDropSensors,
  DragOverlay,
  closestCenter,
  createDroppable,
  type CollisionDetector,
  type DragEvent,
} from "@thisbeyond/solid-dnd";
import { CustomSectionDialog } from "./CustomSectionDialog";
import { ContactBlock, NameHeader, SheetAvatar } from "./DocHeader";
import { DocSection } from "./DocSection";
import { applyLayout, moveItemAcrossSections, reorderItem } from "./docEdits";
import { PlusIcon } from "./icons";
import { SheetModeContext, type SheetMode } from "./sheetMode";
import {
  canMoveEntryAcross,
  drawnSectionPosition,
  entryDisplayLabel,
  entryStep,
  moveSectionStep,
  resolveEntryDrop,
  resolveSectionDropOnColumn,
  resolveSectionDropOnSection,
  sectionItemList,
  type MoveStep,
} from "../../lib/docDnd";
import {
  PAGE_HEIGHT_PX,
  SHEET_PX_PER_PT,
  editorPages,
  findSectionPlacement,
  layoutColumns,
  layoutPages,
  mergePageIntoPrevious,
  renderPages,
  sectionTitle,
  type TemplateLayout,
} from "../../lib/docLayout";
import { reorderAnnouncement } from "../../lib/reorderAnnounce";
import { LiveRegion, announceLive } from "../ui/LiveRegion";
import type { ResumeData } from "../../wasm/types";
import "./docSheet.css";

/** Sidebar width bounds for the resize handle (spec §3.2). */
const SIDEBAR_MIN_PX = 160;
const SIDEBAR_MAX_PX = 360;
/** Fallback sidebar width when the template declares none: a third of A4. */
const SIDEBAR_DEFAULT_PX = 287;
/** Where a resized sidebar width persists, per the spec. */
const SIDEBAR_WIDTH_STORAGE_KEY = "rustume.studio.sidebarWidth";
/** Keyboard resize step for the handle. */
const SIDEBAR_KEY_STEP_PX = 8;

/** What a drag carries: the thing being moved. */
type SheetDragData =
  | { type: "section"; sectionId: string }
  | { type: "entry"; sectionId: string; itemId: string };

/** What a droppable is: where the dragged thing may land. */
type SheetDropData =
  | { type: "section"; sectionId: string; itemId?: undefined }
  | { type: "entry"; sectionId: string; itemId: string }
  | { type: "column"; page: number; column: number };

/** Whether `drop` is a meaningful target for `drag`. */
function acceptsDrop(drag: SheetDragData, drop: SheetDropData): boolean {
  if (drag.type === "section") {
    return drop.type === "section" || drop.type === "column";
  }
  if (drop.type === "entry" || drop.type === "section") {
    return drop.sectionId === drag.sectionId || canMoveEntryAcross(drag.sectionId, drop.sectionId);
  }
  return false;
}

/** A short human name for an entry, for announcements and the drag overlay. */
function entryLabel(resume: ResumeData, sectionId: string, itemId: string): string {
  const item = sectionItemList(resume, sectionId).find((entry) => entry.id === itemId);
  return entryDisplayLabel(item, "Item");
}

/** The persisted sidebar width override, if any. */
function storedSidebarWidth(): number | null {
  try {
    const raw = globalThis.localStorage?.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    const value = raw === null || raw === undefined ? Number.NaN : Number.parseInt(raw, 10);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
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
   */
  mode?: SheetMode;
  /**
   * Opens the Sections panel (the Add-section blocks' target). Without it the
   * blocks fall back to the custom-section dialog, so a sheet rendered outside
   * the editor page keeps a working affordance.
   */
  onOpenSections?: () => void;
}

export function DocSheet(props: DocSheetProps): JSX.Element {
  const mode = (): SheetMode => props.mode ?? "edit";
  const isEditable = (): boolean => mode() === "edit";

  // The layout the drops address, and the drawn view of it. In edit mode
  // `editorPages()` never drops a page or column, so the two are aligned
  // index-for-index.
  const layout = createMemo(() => layoutPages(props.resume, props.templateLayout));
  const pages = createMemo<string[][][]>(() => {
    const rendered = isEditable()
      ? editorPages(props.resume, props.templateLayout)
      : renderPages(props.resume, props.templateLayout);
    // An empty resume still gets one sheet, so the surface reads as a blank
    // page rather than as a failure to load.
    return rendered.length > 0 ? rendered : [[[]]];
  });

  const theme = (): ResumeData["metadata"]["theme"] => props.resume.metadata.theme;
  const layoutMode = (): TemplateLayout["layoutMode"] => props.templateLayout.layoutMode;
  const headerStyle = (): TemplateLayout["headerStyle"] => props.templateLayout.headerStyle;
  const contactIn = (): TemplateLayout["contactIn"] => props.templateLayout.contactIn;

  const [focusedSection, setFocusedSection] = createSignal<string | null>(null);
  const [isSectionDialogOpen, setIsSectionDialogOpen] = createSignal(false);
  const [activeDrag, setActiveDrag] = createSignal<SheetDragData | null>(null);
  const [announcement, setAnnouncement] = createSignal("");
  const [measuredPages, setMeasuredPages] = createSignal(1);
  const [sidebarOverride, setSidebarOverride] = createSignal<number | null>(storedSidebarWidth());
  let root: HTMLDivElement | undefined;

  function announce(message: string): void {
    announceLive(setAnnouncement, message);
  }

  /** The sidebar width in sheet pixels: the user's override, else the template's. */
  const sidebarWidth = createMemo<number>(() => {
    const override = sidebarOverride();
    if (override !== null) return clampSidebarWidth(override);
    const declared = props.templateLayout.sidebarWidth;
    if (declared === null || declared <= 0) return SIDEBAR_DEFAULT_PX;
    return clampSidebarWidth(declared * SHEET_PX_PER_PT);
  });

  function setSidebarWidth(px: number): void {
    const next = clampSidebarWidth(px);
    setSidebarOverride(next);
    try {
      globalThis.localStorage?.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(next));
    } catch {
      // Persistence is best-effort; the in-session width still applies.
    }
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

  // Only droppables that mean something for the active drag may catch it, and
  // only droppables the dragged card actually overlaps count at all, so a
  // sloppy release over dead space cancels instead of snapping to the nearest
  // centre.
  const detectCollisions: CollisionDetector = (draggable, droppables, context) => {
    const dragged = draggable.transformed;
    const touching = droppables.filter(
      (droppable) =>
        acceptsDrop(draggable.data as SheetDragData, droppable.data as SheetDropData) &&
        dragged.left < droppable.layout.right &&
        dragged.right > droppable.layout.left &&
        dragged.top < droppable.layout.bottom &&
        dragged.bottom > droppable.layout.top,
    );
    return touching.length > 0 ? closestCenter(draggable, touching, context) : null;
  };

  function onDragStart({ draggable }: DragEvent): void {
    setActiveDrag(draggable.data as SheetDragData);
  }

  /** Resolve a finished drag to at most one store action. */
  function onDragEnd({ draggable, droppable }: DragEvent): void {
    setActiveDrag(null);
    if (!droppable) return;
    const drag = draggable.data as SheetDragData;
    const drop = droppable.data as SheetDropData;
    if (!acceptsDrop(drag, drop)) return;

    if (drag.type === "section") {
      let next: string[][][] | null = null;
      if (drop.type === "section") {
        next = resolveSectionDropOnSection(layout(), drag.sectionId, drop.sectionId);
      } else if (drop.type === "column") {
        next = resolveSectionDropOnColumn(layout(), drag.sectionId, drop.page, drop.column);
      }
      if (!next) return;
      applyLayout(next);
      announceSectionMove(drag.sectionId, next);
      return;
    }

    if (drop.type !== "entry" && drop.type !== "section") return;
    const resolved = resolveEntryDrop({
      fromSectionId: drag.sectionId,
      fromItems: sectionItemList(props.resume, drag.sectionId),
      itemId: drag.itemId,
      toSectionId: drop.sectionId,
      toItems: sectionItemList(props.resume, drop.sectionId),
      targetItemId: drop.type === "entry" ? drop.itemId : null,
    });
    if (!resolved) return;
    const label = entryLabel(props.resume, drag.sectionId, drag.itemId);
    if (resolved.kind === "reorder") {
      reorderItem(resolved.sectionId, resolved.fromIndex, resolved.toIndex);
      announce(
        reorderAnnouncement(
          label,
          resolved.toIndex,
          sectionItemList(props.resume, resolved.sectionId).length,
        ),
      );
      return;
    }
    moveItemAcrossSections(
      resolved.fromSectionId,
      resolved.fromIndex,
      resolved.toSectionId,
      resolved.toIndex,
    );
    announce(`${label} moved to ${sectionTitle(props.resume, resolved.toSectionId)}`);
  }

  const dragLabel = (): string => {
    const drag = activeDrag();
    if (!drag) return "";
    if (drag.type === "section") {
      return `${sectionTitle(props.resume, drag.sectionId)} section`;
    }
    return entryLabel(props.resume, drag.sectionId, drag.itemId);
  };

  /** Merge a drawn page into the one before it (spec §3.4, simple variant). */
  function removePageBreak(pageIndex: number): void {
    const next = mergePageIntoPrevious(layout(), pageIndex);
    if (!next) return;
    applyLayout(next);
    announce(`Page break removed; page ${pageIndex + 1} merged into page ${pageIndex}`);
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
    /** The cross-column move's target name, or `null` on single-column pages. */
    otherColumnLabel: string | null;
  }): JSX.Element {
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
            />
          )}
        </For>
        <Show when={isEditable()}>
          <button
            type="button"
            class="doc-sheet__add-section-block"
            data-testid="doc-sheet-add-section"
            onClick={openSections}
          >
            <PlusIcon /> Add section
          </button>
        </Show>
      </>
    );
  }

  /** A column's droppable frame. */
  function ColumnFrame(frameProps: {
    pageIndex: number;
    columnIndex: number;
    class: string;
    /** How the column reads to tests and tools: `main` or `sidebar`. */
    role: "main" | "sidebar";
    isAside?: boolean;
    children: JSX.Element;
  }): JSX.Element {
    const droppable = createDroppable(
      `drop:column:${frameProps.pageIndex}:${frameProps.columnIndex}`,
      { type: "column", page: frameProps.pageIndex, column: frameProps.columnIndex },
    );
    const classes = (): Record<string, boolean> => ({
      "doc-sheet__column": true,
      [frameProps.class]: true,
      "doc-sheet__column--drop": droppable.isActiveDroppable,
    });
    return (
      <Show
        when={frameProps.isAside === true}
        fallback={
          <div
            ref={droppable.ref}
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
          ref={droppable.ref}
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
      const delta = clientX - dragOrigin.x;
      // A right sidebar grows leftwards: dragging left widens it.
      return dragOrigin.width + (handleProps.isRightSidebar ? -delta : delta);
    };

    return (
      <div
        class="doc-sheet__side-resize"
        classList={{ "doc-sheet__side-resize--right": handleProps.isRightSidebar }}
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
          setSidebarWidth(widthFromPointer(event.clientX));
        }}
        onPointerUp={(event) => {
          dragOrigin = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={(event) => {
          // A cancelled press must not leave stray moves resizing the sidebar.
          dragOrigin = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onKeyDown={(event) => {
          const grow = handleProps.isRightSidebar ? "ArrowLeft" : "ArrowRight";
          const shrink = handleProps.isRightSidebar ? "ArrowRight" : "ArrowLeft";
          if (event.key === grow) {
            event.preventDefault();
            setSidebarWidth(sidebarWidth() + SIDEBAR_KEY_STEP_PX);
          } else if (event.key === shrink) {
            event.preventDefault();
            setSidebarWidth(sidebarWidth() - SIDEBAR_KEY_STEP_PX);
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
        <SectionList ids={columnProps.page[1] ?? []} otherColumnLabel="main column" />
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
        <SectionList ids={columnProps.page[0] ?? []} otherColumnLabel="sidebar" />
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
        <SectionList ids={ids()} otherColumnLabel={null} />
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
              <SectionList ids={ids} otherColumnLabel={null} />
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
      <DragDropProvider
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        collisionDetector={detectCollisions}
      >
        <DragDropSensors />
        <div
          ref={(element) => {
            root = element;
            observer?.observe(element);
          }}
          class={
            `doc-sheet doc-sheet--tpl-${props.resume.metadata.template} ` +
            `doc-sheet--layout-${layoutMode()} doc-sheet--head-${headerStyle()}`
          }
          classList={{
            "doc-sheet--editing": isEditable(),
            "doc-sheet--done": !isEditable(),
          }}
          data-testid="doc-sheet"
          data-sheet-mode={mode()}
          style={{
            "--doc-sheet-bg": theme().background,
            "--doc-sheet-text": theme().text,
            "--doc-sheet-accent": theme().primary,
            "--doc-sheet-side-w": `${sidebarWidth()}px`,
            "--doc-sheet-page-h": `${PAGE_HEIGHT_PX}px`,
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

          <PageCountPill count={measuredPages()} />

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

        <DragOverlay>
          <Show when={activeDrag()}>
            <div class="doc-sheet__drag-overlay">{dragLabel()}</div>
          </Show>
        </DragOverlay>
      </DragDropProvider>
    </SheetModeContext.Provider>
  );
}
