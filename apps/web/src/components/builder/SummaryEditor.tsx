import { Show } from "solid-js";
import { useI18n } from "../../i18n";
import { LazyRichTextEditor as RichTextEditor } from "../ui/LazyRichTextEditor";
import { resumeStore } from "../../stores/resume";

export function SummaryEditor() {
  const { t } = useI18n();
  const { store, updateSummary } = resumeStore;

  return (
    <div class="space-y-4">
      <div class="flex items-center gap-3 pb-4 border-b border-border">
        <div class="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
          <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h7"
            />
          </svg>
        </div>
        <div>
          <h2 class="font-display text-lg font-semibold text-ink">
            {t("builder.summaryEditor.title")}
          </h2>
          <p class="text-sm text-stone">{t("builder.summaryEditor.subtitle")}</p>
        </div>
      </div>

      <Show when={store.resume}>
        {(resume) => (
          <RichTextEditor
            placeholder={t("builder.summaryEditor.placeholder")}
            value={resume().sections.summary.content}
            onInput={updateSummary}
          />
        )}
      </Show>
    </div>
  );
}
