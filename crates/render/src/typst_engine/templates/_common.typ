// Shared helpers for all Rustume templates.
// Templates import with: #import "_common.typ": *

/// Check whether an item has a non-empty URL.
#let has-url(item) = {
  "url" in item and item.url != none and item.url.href != ""
}

/// Visible text for a `{ label, href }` URL: prefer label, then href, then fallback.
#let url-display-label(url, fallback: "Website") = {
  if url == none {
    return fallback
  }
  let label = if "label" in url and url.label != none { url.label } else { "" }
  if label != "" { return label }
  let href = if "href" in url and url.href != none { url.href } else { "" }
  if href != "" { return href }
  fallback
}

/// Resolve a hex color, falling back when the input is empty.
/// Typst's rgb() string form requires a leading #, so prepend one
/// for legacy stored values that lack it.
#let resolve-color(value, fallback) = {
  if value == "" or value == none {
    fallback
  } else if value.starts-with("#") {
    rgb(value)
  } else {
    rgb("#" + value)
  }
}

/// Check whether basics includes a visible profile picture URL.
#let has-visible-picture(basics) = {
  if not ("picture" in basics) or basics.picture == none {
    return false
  }

  let picture = basics.picture
  let effects = picture.at("effects", default: (:))

  "url" in picture and picture.url != "" and not effects.at("hidden", default: false)
}

/// Render a profile picture with shared schema-driven effects.
#let render-picture(basics, primary-color, default-size: 64pt) = {
  if not has-visible-picture(basics) {
    return
  }

  let picture = basics.picture
  let effects = picture.at("effects", default: (:))
  let picture-size = picture.at("size", default: int(default-size / 1pt)) * 1pt
  let border-radius = calc.min(picture.at("borderRadius", default: 0) * 1pt, picture-size / 2)
  let border-width = effects.at("borderWidth", default: 2) * 1pt
  let border-color = resolve-color(effects.at("borderColor", default: ""), primary-color)
  let shadow-size = effects.at("shadowSize", default: 0) * 1pt
  let shadow-color = resolve-color(effects.at("shadowColor", default: "#00000040"), rgb("#00000040"))
  let rotation = effects.at("rotation", default: 0) * 1deg
  let stroke = if effects.at("border", default: false) and border-width > 0pt {
    border-width + border-color
  } else {
    none
  }
  let photo = box(
    width: picture-size,
    height: picture-size,
    radius: border-radius,
    clip: true,
    stroke: stroke,
    image(picture.url, width: picture-size, height: picture-size, fit: "cover")
  )

  let shadow-offset = shadow-size / 2
  let content = if shadow-size > 0pt {
    // The outer box is exactly the picture's size so the photo stays the
    // layout anchor (e.g. inside align(center)). The shadow is place()d
    // with a diagonal offset and overflows the box (place does not clip),
    // appearing below-right of the photo.
    box(width: picture-size, height: picture-size)[
      #place(
        top + left,
        dx: shadow-offset,
        dy: shadow-offset,
        box(width: picture-size, height: picture-size, radius: border-radius, fill: shadow-color)
      )
      #place(top + left, photo)
    ]
  } else {
    photo
  }

  rotate(rotation, reflow: true, content)
}

/// Education primary line: degree / study type only (item-presentation contract).
/// Never joins `area` with `" in "` — area belongs in `education-school`.
#let education-degree(item) = {
  if "studyType" in item and item.studyType != none { item.studyType } else { "" }
}

/// Education secondary line: `institution · area` (omit empty parts).
#let education-school(item) = {
  let institution = if "institution" in item and item.institution != none { item.institution } else { "" }
  let area = if "area" in item and item.area != none { item.area } else { "" }
  if institution != "" and area != "" {
    institution + " · " + area
  } else if institution != "" {
    institution
  } else {
    area
  }
}

/// Legacy helper: returns `studyType` only. `area` is ignored so callers cannot
/// accidentally reintroduce the `"in"` join (#829). Prefer `education-degree`.
#let format-degree(studyType, area) = {
  let _ = area
  studyType
}

/// Initials from a display name (up to `max` words). Shared with the sheet's
/// avatar fallback (item-presentation contract).
#let name-initials(name, max: 2) = {
  let parts = name.split(" ").filter(w => w.len() > 0)
  if parts.len() == 0 { return "" }
  parts.slice(0, calc.min(max, parts.len())).map(w => upper(w.at(0, default: ""))).join("")
}

/// Accent initials disc used when an avatar slot has no photo.
#let render-initials-avatar(name, size, fill) = {
  box(
    width: size,
    height: size,
    fill: fill,
    radius: 50%,
    align(center + horizon)[
      #text(size: size * 0.35, weight: "bold", fill: white)[#name-initials(name)]
    ],
  )
}

