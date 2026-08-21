// Chikorita Template - Two-column layout with green accents
// Main content (left, 2/3) + sidebar (right, 1/3) with tinted background

#import "_common.typ": *


#let template(data) = {
  // ── Theme colors from resume metadata (with sensible fallbacks) ──
  let primary-color = rgb(data.metadata.theme.at("primary", default: "#16a34a"))
  let text-color = rgb(data.metadata.theme.at("text", default: "#166534"))
  let bg-color = rgb(data.metadata.theme.at("background", default: "#ffffff"))
  let level-display = data.metadata.at("levelDisplay", default: "template-default")
  // Derived colors (not in schema — computed from theme values)
  let muted-color = text-color.lighten(10%)
  // Accent ink: `primary-color` darkened until it clears WCAG AA (4.5:1)
  // as text on every backdrop this template paints it on — page, tinted
  // panels, chips and its own profile badge. `primary-color` itself stays
  // the untouched brand seed the decorative tints below are derived from.
  let accent-color = primary-color.darken(35%)

  // ── Helper functions (capture theme colors from enclosing scope) ──

  let light-bg = primary-color.lighten(92%)
  let accent-bg = primary-color.lighten(85%)
  let border-color = primary-color.lighten(75%)

  let main-section(title) = {
    v(14pt)
    box(
      width: 100%,
      stroke: (bottom: 2pt + accent-color),
      inset: (bottom: 4pt),
      text(weight: "bold", size: 10pt, fill: accent-color, tracking: 0.06em)[#upper(title)]
    )
    v(10pt)
  }

  let sidebar-section(title) = {
    v(12pt)
    heading-label(upper(title), size: 9pt, fill: accent-color, tracking: 0.08em)
    v(2pt)
    line(length: 100%, stroke: 0.5pt + accent-color)
    v(6pt)
  }

  let rating-dots(level) = {
    let level = clamp-level(level)
    if level-display == "template-default" {
      rating-indicators(level, 6pt, 6pt, accent-color, border-color, 50%, 3pt)
    } else {
      render-level(level, level-display, accent-color, border-color, spacing: 3pt)
    }
  }

  let render-experience(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 12pt,
      [
        #text(weight: "bold", size: 11pt)[#item.position]
        #v(2pt)
        #text(size: 10pt, fill: accent-color)[#item.company]
      ],
      align(right)[
        #text(size: 9pt, fill: muted-color)[#item.date]
        #if item.location != "" {
          v(2pt)
          text(size: 9pt, fill: muted-color)[#item.location]
        }
      ]
    )

    if item.summary != "" {
      v(6pt)
      render-rich-text(item.summary, size: 10pt)
    }

    v(12pt)
  }

  let render-education(item) = {
    if item.visible == false { return }

    let degree = education-degree(item)
    let school = education-school(item)
    grid(
      columns: (1fr, auto),
      column-gutter: 12pt,
      [
        #if degree != "" {
          text(weight: "bold", size: 11pt)[#degree]
        }
        #if school != "" {
          if degree != "" { v(2pt) }
          text(size: 10pt)[#school]
        }
      ],
      text(size: 9pt, fill: muted-color)[#item.date]
    )

    if item.score != "" {
      v(2pt)
      text(size: 9pt, fill: muted-color)[#item.score]
    }

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 10pt)
    }

    v(12pt)
  }

  let render-skill(item) = {
    if item.visible == false { return }

    text(size: 9pt, weight: "bold")[#item.name]

    if item.description != "" {
      v(2pt)
      render-rich-text(item.description, size: 8pt, fill: muted-color)
    }

    let level = clamp-level(item.level)
    if level-display == "template-default" and level > 0 {
      v(2pt)
      rating-dots(level)
    } else if should-render-level(level, level-display) {
      v(2pt)
      rating-dots(level)
    }

    if has-keywords(item) {
      v(2pt)
      text(size: 8pt, fill: muted-color)[#item.keywords.join(", ")]
    }

    v(8pt)
  }

  let render-language(item) = {
    if item.visible == false { return }

    text(size: 9pt, weight: "bold")[#item.name]

    if item.description != "" {
      v(2pt)
      render-rich-text(item.description, size: 8pt, fill: muted-color)
    }

    let level = clamp-level(item.level)
    if level-display == "template-default" and level > 0 {
      v(2pt)
      rating-dots(level)
    } else if should-render-level(level, level-display) {
      v(2pt)
      rating-dots(level)
    }

    v(8pt)
  }

  let render-profile(item) = {
    if item.visible == false { return }

    render-profile-entry(
      data,
      item,
      size: 9pt,
      fill: text-color,
      link-fill: accent-color,
      label-mode: "auto",
      weight: "medium",
    )
    v(6pt)
  }

  let render-project(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 12pt,
      text(weight: "bold", size: 10pt)[#item.name],
      text(size: 9pt, fill: muted-color)[#item.date]
    )

    if item.description != "" {
      v(4pt)
      render-rich-text(item.description, size: 10pt)
    }

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 9pt, fill: muted-color)
    }

    if has-keywords(item) {
      v(4pt)
      for keyword in item.keywords {
        box(
          fill: accent-bg,
          radius: 3pt,
          inset: (x: 6pt, y: 2pt),
          text(size: 8pt, fill: accent-color)[#keyword]
        )
        h(4pt)
      }
    }

    v(12pt)
  }

  let render-certification(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 12pt,
      [
        #text(weight: "medium", size: 10pt)[#item.name]
        #if item.issuer != "" {
          text(size: 9pt, fill: muted-color)[ -- #item.issuer]
        }
      ],
      text(size: 9pt, fill: muted-color)[#item.date]
    )

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 9pt)
    }

    v(10pt)
  }

  let render-award(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 12pt,
      [
        #text(weight: "medium", size: 10pt)[#item.title]
        #if item.awarder != "" {
          text(size: 9pt, fill: muted-color)[ -- #item.awarder]
        }
      ],
      text(size: 9pt, fill: muted-color)[#item.date]
    )

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 9pt)
    }

    v(10pt)
  }

  let render-interest(item) = {
    if item.visible == false { return }

    text(size: 9pt, weight: "medium")[#item.name]

    if has-keywords(item) {
      v(2pt)
      text(size: 8pt, fill: muted-color)[#item.keywords.join(", ")]
    }

    v(6pt)
  }

  let render-publication(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 12pt,
      [
        #text(weight: "medium", size: 10pt)[#item.name]
        #if item.publisher != "" {
          text(size: 9pt, fill: muted-color)[ -- #item.publisher]
        }
      ],
      text(size: 9pt, fill: muted-color)[#item.date]
    )

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 9pt)
    }

    v(12pt)
  }

  let render-volunteer(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 12pt,
      [
        #text(weight: "bold", size: 11pt)[#item.organization]
        #v(2pt)
        #text(size: 10pt, fill: accent-color)[#item.position]
      ],
      align(right)[
        #text(size: 9pt, fill: muted-color)[#item.date]
        #if item.location != "" {
          v(2pt)
          text(size: 9pt, fill: muted-color)[#item.location]
        }
      ]
    )

    if item.summary != "" {
      v(6pt)
      render-rich-text(item.summary, size: 10pt)
    }

    v(12pt)
  }

  let render-reference(item) = {
    if item.visible == false { return }

    text(weight: "bold", size: 10pt)[#item.name]

    if item.description != "" {
      v(4pt)
      render-rich-text(item.description, size: 10pt)
    }

    if item.summary != "" {
      v(4pt)
      box(
        stroke: (left: 2pt + accent-color),
        inset: (left: 10pt, y: 2pt),
        render-rich-text(item.summary, size: 9pt, style: "italic", fill: muted-color)
      )
    }

    v(12pt)
  }

  let render-custom(item) = {
    if item.visible == false { return }

    text(weight: "bold", size: 10pt)[#item.name]

    if item.description != "" {
      v(4pt)
      render-rich-text(item.description, size: 10pt)
    }

    if item.date != "" or item.location != "" {
      v(2pt)
      if item.date != "" {
        text(size: 9pt, fill: muted-color)[#item.date]
      }
      if item.date != "" and item.location != "" {
        h(8pt)
      }
      if item.location != "" {
        text(size: 9pt, fill: muted-color)[#item.location]
      }
    }

    if item.summary != "" {
      v(6pt)
      render-rich-text(item.summary, size: 10pt)
    }

    if has-keywords(item) {
      v(4pt)
      for keyword in item.keywords {
        box(
          fill: accent-bg,
          radius: 3pt,
          inset: (x: 6pt, y: 2pt),
          text(size: 8pt, fill: accent-color)[#keyword]
        )
        h(4pt)
      }
    }

    render-url(item, accent-color)
    v(12pt)
  }


  let renderers = (
    profiles: render-profile,
    experience: render-experience,
    education: render-education,
    awards: render-award,
    certifications: render-certification,
    skills: render-skill,
    interests: render-interest,
    publications: render-publication,
    volunteer: render-volunteer,
    languages: render-language,
    projects: render-project,
    references: render-reference,
    custom: render-custom,
  )

  set page(fill: bg-color, 
    margin: 48pt,
  )

  set text(
    font: "IBM Plex Sans",
    size: 10pt,
    fill: text-color,
  )

  set par(
    leading: 0.65em,
    justify: false,
  )

  render-cover-letter-page(data, main-section, muted: muted-color)

  if has-resume-body(data) {
    // Header - above columns, left-aligned
    avatar-above(data.basics, accent-color)

    text(size: 26pt, weight: "bold", fill: text-color)[#data.basics.name]

    if data.basics.headline != "" {
      v(4pt)
      text(size: 12pt, fill: accent-color)[#data.basics.headline]
    }

    v(10pt)

    // Contact info
    let contact-items = build-contact-items(data.basics)
    if has-url(data.basics) { contact-items = contact-items + (link(data.basics.url.href)[#url-display-label(data.basics.url)],) }

    if contact-items.len() > 0 {
      text(size: 9pt, fill: muted-color)[#contact-items.join("  |  ")]
    }

    v(16pt)
    line(length: 100%, stroke: 1pt + accent-color)
    v(12pt)

    // `block`, not `box`: a box is an unbreakable inline atom, so a tall
    // tinted sidebar forced the whole two-column grid onto page 2 and left
    // page 1 with only the header (#855). A block keeps the fill/radius and
    // can split with the grid.
    let right-wrapper(body) = {
      block(
        fill: light-bg,
        radius: 6pt,
        inset: 12pt,
        width: 100%,
        body,
      )
    }

    render-resume(data, (
      layout: "two-column",
      renderers: renderers,
      columns: sidebar-ratio-columns(data, (2fr, 1fr), sidebar-side: "right"),
      column-gutter: 20pt,
      left-column: 0,
      left-fallback: default-main-sections + ("custom",),
      left-heading: main-section,
      right-column: 1,
      right-fallback: default-sidebar-sections,
      right-heading: sidebar-section,
      right-wrapper: right-wrapper,
    ))
  }
}
