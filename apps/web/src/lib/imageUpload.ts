/**
 * Profile-photo ingestion: validation, resizing and colour normalisation.
 *
 * The document editor's photo dialog goes through this module so a photo lands
 * in `basics.picture` in one canonical shape. It owns no state and touches no
 * store: callers decide what to do with the encoded result.
 *
 * The encoder deliberately trades quality for size. A resume's JSON travels
 * through `localStorage`, IndexedDB and the cloud sync payload, so the data URL
 * is stepped down until it fits {@link MAX_IMAGE_DATA_URL_CHARS} rather than
 * being stored at source resolution.
 */

import type { JSX } from "solid-js";
import type { Picture } from "../wasm/types";

/** Resume photos display at <=200px; keep the encoded asset compact. */
const MAX_SIZE_PX = 512;

/** Image MIME types the file picker and the drop target accept. */
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Largest source file accepted, before resizing. */
export const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024;

/** Soft cap for the data URL stored in resume JSON (~300 KB payload). */
export const MAX_IMAGE_DATA_URL_CHARS = 400_000;

const HEX_COLOR_REGEX = /^#(?:[0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
const BARE_HEX_REGEX = /^(?:[0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;

/** Whether a value is a `#`-prefixed 3/4/6/8-digit hex colour. */
export function isHexColor(value: string): boolean {
  return HEX_COLOR_REGEX.test(value);
}

/** Trim and prepend `#` when the value is bare 3/4/6/8-digit hex. */
export function normalizeHexColor(raw: string): string {
  const trimmed = raw.trim();
  return BARE_HEX_REGEX.test(trimmed) ? `#${trimmed}` : trimmed;
}

/**
 * Expand `#RGB` / `#RGBA` shorthand to `#RRGGBB` / `#RRGGBBAA`.
 *
 * Server-side validation only accepts the long form.
 */
export function expandShortHex(color: string): string {
  const digits = color.slice(1);
  if (digits.length === 3 || digits.length === 4) {
    return `#${digits
      .split("")
      .map((c) => c + c)
      .join("")}`;
  }
  return color;
}

/** An image encoded for storage, plus the proportions of the source file. */
export interface ProcessedImage {
  dataUrl: string;
  aspectRatio: number;
}

/**
 * Encode canvas to a data URL, preferring WebP and stepping quality down until
 * the result fits under {@link MAX_IMAGE_DATA_URL_CHARS}.
 */
function encodeCanvasDataUrl(canvas: HTMLCanvasElement): string {
  const qualities = [0.82, 0.7, 0.58, 0.45];
  let best = "";
  for (const quality of qualities) {
    let dataUrl = canvas.toDataURL("image/webp", quality);
    if (!dataUrl.startsWith("data:image/webp")) {
      dataUrl = canvas.toDataURL("image/jpeg", quality);
    }
    best = dataUrl;
    if (dataUrl.length <= MAX_IMAGE_DATA_URL_CHARS) {
      return dataUrl;
    }
  }
  return best;
}

/**
 * Resize an image file to fit within `MAX_SIZE_PX` square, then return a base64
 * data URL (WebP with a JPEG fallback) and the source aspect ratio.
 *
 * Rejects when the image cannot be decoded, when the canvas is unavailable, or
 * when the smallest encoding still exceeds {@link MAX_IMAGE_DATA_URL_CHARS}.
 */
export async function processImage(file: File): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");

      let { width, height } = img;
      // Captured before resizing: rounding the scaled side would shift the ratio.
      const sourceAspectRatio = width / height;
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

      const dataUrl = encodeCanvasDataUrl(canvas);
      if (dataUrl.length > MAX_IMAGE_DATA_URL_CHARS) {
        reject(new Error("Image is still too large after compression. Try a smaller photo."));
        return;
      }
      resolve({ dataUrl, aspectRatio: sourceAspectRatio });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

/**
 * CSS for a photo preview, shared by both photo surfaces so the two previews
 * cannot drift from each other or from what the Typst render produces.
 *
 * The shadow is a solid diagonal offset with no blur (`dx = dy = size / 2`),
 * matching the PDF output rather than a browser-idiomatic soft shadow.
 */
export function picturePreviewStyle(picture: Picture): JSX.CSSProperties {
  const size = picture.size || 64;
  const { effects } = picture;
  const borderWidth = effects.borderWidth ?? 2;
  const shadowSize = effects.shadowSize || 0;
  const shadowOffset = shadowSize / 2;

  return {
    width: `${size}px`,
    height: `${size}px`,
    "border-radius": `${Math.min(picture.borderRadius, Math.round(size / 2))}px`,
    filter: effects.grayscale ? "grayscale(100%)" : undefined,
    transform: effects.rotation ? `rotate(${effects.rotation}deg)` : undefined,
    border:
      effects.border && borderWidth > 0
        ? `${borderWidth}px solid ${effects.borderColor || "var(--turbo-brand-primary)"}`
        : undefined,
    "box-shadow":
      shadowSize > 0
        ? `${shadowOffset}px ${shadowOffset}px 0 ${effects.shadowColor || "#00000040"}`
        : undefined,
  };
}

/** The reason `file` cannot be used as a photo, or `null` when it can. */
export function validateImageFile(file: File): string | null {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return "Please upload a JPG, PNG, or WebP image.";
  }
  if (file.size > MAX_IMAGE_FILE_SIZE) {
    return "Image must be smaller than 5 MB.";
  }
  return null;
}