/// Avatar slot: photo when set, otherwise initials disc (#829).
#let render-avatar(basics, primary-color, default-size: 64pt) = {
  if has-visible-picture(basics) {
    render-picture(basics, primary-color, default-size: default-size)
  } else {
    let picture = if "picture" in basics and basics.picture != none { basics.picture } else { (:) }
    let size = picture.at("size", default: int(default-size / 1pt)) * 1pt
    render-initials-avatar(basics.name, size, primary-color)
  }
}

/// Clamp a skill/language level to [0, 5] and convert to int.
/// Shared level rule with the sheet (`clampLevel` / `MAX_LEVEL` = 5).
#let clamp-level(val) = {
  int(calc.min(calc.max(val, 0), 5))
}

/// Generic rating indicator (dots, squares, or rounded bars).
///
/// - `level`: 0–5 value (will be clamped)
/// - `width`, `height`: dimensions of each indicator
/// - `filled-color`, `empty-color`: fill for active/inactive indicators
/// - `radius`: border radius (50% for circles, 0pt–2pt for squares/rounded)
/// - `spacing`: horizontal gap between indicators
///
/// Every indicator carries a `filled-color` outline, empty ones included. A
/// rating is a graphical object that conveys information, so WCAG 2.1 SC 1.4.11
/// asks for 3:1 twice over: between the filled and empty states, AND between an
/// empty indicator and the page, so a reader can tell how many steps the scale
/// has. Those two demands pull in opposite directions when both states are
/// solid — a tint pale enough to read as "empty" against a filled accent is
/// nearly invisible on white. The outline breaks the tie the way a radio button
/// does: the ring carries visibility, the fill carries state.
#let rating-indicators(level, width, height, filled-color, empty-color, radius, spacing) = {
  let level = clamp-level(level)
  for i in range(5) {
    if i > 0 { h(spacing) }
    let color = if i < level { filled-color } else { empty-color }
    box(
      width: width,
      height: height,
      fill: color,
      radius: radius,
      stroke: 0.5pt + filled-color,
    )
  }
}

/// Whether an overridden level display should render an indicator for `level`.
/// False for the template's native rendering ("template-default"), for
/// "hidden", and for a "text" display with no level set (level 0).
#let should-render-level(level, level-display) = {
  (
    level-display != "template-default"
      and level-display != "hidden"
      and not (level-display == "text" and level == 0)
  )
}

/// Render a skill/language level in the configured global display style.
#let render-level(
  level,
  display,
  filled-color,
  empty-color,
  width: 6pt,
  height: 6pt,
  spacing: 2pt,
  track-width: 48pt,
  track-height: 4pt,
  text-size: 8pt,
) = {
  let level = clamp-level(level)

  if display == "hidden" {
    return
  } else if display == "circle" {
    rating-indicators(level, width, height, filled-color, empty-color, 50%, spacing)
  } else if display == "square" {
    rating-indicators(level, width, height, filled-color, empty-color, 0pt, spacing)
  } else if display == "progress-bar" {
    box(
      width: track-width,
      height: track-height,
      fill: empty-color,
      radius: track-height / 2,
      // Same reasoning as rating-indicators: the track outline is what makes
      // the unfilled remainder of the bar visible against the page.
      stroke: 0.5pt + filled-color,
      place(top + left, box(
        width: track-width * level / 5,
        height: track-height,
        fill: filled-color,
        radius: track-height / 2,
      )),
    )
  } else if display == "text" {
    let labels = ("", "Novice", "Beginner", "Intermediate", "Advanced", "Expert")
    let label = labels.at(level)
    if label != "" {
      text(size: text-size, fill: filled-color)[#label]
    }
  }
}

/// Render a pre-processed rich-text string (Typst markup) as content.
/// Plain text passes through unchanged; Typst markup is evaluated.
/// Accepts optional text-styling parameters (size, fill, style) to avoid
/// wrapping in text()[…] which breaks on block-level content (lists, paragraphs).
#let render-rich-text(content, size: none, fill: none, style: none) = {
  if content == "" or content == none { return }
  set text(size: size) if size != none
  set text(fill: fill) if fill != none
  set text(style: style) if style != none
  eval(content, mode: "markup")
}

/// Render a clickable URL link for an item, if present.
/// `color` is link ink, so callers pass their audited `accent-color`.
#let render-url(item, color) = {
  if has-url(item) {
    v(2pt)
    link(item.url.href)[#text(size: 9pt, fill: color)[#item.url.href]]
  }
}

/// Normalize a profile network/icon/host string for icon lookup.
#let normalize-profile-key(value) = {
  if value == none or value == "" {
    return ""
  }
  lower(value).replace(" ", "").replace("-", "").replace("_", "").replace(".", "")
}

