import { Show } from "solid-js";
import { Input } from "../ui";
import { LazyRichTextEditor as RichTextEditor } from "../ui/LazyRichTextEditor";
import { resumeStore } from "../../stores/resume";

export function CoverLetterEditor() {
  const { store, updateCoverLetterContent, updateCoverLetterRecipient } = resumeStore;

  return (
    <div class="space-y-4">
      {/* Header */}
      <div class="flex items-center gap-3 pb-4 border-b border-border">
        <div class="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
          <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <div>
          <h2 class="font-display text-lg font-semibold text-ink">Cover Letter</h2>
          <p class="text-sm text-stone">Address a recipient and write your letter</p>
        </div>
      </div>

      <Show when={store.resume}>
        {(resume) => (
          <div class="space-y-4">
            {/* Recipient */}
            <div class="space-y-4">
              <h3 class="font-mono text-xs uppercase tracking-wider text-stone">Recipient</h3>

              <div class="grid grid-cols-2 gap-4">
                <Input
                  label="Name"
                  placeholder="Jane Smith"
                  value={resume().sections.coverLetter.recipient.name}
                  onInput={(value) => updateCoverLetterRecipient("name", value)}
                />
                <Input
                  label="Title"
                  placeholder="Hiring Manager"
                  value={resume().sections.coverLetter.recipient.title}
                  onInput={(value) => updateCoverLetterRecipient("title", value)}
                />
              </div>

              <div class="grid grid-cols-2 gap-4">
                <Input
                  label="Company"
                  placeholder="Acme Corp"
                  value={resume().sections.coverLetter.recipient.company}
                  onInput={(value) => updateCoverLetterRecipient("company", value)}
                />
                <Input
                  label="Email"
                  type="email"
                  placeholder="jane@acme.com"
                  value={resume().sections.coverLetter.recipient.email}
                  onInput={(value) => updateCoverLetterRecipient("email", value)}
                />
              </div>

              <Input
                label="Address"
                placeholder="123 Main St, San Francisco, CA"
                value={resume().sections.coverLetter.recipient.address}
                onInput={(value) => updateCoverLetterRecipient("address", value)}
              />
            </div>

            {/* Body */}
            <div class="space-y-2 pt-4 border-t border-border">
              <h3 class="font-mono text-xs uppercase tracking-wider text-stone">Letter</h3>
              <RichTextEditor
                placeholder="Dear Hiring Manager, I'm excited to apply for..."
                value={resume().sections.coverLetter.content}
                onInput={updateCoverLetterContent}
              />
            </div>
          </div>
        )}
      </Show>

      <p class="text-xs text-stone">
        Tip: Tailor each letter to the role. Toggle the Cover Letter section on to include it in
        your resume PDF, or export it separately from the Export menu.
      </p>
    </div>
  );
}
