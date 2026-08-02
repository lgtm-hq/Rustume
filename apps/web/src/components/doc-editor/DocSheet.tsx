/**
 * The document sheet: A4 page frames, the template's column grid, the header
 * region, and an editable view of every placed section.
 *
 * The page/column structure comes straight from `editorPages()` and
 * `layoutColumns()` — this component draws that model and nothing else, and the
 * same model's indices address `metadata.layout` directly, so drag and drop
 * needs no second layout representation. Editing is click-to-edit in place
 * plus the item, section and photo dialogs; structural editing is the chrome
 * `DocSection` draws plus the whole-surface drag and drop owned here. Every
 * mutation writes through a `resumeStore` action, never `setStore` (see
 * `docEdits.ts`), and every drop resolves through the pure functions in
 * `lib/docDnd.ts` — one drop, one action, one undo entry; a drag that ends
 * where it started writes nothing.
 *
 * Overflow is *reported*, never absorbed. A column that cannot fit its sections
 * is clipped and flagged; moving a section to another page is a `metadata.layout`
 * decision the user makes on this surface, so nothing here reflows.
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
import { DocHeader } from "./DocHeader";
import { DocSection } from "./DocSection";
import { ItemDialog } from "./ItemDialog";
import { applyLayout, moveItemAcrossSections, reorderItem } from "./docEdits";
import { itemNoun } from "./itemFields";
import { SheetModeContext, type SheetMode } from "./sheetMode";
import {
  adjacentCustomSectionId,
  canMoveEntryAcross,
  drawnSectionPosition,
  entryStep,
  moveSectionInLayout,
  moveSectionStep,
  resolveEntryDrop,
  resolveSectionDropOnColumn,
  resolveSectionDropOnSection,
  sectionItemList,
  type MoveStep,
} from "../../lib/docDnd";
import {
  editorPages,
  layoutColumns,
  layoutPages,
  renderPages,
  sectionTitle,
  type EditorSectionView,
  type LayoutColumn,
  type TemplateLayout,
} from "../../lib/docLayout";
import { reorderAnnouncement } from "../../lib/reorderAnnounce";
import { LiveRegion, announceLive } from "../ui/LiveRegion";
import type { ResumeData } from "../../wasm/types";
import "./docSheet.css";

/** What a drag carries: the thing being moved. */
type SheetDragData =
  | { type: "section"; sectionId: string }
  | { type: "entry"; sectionId: string; itemId: string };

/** What a droppable is: where the dragged thing may land. */
type SheetDropData =
  | { type: "section"; sectionId: string; itemId?: undefined }
  | { type: "entry"; sectionId: string; itemId: string }
  | { type: "column"; page: number; column: number }
  | { type: "new-page" };

/** Whether `drop` is a meaningful target for `drag`. */
function acceptsDrop(drag: SheetDragData, drop: SheetDropData): boolean {
  if (drag.type === "section") {
    return drop.type === "section" || drop.type === "column" || drop.type === "new-page";
  }
  if (drop.type === "entry" || drop.type === "section") {
    return drop.sectionId === drag.sectionId || canMoveEntryAcross(drag.sectionId, drop.sectionId);
  }
  return false;
}

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

/** Head-line fields an entry might carry, in announcement preference order. */
const ENTRY_LABEL_KEYS = [
  "name",
  "company",
  "institution",
  "title",
  "network",
  "organization",
] as const;