/// Extract a hostname-ish token from a profile URL for icon fallback.
#let profile-url-host-key(item) = {
  if not has-url(item) {
    return ""
  }
  let href = lower(item.url.href)
  let without-scheme = if href.starts-with("https://") {
    href.slice(8)
  } else if href.starts-with("http://") {
    href.slice(7)
  } else if href.starts-with("mailto:") {
    return "email"
  } else {
    href
  }
  let host = without-scheme.split("/").at(0, default: "")
  let host = if host.starts-with("www.") { host.slice(4) } else { host }
  host.split(".").at(0, default: "")
}

/// Resolve the best icon key for a profile from icon → network → URL host.
#let profile-icon-key(item) = {
  let icon = if "icon" in item and item.icon != none { normalize-profile-key(item.icon) } else { "" }
  if icon != "" { return icon }

  let network = if "network" in item and item.network != none {
    normalize-profile-key(item.network)
  } else {
    ""
  }
  if network != "" { return network }

  normalize-profile-key(profile-url-host-key(item))
}

/// Map a normalized profile key to a bundled SVG stem under `/assets/icons/`.
/// Returns `none` when no bundled mark exists (text badge fallback).
#let profile-icon-asset(key) = {
  if key == "github" or key == "gh" or key == "githuborg" or key == "githuborganization" { "github" }
  else if key == "gitlab" or key == "gl" { "gitlab" }
  else if key == "linkedin" or key == "li" { "linkedin" }
  else if key == "twitter" or key == "x" or key == "xtwitter" { "x" }
  else if key == "facebook" or key == "fb" { "facebook" }
  else if key == "instagram" or key == "ig" { "instagram" }
  else if key == "youtube" or key == "yt" { "youtube" }
  else if key == "mastodon" { "mastodon" }
  else if key == "discord" { "discord" }
  else if key == "stackoverflow" or key == "stack" { "stackoverflow" }
  else if key == "medium" { "medium" }
  else if key == "dribbble" { "dribbble" }
  else if key == "behance" { "behance" }
  else if key == "telegram" or key == "tg" { "telegram" }
  else if key == "whatsapp" or key == "wa" { "whatsapp" }
  else if key == "email" or key == "mail" or key == "envelope" { "email" }
  else if key == "website" or key == "web" or key == "portfolio" or key == "personal" or key == "homepage" { "website" }
  else if key == "phone" or key == "tel" or key == "mobile" { "phone" }
  else { none }
}

/// Short offline-safe text mark when no bundled SVG exists for the key.
#let profile-icon-mark(key) = {
  if key != "" { key.slice(0, calc.min(2, key.len())) }
  else { "↗" }
}

/// Whether typography.hideIcons is set.
#let typography-hide-icons(data) = {
  data.metadata.typography.at("hideIcons", default: false)
}

/// Whether typography.underlineLinks is set (defaults to true).
#let typography-underline-links(data) = {
  data.metadata.typography.at("underlineLinks", default: true)
}

/// Compact local icon badge for a profile entry (bundled SVG, text fallback).
#let render-profile-icon(item, size: 9pt, fill: rgb("#333333")) = {
  let key = profile-icon-key(item)
  let asset = profile-icon-asset(key)
  let box-size = size + 2pt
  let icon-size = size * 0.72
  let content = if asset != none {
    // Typst does not resolve SVG `currentColor` from surrounding text; rewrite
    // the fill into the SVG bytes before rendering.
    let svg = read("/assets/icons/" + asset + ".svg")
    let colored = svg.replace("currentColor", fill.to-hex())
    image(bytes(colored), width: icon-size, height: icon-size)
  } else {
    text(size: size * 0.55, fill: fill, weight: "bold")[#profile-icon-mark(key)]
  }
  box(
    width: box-size,
    height: box-size,
    fill: fill.lighten(82%),
    radius: 2pt,
    stroke: 0.4pt + fill.lighten(40%),
    align(center + horizon, content),
  )
}

/// Inline contact icon from the bundled SVG set (email/phone/location/link).
/// Typst does not resolve SVG `currentColor` from surrounding text, so the
/// fill is rewritten into the SVG bytes before rendering — same mechanism as
/// `render-profile-icon`. The box baseline keeps the mark optically aligned
/// with the adjacent text line.
#let contact-icon(name, size: 9pt, fill: rgb("#333333")) = {
  let svg = read("/assets/icons/" + name + ".svg")
  let colored = svg.replace("currentColor", fill.to-hex())
  box(height: size, baseline: 15%, image(bytes(colored), height: size))
}

/// Icon-plus-content contact fragment. Respects `metadata.typography.hideIcons`
/// (the icon is dropped, the content stays).
#let contact-item(data, icon-name, body, size: 9pt, fill: rgb("#333333"), gap: 4pt) = {
  if not typography-hide-icons(data) {
    contact-icon(icon-name, size: size, fill: fill)
    h(gap)
  }
  body
}

