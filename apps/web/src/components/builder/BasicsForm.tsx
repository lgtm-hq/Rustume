import { useI18n } from "../../i18n";
import { Show } from "solid-js";
import { Input } from "../ui";
import { resumeStore } from "../../stores/resume";
import { ImageUpload } from "./ImageUpload";
import type { Picture } from "../../wasm/types";

export function BasicsForm() {
  const { t } = useI18n();
  const { store, updateBasics } = resumeStore;

  function handlePictureChange(picture: Picture) {
    updateBasics("picture", picture);
  }

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex items-center gap-3 pb-4 border-b border-border">
        <div class="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
          <svg class="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        </div>
        <div>
          <h2 class="font-display text-lg font-semibold text-ink">{t("builder.basics.title")}</h2>
          <p class="text-sm text-stone">{t("builder.basics.subtitle")}</p>
        </div>
      </div>

      <Show when={store.resume}>
        {(resume) => (
          <div class="space-y-4">
            {/* Name */}
            <Input
              label={t("builder.basics.fullName")}
              placeholder={t("builder.basics.fullNamePlaceholder")}
              value={resume().basics.name}
              onInput={(value) => updateBasics("name", value)}
              required
            />

            {/* Headline */}
            <Input
              label={t("builder.basics.headline")}
              placeholder={t("builder.basics.headlinePlaceholder")}
              description={t("builder.basics.headlineDescription")}
              value={resume().basics.headline}
              onInput={(value) => updateBasics("headline", value)}
            />

            {/* Contact Grid */}
            <div class="grid grid-cols-2 gap-4">
              <Input
                label={t("builder.basics.email")}
                type="email"
                placeholder={t("builder.basics.emailPlaceholder")}
                value={resume().basics.email}
                onInput={(value) => updateBasics("email", value)}
              />

              <Input
                label={t("builder.basics.phone")}
                type="tel"
                placeholder={t("builder.basics.phonePlaceholder")}
                value={resume().basics.phone}
                onInput={(value) => updateBasics("phone", value)}
              />
            </div>

            {/* Location */}
            <Input
              label={t("builder.fields.location")}
              placeholder={t("builder.fields.locationPlaceholder")}
              value={resume().basics.location}
              onInput={(value) => updateBasics("location", value)}
            />

            {/* Website */}
            <div class="space-y-4 pt-4 border-t border-border">
              <h3 class="font-mono text-xs uppercase tracking-wider text-stone">Website</h3>
              <div class="grid grid-cols-2 gap-4">
                <Input
                  label={t("builder.basics.label")}
                  placeholder={t("builder.basics.labelPlaceholder")}
                  value={resume().basics.url.label}
                  onInput={(value) => updateBasics("url", { ...resume().basics.url, label: value })}
                />
                <Input
                  label={t("builder.basics.url")}
                  type="url"
                  placeholder={t("builder.basics.urlPlaceholder")}
                  value={resume().basics.url.href}
                  onInput={(value) => updateBasics("url", { ...resume().basics.url, href: value })}
                />
              </div>
            </div>

            {/* Profile Photo */}
            <ImageUpload picture={resume().basics.picture} onPictureChange={handlePictureChange} />
          </div>
        )}
      </Show>
    </div>
  );
}