/** A short human name for an entry, for announcements and the drag overlay. */
function entryLabel(resume: ResumeData, sectionId: string, itemId: string): string {
  const item = sectionItemList(resume, sectionId).find((entry) => entry.id === itemId) as
    | Record<string, unknown>
    | undefined;
  for (const key of ENTRY_LABEL_KEYS) {
    const value = item?.[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return "Item";
}

/** A section placed in a column but not drawn there — an add-block target. */
interface AddTarget {
  id: string;
  noun: string;
}

/** One column of one page: the droppable frame plus its add-block. */
function SheetColumn(props: {
  pageIndex: number;
  column: LayoutColumn;
  addTargets: AddTarget[];
  onAdd: (sectionId: string) => void;
  children: JSX.Element;
}): JSX.Element {
  const droppable = createDroppable(`drop:column:${props.pageIndex}:${props.column.index}`, {
    type: "column",
    page: props.pageIndex,
    column: props.column.index,
  });

  return (
    <div
      ref={droppable.ref}
      class="doc-sheet__column"
      classList={{
        "doc-sheet__column--sidebar": props.column.role === "sidebar",
        "doc-sheet__column--drop": droppable.isActiveDroppable,
      }}
      data-testid="doc-sheet-column"
      data-column-index={props.column.index}
      data-column-role={props.column.role}
      data-page-index={props.pageIndex}
      style={{ "flex-basis": `${props.column.width * 100}%` }}
    >
      {props.children}
      <Show when={props.addTargets.length > 0}>
        <div class="doc-sheet__add-block" data-testid="doc-sheet-add-block">
          <For each={props.addTargets}>
            {(target) => (
              <button
                type="button"
                class="doc-sheet__action"
                onClick={() => props.onAdd(target.id)}
              >
                Add {target.noun}
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

/**
 * The trailing drop zone that starts a new page. Always mounted so its
 * droppable is registered before a drag begins; only *shown* while a section
 * is being dragged, because that is the only drag it accepts.
 */
function NewPageZone(props: { active: boolean }): JSX.Element {
  const droppable = createDroppable("drop:new-page", { type: "new-page" });
  return (
    <div
      ref={droppable.ref}
      class="doc-sheet__new-page"
      classList={{
        "doc-sheet__new-page--active": props.active,
        "doc-sheet__new-page--drop": droppable.isActiveDroppable,
      }}
      data-testid="doc-sheet-new-page"
      aria-hidden={props.active ? undefined : "true"}
    >
      Drop here to start a new page
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
  /** Reports the 0-based indices of pages whose content is clipped. */
  onOverflowChange?: (pages: number[]) => void;
  /** Reports the number of page frames drawn. */
  onPageCountChange?: (count: number) => void;
}

export function DocSheet(props: DocSheetProps): JSX.Element {
  const mode = (): SheetMode => props.mode ?? "edit";
  const isEditable = (): boolean => mode() === "edit";

  // The layout the drops address, and the drawn view of it. `editorPages()`
  // never drops a page or column, so the two are aligned index-for-index.
  const layout = createMemo(() => layoutPages(props.resume, props.templateLayout));
  const pages = createMemo<EditorSectionView[][][]>(() => {
    // Done mode draws what the PDF draws: `renderPages` drops hidden sections,
    // empty sections and empty pages, so the surface is the rendered document
    // rather than the editing model with its chrome switched off.
    const rendered = isEditable()
      ? editorPages(props.resume, props.templateLayout)
      : renderPages(props.resume, props.templateLayout).map((page) =>
          page.map((column) => column.map((id) => ({ id, hidden: false }))),
        );
    // An empty resume still gets one frame, so the sheet reads as a blank page
    // rather than as a failure to load.
    return rendered.length > 0 ? rendered : [[[]]];
  });

  const links = createMemo(() => {
    // `profiles` renders as a section wherever the layout places it; the header
    // only carries the links when no page does.
    const placed = pages().some((page) =>
      page.some((column) => column.some((section) => section.id === "profiles")),
    );
    return placed ? [] : profileLinks(props.resume);
  });

  const theme = () => props.resume.metadata.theme;

  const [overflowing, setOverflowing] = createSignal<number[]>([]);
  const [isSectionDialogOpen, setIsSectionDialogOpen] = createSignal(false);
  /** Section an add-block is adding an item to, or `null`. */
  const [addTarget, setAddTarget] = createSignal<string | null>(null);
  const [activeDrag, setActiveDrag] = createSignal<SheetDragData | null>(null);
  const [announcement, setAnnouncement] = createSignal("");
  let root: HTMLDivElement | undefined;

  function announce(message: string): void {
    announceLive(setAnnouncement, message);
  }

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

  // The cards the sheet draws. Drawn-ness depends on content and visibility,
  // never on placement — so the set stays valid for a layout about to change.
  const drawnIds = createMemo(
    () => new Set(pages().flatMap((page) => page.flatMap((column) => column.map((s) => s.id)))),
  );
  const isDrawn = (id: string): boolean => drawnIds().has(id);

  /**
   * Announce where `sectionId` landed in `nextLayout`, in drawn-card terms:
   * what is spoken must match what is seen, so positions count the cards the
   * sheet draws, not the slots the layout stores.
   */
  function announceSectionMove(sectionId: string, nextLayout: string[][][]): void {
    const position = drawnSectionPosition(nextLayout, sectionId, isDrawn);
    const title = sectionTitle(props.resume, sectionId);
    if (!position) {
      announce(`${title} section moved`);
      return;
    }
    // Speak the visual column position, not the stored index: sidebar-left
    // templates paint column 1 second, and what is spoken must match what
    // is seen.
    const geometry = layoutColumns(nextLayout[position.page], props.templateLayout);
    const visualColumn =
      (geometry.find((column) => column.index === position.column)?.order ?? position.column) + 1;
    announce(
      `${title} section moved to position ${position.index + 1} of ${position.total} ` +
        `in column ${visualColumn} of page ${position.page + 1}`,
    );
  }

  /** One-step section move, shared by the move controls (click and keyboard). */
  function moveSection(sectionId: string, step: MoveStep): void {
    // Stepping is drawn-aware: slots the sheet does not draw are skipped, so
    // a press never announces a move with zero visual change.
    const next = moveSectionStep(layout(), sectionId, step, isDrawn);
    if (!next) {
      announce(`${sectionTitle(props.resume, sectionId)} section did not move`);
      return;
    }
    applyLayout(next);
    announceSectionMove(sectionId, next);
    // Keep the user on the control they just used; it moved with the section.
    requestAnimationFrame(() => {
      root
        ?.querySelector<HTMLButtonElement>(`[data-doc-move-section="${sectionId}:${step}"]`)
        ?.focus();
    });
  }

  /** One-step entry move, shared by the move controls (click and keyboard). */
  function moveEntry(sectionId: string, itemId: string, step: MoveStep): void {
    const label = entryLabel(props.resume, sectionId, itemId);
    const items = sectionItemList(props.resume, sectionId);

    if (step === "up" || step === "down") {
      const move = entryStep(items, itemId, step);
      if (!move) {
        announce(`${label} did not move`);
        return;
      }
      reorderItem(sectionId, move.fromIndex, move.toIndex);
      announce(reorderAnnouncement(label, move.toIndex, items.length));
    } else {
      const targetId = adjacentCustomSectionId(layout(), sectionId, step);
      const fromIndex = items.findIndex((item) => item.id === itemId);
      if (targetId === null || fromIndex === -1) {
        announce(`${label} did not move`);
        return;
      }
      const targetItems = sectionItemList(props.resume, targetId);
      moveItemAcrossSections(sectionId, fromIndex, targetId, targetItems.length);
      announce(`${label} moved to ${sectionTitle(props.resume, targetId)}`);
    }

    requestAnimationFrame(() => {
      root?.querySelector<HTMLButtonElement>(`[data-doc-move-entry="${itemId}:${step}"]`)?.focus();
    });
  }

  // Only droppables that mean something for the active drag may catch it —
  // a section drag must never land on an entry, nor an entry on a column —
  // and only droppables the dragged card actually overlaps count at all, so a
  // sloppy release over dead space cancels instead of snapping to the nearest
  // centre. Among the overlapping targets, closest-centre keeps the familiar
  // card-versus-column selection.
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
      } else if (drop.type === "new-page") {
        next = moveSectionInLayout(layout(), drag.sectionId, {
          page: layout().length,
          column: 0,
          index: 0,
        });
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

  /** The placed-but-empty item sections of one column — its add-block targets. */
  function addTargets(pageIndex: number, columnIndex: number): AddTarget[] {
    // The rendered document (Done mode) has no add affordances.
    if (!isEditable()) return [];
    const placed = layout()[pageIndex]?.[columnIndex] ?? [];
    const drawn = new Set((pages()[pageIndex]?.[columnIndex] ?? []).map((section) => section.id));
    return placed
      .filter((id) => !drawn.has(id) && id !== "summary" && id !== "coverLetter")
      .map((id) => ({ id, noun: itemNoun(sectionTitle(props.resume, id)) }));
  }

  const dragLabel = (): string => {
    const drag = activeDrag();
    if (!drag) return "";
    if (drag.type === "section") {
      return `${sectionTitle(props.resume, drag.sectionId)} section`;
    }
    return entryLabel(props.resume, drag.sectionId, drag.itemId);
  };

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
          class="doc-sheet"
          classList={{ "doc-sheet--done": !isEditable() }}
          data-testid="doc-sheet"
          data-sheet-mode={mode()}
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
                        <SheetColumn
                          pageIndex={pageIndex()}
                          column={column}
                          addTargets={addTargets(pageIndex(), column.index)}
                          onAdd={setAddTarget}
                        >
                          <Show
                            when={
                              isFirst() && column.role === "sidebar" && identityIn() === "sidebar"
                            }
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
                            {(section) => (
                              <DocSection
                                resume={props.resume}
                                sectionId={section.id}
                                hidden={section.hidden}
                                onMoveSection={moveSection}
                                onMoveEntry={moveEntry}
                                onAnnounce={announce}
                              />
                            )}
                          </For>
                        </SheetColumn>
                      )}
                    </For>
                  </div>
                </article>
              );
            }}
          </For>

          <NewPageZone active={activeDrag()?.type === "section"} />

          {/* Sheet-level chrome: creating a section is not part of any one page. */}
          <Show when={isEditable()}>
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
          </Show>

          {/* Dialogs are editing chrome: unmounted in Done mode even when an
              open flag was left set by a mid-dialog mode switch. */}
          <Show when={isEditable()}>
            <CustomSectionDialog
              open={isSectionDialogOpen()}
              onOpenChange={setIsSectionDialogOpen}
            />

            {/* Add-block target: adds the first item of a placed-but-empty section. */}
            <ItemDialog
              open={addTarget() !== null}
              sectionId={addTarget() ?? ""}
              sectionTitle={sectionTitle(props.resume, addTarget() ?? "")}
              onOpenChange={(open) => {
                if (!open) setAddTarget(null);
              }}
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