/// Build the visible label for a profile entry (item-presentation contract).
///
/// Modes:
/// - `"username"` / `"auto"` — username (fallback network / URL) — **default**
/// - `"network"` — network name (fallback username / URL)
/// - `"network-username"` — `Network: username` when both exist
#let profile-entry-label(item, mode: "auto") = {
  let network = if "network" in item and item.network != none { item.network } else { "" }
  let username = if "username" in item and item.username != none { item.username } else { "" }
  let href = if has-url(item) { item.url.href } else { "" }

  if mode == "network" {
    if network != "" { network }
    else if username != "" { username }
    else { href }
  } else if mode == "network-username" {
    if network != "" and username != "" { network + ": " + username }
    else if network != "" { network }
    else if username != "" { username }
    else { href }
  } else {
    // "username" and "auto" share the same preference order (#829 / #820).
    if username != "" { username }
    else if network != "" { network }
    else { href }
  }
}

/// Render a profile row with an optional local icon and link styling.
///
/// Respects `metadata.typography.hideIcons` and `underlineLinks`.
/// Pass `fill` / `link-fill` so sidebar templates can keep readable contrast.
#let render-profile-entry(
  data,
  item,
  size: 9pt,
  fill: rgb("#333333"),
  link-fill: none,
  label-mode: "auto",
  weight: "regular",
  icon-gap: 4pt,
) = {
  let label = profile-entry-label(item, mode: label-mode)
  if label == "" or label == none { return }

  let hide-icons = typography-hide-icons(data)
  let underline-links = typography-underline-links(data)
  let color = if has-url(item) {
    if link-fill != none { link-fill } else { fill }
  } else {
    fill
  }

  let body = {
    if not hide-icons {
      render-profile-icon(item, size: size, fill: color)
      h(icon-gap)
    }
    text(size: size, fill: color, weight: weight)[#label]
  }

  if has-url(item) {
    let linked = if underline-links {
      underline(offset: 1.5pt, extent: 0.5pt, body)
    } else {
      body
    }
    link(item.url.href)[#linked]
  } else {
    body
  }
}

/// Check whether an item has non-empty keywords.
#let has-keywords(item) = {
  "keywords" in item and item.keywords != none and item.keywords.len() > 0
}

/// Render keywords as an inline comma-joined string.
#let render-keywords-inline(item, size, color, separator: ", ") = {
  if has-keywords(item) {
    text(size: size, fill: color)[#item.keywords.join(separator)]
  }
}

/// Render an item's keywords as soft tag chips (doc-editor spec §4.3).
/// Used for experience/education entries, whose keywords are new fields no
/// template renders natively. Colors are intentionally neutral so the chips
/// read as secondary metadata in every template's palette.
#let render-item-tag-chips(item, size: 7pt, ink: rgb("#57534e")) = {
  if not has-keywords(item) { return }
  v(3pt)
  // No outer box: a box is an unbreakable inline atom, so a long keyword list
  // would overflow the column instead of wrapping onto the next line. Each
  // chip stays boxed (it must not split mid-word); the gaps between them are
  // ordinary spacing, which is where a line break is allowed to happen.
  for (i, keyword) in item.keywords.enumerate() {
    if i > 0 { h(3pt) }
    box(
      fill: ink.lighten(88%),
      stroke: 0.4pt + ink.lighten(60%),
      radius: 999pt,
      inset: (x: 5pt, y: 2.5pt),
      text(size: size, fill: ink)[#keyword],
    )
  }
}

/// Render an item's custom fields as uppercase label + value rows
/// (doc-editor spec §4.3). Rows with neither label nor value are skipped.
#let render-item-custom-fields(item, size: 7.5pt, muted: rgb("#78716c")) = {
  let fields = item.at("customFields", default: ())
  if fields == none or fields.len() == 0 { return }
  for field in fields {
    let label = field.at("name", default: "")
    let value = field.at("value", default: "")
    if label == "" and value == "" { continue }
    v(2pt)
    block[
      #if label != "" {
        text(size: size - 0.5pt, fill: muted, tracking: 0.6pt)[#upper(label)]
        h(4pt)
      }
      #text(size: size)[#value]
    ]
  }
}

/// Build a filtered array of non-empty contact text items from basics.
/// Returns an array of (email, phone, location) strings, excluding empties.
/// URL is intentionally omitted — templates style it differently.
#let build-contact-items(basics) = {
  let items = ()
  if basics.email != "" { items = items + (basics.email,) }
  if basics.phone != "" { items = items + (basics.phone,) }
  if basics.location != "" { items = items + (basics.location,) }
  items
}

/// Optional sidebar width ratio from metadata.page.sidebarRatio.
#let sidebar-ratio(data) = {
  data.metadata.page.at("sidebarRatio", default: none)
}

/// Paper width in points for supported page formats.
#let paper-width(data) = {
  let format = data.metadata.page.at("format", default: "a4")
  if format == "letter" or format == "us-letter" {
    612pt
  } else {
    595.28pt
  }
}

