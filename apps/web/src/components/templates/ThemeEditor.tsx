import { Show, For, createSignal } from "solid-js";
import { resumeStore } from "../../stores/resume";
import { getThemePresets } from "../../stores/themePresets";
import type { Metadata, PageConfig, ThemePresetInfo } from "../../wasm/types";

// Must match the templates wired to sidebar-ratio helpers in
// crates/render/src/typst_engine/templates/<template>.typ.
const SIDEBAR_TEMPLATES = new Set(["azurill", "pikachu", "chikorita", "ditto", "gengar", "glalie"]);
const SIDEBAR_TEMPLATE_RATIO_DEFAULT = 1 / 3;
// Must match the sidebar-width defaults in
// crates/render/src/typst_engine/templates/<template>.typ.
const FIXED_SIDEBAR_WIDTH_PT: Record<string, number> = {
  pikachu: 180,
  ditto: 160,
  gengar: 170,
  glalie: 170,
};
const PAPER_WIDTH_PT: Record<PageConfig["format"], number> = {
  a4: 595.28,
  letter: 612,
};

const LEVEL_DISPLAY_OPTIONS: { value: Metadata["levelDisplay"]; label: string }[] = [
  { value: "template-default", label: "Template default" },
  { value: "hidden", label: "Hidden" },
  { value: "circle", label: "Circles" },
  { value: "square", label: "Squares" },
  { value: "progress-bar", label: "Progress bar" },
  { value: "text", label: "Text label" },
];

