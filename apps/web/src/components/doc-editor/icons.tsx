/**
 * Inline SVG icons for the document sheet's chrome (#794, spec §1.17).
 *
 * The sheet paints the resume's own theme, so its icons are plain inline SVGs
 * that inherit `currentColor` — no icon library, no app-chrome styling. Each
 * maps 1:1 to the glyph the design spec names (mdi-plus, mdi-pencil, the 3×3
 * drag grid, and the contact/profile glyphs).
 */

import { For, Show, type JSX } from "solid-js";

/** mdi-plus — dashed "add" blocks. */
export function PlusIcon(): JSX.Element {
  return (
    <svg class="doc-sheet__plus-ico" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M19,13H13V19H11V13H5V11H11V5H13V11H19V13Z" />
    </svg>
  );
}

/** mdi-pencil — the section options affordance. */
export function PencilIcon(): JSX.Element {
  return (
    <svg class="doc-sheet__pencil-ico" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9
          16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z"
      />
    </svg>
  );
}

/** The section grip: mdi-drag's 3×3 dot grid. */
export function DragGridIcon(): JSX.Element {
  const dots = [5.5, 12, 18.5];
  return (
    <svg class="doc-sheet__grip-ico" viewBox="0 0 24 24" aria-hidden="true">
      <For each={dots}>
        {(cx) => (
          <For each={dots}>{(cy) => <circle cx={cx} cy={cy} r="1.7" fill="currentColor" />}</For>
        )}
      </For>
    </svg>
  );
}

/** Which glyph a contact row shows. */
export type ContactIconKind = "email" | "phone" | "location" | "link";

const CONTACT_PATHS: Record<ContactIconKind, string> = {
  email:
    "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 " +
    "4l-8 5-8-5V6l8 5 8-5v2z",
  phone:
    "M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 " +
    "3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 " +
    ".45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z",
  location:
    "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 " +
    "1 1 0-5 2.5 2.5 0 0 1 0 5z",
  link:
    "M3.9 12a5 5 0 0 1 5-5h4v2h-4a3 3 0 1 0 0 6h4v2h-4a5 5 0 0 1-5-5zm7-1h6v2h-6v-2zm4.1-4h-4v2" +
    "h4a3 3 0 1 1 0 6h-4v2h4a5 5 0 0 0 0-10z",
};

/** One contact row's leading glyph. */
export function ContactIcon(props: { kind: ContactIconKind }): JSX.Element {
  return (
    <svg class="doc-sheet__row-ico" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d={CONTACT_PATHS[props.kind]} />
    </svg>
  );
}

const GITHUB_PATH =
  "M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 " +
  "0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 " +
  "17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 " +
  "1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 " +
  "0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 " +
  "1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 " +
  "3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 " +
  "5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 " +
  ".315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12";

const LINKEDIN_PATH =
  "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 " +
  "2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 " +
  "4.267 5.455v6.286zM5.337 7.433c-1.14 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 " +
  "2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 " +
  "13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 " +
  "24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z";

const GLOBE_PATH =
  "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 " +
  "17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c" +
  "-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 " +
  "2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z";

/** Brand glyph for a profile row, keyed off the icon or network name. */
export function ProfileIcon(props: { network?: string; icon?: string }): JSX.Element {
  const key = (): string =>
    (props.icon || props.network || "").toLowerCase().replaceAll(/\s+/g, "");
  const path = (): string => {
    if (key().includes("github")) return GITHUB_PATH;
    if (key().includes("linkedin")) return LINKEDIN_PATH;
    return GLOBE_PATH;
  };
  return (
    <svg class="doc-sheet__row-ico" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d={path()} />
    </svg>
  );
}

/** Eye open/closed — visibility toggles. */
export function EyeIcon(props: { isOpen: boolean }): JSX.Element {
  return (
    <Show
      when={props.isOpen}
      fallback={
        <svg class="doc-sheet__eye-ico" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M2.1 3.51 3.5 2.1l18.4 18.4-1.4 1.4-2.53-2.53A12.3 12.3 0 0 1 12
              20.5C6.48 20.5 1.9 16.9.3 12.25a13 13 0 0 1 4.55-5.7L2.1 3.5Zm6.2
              6.2 1.55 1.55a2.75 2.75 0 0 0 3.39 3.39l1.55 1.55A4.75 4.75 0 0 1
              8.3 9.71Zm3.9-5.96c5.52 0 10.1 3.6 11.7 8.25a12.9 12.9 0 0 1-3.48
              5.05l-1.45-1.45A10.9 10.9 0 0 0 21.7 12a10.9 10.9 0 0
              0-9.5-6.25c-1.03 0-2.02.14-2.96.4L7.7 4.6A12.4 12.4 0 0 1 12 3.75Z"
          />
        </svg>
      }
    >
      <svg class="doc-sheet__eye-ico" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 5c5.4 0 9.9 3.4 11.5 8-1.6 4.6-6.1 8-11.5 8S2.1 17.6.5 13C2.1
            8.4 6.6 5 12 5Zm0 2.5A5.5 5.5 0 1 0 12 18a5.5 5.5 0 0 0 0-10.5Zm0
            2.5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"
        />
      </svg>
    </Show>
  );
}