/// Content width after subtracting resume page margins.
/// Note: fixed-width sidebar templates set the real page margin to 0/48pt, so
/// subtracting 2x the metadata margin here is an approximation. The web UI's
/// default-ratio math (ThemeEditor.tsx) mirrors the same approximation, so the
/// two stay self-consistent — do not "fix" the math on one side only.
#let content-width(data) = {
  paper-width(data) - (2 * data.metadata.page.at("margin", default: 18) * 1pt)
}

/// Clamp a sidebar ratio to the supported [0.1, 0.5] range.
/// The export path renders stored JSON without schema validation, so
/// out-of-range stored values must be clamped here as defense-in-depth.
#let clamp-sidebar-ratio(ratio) = {
  calc.max(0.1, calc.min(0.5, ratio))
}

/// Resolve a fixed sidebar width from sidebarRatio, preserving native defaults.
#let sidebar-width-from-ratio(data, default) = {
  let ratio = sidebar-ratio(data)
  if ratio == none {
    default
  } else {
    clamp-sidebar-ratio(ratio) * content-width(data)
  }
}

/// Resolve proportional two-column widths, preserving native defaults.
#let sidebar-ratio-columns(data, default, sidebar-side: "left") = {
  let ratio = sidebar-ratio(data)
  if ratio == none {
    return default
  }
  let ratio = clamp-sidebar-ratio(ratio)

  let sidebar-width = ratio * 100fr
  let main-width = (1 - ratio) * 100fr
  if sidebar-side == "right" {
    (main-width, sidebar-width)
  } else {
    (sidebar-width, main-width)
  }
}

/// Fixed-width sidebar plus flowing main content.
///
/// The grid owns the sidebar background while each column receives breakable
/// padding, so long content can continue onto later pages.
#let sidebar-layout(
  sidebar-width: 170pt,
  sidebar-bg: none,
  body-bg: none,
  sidebar-inset: (x: 16pt, y: 24pt),
  main-inset: (x: 24pt, y: 24pt),
  sidebar-content: none,
  main-content: none,
) = {
  grid(
    columns: (sidebar-width, 1fr),
    column-gutter: 0pt,
    fill: (x, _) => if x == 0 { sidebar-bg } else { body-bg },
    pad(x: sidebar-inset.x, y: sidebar-inset.y, sidebar-content),
    pad(x: main-inset.x, y: main-inset.y, main-content),
  )
}

/// Proportional two-column content layout.
#let two-column-layout(
  columns: (1fr, 2fr),
  column-gutter: 20pt,
  left-content: none,
  right-content: none,
) = {
  grid(
    columns: columns,
    column-gutter: column-gutter,
    left-content,
    right-content,
  )
}


#let default-main-sections = (
  "summary",
  "experience",
  "education",
  "awards",
  "certifications",
  "publications",
  "volunteer",
  "projects",
  "references",
)

#let default-sidebar-sections = (
  "profiles",
  "skills",
  "interests",
  "certifications",
  "awards",
  "publications",
  "languages",
)

#let unique-section-order(sources) = {
  let keys = ()
  for source in sources {
    for key in source {
      if not (key in keys) {
        keys = keys + (key,)
      }
    }
  }
  keys
}

#let default-all-sections = unique-section-order((
  default-main-sections,
  default-sidebar-sections,
  ("custom",),
))

/// Number of explicit layout pages (0 when no layout is stored).
#let layout-page-count(data) = {
  data.metadata.layout.len()
}

/// Return the section keys configured for a column on one layout page.
/// The fallback applies to page 0 only — pages after the first render exactly
/// what they declare, so an empty column on a later page stays empty instead
/// of repeating the default sections.
#let layout-column-sections(data, column, fallback, page: 0) = {
  if data.metadata.layout.len() > page and data.metadata.layout.at(page).len() > column {
    let keys = data.metadata.layout.at(page).at(column)
    if keys.len() > 0 or page > 0 {
      keys
    } else {
      fallback
    }
  } else if page == 0 {
    fallback
  } else {
    ()
  }
}

/// Return one layout page's keys in column order for single-column templates.
/// The fallback applies to page 0 only (see layout-column-sections).
#let layout-all-sections(data, fallback: default-all-sections, page: 0) = {
  if data.metadata.layout.len() <= page {
    return if page == 0 { fallback } else { () }
  }

  let keys = ()
  for column in data.metadata.layout.at(page) {
    keys = keys + column
  }

  if keys.len() > 0 or page > 0 {
    keys
  } else {
    fallback
  }
}

/// Return all rendered layout keys across every page (empty when no layout).
#let layout-section-keys(data) = {
  let keys = ()
  for page in data.metadata.layout {
    for column in page {
      keys = keys + column
    }
  }
  keys
}

