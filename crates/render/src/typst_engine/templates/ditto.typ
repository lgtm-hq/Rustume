// Ditto Template - Two-column sidebar layout
// Teal/cyan accents, sidebar on left, compact modern design

#import "_common.typ": *


#let template(data) = {
  // ── Theme colors from resume metadata (with sensible fallbacks) ──
  let primary-color = rgb(data.metadata.theme.at("primary", default: "#0891b2"))
  let text-color = rgb(data.metadata.theme.at("text", default: "#1f2937"))
  let bg-color = rgb(data.metadata.theme.at("background", default: "#ffffff"))
  let level-display = data.metadata.at("levelDisplay", default: "template-default")
  // Derived colors (not in schema — computed from theme values)
  let muted-color = rgb("#6b7280")

  // ── Helper functions (capture theme colors from enclosing scope) ──

  let light-bg = primary-color.lighten(92%)
  let sidebar-bg = primary-color.lighten(95%)
  let white = rgb("#ffffff")

  let sidebar-heading(title) = {
    v(10pt)
    text(weight: "bold", size: 8pt, fill: primary-color, tracking: 0.08em)[#upper(title)]
    v(2pt)
    line(length: 100%, stroke: 0.5pt + primary-color)
    v(6pt)
  }

  let section-heading(title) = {
    v(10pt)
    box(
      width: 100%,
      stroke: (bottom: 1.5pt + primary-color),
      inset: (bottom: 3pt),
      text(weight: "bold", size: 9pt, fill: primary-color, tracking: 0.06em)[#upper(title)]
    )
    v(8pt)
  }

  let render-experience(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 8pt,
      [
        #if has-url(item) {
          link(item.url.href)[#text(weight: "bold", size: 9pt, fill: primary-color)[#item.company]]
        } else {
          text(weight: "bold", size: 9pt)[#item.company]
        }
        #v(1pt)
        #text(size: 9pt)[#item.position]
      ],
      align(right)[
        #text(size: 8pt, fill: muted-color)[#item.date]
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
        #text(weight: "bold", size: 9pt)[#item.institution]
        #if item.studyType != "" or item.area != "" {
          v(1pt)
          let degree = format-degree(item.studyType, item.area)
          text(size: 9pt)[#degree]
        }
      ],
      align(right)[
        #text(size: 8pt, fill: muted-color)[#item.date]
      ]
    )

    if item.score != "" {
      v(2pt)
      text(size: 8pt, fill: muted-color)[#item.score]
    }

    v(10pt)
  }

  let render-skill(item) = {
    if item.visible == false { return }

    text(size: 8pt, weight: "bold")[#item.name]

    if item.description != "" {
      v(1pt)
      render-rich-text(item.description, size: 7pt, fill: muted-color)
    }

    let level = clamp-level(item.level)
    if level-display == "template-default" and level > 0 {
      v(2pt)
      rating-indicators(level, 6pt, 6pt, primary-color, bg-color.darken(10%), 50%, 2pt)
    } else if should-render-level(level, level-display) {
      v(2pt)
      render-level(level, level-display, primary-color, bg-color.darken(10%))
    }

    if has-keywords(item) {
      v(2pt)
      text(size: 7pt, fill: muted-color)[#item.keywords.join(", ")]
    }

    v(6pt)
  }

  let render-language(item) = {
    if item.visible == false { return }

    text(size: 8pt, weight: "bold")[#item.name]

    if item.description != "" {
      { set text(size: 7pt, fill: muted-color); [ -- ]; render-rich-text(item.description) }
    }

    let level = clamp-level(item.level)
    if level-display == "template-default" and level > 0 {
      v(2pt)
      rating-indicators(level, 6pt, 6pt, primary-color, bg-color.darken(10%), 50%, 2pt)
    } else if should-render-level(level, level-display) {
      v(2pt)
      render-level(level, level-display, primary-color, bg-color.darken(10%))
    }

    v(6pt)
  }

  let render-profile(item) = {
    if item.visible == false { return }

    text(size: 8pt, weight: "medium")[#item.network]

    if has-url(item) {
      v(1pt)
      link(item.url.href)[#text(size: 7pt, fill: primary-color)[#item.username]]
    } else {
      v(1pt)
      text(size: 7pt, fill: muted-color)[#item.username]
    }

    v(6pt)
  }

  let render-project(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 8pt,
      [#text(weight: "bold", size: 9pt)[#item.name]],
      text(size: 8pt, fill: muted-color)[#item.date]
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
          radius: 2pt,
          inset: (x: 4pt, y: 1pt),
          text(size: 7pt, fill: primary-color)[#keyword]
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
        #text(weight: "medium", size: 9pt)[#item.name]
        #if item.issuer != "" {
          text(size: 8pt, fill: muted-color)[ -- #item.issuer]
        }
      ],
      text(size: 8pt, fill: muted-color)[#item.date]
    )

    if item.summary != "" {
      v(2pt)
      render-rich-text(item.summary, size: 9pt)
    }

    v(8pt)
  }

  let render-award(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 8pt,
      [
        #text(weight: "medium", size: 9pt)[#item.title]
        #if item.awarder != "" {
          text(size: 8pt, fill: muted-color)[ -- #item.awarder]
        }
      ],
      text(size: 8pt, fill: muted-color)[#item.date]
    )

    if item.summary != "" {
      v(2pt)
      render-rich-text(item.summary, size: 9pt)
    }

    v(8pt)
  }

  let render-interest(item) = {
    if item.visible == false { return }

    text(size: 8pt, weight: "medium")[#item.name]

    if has-keywords(item) {
      v(2pt)
      for keyword in item.keywords {
        box(
          fill: light-bg,
          radius: 2pt,
          inset: (x: 4pt, y: 1pt),
          text(size: 7pt, fill: primary-color)[#keyword]
        )
        h(3pt)
      }
    }

    v(6pt)
  }

  let render-publication(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 8pt,
      [
        #text(weight: "bold", size: 9pt)[#item.name]
        #if item.publisher != "" {
          v(1pt)
          text(size: 8pt, fill: muted-color)[#item.publisher]
        }
      ],
      text(size: 8pt, fill: muted-color)[#item.date]
    )

    if item.summary != "" {
      v(2pt)
      render-rich-text(item.summary, size: 9pt)
    }

    v(8pt)
  }

  let render-volunteer(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 8pt,
      [
        #text(weight: "bold", size: 9pt)[#item.organization]
        #if item.position != "" {
          text(size: 9pt)[ -- #item.position]
        }
      ],
      text(size: 8pt, fill: muted-color)[#item.date]
    )

    if item.location != "" {
      v(1pt)
      text(size: 8pt, fill: muted-color)[#item.location]
    }

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 9pt)
    }

    v(10pt)
  }

  let render-reference(item) = {
    if item.visible == false { return }

    text(weight: "bold", size: 9pt)[#item.name]

    if item.description != "" {
      v(2pt)
      render-rich-text(item.description, size: 8pt, fill: muted-color)
    }

    if item.summary != "" {
      v(2pt)
      render-rich-text(item.summary, size: 9pt)
    }

    v(8pt)
  }

  let render-custom(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 8pt,
      [
        #text(weight: "bold", size: 9pt)[#item.name]
        #if item.description != "" {
          v(1pt)
          render-rich-text(item.description, size: 8pt, fill: muted-color)
        }
      ],
      text(size: 8pt, fill: muted-color)[#item.date]
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
      v(3pt)
      for keyword in item.keywords {
        box(
          fill: light-bg,
          radius: 2pt,
          inset: (x: 4pt, y: 1pt),
          text(size: 7pt, fill: primary-color)[#keyword]
        )
        h(3pt)
      }
    }

    render-url(item, primary-color)
    v(8pt)
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
    margin: 0pt,
  )

  set text(
    font: "IBM Plex Sans",
    size: 9pt,
    fill: text-color,
  )

  set par(
    leading: 0.6em,
    justify: false,
  )

  // Header - full width teal background bar
  box(
    width: 100%,
    fill: primary-color,
    inset: (x: 24pt, y: 18pt),
    [
      #text(size: 22pt, weight: "bold", fill: white)[#data.basics.name]

      #if data.basics.headline != "" {
        v(4pt)
        text(size: 11pt, fill: primary-color.lighten(80%))[#data.basics.headline]
      }

      #v(8pt)

      #let contact-items = build-contact-items(data.basics)
      #if has-url(data.basics) { contact-items = contact-items + (link(data.basics.url.href)[#text(fill: white)[#data.basics.url.href]],) }

      #text(size: 8pt, fill: primary-color.lighten(85%))[#contact-items.join("  |  ")]
    ]
  )

  render-resume(data, (
    layout: "full-header-sidebar",
    renderers: renderers,
    // Default width must match FIXED_SIDEBAR_WIDTH_PT in apps/web/src/components/templates/ThemeEditor.tsx.
    sidebar-width: sidebar-width-from-ratio(data, 160pt),
    sidebar-bg: sidebar-bg,
    body-bg: bg-color,
    sidebar-inset: (x: 14pt, y: 12pt),
    main-inset: (x: 20pt, y: 12pt),
    sidebar-heading: sidebar-heading,
    main-heading: section-heading,
  ))
}
