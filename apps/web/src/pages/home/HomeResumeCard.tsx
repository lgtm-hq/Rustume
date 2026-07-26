import { For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { Spinner } from "../../components/ui";
import type { TextSegment } from "../../lib/resumeSearch";
import { HomeLayout } from "../../lib/homeLayout";
import type { ResumeListItem } from "../../stores/persistence";
import { DocumentPreview, resumeSlug } from "./DocumentPreview";
import { formatUpdatedAt, HighlightedText } from "./shared";
import type { HomePageModel } from "./useHomePage";

function LockIcon(props: { locked: boolean; class?: string }) {
  return (
    <svg
      class={props.class ?? "w-5 h-5"}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <Show
        when={props.locked}
        fallback={
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M8 11V7a4 4 0 118 0v4m-9 0h10v8H7v-8z"
          />
        }
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 15v2m-6-6V9a6 6 0 1112 0v2M6 11h12v8H6v-8z"
        />
      </Show>
    </svg>
  );
}

function ResumeActions(props: { home: HomePageModel; resume: ResumeListItem }) {
  const { home } = props;
  const resume = () => props.resume;

  return (
    <div class="flex items-center gap-1 flex-shrink-0">
      <button
        type="button"
        class={`p-2 rounded-lg transition-colors motion-reduce:transition-none
          hover:bg-accent/10 disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus-visible:ring-2 focus-visible:ring-accent
          ${resume().locked ? "text-gold hover:text-gold" : "text-stone hover:text-accent"}`}
        onClick={(e) => home.handleToggleLock(resume().id, Boolean(resume().locked), e)}
        disabled={home.lockingId() === resume().id || home.actionsBusy()}
        title={resume().locked ? "Unlock" : "Lock"}
        aria-label={resume().locked ? "Unlock resume" : "Lock resume"}
        aria-busy={home.lockingId() === resume().id}
      >
        <LockIcon locked={Boolean(resume().locked)} />
      </button>
      <button
        type="button"
        class="p-2 text-stone hover:text-accent hover:bg-accent/10 rounded-lg transition-colors
          motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onClick={(e) => home.startRename(resume().id, resume().name, e)}
        disabled={Boolean(resume().locked) || home.actionsBusy()}
        title="Rename"
        aria-label="Rename resume"
      >
        <svg
          class="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
      </button>
      <button
        type="button"
        class="p-2 text-stone hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors
          motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onClick={(e) => home.handleDelete(resume().id, e)}
        disabled={Boolean(resume().locked) || home.actionsBusy()}
        title={resume().locked ? "Unlock to delete" : "Delete"}
        aria-label="Delete resume"
      >
        <Show when={home.deletingId() !== resume().id} fallback={<Spinner class="w-5 h-5" />}>
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </Show>
      </button>
      <button
        type="button"
        class="p-2 text-stone hover:text-accent hover:bg-accent/10 rounded-lg transition-colors
          motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed
          focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        onClick={(e) => home.handleDuplicate(resume().id, e)}
        disabled={home.actionsBusy()}
        title="Duplicate"
        aria-label="Duplicate resume"
      >
        <Show when={home.duplicatingId() !== resume().id} fallback={<Spinner class="w-5 h-5" />}>
          <svg
            class="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </Show>
      </button>
      <A href={`/edit/${resume().id}`} class="p-1" aria-label={`Edit ${resume().name}`}>
        <svg
          class="w-5 h-5 text-stone group-hover:text-accent transition-colors motion-reduce:transition-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
      </A>
    </div>
  );
}

/** Mono title bar shared by grid cards and gallery tiles. */
function WindowBar(props: { resume: ResumeListItem }) {
  return (
    <div class="flex items-center gap-1.5 px-3 py-2 font-mono text-[10px] text-stone">
      <span class="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
      <span class="h-1.5 w-1.5 rounded-full bg-border" aria-hidden="true" />
      <span class="truncate">{resumeSlug(props.resume.name)}</span>
      <span class="ml-auto flex-shrink-0 opacity-70">a4</span>
    </div>
  );
}

export function HomeResumeCard(props: {
  home: HomePageModel;
  resume: ResumeListItem;
  nameSegments: TextSegment[];
  variant: HomeLayout;
}) {
  const { home } = props;
  const resume = () => props.resume;
  const isGrid = () => props.variant === HomeLayout.Grid;
  const isGallery = () => props.variant === HomeLayout.Gallery;
  const isList = () => props.variant === HomeLayout.List;

  /**
   * Filing control. A select rather than the freeform input tags use, because a
   * resume is in exactly one folder or none — the control should not suggest
   * otherwise.
   */
  const folderSelect = () => (
    <Show when={home.allFolders().length > 0}>
      <select
        class={`max-w-[9rem] border border-border bg-paper px-1.5 py-0.5 font-mono text-[10px]
        text-stone transition-colors motion-reduce:transition-none hover:border-accent
        hover:text-ink disabled:opacity-50 disabled:pointer-events-none focus:outline-none
        focus-visible:ring-2 focus-visible:ring-accent ${isList() ? "rounded-full" : "rounded-sm"}`}
        aria-label={`Folder for ${resume().name}`}
        title={resume().locked ? "Unlock to change folder" : "Folder"}
        disabled={
          Boolean(resume().locked) || home.metaBusyId() === resume().id || home.actionsBusy()
        }
        data-testid="resume-folder-select"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => void home.handleAssignFolder(resume().id, e.currentTarget.value || null)}
      >
        <option value="" selected={!resume().folder}>
          Unfiled
        </option>
        <For each={home.allFolders()}>
          {(folder) => (
            <option value={folder} selected={resume().folder === folder}>
              /{folder}
            </option>
          )}
        </For>
      </select>
    </Show>
  );

  const tagRow = (opts?: { trailing?: "updated" }) => (
    <div
      class={
        isList()
          ? "mt-1.5 ml-14 flex flex-wrap items-center gap-1.5"
          : "flex flex-wrap items-center gap-1.5"
      }
      data-testid="resume-card-tags"
      onClick={(e) => e.stopPropagation()}
    >
      {folderSelect()}
      <For each={resume().tags ?? []}>
        {(tag) => (
          <span
            class={`inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-semibold text-stone ${
              isList()
                ? "rounded-full border border-border bg-surface/80"
                : "rounded-sm bg-paper border border-border"
            }`}
          >
            <span class="max-w-[8rem] truncate">{tag}</span>
            <button
              type="button"
              class="ml-0.5 rounded-full p-0.5 text-stone/70 hover:bg-accent/10 hover:text-ink transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              onClick={(e) => home.handleRemoveTag(resume().id, tag, resume().tags, e)}
              disabled={
                Boolean(resume().locked) || home.metaBusyId() === resume().id || home.actionsBusy()
              }
              title={resume().locked ? "Unlock to edit tags" : `Remove tag ${tag}`}
              aria-label={`Remove tag ${tag} from ${resume().name}`}
              data-testid="resume-tag-remove"
            >
              <svg
                class="w-2.5 h-2.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2.5"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </span>
        )}
      </For>
      <Show
        when={home.tagEditorId() === resume().id}
        fallback={
          <button
            type="button"
            class={`inline-flex items-center border border-dashed border-border px-2 py-0.5 font-mono text-[10px] text-stone hover:border-accent hover:text-ink hover:bg-accent/10 transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
              isList() ? "rounded-full" : "rounded-sm"
            }`}
            onClick={(e) => home.openTagEditor(resume().id, e)}
            disabled={
              Boolean(resume().locked) || home.metaBusyId() === resume().id || home.actionsBusy()
            }
            title={resume().locked ? "Unlock to edit tags" : undefined}
            aria-label={`Add tag to ${resume().name}`}
            data-testid="resume-tag-add"
          >
            + Tag
          </button>
        }
      >
        <form
          class="inline-flex items-center"
          onSubmit={(e) => home.handleAddTag(resume().id, resume().tags, e)}
        >
          <input
            type="text"
            class={`w-28 max-w-full border border-accent/40 bg-surface px-2.5 py-0.5 text-[10px] text-ink placeholder:text-stone/70 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 disabled:opacity-50 ${
              isList() ? "rounded-full" : "rounded-sm"
            }`}
            placeholder="Tag name"
            aria-label={`Add tag to ${resume().name}`}
            value={home.tagDrafts()[resume().id] ?? ""}
            data-testid="resume-tag-input"
            disabled={
              Boolean(resume().locked) || home.metaBusyId() === resume().id || home.actionsBusy()
            }
            onInput={(e) =>
              home.setTagDrafts((prev) => ({
                ...prev,
                [resume().id]: e.currentTarget.value,
              }))
            }
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                home.setTagDrafts((prev) => ({ ...prev, [resume().id]: "" }));
                home.closeTagEditor(resume().id);
              }
            }}
            onBlur={() => home.closeTagEditor(resume().id)}
            onClick={(e) => e.stopPropagation()}
            ref={(el) => setTimeout(() => el?.focus(), 0)}
          />
        </form>
      </Show>
      <Show when={opts?.trailing === "updated"}>
        <span class="ml-auto font-mono text-[10px] text-stone whitespace-nowrap">
          {formatUpdatedAt(resume().updatedAt)}
        </span>
      </Show>
    </div>
  );

  const renameForm = () => (
    <div class="min-w-0 flex items-center gap-2">
      <input
        type="text"
        class="font-body font-medium text-ink bg-surface border border-border rounded px-2 py-0.5 text-sm focus:outline-none focus:border-accent w-48 max-w-full"
        aria-label="Rename resume"
        value={home.renameValue()}
        onInput={(e) => home.setRenameValue(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") home.confirmRename(resume().id);
          if (e.key === "Escape") home.cancelRename();
        }}
        ref={(el) => setTimeout(() => el?.focus(), 0)}
        data-testid="rename-input"
      />
      <button
        type="button"
        class="p-1 text-accent hover:text-accent/80 transition-colors motion-reduce:transition-none"
        onClick={() => home.confirmRename(resume().id)}
        title="Confirm rename"
        aria-label="Confirm rename"
      >
        <svg
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 13l4 4L19 7"
          />
        </svg>
      </button>
      <button
        type="button"
        class="p-1 text-stone hover:text-ink transition-colors motion-reduce:transition-none"
        onClick={() => home.cancelRename()}
        title="Cancel rename"
        aria-label="Cancel rename"
      >
        <svg
          class="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );

  const docIcon = (hoverAccent = false) => (
    <div class="w-10 h-10 bg-surface rounded-lg flex items-center justify-center flex-shrink-0">
      <svg
        class={`w-5 h-5 text-stone ${hoverAccent ? "group-hover:text-accent transition-colors motion-reduce:transition-none" : ""}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    </div>
  );

  const lockedChip = () => (
    <span
      class="inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-gold/40
        bg-surface/90 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-gold"
      title="Locked"
    >
      <LockIcon locked class="w-2.5 h-2.5" />
      Locked
    </span>
  );

  const gridCard = () => (
    <article
      class="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface
        transition-[box-shadow,transform,border-color] duration-150 motion-reduce:transition-none
        hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-card
        focus-within:-translate-y-0.5 focus-within:border-accent/40 focus-within:shadow-card
        motion-reduce:transform-none motion-reduce:hover:translate-y-0"
      data-testid="resume-card"
    >
      <div class="border-b border-border bg-paper pb-3">
        <WindowBar resume={resume()} />
        <A
          href={`/edit/${resume().id}`}
          class="block px-3"
          aria-label={`Open ${resume().name}`}
          tabindex={-1}
        >
          <DocumentPreview resume={resume()} size="card" />
        </A>
      </div>

      <div class="px-3.5 pt-3 min-w-0">
        <Show when={home.renamingId() !== resume().id} fallback={renameForm()}>
          <h3 class="flex items-center gap-1.5 min-w-0">
            <Show when={resume().locked}>
              <LockIcon locked class="w-3 h-3 flex-shrink-0 text-gold" />
              <span class="sr-only">Locked</span>
            </Show>
            <A
              href={`/edit/${resume().id}`}
              class="font-display text-[0.95rem] font-semibold tracking-tight text-ink
                group-hover:text-accent transition-colors motion-reduce:transition-none truncate"
            >
              <HighlightedText segments={props.nameSegments} />
            </A>
          </h3>
        </Show>
        <Show when={resume().headline?.trim()}>
          {(headline) => (
            <p
              class="mt-1 text-xs leading-snug text-stone line-clamp-2"
              data-testid="resume-list-headline"
            >
              {headline()}
            </p>
          )}
        </Show>
      </div>

      <div class="px-3.5 pt-2.5 pb-3 min-w-0">{tagRow({ trailing: "updated" })}</div>

      <div class="mt-auto flex items-center border-t border-border px-2 py-1">
        <ResumeActions home={home} resume={resume()} />
      </div>
    </article>
  );

  const galleryCard = () => (
    <article class="group flex flex-col" data-testid="resume-card">
      <div
        class="relative overflow-hidden rounded-xl border border-border bg-paper
          transition-[transform,border-color] duration-200 motion-reduce:transition-none
          group-hover:-translate-y-0.5 group-hover:border-accent/40
          group-focus-within:border-accent/40 motion-reduce:transform-none
          motion-reduce:group-hover:translate-y-0"
      >
        <WindowBar resume={resume()} />
        <Show when={resume().locked}>
          <span class="absolute right-2.5 top-9 z-10">{lockedChip()}</span>
        </Show>
        <A
          href={`/edit/${resume().id}`}
          class="block px-3.5 pb-3.5"
          aria-label={`Open ${resume().name}`}
          tabindex={-1}
        >
          <DocumentPreview resume={resume()} size="page" />
        </A>
        <div
          class="absolute inset-x-0 bottom-0 z-10 flex justify-center bg-linear-to-t
            from-paper via-paper/85 to-transparent px-3 pb-3 pt-8 opacity-0
            transition-opacity duration-150 motion-reduce:transition-none
            pointer-events-none group-hover:pointer-events-auto
            group-focus-within:pointer-events-auto
            group-hover:opacity-100 group-focus-within:opacity-100"
        >
          <div class="rounded-lg border border-border bg-surface/95 px-1 py-0.5 shadow-soft">
            <ResumeActions home={home} resume={resume()} />
          </div>
        </div>
      </div>

      <div class="px-1 pt-2.5 min-w-0">
        <Show
          when={home.renamingId() !== resume().id}
          fallback={<div class="pb-1">{renameForm()}</div>}
        >
          <div class="flex items-baseline gap-2 min-w-0">
            <h3 class="min-w-0 truncate">
              <A
                href={`/edit/${resume().id}`}
                class="font-display text-[0.95rem] font-semibold tracking-tight text-ink
                  group-hover:text-accent transition-colors motion-reduce:transition-none"
              >
                <HighlightedText segments={props.nameSegments} />
              </A>
            </h3>
            <span class="ml-auto flex-shrink-0 font-mono text-[10px] uppercase tracking-wider text-stone">
              {formatUpdatedAt(resume().updatedAt)}
            </span>
          </div>
        </Show>
        <Show when={resume().headline?.trim()}>
          {(headline) => (
            <p class="mt-0.5 truncate text-xs text-stone" data-testid="resume-list-headline">
              {headline()}
            </p>
          )}
        </Show>
        <div class="mt-2">{tagRow()}</div>
      </div>
    </article>
  );

  const listCard = () => (
    <div
      class="group flex items-start justify-between gap-3 px-3.5 py-2.5 border border-border
      rounded-xl bg-surface hover:border-accent hover:shadow-card transition-all
      motion-reduce:transition-none"
      data-testid="resume-card"
    >
      <div class="flex-1 min-w-0">
        <Show
          when={home.renamingId() !== resume().id}
          fallback={
            <div class="flex items-center gap-3 min-w-0">
              {docIcon()}
              {renameForm()}
            </div>
          }
        >
          <A href={`/edit/${resume().id}`} class="flex items-center gap-3 min-w-0">
            {docIcon(true)}
            <div class="min-w-0 flex-1">
              <h3 class="font-display text-lg font-semibold text-ink group-hover:text-accent transition-colors motion-reduce:transition-none flex items-center gap-2 min-w-0 leading-snug">
                <span class="truncate min-w-0">
                  <HighlightedText segments={props.nameSegments} />
                </span>
                <Show when={resume().locked}>{lockedChip()}</Show>
              </h3>
              <Show when={resume().headline?.trim()}>
                {(headline) => (
                  <p
                    class="text-sm text-stone truncate leading-snug"
                    data-testid="resume-list-headline"
                  >
                    {headline()}
                  </p>
                )}
              </Show>
              <p class="text-xs text-stone leading-snug">
                Updated {formatUpdatedAt(resume().updatedAt)}
              </p>
            </div>
          </A>
        </Show>

        {tagRow()}
      </div>

      <div class="pt-0.5">
        <ResumeActions home={home} resume={resume()} />
      </div>
    </div>
  );

  return (
    <Show
      when={isGallery()}
      fallback={
        <Show when={isGrid()} fallback={listCard()}>
          {gridCard()}
        </Show>
      }
    >
      {galleryCard()}
    </Show>
  );
}
