import { Show, createSignal } from "solid-js";
import { Button, Switch, toast } from "../ui";
import type { Picture } from "../../wasm/types";

export interface ImageUploadProps {
  picture: Picture;
  onPictureChange: (picture: Picture) => void;
}

const MAX_SIZE_PX = 800;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

interface ProcessedImage {
  dataUrl: string;
  aspectRatio: number;
}

/**
 * Resize an image file to fit within MAX_SIZE_PX x MAX_SIZE_PX,
 * then return a base64 data URL (WebP with JPEG fallback) and aspect ratio.
 */
async function processImage(file: File): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");

      let { width, height } = img;
      if (width > MAX_SIZE_PX || height > MAX_SIZE_PX) {
        if (width > height) {
          height = Math.max(1, Math.round((height * MAX_SIZE_PX) / width));
          width = MAX_SIZE_PX;
        } else {
          width = Math.max(1, Math.round((width * MAX_SIZE_PX) / height));
          height = MAX_SIZE_PX;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // Try WebP first, fall back to JPEG
      let dataUrl = canvas.toDataURL("image/webp", 0.85);
      if (!dataUrl.startsWith("data:image/webp")) {
        dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      }
      resolve({ dataUrl, aspectRatio: width / height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "Please upload a JPG, PNG, or WebP image.";
  }
  if (file.size > MAX_FILE_SIZE) {
    return "Image must be smaller than 5 MB.";
  }
  return null;
}

export function ImageUpload(props: ImageUploadProps) {
  const [isDragging, setIsDragging] = createSignal(false);
  const [isProcessing, setIsProcessing] = createSignal(false);

  let fileInputRef: HTMLInputElement | undefined;

  const hasPhoto = () => props.picture.url !== "";

  async function handleFile(file: File) {
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    setIsProcessing(true);
    try {
      const { dataUrl, aspectRatio } = await processImage(file);
      props.onPictureChange({
        ...props.picture,
        url: dataUrl,
        aspectRatio,
        effects: {
          ...props.picture.effects,
          hidden: props.picture.url ? props.picture.effects.hidden : false,
        },
      });
      toast.success("Profile photo uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to process image");
    } finally {
      setIsProcessing(false);
    }
  }

  function handleInputChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      handleFile(file);
    }
    // Reset so the same file can be re-selected
    input.value = "";
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer?.files?.[0];
    if (file) {
      handleFile(file);
    }
  }

  function handleRemove() {
    props.onPictureChange({
      ...props.picture,
      url: "",
      effects: { ...props.picture.effects, hidden: true },
    });
    toast.info("Profile photo removed");
  }

  function updateEffect(key: keyof Picture["effects"], value: boolean) {
    props.onPictureChange({
      ...props.picture,
      effects: { ...props.picture.effects, [key]: value },
    });
  }

  function updateBorderRadius(value: number) {
    props.onPictureChange({
      ...props.picture,
      borderRadius: value,
    });
  }

  function updateSize(value: number) {
    props.onPictureChange({
      ...props.picture,
      size: value,
    });
  }

  // Compute CSS for the preview image
  const previewStyle = () => {
    const size = props.picture.size || 64;
    const br = props.picture.borderRadius;
    const maxRadius = Math.round(size / 2);
    const borderRadiusPx = Math.min(br, maxRadius);
    const filters: string[] = [];
    if (props.picture.effects.grayscale) {
      filters.push("grayscale(100%)");
    }
    return {
      width: `${size}px`,
      height: `${size}px`,
      "border-radius": `${borderRadiusPx}px`,
      filter: filters.length > 0 ? filters.join(" ") : undefined,
      border: props.picture.effects.border ? "2px solid var(--turbo-brand-primary)" : undefined,
    };
  };

  return (
    <div class="space-y-4 pt-4 border-t border-border">
      <h3 class="font-mono text-xs uppercase tracking-wider text-stone">Profile Photo</h3>

      <input
        ref={(el) => (fileInputRef = el)}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        class="hidden"
        aria-label="Choose profile photo"
        onChange={handleInputChange}
      />

      <Show
        when={hasPhoto()}
        fallback={
          /* Upload zone */
          <div>
            <button
              type="button"
              class={`w-full border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer
                ${
                  isDragging()
                    ? "border-accent bg-accent/10"
                    : "border-border hover:border-accent/50 hover:bg-surface/50"
                }`}
              onClick={() => fileInputRef?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              disabled={isProcessing()}
            >
              <Show
                when={!isProcessing()}
                fallback={
                  <div class="flex flex-col items-center gap-2">
                    <svg class="w-8 h-8 text-accent animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle
                        class="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        stroke-width="4"
                      />
                      <path
                        class="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    <span class="text-sm text-stone">Processing image...</span>
                  </div>
                }
              >
                <div class="flex flex-col items-center gap-2">
                  {/* Camera / upload icon */}
                  <svg
                    class="w-8 h-8 text-stone"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="1.5"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <span class="text-sm text-stone">Click to upload or drag and drop</span>
                  <span class="text-xs text-stone/70">JPG, PNG, or WebP (max 5 MB)</span>
                </div>
              </Show>
            </button>
          </div>
        }
      >
        {/* Photo preview + controls */}
        <div class="space-y-4">
          {/* Preview */}
          <div class="flex items-start gap-4">
            <div class="flex-shrink-0">
              <Show
                when={!props.picture.effects.hidden}
                fallback={
                  <div
                    class="bg-surface flex items-center justify-center overflow-hidden"
                    style={{ ...previewStyle(), opacity: "0.4" }}
                  >
                    <img
                      src={props.picture.url}
                      alt="Profile photo (hidden)"
                      class="w-full h-full object-cover"
                    />
                  </div>
                }
              >
                <img
                  src={props.picture.url}
                  alt="Profile photo"
                  class="object-cover"
                  style={previewStyle()}
                />
              </Show>
            </div>

            <div class="flex flex-col gap-2 flex-1 min-w-0">
              <div class="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => fileInputRef?.click()}>
                  Replace
                </Button>
                <Button variant="danger" size="sm" onClick={handleRemove}>
                  Remove
                </Button>
              </div>
            </div>
          </div>

          {/* Size slider */}
          <div class="space-y-1.5">
            <label class="font-mono text-xs uppercase tracking-wider text-stone flex justify-between">
              <span>Size</span>
              <span class="font-body normal-case tracking-normal">
                {props.picture.size || 64}px
              </span>
            </label>
            <input
              type="range"
              min="32"
              max="200"
              step="4"
              value={props.picture.size || 64}
              onInput={(e) => updateSize(parseInt(e.currentTarget.value, 10))}
              class="w-full accent-[var(--turbo-brand-primary)]"
              aria-label="Size"
            />
          </div>

          {/* Border radius slider */}
          <div class="space-y-1.5">
            <label class="font-mono text-xs uppercase tracking-wider text-stone flex justify-between">
              <span>Border Radius</span>
              <span class="font-body normal-case tracking-normal">
                {props.picture.borderRadius}px
              </span>
            </label>
            <input
              type="range"
              min="0"
              max={Math.round((props.picture.size || 64) / 2)}
              step="1"
              value={props.picture.borderRadius}
              onInput={(e) => updateBorderRadius(parseInt(e.currentTarget.value, 10))}
              class="w-full accent-[var(--turbo-brand-primary)]"
              aria-label="Border radius"
            />
          </div>

          {/* Effects toggles */}
          <div class="space-y-2">
            <Switch
              label="Hidden"
              description="Hide photo from resume"
              checked={props.picture.effects.hidden}
              onChange={(val) => updateEffect("hidden", val)}
            />
            <Switch
              label="Grayscale"
              description="Apply grayscale filter"
              checked={props.picture.effects.grayscale}
              onChange={(val) => updateEffect("grayscale", val)}
            />
            <Switch
              label="Border"
              description="Show a border around the photo"
              checked={props.picture.effects.border}
              onChange={(val) => updateEffect("border", val)}
            />
          </div>
        </div>
      </Show>
    </div>
  );
}
