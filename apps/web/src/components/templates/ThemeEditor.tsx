import { Show, For, createResource, createSignal } from "solid-js";
import { resumeStore } from "../../stores/resume";
import { get } from "../../api/client";
import type { ThemePresetInfo } from "../../wasm/types";

export function ThemeEditor() {
  const { store, updateTheme } = resumeStore;
  const [activeTab, setActiveTab] = createSignal<"presets" | "custom">("presets");

  // Fetch theme presets from API
  const [presets] = createResource(async () => {
    try {
      return await get<ThemePresetInfo[]>("/themes");
    } catch (e) {
      console.error("Failed to fetch themes:", e);
      return [];
    }
  });

  const lightPresets = () => presets()?.filter((p) => !p.isDark) ?? [];
  const darkPresets = () => presets()?.filter((p) => p.isDark) ?? [];

  const applyPreset = (preset: ThemePresetInfo) => {
    updateTheme({
      preset: preset.id,
      background: preset.colors.background,
      text: preset.colors.text,
      primary: preset.colors.primary,
    });
  };

  const currentPresetId = () => store.resume?.metadata.theme.preset;

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
              d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
            />
          </svg>
        </div>
        <div>
          <h2 class="font-display text-lg font-semibold text-ink">Theme</h2>
          <p class="text-sm text-stone">Choose a color scheme</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div class="flex gap-1 p-1 bg-surface rounded-lg">
        <button
          onClick={() => setActiveTab("presets")}
          class={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeTab() === "presets" ? "bg-white text-ink shadow-sm" : "text-stone hover:text-ink"
          }`}
        >
          Presets
        </button>
        <button
          onClick={() => setActiveTab("custom")}
          class={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeTab() === "custom" ? "bg-white text-ink shadow-sm" : "text-stone hover:text-ink"
          }`}
        >
          Custom
        </button>
      </div>

      <Show when={store.resume}>
        {(resume) => (
          <div class="space-y-4">
            {/* Presets Tab */}
            <Show when={activeTab() === "presets"}>
              <Show when={presets.loading}>
                <div class="flex items-center justify-center py-8 text-stone">
                  Loading presets...
                </div>
              </Show>

              <Show when={!presets.loading && presets()}>
                <div class="space-y-4">
                  {/* Light Themes */}
                  <div>
                    <h3 class="font-mono text-xs uppercase tracking-wider text-stone mb-2">
                      Light Themes
                    </h3>
                    <div class="grid grid-cols-4 gap-2">
                      <For each={lightPresets()}>
                        {(preset) => (
                          <PresetCard
                            preset={preset}
                            isSelected={currentPresetId() === preset.id}
                            onSelect={() => applyPreset(preset)}
                          />
                        )}
                      </For>
                    </div>
                  </div>

                  {/* Dark Themes */}
                  <div>
                    <h3 class="font-mono text-xs uppercase tracking-wider text-stone mb-2">
                      Dark Themes
                    </h3>
                    <div class="grid grid-cols-4 gap-2">
                      <For each={darkPresets()}>
                        {(preset) => (
                          <PresetCard
                            preset={preset}
                            isSelected={currentPresetId() === preset.id}
                            onSelect={() => applyPreset(preset)}
                          />
                        )}
                      </For>
                    </div>
                  </div>
                </div>
              </Show>
            </Show>

            {/* Custom Tab */}
            <Show when={activeTab() === "custom"}>
              {/* Color Inputs */}
              <div class="grid grid-cols-3 gap-4">
                <ColorInput
                  label="Background"
                  value={resume().metadata.theme.background}
                  onChange={(v) => updateTheme({ background: v, preset: undefined })}
                />
                <ColorInput
                  label="Text"
                  value={resume().metadata.theme.text}
                  onChange={(v) => updateTheme({ text: v, preset: undefined })}
                />
                <ColorInput
                  label="Primary"
                  value={resume().metadata.theme.primary}
                  onChange={(v) => updateTheme({ primary: v, preset: undefined })}
                />
              </div>
            </Show>

            {/* Preview */}
            <div class="p-4 rounded-lg border border-border">
              <div
                class="p-4 rounded-lg"
                style={{ background: resume().metadata.theme.background }}
              >
                <h3
                  class="font-display font-semibold mb-2"
                  style={{ color: resume().metadata.theme.text }}
                >
                  Preview
                </h3>
                <p class="text-sm mb-2" style={{ color: resume().metadata.theme.text }}>
                  This is how your resume colors will look.
                </p>
                <span
                  class="inline-block px-2 py-1 rounded text-xs font-medium"
                  style={{
                    background: resume().metadata.theme.primary,
                    color: resume().metadata.theme.background,
                  }}
                >
                  Accent Badge
                </span>
              </div>
            </div>
          </div>
        )}
      </Show>
    </div>
  );
}

