/**
 * Edit `basics.picture`: the image itself, its size and shape, and its effects.
 *
 * Upload, resize and colour handling come from `lib/imageUpload`, shared with
 * the form builder's `ImageUpload` so a photo is ingested identically whichever
 * surface the user reached for.
 *
 * The dialog edits a draft and commits **once**, on save, through a single
 * `updateBasics("picture", …)` — so changing the size, the radius and three
 * effects together is one undo entry rather than five.
 */

import { Show, createEffect, createSignal, type JSX } from "solid-js";
import { Button, Modal, Switch, toast } from "../ui";
import {
  ACCEPTED_IMAGE_TYPES,
  expandShortHex,
  isHexColor,
  normalizeHexColor,
  processImage,
  validateImageFile,
} from "../../lib/imageUpload";
import { updatePicture } from "./docEdits";
import type { Picture } from "../../wasm/types";

/** Point bounds for the stored photo size, matching the form builder's slider. */
const MIN_SIZE = 32;
const MAX_SIZE = 200;
const MAX_BORDER_WIDTH = 10;
const MAX_SHADOW_SIZE = 20;

export interface PhotoDialogProps {
  open: boolean;
  /** The picture as stored. */
  picture: Picture;
  onOpenChange: (open: boolean) => void;
}

export function PhotoDialog(props: PhotoDialogProps): JSX.Element {
  const [draft, setDraft] = createSignal<Picture>(props.picture);
  const [isProcessing, setIsProcessing] = createSignal(false);

  let fileInput: HTMLInputElement | undefined;

  createEffect(() => {
    if (!props.open) return;
    setDraft({ ...props.picture, effects: { ...props.picture.effects } });
  });

  function patch(updates: Partial<Picture>): void {
    setDraft((current) => ({ ...current, ...updates }));
  }

  function patchEffect<K extends keyof Picture["effects"]>(
    key: K,
    value: Picture["effects"][K],
  ): void {
    setDraft((current) => ({ ...current, effects: { ...current.effects, [key]: value } }));
  }

  function patchColorEffect(key: "borderColor" | "shadowColor", raw: string): void {
    const normalized = normalizeHexColor(raw);
    if (normalized === "" || isHexColor(normalized)) {
      patchEffect(key, expandShortHex(normalized));
    }
  }

  async function handleFile(file: File): Promise<void> {
    const error = validateImageFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    setIsProcessing(true);
    try {
      const { dataUrl, aspectRatio } = await processImage(file);
      setDraft((current) => ({
        ...current,
        url: dataUrl,
        aspectRatio,
        effects: { ...current.effects, hidden: false },
      }));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to process image");
    } finally {
      setIsProcessing(false);
    }
  }

  function handleInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) void handleFile(file);
    // Reset so the same file can be re-selected.
    input.value = "";
  }

  function removePhoto(): void {
    setDraft((current) => ({
      ...current,
      url: "",
      effects: { ...current.effects, hidden: true },
    }));
  }

  function save(): void {
    updatePicture(draft());
    props.onOpenChange(false);
  }

  const previewStyle = () => {
    const picture = draft();
    const size = picture.size || 64;
    return {
      width: `${size}px`,
      height: `${size}px`,
      "border-radius": `${Math.min(picture.borderRadius, Math.round(size / 2))}px`,
      filter: picture.effects.grayscale ? "grayscale(100%)" : undefined,
      transform: picture.effects.rotation ? `rotate(${picture.effects.rotation}deg)` : undefined,
    };
  };

  return (
    <Modal open={props.open} onOpenChange={props.onOpenChange} title="Photo" size="lg">
      <input
        ref={(element) => (fileInput = element)}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(",")}
        class="hidden"
        aria-label="Choose profile photo"
        onChange={handleInputChange}
      />

      <div class="flex flex-col gap-5">
        <div class="flex items-start gap-4">
          <Show
            when={draft().url !== ""}
            fallback={<div class="text-sm text-stone">No photo yet.</div>}
          >
            <img
              src={draft().url}
              alt="Profile photo"
              class="object-cover"
              style={previewStyle()}
            />
          </Show>

          <div class="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              loading={isProcessing()}
              onClick={() => fileInput?.click()}
            >
              {draft().url === "" ? "Upload photo" : "Replace"}
            </Button>
            <Show when={draft().url !== ""}>
              <Button variant="danger" size="sm" onClick={removePhoto}>
                Remove
              </Button>
            </Show>
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <label class="font-mono text-xs uppercase tracking-wider text-stone" for="doc-photo-size">
            Size ({draft().size}pt)
          </label>
          <input
            id="doc-photo-size"
            type="range"
            min={MIN_SIZE}
            max={MAX_SIZE}
            step="4"
            value={draft().size}
            onInput={(event) => patch({ size: parseInt(event.currentTarget.value, 10) })}
            class="w-full accent-accent"
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label
            class="font-mono text-xs uppercase tracking-wider text-stone"
            for="doc-photo-radius"
          >
            Corner radius ({draft().borderRadius}pt)
          </label>
          <input
            id="doc-photo-radius"
            type="range"
            min="0"
            max={Math.round(draft().size / 2)}
            step="1"
            value={draft().borderRadius}
            onInput={(event) => patch({ borderRadius: parseInt(event.currentTarget.value, 10) })}
            class="w-full accent-accent"
          />
        </div>

        <p class="text-xs text-stone">
          Aspect ratio {draft().aspectRatio.toFixed(2)} — recorded from the source image.
        </p>

        <div class="flex flex-col gap-2">
          <Switch
            label="Hidden"
            description="Hide photo from the document"
            checked={draft().effects.hidden}
            onChange={(value) => patchEffect("hidden", value)}
          />
          <Switch
            label="Grayscale"
            checked={draft().effects.grayscale}
            onChange={(value) => patchEffect("grayscale", value)}
          />
          <Switch
            label="Border"
            checked={draft().effects.border}
            onChange={(value) => patchEffect("border", value)}
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label
            class="font-mono text-xs uppercase tracking-wider text-stone"
            for="doc-photo-rotation"
          >
            Rotation ({draft().effects.rotation}deg)
          </label>
          <input
            id="doc-photo-rotation"
            type="range"
            min="0"
            max="360"
            step="1"
            value={draft().effects.rotation}
            onInput={(event) => patchEffect("rotation", parseFloat(event.currentTarget.value))}
            class="w-full accent-accent"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <label class="flex flex-col gap-1.5">
            <span class="font-mono text-xs uppercase tracking-wider text-stone">Border color</span>
            <input
              type="text"
              value={draft().effects.borderColor}
              onInput={(event) => patchColorEffect("borderColor", event.currentTarget.value)}
              placeholder="Theme primary"
              class="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink"
            />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="font-mono text-xs uppercase tracking-wider text-stone">Border width</span>
            <input
              type="number"
              min="0"
              max={MAX_BORDER_WIDTH}
              value={draft().effects.borderWidth}
              onInput={(event) => {
                const parsed = parseInt(event.currentTarget.value, 10);
                if (Number.isNaN(parsed)) return;
                patchEffect("borderWidth", Math.min(MAX_BORDER_WIDTH, Math.max(0, parsed)));
              }}
              class="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink"
            />
          </label>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <label class="flex flex-col gap-1.5">
            <span class="font-mono text-xs uppercase tracking-wider text-stone">Shadow color</span>
            <input
              type="text"
              value={draft().effects.shadowColor}
              onInput={(event) => patchColorEffect("shadowColor", event.currentTarget.value)}
              placeholder="#00000040"
              class="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink"
            />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="font-mono text-xs uppercase tracking-wider text-stone">Shadow size</span>
            <input
              type="number"
              min="0"
              max={MAX_SHADOW_SIZE}
              value={draft().effects.shadowSize}
              onInput={(event) => {
                const parsed = parseInt(event.currentTarget.value, 10);
                if (Number.isNaN(parsed)) return;
                patchEffect("shadowSize", Math.min(MAX_SHADOW_SIZE, Math.max(0, parsed)));
              }}
              class="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-ink"
            />
          </label>
        </div>
      </div>

      <div class="mt-6 flex justify-end gap-3">
        <Button variant="ghost" onClick={() => props.onOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={save}>Save photo</Button>
      </div>
    </Modal>
  );
}
