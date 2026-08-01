/**
 * The sheet's header region: avatar, name, headline, contact details and — when
 * the resume does not place `profiles` as a section — its profile links.
 *
 * Placement is the template's decision, not this component's: `headerStyle`
 * says where and how the name block is drawn (`banner`, `sidebar`, `boxed`,
 * `left`, `center`) and `contactIn` says which of those regions prints the
 * contact details. Both arrive as layout metadata from `GET /api/templates`.
 *
 * Everything the header draws is editable in place. The core contact fields
 * (email, phone, location) are drawn even when empty, as muted placeholders, so
 * a blank resume still offers somewhere to type; the personal URL and the
 * resume's own custom fields appear only once they carry a value, because they
 * are additions rather than expected parts of a document.
 */

import { For, Show, createSignal, type JSX } from "solid-js";
import { InlineText } from "./InlineText";
import { PhotoDialog } from "./PhotoDialog";
import { updateBasicsField } from "./docEdits";
import type { TemplateHeaderStyle } from "../../lib/docLayout";
import type { Basics, CustomField, Picture, Url } from "../../wasm/types";

/** One contact line: an optional label, the value, and where it writes back. */
interface ContactEntry {
  key: string;
  label?: string;
  value: string;
  /** Field name announced by the inline editor. */
  fieldLabel: string;
  commit: (value: string) => void;
  /** Whether the line is drawn even when the value is empty. */
  alwaysShown?: boolean;
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
  const entries: ContactEntry[] = [
    {
      key: "email",
      value: basics.email,
      fieldLabel: "Email",
      commit: (value) => updateBasicsField("email", value),
      alwaysShown: true,
    },
    {
      key: "phone",
      value: basics.phone,
      fieldLabel: "Phone",
      commit: (value) => updateBasicsField("phone", value),
      alwaysShown: true,
    },
    {
      key: "location",
      value: basics.location,
      fieldLabel: "Location",
      commit: (value) => updateBasicsField("location", value),
      alwaysShown: true,
    },
  ];

  const url = urlLabel(basics.url);
  if (url !== "") {
    // The sheet prints the label when there is one, so that is what an inline
    // edit changes; with no label the href is what is on the page.
    const hasLabel = (basics.url?.label ?? "").trim() !== "";
    entries.push({
      key: "url",
      value: url,
      fieldLabel: hasLabel ? "Website label" : "Website URL",
      commit: (value) =>
        // Spreading a missing `url` alone would drop the other half of the
        // required `{label, href}` shape.
        updateBasicsField("url", {
          ...(basics.url ?? { label: "", href: "" }),
          [hasLabel ? "label" : "href"]: value,
        }),
    });
  }

  for (const field of basics.customFields) {
    if (field.value.trim() === "") continue;
    entries.push({
      key: `custom:${field.id}`,
      label: field.name,
      value: field.value,
      fieldLabel: field.name === "" ? "Custom field" : field.name,
      commit: (value) => updateBasicsField("customFields", replaceField(basics, field.id, value)),
    });
  }

  return entries;
}

/** `customFields` with one field's value replaced — committed as one action. */
function replaceField(basics: Basics, id: string, value: string): CustomField[] {
  return basics.customFields.map((field) => (field.id === id ? { ...field, value } : field));
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
  const [isPhotoOpen, setIsPhotoOpen] = createSignal(false);

  const entries = () =>
    contactEntries(props.basics).filter(
      (entry) => entry.alwaysShown === true || entry.value.trim() !== "",
    );
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
      <Show when={showIdentity()}>
        <Show
          when={pictureVisible(props.basics.picture)}
          fallback={
            <button type="button" class="doc-sheet__action" onClick={() => setIsPhotoOpen(true)}>
              Add photo
            </button>
          }
        >
          <button
            type="button"
            class="doc-sheet__editable doc-sheet__avatar-button"
            title="Edit photo"
            onClick={() => setIsPhotoOpen(true)}
          >
            <Avatar picture={props.basics.picture} name={props.basics.name} />
          </button>
        </Show>

        <h2 class="doc-sheet__name">
          <InlineText
            value={props.basics.name}
            label="Name"
            placeholder="Your name"
            triggerId="doc-header-name"
            onCommit={(value) => updateBasicsField("name", value)}
          />
        </h2>

        <p class="doc-sheet__headline">
          <InlineText
            value={props.basics.headline}
            label="Headline"
            placeholder="Your headline"
            triggerId="doc-header-headline"
            onCommit={(value) => updateBasicsField("headline", value)}
          />
        </p>

        <PhotoDialog
          open={isPhotoOpen()}
          picture={props.basics.picture}
          onOpenChange={setIsPhotoOpen}
        />
      </Show>

      <Show when={props.showContact && entries().length > 0}>
        <ul class="doc-sheet__contact" classList={{ "doc-sheet__contact--stacked": stacked() }}>
          <For each={entries()}>
            {(entry) => (
              <li>
                <Show when={entry.label}>
                  <span class="doc-sheet__contact-label">{entry.label}: </span>
                </Show>
                <InlineText
                  value={entry.value}
                  label={entry.fieldLabel}
                  triggerId={`doc-header-${entry.key}`}
                  onCommit={entry.commit}
                />
              </li>
            )}
          </For>
        </ul>
      </Show>

      <Show when={props.showContact && links().length > 0}>
        <ul class="doc-sheet__contact" classList={{ "doc-sheet__contact--stacked": stacked() }}>
          {/* Profile links mirror the `profiles` section, which is edited where
              the layout places it rather than twice over. */}
          <For each={links()}>{(link) => <li>{link.label}</li>}</For>
        </ul>
      </Show>
    </header>
  );
}
