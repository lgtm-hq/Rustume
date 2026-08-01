/**
 * The sheet's header region: avatar, name, headline, contact details and — when
 * the resume does not place `profiles` as a section — its profile links.
 *
 * Placement is the template's decision, not this component's: `headerStyle`
 * says where and how the name block is drawn (`banner`, `sidebar`, `boxed`,
 * `left`, `center`) and `contactIn` says which of those regions prints the
 * contact details. Both arrive as layout metadata from `GET /api/templates`.
 */

import { For, Show, type JSX } from "solid-js";
import type { TemplateHeaderStyle } from "../../lib/docLayout";
import type { Basics, Picture, Url } from "../../wasm/types";

/** One contact line: an optional label plus the value the template prints. */
interface ContactEntry {
  key: string;
  label?: string;
  value: string;
}

/**
 * Visible text for a URL — label, else href. Mirrors `url-display-label`.
 *
 * Both fields are read defensively: imported resumes reach the store with one
 * or the other missing.
 */
function urlLabel(url: Url | undefined): string {
  const label = url?.label ?? "";
  return label.trim() !== "" ? label : (url?.href ?? "");
}

/**
 * Contact entries in template order.
 *
 * `build-contact-items` in `_common.typ` emits email, phone then location, and
 * templates append the personal URL after it; the resume's custom fields
 * follow, as the templates that print them do.
 */
function contactEntries(basics: Basics): ContactEntry[] {
  const entries: ContactEntry[] = [];
  if (basics.email.trim() !== "") entries.push({ key: "email", value: basics.email });
  if (basics.phone.trim() !== "") entries.push({ key: "phone", value: basics.phone });
  if (basics.location.trim() !== "") entries.push({ key: "location", value: basics.location });

  const url = urlLabel(basics.url);
  if (url !== "") entries.push({ key: "url", value: url });

  for (const field of basics.customFields) {
    if (field.value.trim() === "") continue;
    entries.push({ key: `custom:${field.id}`, label: field.name, value: field.value });
  }

  return entries;
}

/** Whether a picture is set and not switched off. Mirrors `has-visible-picture`. */
function pictureVisible(picture: Picture | undefined): boolean {
  return picture !== undefined && picture.url.trim() !== "" && !picture.effects.hidden;
}

/**
 * The stored avatar, drawn at its stored size and shape.
 *
 * Sizes are stored in typographic points, so they are expressed against the
 * page's own `--doc-sheet-pt` unit and scale with the sheet, exactly as they do
 * in the rendered PDF. Like `render-picture`, the frame is square and the image
 * is cropped to fill it; `aspectRatio` records the source image's proportions
 * and is not a display setting.
 */
function Avatar(props: { picture: Picture; name: string }): JSX.Element {
  const size = () => `calc(var(--doc-sheet-pt) * ${props.picture.size})`;
  const effects = () => props.picture.effects;
  const radius = () =>
    `calc(var(--doc-sheet-pt) * ${Math.min(props.picture.borderRadius, props.picture.size / 2)})`;

  return (
    <img
      class="doc-sheet__avatar"
      src={props.picture.url}
      alt={props.name.trim() === "" ? "Profile picture" : `Profile picture of ${props.name}`}
      style={{
        width: size(),
        height: size(),
        "border-radius": radius(),
        "border-width": effects().border
          ? `calc(var(--doc-sheet-pt) * ${effects().borderWidth})`
          : "0",
        "border-color": effects().borderColor === "" ? undefined : effects().borderColor,
        filter: effects().grayscale ? "grayscale(1)" : undefined,
        transform: effects().rotation === 0 ? undefined : `rotate(${effects().rotation}deg)`,
      }}
    />
  );
}

export interface DocHeaderProps {
  basics: Basics;
  /** How the template presents the name block. */
  headerStyle: TemplateHeaderStyle;
  /**
   * Whether to draw the avatar, name and headline.
   *
   * False for the second header a template needs when it prints its name block
   * and its contact details in different regions.
   */
  showIdentity?: boolean;
  /** Whether this region is the one the template prints contact details in. */
  showContact: boolean;
  /**
   * Profile links to print in the header.
   *
   * Empty when the resume places `profiles` as a section, so a profile is never
   * drawn twice on the same sheet.
   */
  profileLinks?: { id: string; label: string }[];
}

export function DocHeader(props: DocHeaderProps): JSX.Element {
  const entries = () => contactEntries(props.basics);
  const links = () => props.profileLinks ?? [];
  const stacked = () => props.headerStyle === "sidebar";
  const showIdentity = () => props.showIdentity ?? true;

  return (
    <header
      class="doc-sheet__header"
      classList={{
        "doc-sheet__header--left": props.headerStyle === "left",
        "doc-sheet__header--center": props.headerStyle === "center",
        "doc-sheet__header--banner": props.headerStyle === "banner",
        "doc-sheet__header--boxed": props.headerStyle === "boxed",
        "doc-sheet__header--sidebar": stacked(),
      }}
      data-testid="doc-sheet-header"
    >
      <Show when={showIdentity() && pictureVisible(props.basics.picture)}>
        <Avatar picture={props.basics.picture} name={props.basics.name} />
      </Show>

      <Show when={showIdentity() && props.basics.name.trim() !== ""}>
        <h2 class="doc-sheet__name">{props.basics.name}</h2>
      </Show>

      <Show when={showIdentity() && props.basics.headline.trim() !== ""}>
        <p class="doc-sheet__headline">{props.basics.headline}</p>
      </Show>

      <Show when={props.showContact && entries().length > 0}>
        <ul class="doc-sheet__contact" classList={{ "doc-sheet__contact--stacked": stacked() }}>
          <For each={entries()}>
            {(entry) => (
              <li>
                <Show when={entry.label}>
                  <span class="doc-sheet__contact-label">{entry.label}: </span>
                </Show>
                {entry.value}
              </li>
            )}
          </For>
        </ul>
      </Show>

      <Show when={props.showContact && links().length > 0}>
        <ul class="doc-sheet__contact" classList={{ "doc-sheet__contact--stacked": stacked() }}>
          <For each={links()}>{(link) => <li>{link.label}</li>}</For>
        </ul>
      </Show>
    </header>
  );
}
