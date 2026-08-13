/**
 * The sheet's identity and contact chrome (#794, spec §1.4): `NameHeader`,
 * `SheetAvatar` and `ContactBlock` — the pieces each template's page
 * compositor places per its `headerStyle` / `contactIn` metadata.
 *
 * `ContactBlock` is the one piece of section chrome the template owns
 * outright: it reuses {@link SectionChrome} with no grip, no pencil and no
 * menu, and is never draggable. Its core fields (email, phone, location) draw
 * even when empty in edit mode, as placeholders, so a blank resume still
 * offers somewhere to type; the personal URL and custom fields appear once
 * they carry a value. `SheetAvatar` falls back to an initials disc and opens
 * the photo dialog — #788's `PhotoDialog` with `lib/imageUpload` processing,
 * kept as the superset of the prototype's modal.
 */

import { For, Show, createSignal, type JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import { EditableField } from "./EditableField";
import { PhotoDialog } from "./PhotoDialog";
import { SectionChrome } from "./SectionChrome";
import { ContactIcon, type ContactIconKind } from "./icons";
import { updateBasicsField } from "./docEdits";
import { useSheetEditable } from "./sheetMode";
import { SHEET_PX_PER_PT } from "../../lib/docLayout";
import { looksLikeUrl, withHttps } from "../../lib/profileUrls";
import { nameInitials } from "../../lib/itemPresentation";
import type { Basics, CustomField, Picture, Url } from "../../wasm/types";

/** Largest avatar the sheet draws, whatever the stored size (spec §1.4). */
const MAX_SHEET_AVATAR_PX = 120;

/**
 * Visible text for a URL — label, else href. Mirrors `url-display-label`.
 * Both fields are read defensively: imported resumes reach the store with one
 * or the other missing.
 */
function urlLabel(url: Url | undefined): string {
  const label = url?.label ?? "";
  return label.trim() !== "" ? label : (url?.href ?? "");
}

/** `customFields` with one field's value replaced — committed as one action. */
function replaceField(basics: Basics, id: string, value: string): CustomField[] {
  return basics.customFields.map((field) => (field.id === id ? { ...field, value } : field));
}

/** Whether a picture is set and not switched off. Mirrors `has-visible-picture`. */
function pictureVisible(picture: Picture | undefined): boolean {
  return picture !== undefined && picture.url.trim() !== "" && !picture.effects.hidden;
}

/** The name block: display name over the accent headline (spec §1.4). */
export function NameHeader(props: { basics: Basics; isInSidebar?: boolean }): JSX.Element {
  const isEditable = useSheetEditable();
  return (
    <header
      class="doc-sheet__head"
      classList={{ "doc-sheet__head--in-side": props.isInSidebar === true }}
      data-testid="doc-sheet-header"
    >
      <Show when={isEditable() || props.basics.name.trim() !== ""}>
        <h2 class="doc-sheet__name">
          <EditableField
            value={props.basics.name}
            label="Name"
            dialogTitle="Edit · Name"
            placeholder="Your name"
            triggerId="doc-header-name"
            onCommit={(value) => updateBasicsField("name", value)}
          />
        </h2>
      </Show>
      <Show when={isEditable() || props.basics.headline.trim() !== ""}>
        <p class="doc-sheet__headline">
          <EditableField
            value={props.basics.headline}
            label="Headline"
            dialogTitle="Edit · Headline"
            placeholder="Your headline"
            triggerId="doc-header-headline"
            onCommit={(value) => updateBasicsField("headline", value)}
          />
        </p>
      </Show>
    </header>
  );
}

/**
 * The avatar's stored geometry, in sheet pixels. All stored lengths — size,
 * radius, border width, shadow size — are points, so every one of them scales
 * through {@link SHEET_PX_PER_PT} and the on-sheet avatar matches the PDF.
 */
function avatarStyle(picture: Picture): JSX.CSSProperties {
  const size = Math.min(Math.round(picture.size * SHEET_PX_PER_PT), MAX_SHEET_AVATAR_PX);
  const radius = Math.min(Math.round(picture.borderRadius * SHEET_PX_PER_PT), size / 2);
  const effects = picture.effects;
  const borderColor =
    effects.borderColor.trim() === "" ? "var(--doc-sheet-accent)" : effects.borderColor;
  const borderWidth = effects.borderWidth * SHEET_PX_PER_PT;
  const shadowOffset = ((effects.shadowSize || 0) * SHEET_PX_PER_PT) / 2;
  return {
    width: `${size}px`,
    height: `${size}px`,
    "border-radius": `${radius}px`,
    filter: effects.grayscale ? "grayscale(1)" : undefined,
    transform: effects.rotation === 0 ? undefined : `rotate(${effects.rotation}deg)`,
    border:
      effects.border && effects.borderWidth > 0
        ? `${borderWidth.toFixed(2)}px solid ${borderColor}`
        : "none",
    "box-shadow":
      effects.shadowSize > 0
        ? `${shadowOffset.toFixed(2)}px ${shadowOffset.toFixed(2)}px 0 ${effects.shadowColor || "#00000040"}`
        : "none",
    "object-fit": "cover",
  };
}

/**
 * The avatar: photo when set, an initials disc otherwise. When the template
 * places this slot, Done mode still draws the initials fallback (#829) — the
 * disc is not edit-only. In edit mode the whole avatar is a button that opens
 * the photo dialog; in Done mode it is inert.
 */
export function SheetAvatar(props: { basics: Basics }): JSX.Element {
  const isEditable = useSheetEditable();
  const [isPhotoOpen, setIsPhotoOpen] = createSignal(false);

  const picture = (): Picture => props.basics.picture;
  const hasPhoto = (): boolean => pictureVisible(picture());
  const initials = (): string => nameInitials(props.basics.name);
  const photoAlt = (): string =>
    props.basics.name.trim() === "" ? "Profile picture" : `Profile picture of ${props.basics.name}`;

  return (
    <>
      <Dynamic
        component={isEditable() ? "button" : "div"}
        type={isEditable() ? "button" : undefined}
        class="doc-sheet__avatar-btn"
        title={isEditable() ? "Edit profile photo" : undefined}
        onClick={isEditable() ? () => setIsPhotoOpen(true) : undefined}
      >
        <Show
          when={hasPhoto()}
          fallback={
            <span class="doc-sheet__avatar-initials" aria-hidden="true">
              {initials()}
            </span>
          }
        >
          <img
            class="doc-sheet__avatar-img"
            src={picture().url}
            alt={photoAlt()}
            style={avatarStyle(picture())}
          />
        </Show>
      </Dynamic>

      <Show when={isEditable()}>
        <PhotoDialog open={isPhotoOpen()} picture={picture()} onOpenChange={setIsPhotoOpen} />
      </Show>
    </>
  );
}

/** One contact line: glyph kind, value, and where it writes back. */
interface ContactEntry {
  key: string;
  kind: ContactIconKind;
  /** Text label for custom fields, drawn instead of a glyph. */
  label?: string;
  value: string;
  fieldLabel: string;
  commit: (value: string) => void;
  /** Whether the line is drawn even when the value is empty (edit mode). */
  alwaysShown?: boolean;
}

/**
 * Contact entries in template order: email, phone, location, then the
 * personal URL and the resume's custom fields (`build-contact-items`).
 */
function contactEntries(basics: Basics): ContactEntry[] {
  const entries: ContactEntry[] = [
    {
      key: "email",
      kind: "email",
      value: basics.email,
      fieldLabel: "Email",
      commit: (value) => updateBasicsField("email", value),
      alwaysShown: true,
    },
    {
      key: "phone",
      kind: "phone",
      value: basics.phone,
      fieldLabel: "Phone",
      commit: (value) => updateBasicsField("phone", value),
      alwaysShown: true,
    },
    {
      key: "location",
      kind: "location",
      value: basics.location,
      fieldLabel: "Location",
      commit: (value) => updateBasicsField("location", value),
      alwaysShown: true,
    },
  ];

  const url = urlLabel(basics.url);
  if (url !== "") {
    // The sheet prints the label when there is one, so that is what an inline
    // edit changes; with no label the href is what is on the page. A label
    // edit that reads as a URL updates the href too (#820): typing a new
    // address over the old label must not leave the link pointing at the old
    // destination.
    const hasLabel = (basics.url?.label ?? "").trim() !== "";
    entries.push({
      key: "url",
      kind: "link",
      value: url,
      fieldLabel: hasLabel ? "Website label" : "Website URL",
      commit: (value) => {
        const current = basics.url ?? { label: "", href: "" };
        if (!hasLabel) {
          updateBasicsField("url", { ...current, href: value });
          return;
        }
        updateBasicsField(
          "url",
          looksLikeUrl(value)
            ? { ...current, label: value, href: withHttps(value) }
            : { ...current, label: value },
        );
      },
    });
  }

  for (const field of basics.customFields) {
    if (field.value.trim() === "") continue;
    entries.push({
      key: `custom:${field.id}`,
      kind: "link",
      label: field.name,
      value: field.value,
      fieldLabel: field.name === "" ? "Custom field" : field.name,
      commit: (value) => updateBasicsField("customFields", replaceField(basics, field.id, value)),
    });
  }

  return entries;
}

export interface ContactBlockProps {
  basics: Basics;
  /** Wrapping inline row for header/banner placements; column list otherwise. */
  isCompact?: boolean;
  /** Draw the avatar above the block (sidebar placement). */
  withAvatar?: boolean;
}

/**
 * The contact card: a `SectionChrome` whose body is icon rows. Template-owned
 * chrome — no grip, no pencil, no menu, never draggable (spec §1.4).
 */
export function ContactBlock(props: ContactBlockProps): JSX.Element {
  const isEditable = useSheetEditable();
  const entries = (): ContactEntry[] =>
    contactEntries(props.basics).filter(
      (entry) => (isEditable() && entry.alwaysShown === true) || entry.value.trim() !== "",
    );

  return (
    <>
      <Show when={props.withAvatar === true}>
        <SheetAvatar basics={props.basics} />
      </Show>
      <Show when={entries().length > 0}>
        <SectionChrome sectionId="basics" title="Contact" isFocused={false} onFocus={() => {}}>
          <ul
            class="doc-sheet__contact"
            classList={{
              "doc-sheet__contact--inline": props.isCompact === true,
              "doc-sheet__contact--list": props.isCompact !== true,
            }}
            data-testid="doc-sheet-contact"
          >
            <For each={entries()}>
              {(entry) => (
                <li class="doc-sheet__icon-row">
                  <Show
                    when={entry.label === undefined}
                    fallback={<span class="doc-sheet__contact-label">{entry.label}: </span>}
                  >
                    <ContactIcon kind={entry.kind} />
                    <span class="sr-only">{entry.fieldLabel}</span>
                  </Show>
                  <EditableField
                    value={entry.value}
                    label={entry.fieldLabel}
                    dialogTitle={`Edit · ${entry.fieldLabel}`}
                    class="doc-sheet__side-val"
                    triggerId={`doc-header-${entry.key}`}
                    onCommit={entry.commit}
                  />
                </li>
              )}
            </For>
          </ul>
        </SectionChrome>
      </Show>
    </>
  );
}
