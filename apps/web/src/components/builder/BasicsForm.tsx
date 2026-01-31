import { Show } from "solid-js";
import { Input, TextArea } from "../ui";
import { resumeStore } from "../../stores/resume";

export function BasicsForm() {
  const { store, updateBasics } = resumeStore;

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex items-center gap-3 pb-4 border-b border-border">
        <div class="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
          <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div>
          <h2 class="font-display text-lg font-semibold text-ink">Personal Information</h2>
          <p class="text-sm text-stone">Your basic contact details</p>
        </div>
      </div>

      <Show when={store.resume}>
        {(resume) => (
          <div class="space-y-4">
            {/* Name */}
            <Input
              label="Full Name"
              placeholder="John Doe"
              value={resume().basics.name}
              onInput={(value) => updateBasics("name", value)}
              required
            />

            {/* Headline */}
            <Input
              label="Headline"
              placeholder="Senior Software Engineer"
              description="Your professional title or tagline"
              value={resume().basics.headline}
              onInput={(value) => updateBasics("headline", value)}
            />

            {/* Contact Grid */}
            <div class="grid grid-cols-2 gap-4">
              <Input
                label="Email"
                type="email"
                placeholder="john@example.com"
                value={resume().basics.email}
                onInput={(value) => updateBasics("email", value)}
              />

              <Input
                label="Phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={resume().basics.phone}
                onInput={(value) => updateBasics("phone", value)}
              />
            </div>

            {/* Location */}
            <Input
              label="Location"
              placeholder="San Francisco, CA"
              value={resume().basics.location}
              onInput={(value) => updateBasics("location", value)}
            />

            {/* Website */}
            <div class="space-y-4 pt-4 border-t border-border">
              <h3 class="font-mono text-xs uppercase tracking-wider text-stone">
                Website
              </h3>
              <div class="grid grid-cols-2 gap-4">
                <Input
                  label="Label"
                  placeholder="Portfolio"
                  value={resume().basics.url.label}
                  onInput={(value) =>
                    updateBasics("url", { ...resume().basics.url, label: value })
                  }
                />
                <Input
                  label="URL"
                  type="url"
                  placeholder="https://johndoe.com"
                  value={resume().basics.url.href}
                  onInput={(value) =>
                    updateBasics("url", { ...resume().basics.url, href: value })
                  }
                />
              </div>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}