/// Whether one layout key resolves to a section that would actually draw.
/// The cover letter never counts — it renders as a dedicated page before the
/// resume body — and a hidden section draws nothing, so it must not count
/// either (mirrors the `section.visible` guard in render-item-section).
#let layout-key-draws(data, key) = {
  if key == "coverLetter" { return false }
  if key == "custom" {
    if "custom" not in data.sections { return false }
    for (_, section) in data.sections.custom {
      if section.at("visible", default: false) { return true }
    }
    return false
  }
  if key in data.sections {
    return data.sections.at(key).at("visible", default: false)
  }
  if "custom" in data.sections and key in data.sections.custom {
    let section = data.sections.custom.at(key)
    return section != none and section.at("visible", default: false)
  }
  false
}

/// Whether a layout page declares any section that would draw. A page whose
/// keys are all hidden (or all "coverLetter") must not emit a styled blank
/// page.
#let layout-page-has-content(data, page) = {
  if data.metadata.layout.len() <= page { return false }
  for column in data.metadata.layout.at(page) {
    for key in column {
      if layout-key-draws(data, key) { return true }
    }
  }
  false
}

/// Whether the cover letter should render as a dedicated page.
/// Requires the section to exist, be visible, and be placed in the layout
/// (an empty layout counts as placed, mirroring the default section order).
#let has-cover-letter(data) = {
  if not ("coverLetter" in data.sections) { return false }
  let section = data.sections.coverLetter
  if not section.at("visible", default: false) { return false }
  let keys = layout-section-keys(data)
  data.metadata.layout.len() == 0 or "coverLetter" in keys
}

/// Whether the layout contains any resume section besides the dedicated cover
/// letter page. An empty layout falls back to the default resume sections.
#let has-resume-body(data) = {
  let keys = layout-section-keys(data)
  if data.metadata.layout.len() == 0 or keys.len() == 0 { return true }
  for key in keys {
    if key != "coverLetter" { return true }
  }
  false
}