export function ThemeEditor() {
  const { store, updateTheme, updateMetadata } = resumeStore;
  const [activeTab, setActiveTab] = createSignal<"presets" | "custom" | "css">("presets");

  // Theme presets are embedded client-side -- no network dependency.
  const presets = getThemePresets();

  const lightPresets = presets.filter((p) => !p.isDark);
  const darkPresets = presets.filter((p) => p.isDark);

  const applyPreset = (preset: ThemePresetInfo) => {
    updateTheme({
      preset: preset.id,
      background: preset.colors.background,
      text: preset.colors.text,
      primary: preset.colors.primary,
    });
  };

  const currentPresetId = () => store.resume?.metadata.theme.preset;
  const isSidebarTemplate = (template: string) => SIDEBAR_TEMPLATES.has(template);

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
          Custom Colors
        </button>
        <button
          onClick={() => setActiveTab("css")}
          class={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeTab() === "css" ? "bg-white text-ink shadow-sm" : "text-stone hover:text-ink"
          }`}
        >
          CSS
        </button>
      </div>

      <Show when={store.resume}>
        {(resume) => (
          <div class="space-y-4">
            {/* Presets Tab */}
            <Show when={activeTab() === "presets"}>
              <div class="space-y-4">
                {/* Light Themes */}
                <div>
                  <h3 class="font-mono text-xs uppercase tracking-wider text-stone mb-2">
                    Light Themes
                  </h3>
                  <div class="grid grid-cols-4 gap-2">
                    <For each={lightPresets}>
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
                    <For each={darkPresets}>
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

            {/* Custom Colors Tab */}
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

            {/* Custom CSS Tab */}
            <Show when={activeTab() === "css"}>
              <CustomCssTab
                css={resume().metadata.css ?? { value: "", visible: false }}
                onChange={(css) => updateMetadata("css", css)}
              />
            </Show>

            <Show when={isSidebarTemplate(resume().metadata.template)}>
              <SidebarRatioControl
                template={resume().metadata.template}
                page={resume().metadata.page}
                onChange={(sidebarRatio) =>
                  updateMetadata("page", { ...resume().metadata.page, sidebarRatio })
                }
              />
            </Show>

            <div class="space-y-2">
              <label
                for="proficiency-display"
                class="font-mono text-xs uppercase tracking-wider text-stone block"
              >
                Proficiency display
              </label>
              <select
                id="proficiency-display"
                value={resume().metadata.levelDisplay ?? "template-default"}
                onChange={(e) =>
                  updateMetadata("levelDisplay", e.currentTarget.value as Metadata["levelDisplay"])
                }
                class="w-full px-3 py-2 text-sm bg-surface border border-border rounded-lg
                  focus:outline-none focus:border-accent"
              >
                <For each={LEVEL_DISPLAY_OPTIONS}>
                  {(option) => <option value={option.value}>{option.label}</option>}
                </For>
              </select>
            </div>

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

interface SidebarRatioControlProps {
  template: string;
  page: PageConfig;
  onChange: (sidebarRatio: number | undefined) => void;
}

function defaultSidebarRatio(template: string, page: PageConfig): number {
  const fixedWidth = FIXED_SIDEBAR_WIDTH_PT[template];
  if (fixedWidth === undefined) return SIDEBAR_TEMPLATE_RATIO_DEFAULT;

  const paperWidth = PAPER_WIDTH_PT[page.format] ?? PAPER_WIDTH_PT.a4;
  const contentWidth = paperWidth - 2 * page.margin;
  if (contentWidth <= 0) return SIDEBAR_TEMPLATE_RATIO_DEFAULT;

  return Math.min(0.5, Math.max(0.1, fixedWidth / contentWidth));
}

function formatRatio(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function SidebarRatioControl(props: SidebarRatioControlProps) {
  // Older server payloads serialized the unset ratio as an explicit null;
  // normalize so null and undefined both mean "template default".
  const ratioOverride = () => props.page.sidebarRatio ?? undefined;
  const currentRatio = () => ratioOverride() ?? defaultSidebarRatio(props.template, props.page);
  const labelValue = () => {
    const override = ratioOverride();
    return override === undefined ? "Template default" : formatRatio(override);
  };

  return (
    <div class="space-y-3 pt-4 border-t border-border">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="font-mono text-xs uppercase tracking-wider text-stone">Sidebar Width</h3>
          <p class="text-xs text-stone mt-1">Adjust the sidebar column for this template.</p>
        </div>
        <button
          type="button"
          onClick={() => props.onChange(undefined)}
          class="text-xs font-medium text-accent hover:text-accent/80"
        >
          Reset to template default
        </button>
      </div>

      <div class="space-y-1.5">
        <label
          for="sidebar-ratio-input"
          class="font-mono text-xs uppercase tracking-wider text-stone flex justify-between"
        >
          <span>Width</span>
          <span class="font-body normal-case tracking-normal">{labelValue()}</span>
        </label>
        <input
          id="sidebar-ratio-input"
          type="range"
          min="0.10"
          max="0.50"
          step="0.01"
          value={currentRatio()}
          onInput={(e) => props.onChange(parseFloat(e.currentTarget.value))}
          class="w-full accent-[var(--turbo-brand-primary)]"
          aria-label="Sidebar width"
          aria-valuetext={formatRatio(currentRatio())}
        />
      </div>
    </div>
  );
}

interface CustomCssTabProps {
  css: { value: string; visible: boolean };
  onChange: (css: { value: string; visible: boolean }) => void;
}

function CustomCssTab(props: CustomCssTabProps) {
  const toggleVisible = () => {
    props.onChange({ ...props.css, visible: !props.css.visible });
  };

  const handleInput = (value: string) => {
    props.onChange({ ...props.css, value });
  };

  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-sm font-medium text-ink">Enable custom CSS</p>
          <p class="text-xs text-stone">Inject styles into HTML and print views</p>
        </div>
        <button
          type="button"
          aria-pressed={props.css.visible}
          aria-label="Enable custom CSS"
          onClick={toggleVisible}
          class={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
            props.css.visible ? "bg-accent" : "bg-border"
          }`}
        >
          <span
            class={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-paper shadow-sm transition-transform ${
              props.css.visible ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <div class="space-y-2">
        <label
          for="custom-css-input"
          class="font-mono text-xs uppercase tracking-wider text-stone block"
        >
          Custom CSS
        </label>
        <textarea
          id="custom-css-input"
          value={props.css.value}
          onInput={(e) => handleInput(e.currentTarget.value)}
          rows={10}
          spellcheck={false}
          class="w-full px-3 py-2 text-xs font-mono bg-surface border border-border rounded-lg
            focus:outline-none focus:border-accent resize-y min-h-[160px]"
          placeholder={`.resume-title {\n  letter-spacing: 0.05em;\n}`}
        />
      </div>

      <p class="text-xs text-stone leading-relaxed">
        Custom CSS applies to HTML and print surfaces in the editor (for example browser print via
        Cmd/Ctrl+P). Selectors are scoped to the resume content area and cannot affect the app UI.
        The live preview image and PDF export use Typst templates and theme controls instead —
        custom CSS does not affect PDF export.
      </p>
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
