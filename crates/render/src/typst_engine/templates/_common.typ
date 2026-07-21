// Shared helpers for all Rustume templates.
// Templates import with: #import "_common.typ": *

/// Check whether an item has a non-empty URL.
#let has-url(item) = {
  "url" in item and item.url != none and item.url.href != ""
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

/// Format a degree line from studyType and area.
#let format-degree(studyType, area) = {
  if studyType != "" and area != "" {
    [#studyType in #area]
  } else if area != "" {
    area
  } else {
    studyType
  }
}

/// Clamp a skill/language level to [0, 5] and convert to int.
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
#let rating-indicators(level, width, height, filled-color, empty-color, radius, spacing) = {
  let level = clamp-level(level)
  for i in range(5) {
    if i > 0 { h(spacing) }
    let color = if i < level { filled-color } else { empty-color }
    box(width: width, height: height, fill: color, radius: radius)
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
/// Uses primary-color for styling — caller must have it in scope.
#let render-url(item, color) = {
  if has-url(item) {
    v(2pt)
    link(item.url.href)[#text(size: 9pt, fill: color)[#item.url.href]]
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

/// Return the section keys configured for a layout column, with a fallback.
#let layout-column-sections(data, column, fallback) = {
  if data.metadata.layout.len() > 0 and data.metadata.layout.at(0).len() > column {
    let keys = data.metadata.layout.at(0).at(column)
    if keys.len() > 0 {
      keys
    } else {
      fallback
    }
  } else {
    fallback
  }
}

/// Return all page-0 layout keys in column order for single-column templates.
#let layout-all-sections(data, fallback: default-all-sections) = {
  if data.metadata.layout.len() == 0 {
    return fallback
  }

  let keys = ()
  for column in data.metadata.layout.at(0) {
    keys = keys + column
  }

  if keys.len() > 0 {
    keys
  } else {
    fallback
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

/// Render item sections while keeping headings with the first item.
#let render-item-section(section, heading, render-item) = {
  if section.visible {
    let has-items = false
    let is-first = true

    for item in section.items {
      has-items = true
      block(breakable: false)[
        #if is-first {
          heading(section.name)
        }
        #render-item(item)
      ]
      is-first = false
    }

    if not has-items {
      block(breakable: false)[
        #heading(section.name)
      ]
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

/// Render a semantic section key using template-provided presentation renderers.
#let render-section(data, key, heading, renderers) = {
  if key == "summary" {
    render-rich-text-section(data.sections.summary, heading)
  } else if key == "profiles" {
    render-item-section(data.sections.profiles, heading, renderers.profiles)
  } else if key == "experience" {
    render-item-section(data.sections.experience, heading, renderers.experience)
  } else if key == "education" {
    render-item-section(data.sections.education, heading, renderers.education)
  } else if key == "awards" {
    render-item-section(data.sections.awards, heading, renderers.awards)
  } else if key == "certifications" {
    render-item-section(data.sections.certifications, heading, renderers.certifications)
  } else if key == "skills" {
    render-item-section(data.sections.skills, heading, renderers.skills)
  } else if key == "interests" {
    render-item-section(data.sections.interests, heading, renderers.interests)
  } else if key == "publications" {
    render-item-section(data.sections.publications, heading, renderers.publications)
  } else if key == "volunteer" {
    render-item-section(data.sections.volunteer, heading, renderers.volunteer)
  } else if key == "languages" {
    render-item-section(data.sections.languages, heading, renderers.languages)
  } else if key == "projects" {
    render-item-section(data.sections.projects, heading, renderers.projects)
  } else if key == "references" {
    render-item-section(data.sections.references, heading, renderers.references)
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
#let render-sections(data, keys, heading, renderers) = {
  for key in keys {
    render-section(data, key, heading, renderers)
  }
}

/// Render one configured layout column with a fallback section order.
#let render-sections-for-column(data, column, fallback, heading, renderers) = {
  render-sections(data, layout-column-sections(data, column, fallback), heading, renderers)
}

/// Render all configured layout columns in order for single-column templates.
#let render-all-sections(data, heading, renderers) = {
  render-sections(data, layout-all-sections(data), heading, renderers)
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

  if layout == "single" {
    render-all-sections(data, main-heading, renderers)
  } else if layout == "sidebar-left" or layout == "full-header-sidebar" {
    sidebar-layout(
      sidebar-width: config.at("sidebar-width", default: 170pt),
      sidebar-bg: config.at("sidebar-bg", default: none),
      body-bg: config.at("body-bg", default: none),
      sidebar-inset: config.at("sidebar-inset", default: (x: 16pt, y: 24pt)),
      main-inset: config.at("main-inset", default: (x: 24pt, y: 24pt)),
      sidebar-content: sidebar-wrapper([
        #render-slot(sidebar-before)
        #render-sections-for-column(data, 1, sidebar-fallback, sidebar-heading, renderers)
      ]),
      main-content: main-wrapper([
        #render-slot(main-before)
        #render-sections-for-column(data, 0, main-fallback, main-heading, renderers)
      ]),
    )
  } else if layout == "two-column" {
    two-column-layout(
      columns: config.at("columns", default: (1fr, 2fr)),
      column-gutter: config.at("column-gutter", default: 20pt),
      left-content: left-wrapper([
        #render-slot(left-before)
        #render-sections-for-column(
          data,
          config.at("left-column", default: 0),
          config.at("left-fallback", default: main-fallback),
          config.at("left-heading", default: main-heading),
          renderers,
        )
      ]),
      right-content: right-wrapper([
        #render-slot(right-before)
        #render-sections-for-column(
          data,
          config.at("right-column", default: 1),
          config.at("right-fallback", default: sidebar-fallback),
          config.at("right-heading", default: sidebar-heading),
          renderers,
        )
      ]),
    )
  }
}
