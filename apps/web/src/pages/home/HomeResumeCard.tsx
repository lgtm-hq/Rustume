import { For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { Spinner } from "../../components/ui";
import type { TextSegment } from "../../lib/resumeSearch";
import { HomeLayout } from "../../lib/homeLayout";
import type { ResumeListItem } from "../../stores/persistence";
import { formatUpdatedAt, HighlightedText } from "./shared";
import type { HomePageModel } from "./useHomePage";

function ResumeActions(props: { home: HomePageModel; resume: ResumeListItem }) {
  const { home } = props;
  const resume = () => props.resume;

  return (
    <div class="flex items-center gap-1 flex-shrink-0">
      <button
        type="button"
        class="p-2 text-stone hover:text-accent hover:bg-accent/10 rounded-lg transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={(e) => home.handleToggleLock(resume().id, Boolean(resume().locked), e)}
        title={resume().locked ? "Unlock" : "Lock"}
        aria-label={resume().locked ? "Unlock resume" : "Lock resume"}
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <Show
            when={resume().locked}
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
      </button>
      <button
        type="button"
        class="p-2 text-stone hover:text-accent hover:bg-accent/10 rounded-lg transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={(e) => home.startRename(resume().id, resume().name, e)}
        disabled={Boolean(resume().locked) || home.actionsBusy()}
        title="Rename"
        aria-label="Rename resume"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
          disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={(e) => home.handleDelete(resume().id, e)}
        disabled={Boolean(resume().locked) || home.actionsBusy()}
        title={resume().locked ? "Unlock to delete" : "Delete"}
        aria-label="Delete resume"
      >
        <Show when={home.deletingId() !== resume().id} fallback={<Spinner class="w-5 h-5" />}>
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
          disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={(e) => home.handleDuplicate(resume().id, e)}
        disabled={home.actionsBusy()}
        title="Duplicate"
        aria-label="Duplicate resume"
      >
        <Show when={home.duplicatingId() !== resume().id} fallback={<Spinner class="w-5 h-5" />}>
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
          class="w-5 h-5 text-stone group-hover:text-accent transition-colors"
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

export function HomeResumeCard(props: {
  home: HomePageModel;
  resume: ResumeListItem;
  nameSegments: TextSegment[];
  variant: HomeLayout;
}) {
  const { home } = props;
  const resume = () => props.resume;
  const isGrid = () => props.variant === HomeLayout.Grid;

  const tagRow = (opts?: { trailing?: "updated" }) => (
    <div
      class={
        isGrid()
          ? "mt-auto flex flex-wrap items-center gap-1.5 pt-2.5"
          : "mt-1.5 ml-14 flex flex-wrap items-center gap-1.5"
      }
      data-testid="resume-card-tags"
      onClick={(e) => e.stopPropagation()}
    >
      <For each={resume().tags ?? []}>
        {(tag) => (
          <span
            class={`inline-flex items-center gap-0.5 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold text-stone ${
              isGrid() ? "bg-paper" : "rounded-full border border-border bg-surface/80"
            }`}
          >
            <span class="max-w-[8rem] truncate">{tag}</span>
            <button
              type="button"
              class="ml-0.5 rounded-full p-0.5 text-stone/70 hover:bg-accent/10 hover:text-ink transition-colors"
              onClick={(e) => home.handleRemoveTag(resume().id, tag, resume().tags, e)}
              title={`Remove tag ${tag}`}
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
            class={`inline-flex items-center border border-dashed border-border px-2 py-0.5 text-[10px] text-stone hover:border-accent hover:text-ink hover:bg-accent/10 transition-colors ${
              isGrid() ? "rounded-sm" : "rounded-full"
            }`}
            onClick={(e) => home.openTagEditor(resume().id, e)}
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
            class={`w-28 max-w-full border border-accent/40 bg-surface px-2.5 py-0.5 text-[10px] text-ink placeholder:text-stone/70 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 ${
              isGrid() ? "rounded-sm" : "rounded-full"
            }`}
            placeholder="Tag name"
            aria-label={`Add tag to ${resume().name}`}
            value={home.tagDrafts()[resume().id] ?? ""}
            data-testid="resume-tag-input"
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
        <span class="ml-auto text-[10px] text-stone whitespace-nowrap">
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
        class="p-1 text-accent hover:text-accent/80 transition-colors"
        onClick={() => home.confirmRename(resume().id)}
        title="Confirm rename"
        aria-label="Confirm rename"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
      </button>
      <button
        type="button"
        class="p-1 text-stone hover:text-ink transition-colors"
        onClick={() => home.cancelRename()}
        title="Cancel rename"
        aria-label="Cancel rename"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
        class={`w-5 h-5 text-stone ${hoverAccent ? "group-hover:text-accent transition-colors" : ""}`}
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

  const previewPane = () => (
    <div
      class="relative h-[7.5rem] border-b border-border px-4 pt-3.5
        bg-gradient-to-b from-paper to-surface"
      data-testid="resume-card-preview"
    >
      <span class="mb-2.5 block h-1.5 w-[42%] rounded-sm bg-ink/85" aria-hidden="true" />
      <span
        class="block h-[0.28rem] w-[78%] rounded-sm bg-stone/35
          shadow-[0_0.55rem_0_color-mix(in_srgb,var(--color-stone)_28%,transparent),0_1.1rem_0_color-mix(in_srgb,var(--color-stone)_22%,transparent),0_1.65rem_0_color-mix(in_srgb,var(--color-stone)_18%,transparent)]"
        aria-hidden="true"
      />
      <Show when={resume().locked}>
        <span
          class="absolute top-2 right-2 rounded-sm bg-ink px-1.5 py-0.5 text-[10px]
            font-bold uppercase tracking-wider text-paper"
          title="Locked"
        >
          Locked
        </span>
      </Show>
    </div>
  );

  const gridCard = () => (
    <article
      class="group flex flex-col min-h-[14rem] overflow-hidden border border-border rounded-lg
        bg-surface shadow-[0_1px_0_color-mix(in_srgb,var(--color-ink)_4%,transparent)]
        transition-[box-shadow,transform,border-color] duration-150
        hover:-translate-y-0.5 hover:border-stone hover:shadow-card
        focus-within:-translate-y-0.5 focus-within:border-stone focus-within:shadow-card
        motion-reduce:transform-none motion-reduce:transition-none"
      data-testid="resume-card"
    >
      <Show
        when={home.renamingId() !== resume().id}
        fallback={
          <>
            {previewPane()}
            <div class="px-4 pt-3.5 min-w-0">{renameForm()}</div>
          </>
        }
      >
        <A href={`/edit/${resume().id}`} class="block min-w-0">
          {previewPane()}
          <div class="px-4 pt-3.5 min-w-0">
            <h3
              class="font-display text-[0.95rem] font-semibold tracking-tight text-ink
                group-hover:text-accent transition-colors truncate"
            >
              <HighlightedText segments={props.nameSegments} />
            </h3>
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
        </A>
      </Show>

      <div class="flex flex-1 flex-col px-4 pb-4 min-w-0">{tagRow({ trailing: "updated" })}</div>

      <div class="flex justify-end gap-0.5 px-2.5 pb-2.5">
        <ResumeActions home={home} resume={resume()} />
      </div>
    </article>
  );

  const listCard = () => (
    <div
      class="group flex items-start justify-between gap-3 px-3.5 py-2.5 border border-border
      rounded-xl hover:border-accent hover:shadow-card transition-all bg-paper"
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
              <h3 class="font-body font-medium text-ink group-hover:text-accent transition-colors flex items-center gap-2 min-w-0 leading-snug">
                <span class="truncate min-w-0">
                  <HighlightedText segments={props.nameSegments} />
                </span>
                <Show when={resume().locked}>
                  <span
                    class="inline-flex flex-shrink-0 items-center rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-mono uppercase text-stone border border-border"
                    title="Locked"
                  >
                    Locked
                  </span>
                </Show>
              </h3>
              <Show when={resume().headline?.trim()}>
                {(headline) => (
                  <p class="text-sm text-accent/65 truncate leading-snug" data-testid="resume-list-headline">
                    {headline()}
                  </p>
                )}
              </Show>
              <p class="text-xs text-stone leading-snug">Updated {formatUpdatedAt(resume().updatedAt)}</p>
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
    <Show when={isGrid()} fallback={listCard()}>
      {gridCard()}
    </Show>
  );
}
