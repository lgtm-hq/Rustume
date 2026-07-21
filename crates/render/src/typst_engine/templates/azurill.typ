// Azurill Template - Two-column sidebar layout
// Amber/gold accents, left sidebar (1/3) + main content (2/3), centered header above columns

#import "_common.typ": *


#let template(data) = {
  // ── Theme colors from resume metadata (with sensible fallbacks) ──
  let primary-color = rgb(data.metadata.theme.at("primary", default: "#d97706"))
  let text-color = rgb(data.metadata.theme.at("text", default: "#1f2937"))
  let bg-color = rgb(data.metadata.theme.at("background", default: "#ffffff"))
  let level-display = data.metadata.at("levelDisplay", default: "template-default")
  // Derived colors (not in schema — computed from theme values)
  let muted-color = text-color.lighten(40%)

  // ── Helper functions (capture theme colors from enclosing scope) ──

  let light-bg = primary-color.lighten(90%)
  let bar-empty = bg-color.darken(10%)

  // Section heading for main content area (right column)
  let main-section-heading(title) = {
    v(14pt)
    text(weight: "bold", size: 11pt, fill: primary-color, tracking: 0.06em)[#upper(title)]
    v(2pt)
    line(length: 100%, stroke: 1.5pt + primary-color)
    v(8pt)
  }

  // Section heading for sidebar (left column) - smaller, different style
  let sidebar-section-heading(title) = {
    v(12pt)
    text(weight: "semibold", size: 9pt, fill: primary-color, tracking: 0.1em)[#upper(title)]
    v(2pt)
    line(length: 100%, stroke: 0.75pt + primary-color)
    v(6pt)
  }

  // Rating bars helper (0-5 scale)
  let rating-bars(level) = {
    let level = clamp-level(level)
    if level-display == "template-default" {
      rating-indicators(level, 14pt, 4pt, primary-color, bar-empty, 2pt, 2pt)
    } else if level-display == "progress-bar" {
      render-level(level, level-display, primary-color, bar-empty, track-width: 70pt)
    } else {
      render-level(level, level-display, primary-color, bar-empty)
    }
  }

  let render-experience(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 8pt,
      [
        #text(weight: "bold", size: 10pt)[#item.company]
        #v(1pt)
        #text(size: 9pt, fill: muted-color)[#item.position]
      ],
      align(right)[
        #text(size: 9pt, fill: muted-color)[#item.date]
        #if item.location != "" {
          v(1pt)
          text(size: 8pt, fill: muted-color)[#item.location]
        }
      ]
    )

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 9pt)
    }

    v(10pt)
  }

  let render-education(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 8pt,
      [
        #text(weight: "bold", size: 10pt)[#item.institution]
        #if item.studyType != "" or item.area != "" {
          v(1pt)
          let degree = format-degree(item.studyType, item.area)
          text(size: 9pt, fill: muted-color)[#degree]
        }
      ],
      align(right)[
        #text(size: 9pt, fill: muted-color)[#item.date]
      ]
    )

    if item.score != "" {
      v(2pt)
      text(size: 8pt, fill: muted-color)[Score: #item.score]
    }

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 9pt)
    }

    v(10pt)
  }

  let render-skill(item) = {
    if item.visible == false { return }

    text(size: 9pt, weight: "bold")[#item.name]

    if item.description != "" {
      v(1pt)
      render-rich-text(item.description, size: 8pt, fill: muted-color)
    }

    let level = clamp-level(item.level)
    if level-display == "template-default" and level > 0 {
      v(2pt)
      rating-bars(level)
    } else if should-render-level(level, level-display) {
      v(2pt)
      rating-bars(level)
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
      v(1pt)
      render-rich-text(item.description, size: 8pt, fill: muted-color)
    }

    let level = clamp-level(item.level)
    if level-display == "template-default" and level > 0 {
      v(2pt)
      rating-bars(level)
    } else if should-render-level(level, level-display) {
      v(2pt)
      rating-bars(level)
    }

    v(8pt)
  }

  let render-profile(item) = {
    if item.visible == false { return }

    let network = if "network" in item and item.network != none { item.network } else { "" }
    let username = if "username" in item and item.username != none { item.username } else { "" }

    if network != "" {
      text(size: 8pt, fill: muted-color)[#network]
      v(1pt)
    }
    let label = if username != "" { username } else if has-url(item) { item.url.href } else { "" }
    if label != "" {
      if has-url(item) {
        link(item.url.href)[#text(size: 9pt, fill: primary-color)[#label]]
      } else {
        text(size: 9pt)[#label]
      }
    }
    v(6pt)
  }

  let render-project(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 8pt,
      text(weight: "bold", size: 10pt)[#item.name],
      text(size: 9pt, fill: muted-color)[#item.date]
    )

    if item.description != "" {
      v(2pt)
      render-rich-text(item.description, size: 9pt)
    }

    if item.summary != "" {
      v(2pt)
      render-rich-text(item.summary, size: 9pt)
    }

    if has-keywords(item) {
      v(3pt)
      for keyword in item.keywords {
        box(
          fill: light-bg,
          radius: 3pt,
          inset: (x: 5pt, y: 2pt),
          text(size: 8pt, fill: primary-color)[#keyword]
        )
        h(3pt)
      }
    }

    v(10pt)
  }

  let render-certification(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 8pt,
      [
        #text(weight: "bold", size: 10pt)[#item.name]
        #if item.issuer != "" {
          v(1pt)
          text(size: 9pt, fill: muted-color)[#item.issuer]
        }
      ],
      text(size: 9pt, fill: muted-color)[#item.date]
    )

    if item.summary != "" {
      v(2pt)
      render-rich-text(item.summary, size: 9pt)
    }

    v(10pt)
  }

  let render-award(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 8pt,
      [
        #text(weight: "bold", size: 10pt)[#item.title]
        #if item.awarder != "" {
          v(1pt)
          text(size: 9pt, fill: muted-color)[#item.awarder]
        }
      ],
      text(size: 9pt, fill: muted-color)[#item.date]
    )

    if item.summary != "" {
      v(2pt)
      render-rich-text(item.summary, size: 9pt)
    }

    v(10pt)
  }

  let render-interest(item) = {
    if item.visible == false { return }

    text(size: 9pt, weight: "bold")[#item.name]

    if has-keywords(item) {
      v(2pt)
      for keyword in item.keywords {
        box(
          fill: light-bg,
          radius: 3pt,
          inset: (x: 5pt, y: 2pt),
          text(size: 8pt, fill: primary-color)[#keyword]
        )
        h(3pt)
      }
    }

    v(8pt)
  }

  let render-publication(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 8pt,
      [
        #text(weight: "bold", size: 10pt)[#item.name]
        #if item.publisher != "" {
          v(1pt)
          text(size: 9pt, fill: muted-color)[#item.publisher]
        }
      ],
      text(size: 9pt, fill: muted-color)[#item.date]
    )

    if item.summary != "" {
      v(2pt)
      render-rich-text(item.summary, size: 9pt)
    }

    v(10pt)
  }

  let render-volunteer(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 8pt,
      [
        #text(weight: "bold", size: 10pt)[#item.organization]
        #if item.position != "" {
          v(1pt)
          text(size: 9pt, fill: muted-color)[#item.position]
        }
      ],
      align(right)[
        #text(size: 9pt, fill: muted-color)[#item.date]
        #if item.location != "" {
          v(1pt)
          text(size: 8pt, fill: muted-color)[#item.location]
        }
      ]
    )

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 9pt)
    }

    v(10pt)
  }

  let render-reference(item) = {
    if item.visible == false { return }

    text(weight: "bold", size: 10pt)[#item.name]

    if item.description != "" {
      v(2pt)
      render-rich-text(item.description, size: 9pt, fill: muted-color)
    }

    if item.summary != "" {
      v(2pt)
      render-rich-text(item.summary, size: 9pt)
    }

    v(10pt)
  }

  let render-custom(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 8pt,
      [
        #text(weight: "bold", size: 10pt)[#item.name]
        #if item.description != "" {
          v(1pt)
          render-rich-text(item.description, size: 9pt)
        }
      ],
      text(size: 9pt, fill: muted-color)[#item.date]
    )

    if item.location != "" {
      v(1pt)
      text(size: 8pt, fill: muted-color)[#item.location]
    }

    if item.summary != "" {
      v(2pt)
      render-rich-text(item.summary, size: 9pt)
    }

    if has-keywords(item) {
      v(2pt)
      text(size: 8pt, fill: muted-color)[#item.keywords.join(", ")]
    }

    render-url(item, primary-color)
    v(10pt)
  }

  // Page setup

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

  // ── Header - centered, above columns ──
  align(center)[
    #text(size: 26pt, weight: "bold", fill: text-color, tracking: 0.03em)[#data.basics.name]

    #if data.basics.headline != "" {
      v(4pt)
      text(size: 11pt, fill: primary-color)[#data.basics.headline]
    }

    #v(8pt)

    // Contact info as horizontal list
    #let contact-items = ()
    #if data.basics.email != "" { contact-items = contact-items + (link("mailto:" + data.basics.email)[#data.basics.email],) }
    #if data.basics.phone != "" { contact-items = contact-items + (data.basics.phone,) }
    #if data.basics.location != "" { contact-items = contact-items + (data.basics.location,) }
    #if has-url(data.basics) { contact-items = contact-items + (link(data.basics.url.href)[#data.basics.url.href],) }

    #text(size: 9pt, fill: muted-color)[#contact-items.join("  ·  ")]
  ]

  v(16pt)
  line(length: 100%, stroke: 1pt + primary-color)
  v(12pt)

  render-resume(data, (
    layout: "two-column",
    renderers: renderers,
    columns: (1fr, 2fr),
    column-gutter: 20pt,
    left-column: 0,
    left-fallback: default-sidebar-sections,
    left-heading: sidebar-section-heading,
    right-column: 1,
    right-fallback: default-main-sections + ("custom",),
    right-heading: main-section-heading,
  ))
}