/// Render the cover letter recipient block (name, title, company, address,
/// email), top-left, skipping empty fields.
#let render-cover-letter-recipient(recipient, size: 10pt, muted: none) = {
  let lines = ()
  let name = recipient.at("name", default: "")
  let title = recipient.at("title", default: "")
  let company = recipient.at("company", default: "")
  let address = recipient.at("address", default: "")
  let email = recipient.at("email", default: "")
  if name != "" { lines = lines + (text(weight: "bold")[#name],) }
  if title != "" { lines = lines + ([#title],) }
  if company != "" { lines = lines + ([#company],) }
  if address != "" { lines = lines + ([#address],) }
  if email != "" { lines = lines + (link("mailto:" + email)[#email],) }

  if lines.len() > 0 {
    set text(size: size)
    set text(fill: muted) if muted != none
    stack(dir: ttb, spacing: 4pt, ..lines)
    v(12pt)
  }
}

/// Render the cover letter (heading, recipient block, rich-text body) using
/// the template's heading style. Content arrives pre-converted to Typst
/// markup by the engine's rich-text preprocessing.
#let render-cover-letter(data, heading, size: 10pt, muted: none) = {
  let section = data.sections.at("coverLetter", default: (:))
  heading(section.at("name", default: "Cover Letter"))
  render-cover-letter-recipient(section.at("recipient", default: (:)), size: size, muted: muted)
  render-rich-text(section.at("content", default: ""), size: size)
}

/// Render the cover letter as a dedicated page before the resume content.
/// No-op unless the section is visible and placed in the layout.
#let render-cover-letter-page(data, heading, size: 10pt, muted: none, inset: none) = {
  if not has-cover-letter(data) { return }
  if inset == none {
    render-cover-letter(data, heading, size: size, muted: muted)
  } else {
    pad(x: inset.x, y: inset.y)[
      #render-cover-letter(data, heading, size: size, muted: muted)
    ]
  }
  if has-resume-body(data) {
    pagebreak()
  }
}

/// Render a text-only section without splitting it from its heading.
#let render-rich-text-section(section, heading, size: 10pt, fill: none, style: none) = {
  if section.visible {
    block(breakable: false)[
      #heading(section.name)
      #render-rich-text(section.content, size: size, fill: fill, style: style)
    ]
  }
}

/// Main-flow section keys allowed to carry mid-section page breaks
/// (doc-editor spec §3.4). Break markers on any other section are ignored.
#let item-break-sections = (
  "experience",
  "education",
  "projects",
  "volunteer",
  "awards",
  "certifications",
  "publications",
  "references",
)

/// Item ids that start a new page for a section (metadata.itemBreaks).
#let item-breaks-for(data, key) = {
  data.metadata.at("itemBreaks", default: (:)).at(key, default: ())
}

/// Split a section's items into page slices: a new slice starts at every item
/// whose id is a break marker. Never yields empty slices — a marker on the
/// first item is a no-op, matching the editor's rendering pipeline where an
/// empty leading slice is stripped.
#let split-items-by-breaks(items, breaks) = {
  let slices = ()
  let current = ()
  for item in items {
    if current.len() > 0 and item.at("id", default: "") in breaks {
      slices.push(current)
      current = ()
    }
    current.push(item)
  }
  if current.len() > 0 {
    slices.push(current)
  }
  slices
}

/// Render item sections while keeping headings with the first item.
///
/// - `extras`: optional per-item trailer (keyword chips, custom-field rows)
///   rendered inside the item's unbreakable block.
/// - `breaks`: item ids that start a new page (metadata.itemBreaks). Each
///   continuation slice starts after a weak pagebreak and re-renders the
///   heading as "<Name> (cont.)". Typst forbids pagebreaks inside layout
///   containers, so grid-based layouts (sidebar/two-column) must not pass
///   breaks — see render-resume.
#let render-item-section(section, heading, render-item, extras: none, breaks: ()) = {
  if not section.visible { return }

  if section.items.len() == 0 {
    block(breakable: false)[
      #heading(section.name)
    ]
    return
  }

  let slices = if breaks.len() > 0 {
    split-items-by-breaks(section.items, breaks)
  } else {
    (section.items,)
  }

  for (slice-index, slice) in slices.enumerate() {
    if slice-index > 0 {
      pagebreak(weak: true)
    }
    let title = if slice-index == 0 { section.name } else { section.name + " (cont.)" }
    let is-first = true
    for item in slice {
      block(breakable: false)[
        #if is-first {
          heading(title)
        }
        #render-item(item)
        #if extras != none {
          extras(item)
        }
      ]
      is-first = false
    }
  }
}

#let identity(content) = {
  content
}

#let render-slot(slot) = {
  if slot != none {
    slot()
  }
}

/// Per-item trailer for a section key (doc-editor spec §4.3 + item-presentation
/// contract): keyword chips for experience/education (fields no template renders
/// natively) plus custom-field rows for experience, education, projects, and
/// skills. Skills/projects/interests already print keywords in each template's
/// native style — extras must not double-render those.
#let section-item-extras(key) = {
  if key == "experience" or key == "education" {
    item => {
      render-item-tag-chips(item)
      render-item-custom-fields(item)
    }
  } else if key == "projects" or key == "skills" {
    item => render-item-custom-fields(item)
  } else {
    none
  }
}

/// Render a semantic section key using template-provided presentation renderers.
/// `allow-item-breaks` gates metadata.itemBreaks pagination: only true when
/// the section renders at page level (single-column layouts), since Typst
/// forbids pagebreaks inside grid containers.
#let render-section(data, key, heading, renderers, allow-item-breaks: false) = {
  let breaks = if allow-item-breaks and key in item-break-sections {
    item-breaks-for(data, key)
  } else {
    ()
  }
  let extras = section-item-extras(key)

  if key == "summary" {
    render-rich-text-section(data.sections.summary, heading)
  } else if key == "profiles" {
    render-item-section(data.sections.profiles, heading, renderers.profiles)
  } else if key == "experience" {
    render-item-section(
      data.sections.experience,
      heading,
      renderers.experience,
      extras: extras,
      breaks: breaks,
    )
  } else if key == "education" {
    render-item-section(
      data.sections.education,
      heading,
      renderers.education,
      extras: extras,
      breaks: breaks,
    )
  } else if key == "awards" {
    render-item-section(data.sections.awards, heading, renderers.awards, breaks: breaks)
  } else if key == "certifications" {
    render-item-section(
      data.sections.certifications,
      heading,
      renderers.certifications,
      breaks: breaks,
    )
  } else if key == "skills" {
    render-item-section(data.sections.skills, heading, renderers.skills, extras: extras)
  } else if key == "interests" {
    render-item-section(data.sections.interests, heading, renderers.interests)
  } else if key == "publications" {
    render-item-section(
      data.sections.publications,
      heading,
      renderers.publications,
      breaks: breaks,
    )
  } else if key == "volunteer" {
    render-item-section(data.sections.volunteer, heading, renderers.volunteer, breaks: breaks)
  } else if key == "languages" {
    render-item-section(data.sections.languages, heading, renderers.languages)
  } else if key == "projects" {
    render-item-section(
      data.sections.projects,
      heading,
      renderers.projects,
      extras: extras,
      breaks: breaks,
    )
  } else if key == "references" {
    render-item-section(data.sections.references, heading, renderers.references, breaks: breaks)
  } else if key == "coverLetter" {
    // Rendered as a dedicated page via render-cover-letter-page before the
    // resume body (pagebreaks are not allowed inside layout containers), so
    // the layout slot is intentionally skipped here.
  } else if key == "custom" and "custom" in data.sections {
    // Layout slot "custom" = render every custom section (order follows JSON object order).
    for (_, section) in data.sections.custom {
      render-item-section(section, heading, renderers.custom)
    }
  } else if "custom" in data.sections and key in data.sections.custom {
    // Layout may reference a single custom block by its id (e.g. imported React-Resume keys).
    let section = data.sections.custom.at(key)
    if section != none {
      render-item-section(section, heading, renderers.custom)
    }
  }
}

/// Render a configured sequence of semantic section keys.
#let render-sections(data, keys, heading, renderers, allow-item-breaks: false) = {
  for key in keys {
    render-section(data, key, heading, renderers, allow-item-breaks: allow-item-breaks)
  }
}

