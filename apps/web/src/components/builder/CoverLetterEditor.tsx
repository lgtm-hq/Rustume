import { Show } from "solid-js";
import { Input, Switch } from "../ui";
import { LazyRichTextEditor as RichTextEditor } from "../ui/LazyRichTextEditor";
import { resumeStore } from "../../stores/resume";

export function CoverLetterEditor() {
  const { store, updateCoverLetter, updateCoverLetterRecipient, toggleSectionVisibility } =
    resumeStore;

  return (
    <div class="space-y-4">
      {/* Header */}
      <div class="flex items-center gap-3 pb-4 border-b border-border">
        <div class="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
          <svg
            class="w-5 h-5 text-accent"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 4h16v16H4V4zm4 4h8M8 12h8M8 16h5"
            />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <h2 class="font-display text-lg font-semibold text-ink">Cover Letter</h2>
          <p class="text-sm text-stone">Recipient details and letter body</p>
        </div>
        <Show when={store.resume}>
          {(resume) => (
            <Switch
              label="Visible"
              description="Include in PDF export"
              checked={resume().sections.coverLetter.visible}
              onChange={() => toggleSectionVisibility("coverLetter")}
            />
          )}
        </Show>
      </div>

      <Show when={store.resume}>
        {(resume) => (
          <div class="space-y-6">
            <div class="space-y-4">
              <h3 class="font-mono text-xs uppercase tracking-wider text-stone">Recipient</h3>

              <Input
                label="Name"
                placeholder="Jane Smith"
                value={resume().sections.coverLetter.recipient.name}
                onInput={(value) => updateCoverLetterRecipient("name", value)}
              />

              <div class="grid grid-cols-2 gap-4">
                <Input
                  label="Title"
                  placeholder="Hiring Manager"
                  value={resume().sections.coverLetter.recipient.title}
                  onInput={(value) => updateCoverLetterRecipient("title", value)}
                />
                <Input
                  label="Company"
                  placeholder="Acme Corp"
                  value={resume().sections.coverLetter.recipient.company}
                  onInput={(value) => updateCoverLetterRecipient("company", value)}
                />
              </div>

              <Input
                label="Address"
                placeholder="123 Main St, City, ST 12345"
                value={resume().sections.coverLetter.recipient.address}
                onInput={(value) => updateCoverLetterRecipient("address", value)}
              />

              <Input
                label="Email"
                type="email"
                placeholder="jane@acme.com"
                value={resume().sections.coverLetter.recipient.email}
                onInput={(value) => updateCoverLetterRecipient("email", value)}
              />
            </div>

            <div class="space-y-4 pt-4 border-t border-border">
              <h3 class="font-mono text-xs uppercase tracking-wider text-stone">Letter Body</h3>
              <RichTextEditor
                placeholder="Write your cover letter. Introduce yourself, explain why you're a strong fit, and close with a clear call to action..."
                value={resume().sections.coverLetter.content}
                onInput={updateCoverLetter}
              />
            </div>
          </div>
        )}
      </Show>

      <p class="text-xs text-stone">
        Tip: Keep the letter to one page. Address a specific person when you can, and mirror
        language from the job posting.
      </p>
    </div>
  );
}
