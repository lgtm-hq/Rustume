// Shared helpers for all Rustume templates.
// Templates import with: #import "_common.typ": *

/// Check whether an item has a non-empty URL.
#let has-url(item) = {
  "url" in item and item.url != none and item.url.href != ""
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