/// Render one configured layout column with a fallback section order.
#let render-sections-for-column(data, column, fallback, heading, renderers, page: 0) = {
  render-sections(
    data,
    layout-column-sections(data, column, fallback, page: page),
    heading,
    renderers,
  )
}

/// Render every layout page in order for single-column templates, with an
/// explicit pagebreak between layout pages. Single-column content flows at
/// page level, so metadata.itemBreaks pagination is honored here.
#let render-all-sections(data, heading, renderers) = {
  render-sections(data, layout-all-sections(data), heading, renderers, allow-item-breaks: true)
  for page in range(1, calc.max(1, layout-page-count(data))) {
    if not layout-page-has-content(data, page) { continue }
    pagebreak(weak: true)
    render-sections(
      data,
      layout-all-sections(data, page: page),
      heading,
      renderers,
      allow-item-breaks: true,
    )
  }
}

/// Render a resume from shared semantic rules and template-provided presentation.
#let render-resume(data, config) = {
  let layout = config.layout
  let renderers = config.renderers
  let main-heading = config.at("main-heading", default: config.at("heading", default: none))
  let sidebar-heading = config.at("sidebar-heading", default: main-heading)
  let main-fallback = config.at("main-fallback", default: default-main-sections + ("custom",))
  let sidebar-fallback = config.at("sidebar-fallback", default: default-sidebar-sections)
  let before-layout = config.at("before-layout", default: none)
  let header = config.at("header", default: none)
  let sidebar-before = config.at("sidebar-before", default: none)
  let main-before = config.at("main-before", default: none)
  let left-before = config.at("left-before", default: none)
  let right-before = config.at("right-before", default: none)
  let sidebar-wrapper = config.at("sidebar-wrapper", default: identity)
  let main-wrapper = config.at("main-wrapper", default: identity)
  let left-wrapper = config.at("left-wrapper", default: identity)
  let right-wrapper = config.at("right-wrapper", default: identity)

  render-slot(header)
  render-slot(before-layout)

  // Explicit layout pages after the first re-emit the template's grid (Typst
  // forbids pagebreaks inside layout containers, so each page gets its own
  // grid). Header/before slots belong to page 0 only.
  let pages = calc.max(1, layout-page-count(data))

  if layout == "single" {
    render-all-sections(data, main-heading, renderers)
  } else if layout == "sidebar-left" or layout == "full-header-sidebar" {
    for page in range(pages) {
      if page > 0 {
        if not layout-page-has-content(data, page) { continue }
        pagebreak(weak: true)
      }
      sidebar-layout(
        sidebar-width: config.at("sidebar-width", default: 170pt),
        sidebar-bg: config.at("sidebar-bg", default: none),
        body-bg: config.at("body-bg", default: none),
        sidebar-inset: config.at("sidebar-inset", default: (x: 16pt, y: 24pt)),
        main-inset: config.at("main-inset", default: (x: 24pt, y: 24pt)),
        sidebar-content: sidebar-wrapper([
          #if page == 0 { render-slot(sidebar-before) }
          #render-sections-for-column(
            data,
            1,
            sidebar-fallback,
            sidebar-heading,
            renderers,
            page: page,
          )
        ]),
        main-content: main-wrapper([
          #if page == 0 { render-slot(main-before) }
          #render-sections-for-column(data, 0, main-fallback, main-heading, renderers, page: page)
        ]),
      )
    }
  } else if layout == "two-column" {
    for page in range(pages) {
      if page > 0 {
        if not layout-page-has-content(data, page) { continue }
        pagebreak(weak: true)
      }
      two-column-layout(
        columns: config.at("columns", default: (1fr, 2fr)),
        column-gutter: config.at("column-gutter", default: 20pt),
        left-content: left-wrapper([
          #if page == 0 { render-slot(left-before) }
          #render-sections-for-column(
            data,
            config.at("left-column", default: 0),
            config.at("left-fallback", default: main-fallback),
            config.at("left-heading", default: main-heading),
            renderers,
            page: page,
          )
        ]),
        right-content: right-wrapper([
          #if page == 0 { render-slot(right-before) }
          #render-sections-for-column(
            data,
            config.at("right-column", default: 1),
            config.at("right-fallback", default: sidebar-fallback),
            config.at("right-heading", default: sidebar-heading),
            renderers,
            page: page,
          )
        ]),
      )
    }
  }
}
