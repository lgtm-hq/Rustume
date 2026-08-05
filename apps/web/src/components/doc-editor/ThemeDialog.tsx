/**
 * Theme selection for the document editor's top bar (spec §1.2, owner
 * addition: "version history and theme selection controls in this bar").
 *
 * A modal — matching the editor's modal-editing model (owner decision
 * 2026-08-04) — over the embedded client-side presets (`stores/themePresets`,
 * offline-first, no server dependency) plus the three custom color fields.
 * Picking a preset lands its id and all three colors as one store action;
 * hand-editing a color detaches the theme from its preset. Every write routes
 * through `docEdits` (decision 4), so the sheet recolors reactively and each
 * change is one undo entry.
 */

import { For, Show, createSignal, type JSX } from "solid-js";
import { Modal } from "../ui";
import { getThemePresets } from "../../stores/themePresets";
import { applyThemePreset, updateThemeColor } from "./docEdits";
import type { ResumeData, Theme, ThemePresetInfo } from "../../wasm/types";

export interface ThemeDialogProps {
  resume: ResumeData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const COLOR_FIELDS: readonly { field: keyof Omit<Theme, "preset">; label: string }[] = [
  { field: "background", label: "Background" },
  { field: "text", label: "Text" },
  { field: "primary", label: "Primary" },
];

const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;

export function ThemeDialog(props: ThemeDialogProps): JSX.Element {
  const presets = getThemePresets();
  const lightPresets = presets.filter((preset) => !preset.isDark);
  const darkPresets = presets.filter((preset) => preset.isDark);

  const theme = (): Theme => props.resume.metadata.theme;

  return (
    <Modal
      open={props.open}
      onOpenChange={props.onOpenChange}
      title="Theme"
      description="Colors for the rendered document — the PDF uses them too."
      size="lg"
    >
      <div class="flex flex-col gap-6" data-testid="theme-dialog">
        <section aria-label="Light themes">
          <h3 class="mb-2 font-mono text-xs uppercase tracking-wider text-stone">Light themes</h3>
          <PresetGrid presets={lightPresets} currentPresetId={theme().preset} />
        </section>

        <section aria-label="Dark themes">
          <h3 class="mb-2 font-mono text-xs uppercase tracking-wider text-stone">Dark themes</h3>
          <PresetGrid presets={darkPresets} currentPresetId={theme().preset} />
        </section>

        <section aria-label="Custom colors">
          <h3 class="mb-2 font-mono text-xs uppercase tracking-wider text-stone">Custom colors</h3>
          <div class="grid grid-cols-3 gap-4">
            <For each={COLOR_FIELDS}>
              {({ field, label }) => (
                <ColorField label={label} value={theme()[field] ?? ""} field={field} />
              )}
            </For>
          </div>
        </section>
      </div>
    </Modal>
  );
}

function PresetGrid(props: {
  presets: ThemePresetInfo[];
  currentPresetId: string | undefined;
}): JSX.Element {
  return (
    <ul class="grid grid-cols-6 gap-2">
      <For each={props.presets}>
        {(preset) => (
          <li>
            <button
              type="button"
              class={`focus-ring w-full rounded-lg border-2 p-1.5 transition-colors
                hover:border-accent
                ${
                  props.currentPresetId === preset.id
                    ? "border-accent ring-2 ring-accent/20"
                    : "border-border"
                }`}
              aria-label={`Use ${preset.name} theme`}
              aria-pressed={props.currentPresetId === preset.id}
              title={preset.name}
              onClick={() => applyThemePreset(preset)}
            >
              <span
                class="flex aspect-square w-full flex-col justify-end gap-0.5 overflow-hidden
                  rounded-md border border-border/50 p-1"
                style={{ background: preset.colors.background }}
              >
                <span
                  class="h-1 w-3/4 rounded-full opacity-60"
                  style={{ background: preset.colors.text }}
                />
                <span
                  class="h-1.5 w-1/2 rounded-full"
                  style={{ background: preset.colors.primary }}
                />
              </span>
              <span class="mt-1 block truncate text-center text-[10px] text-stone">
                {preset.name}
              </span>
            </button>
          </li>
        )}
      </For>
    </ul>
  );
}

/**
 * One theme color: a native picker behind a swatch, plus an editable hex
 * field. Only a complete `#rrggbb` value commits — partial typing must not
 * write garbage into the document.
 */
function ColorField(props: {
  label: string;
  value: string;
  field: keyof Omit<Theme, "preset">;
}): JSX.Element {
  const [draft, setDraft] = createSignal<string | null>(null);
  const inputId = (): string => `theme-color-${props.field}`;

  function commitHex(value: string): void {
    if (HEX_COLOR_REGEX.test(value)) {
      setDraft(null);
      updateThemeColor(props.field, value);
      return;
    }
    setDraft(value);
  }

  return (
    <div class="space-y-1.5">
      <label for={inputId()} class="block font-mono text-xs uppercase tracking-wider text-stone">
        {props.label}
      </label>
      <div class="flex items-center gap-2">
        <span
          class="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg border border-border"
          style={{ background: props.value }}
        >
          <input
            type="color"
            value={props.value}
            aria-label={`Pick ${props.label.toLowerCase()} color`}
            class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            // `change`, not `input`: the native picker fires `input` on every
            // drag tick, which would burn one store write (and undo entry)
            // per tick — `change` commits once per completed selection.
            onChange={(event) => {
              setDraft(null);
              updateThemeColor(props.field, event.currentTarget.value);
            }}
          />
        </span>
        <input
          id={inputId()}
          type="text"
          value={draft() ?? props.value}
          maxLength={7}
          placeholder="#000000"
          class="focus-ring w-full rounded-lg border border-border bg-surface px-2 py-1.5
            font-mono text-xs uppercase"
          onInput={(event) => commitHex(event.currentTarget.value)}
          onBlur={() => setDraft(null)}
        />
      </div>
      <Show when={draft() !== null}>
        <p class="text-[10px] text-stone">Use a full #rrggbb value.</p>
      </Show>
    </div>
  );
}