interface PresetCardProps {
  preset: ThemePresetInfo;
  isSelected: boolean;
  onSelect: () => void;
}

function PresetCard(props: PresetCardProps) {
  return (
    <button
      onClick={props.onSelect}
      class={`relative p-2 rounded-lg border-2 transition-all hover:scale-105 ${
        props.isSelected ? "border-accent shadow-md" : "border-border hover:border-accent/50"
      }`}
      title={props.preset.name}
    >
      {/* Color Preview */}
      <div
        class="w-full aspect-square rounded-md overflow-hidden"
        style={{ background: props.preset.colors.background }}
      >
        <div class="h-full flex flex-col justify-end p-1">
          {/* Text preview line */}
          <div
            class="h-1 w-3/4 rounded-full mb-0.5"
            style={{ background: props.preset.colors.text, opacity: 0.6 }}
          />
          {/* Primary accent bar */}
          <div
            class="h-1.5 w-1/2 rounded-full"
            style={{ background: props.preset.colors.primary }}
          />
        </div>
      </div>
      {/* Name */}
      <p class="text-[10px] mt-1 text-center text-stone truncate">{props.preset.name}</p>
      {/* Selected indicator */}
      <Show when={props.isSelected}>
        <div class="absolute -top-1 -right-1 w-4 h-4 bg-accent rounded-full flex items-center justify-center">
          <svg class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="3"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      </Show>
    </button>
  );
}

interface ColorInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

function isValidHexColor(value: string): boolean {
  return HEX_COLOR_REGEX.test(value);
}

function ColorInput(props: ColorInputProps) {
  let colorInputRef: HTMLInputElement | undefined;

  const openColorPicker = () => {
    colorInputRef?.click();
  };

  const handleTextInput = (value: string) => {
    // Only update if it's a valid hex color
    if (isValidHexColor(value)) {
      props.onChange(value);
    }
  };

  return (
    <div class="space-y-2">
      <label class="font-mono text-xs uppercase tracking-wider text-stone block">
        {props.label}
      </label>

      {/* Large clickable color swatch */}
      <button
        type="button"
        onClick={openColorPicker}
        class="w-full aspect-square rounded-xl border-2 border-border cursor-pointer
          transition-all hover:border-accent hover:scale-[1.02] hover:shadow-lg
          focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        style={{ background: props.value }}
        title="Click to pick a color"
      >
        {/* Hidden native color input */}
        <input
          ref={(el) => (colorInputRef = el)}
          type="color"
          value={props.value}
          onInput={(e) => props.onChange(e.currentTarget.value)}
          class="sr-only"
        />
      </button>

      {/* Hex value display/edit */}
      <input
        type="text"
        value={props.value}
        onInput={(e) => handleTextInput(e.currentTarget.value)}
        class="w-full px-2 py-1.5 text-xs font-mono text-center bg-surface border border-border
          rounded-lg focus:outline-none focus:border-accent uppercase"
        maxLength={7}
        placeholder="#000000"
        pattern="^#[0-9A-Fa-f]{6}$"
      />
    </div>
  );
}
