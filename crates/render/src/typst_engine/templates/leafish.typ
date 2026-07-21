// Leafish Template - Rose/crimson accented two-column layout
// Full-width header above equal two-column grid, two-tier header design

#import "_common.typ": *


#let template(data) = {
  // ── Theme colors from resume metadata (with sensible fallbacks) ──
  let primary-color = rgb(data.metadata.theme.at("primary", default: "#9f1239"))
  let text-color = rgb(data.metadata.theme.at("text", default: "#1f2937"))
  let bg-color = rgb(data.metadata.theme.at("background", default: "#ffffff"))
  let level-display = data.metadata.at("levelDisplay", default: "template-default")
  // Derived colors (not in schema — computed from theme values)
  let muted-color = text-color.lighten(40%)

  // ── Helper functions (capture theme colors from enclosing scope) ──

  let header-bg = primary-color.lighten(90%)
  let header-text-color = primary-color.darken(40%)
  let contact-bar-bg = primary-color
  let separator-color = primary-color.lighten(60%)
  let tag-bg = primary-color.lighten(90%)

  let section-heading(title) = {
    v(10pt)
    box(
      width: 100%,
      stroke: (bottom: 1.5pt + primary-color),
      inset: (bottom: 4pt),
      text(weight: "bold", size: 9pt, fill: primary-color, tracking: 0.06em)[#upper(title)]
    )
    v(8pt)
  }

  let rating-dots(level) = {
    let level = clamp-level(level)
    if level-display == "template-default" {
      rating-indicators(level, 6pt, 6pt, primary-color, bg-color.darken(10%), 50%, 2pt)
    } else {
      render-level(level, level-display, primary-color, bg-color.darken(10%))
    }
  }

  let render-experience(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 8pt,
      [
        #if has-url(item) {
          link(item.url.href)[#text(weight: "bold", size: 10pt, fill: primary-color)[#item.company]]
        } else {
          text(weight: "bold", size: 10pt)[#item.company]
        }
        #if item.position != "" {
          v(2pt)
          text(size: 9.5pt)[#item.position]
        }
      ],
      align(right)[
        #text(size: 8.5pt, fill: muted-color)[#item.date]
        #if item.location != "" {
          v(1pt)
          text(size: 8.5pt, fill: muted-color)[#item.location]
        }
      ]
    )

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 9.5pt)
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
        #if item.area != "" or item.studyType != "" {
          v(2pt)
          let degree = format-degree(item.studyType, item.area)
          text(size: 9.5pt)[#degree]
        }
      ],
      align(right)[
        #text(size: 8.5pt, fill: muted-color)[#item.date]
      ]
    )

    if item.score != "" {
      v(2pt)
      text(size: 8.5pt, fill: muted-color)[#item.score]
    }

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 9.5pt)
    }

    v(10pt)
  }

  let render-skill(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 4pt,
      [
        #text(size: 9.5pt, weight: "bold")[#item.name]
        #if item.description != "" {
          v(1pt)
          render-rich-text(item.description, size: 8.5pt, fill: muted-color)
        }
      ],
      rating-dots(item.level)
    )

    if has-keywords(item) {
      v(3pt)
      for keyword in item.keywords {
        box(
          fill: tag-bg,
          radius: 3pt,
          inset: (x: 5pt, y: 2pt),
          text(size: 7.5pt, fill: primary-color)[#keyword]
        )
        h(3pt)
      }
    }

    v(8pt)
  }

  let render-language(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 4pt,
      [
        #text(size: 9.5pt, weight: "bold")[#item.name]
        #if item.description != "" {
          h(4pt)
          render-rich-text(item.description, size: 8.5pt, fill: muted-color)
        }
      ],
      rating-dots(item.level)
    )

    v(6pt)
  }

  let render-profile(item) = {
    if item.visible == false { return }

    text(size: 9pt, weight: "medium", fill: muted-color)[#item.network]
    h(4pt)
    if has-url(item) {
      link(item.url.href)[#text(size: 9pt, fill: primary-color)[#item.username]]
    } else {
      text(size: 9pt)[#item.username]
    }

    v(5pt)
  }

  let render-project(item) = {
    if item.visible == false { return }

    text(weight: "bold", size: 9.5pt)[#item.name]

    if item.description != "" {
      v(2pt)
      render-rich-text(item.description, size: 9pt)
    }

    if item.date != "" {
      v(2pt)
      text(size: 8.5pt, fill: muted-color)[#item.date]
    }

    if item.summary != "" {
      v(2pt)
      render-rich-text(item.summary, size: 9pt)
    }

    if has-keywords(item) {
      v(3pt)
      for keyword in item.keywords {
        box(
          fill: tag-bg,
          radius: 3pt,
          inset: (x: 5pt, y: 2pt),
          text(size: 7.5pt, fill: primary-color)[#keyword]
        )
        h(3pt)
      }
    }

    v(10pt)
  }

  let render-certification(item) = {
    if item.visible == false { return }

    text(weight: "bold", size: 9.5pt)[#item.name]

    if item.issuer != "" {
      v(2pt)
      text(size: 8.5pt, fill: muted-color)[#item.issuer]
    }

    if item.date != "" {
      h(6pt)
      text(size: 8.5pt, fill: muted-color)[#item.date]
    }

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
        #text(weight: "bold", size: 9.5pt)[#item.title]
        #if item.awarder != "" {
          v(1pt)
          text(size: 8.5pt, fill: muted-color)[#item.awarder]
        }
      ],
      text(size: 8.5pt, fill: muted-color)[#item.date]
    )

    if item.summary != "" {
      v(2pt)
      render-rich-text(item.summary, size: 9pt)
    }

    v(8pt)
  }

  let render-interest(item) = {
    if item.visible == false { return }

    text(size: 9.5pt, weight: "medium")[#item.name]

    if has-keywords(item) {
      v(2pt)
      for keyword in item.keywords {
        box(
          fill: tag-bg,
          radius: 3pt,
          inset: (x: 5pt, y: 2pt),
          text(size: 7.5pt, fill: primary-color)[#keyword]
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
        #text(weight: "bold", size: 9.5pt)[#item.name]
        #if item.publisher != "" {
          v(1pt)
          text(size: 8.5pt, fill: muted-color)[#item.publisher]
        }
      ],
      text(size: 8.5pt, fill: muted-color)[#item.date]
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
        #text(weight: "bold", size: 10pt)[#item.organization]
        #if item.position != "" {
          v(2pt)
          text(size: 9.5pt)[#item.position]
        }
      ],
      align(right)[
        #text(size: 8.5pt, fill: muted-color)[#item.date]
        #if item.location != "" {
          v(1pt)
          text(size: 8.5pt, fill: muted-color)[#item.location]
        }
      ]
    )

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 9.5pt)
    }

    v(10pt)
  }

  let render-reference(item) = {
    if item.visible == false { return }

    text(weight: "bold", size: 9.5pt)[#item.name]

    if item.description != "" {
      v(2pt)
      render-rich-text(item.description, size: 8.5pt, fill: muted-color)
    }

    if item.summary != "" {
      v(2pt)
      render-rich-text(item.summary, size: 9pt)
    }

    v(8pt)
  }

  let render-custom(item) = {
    if item.visible == false { return }

    text(weight: "bold", size: 9.5pt)[#item.name]

    if item.description != "" {
      v(2pt)
      render-rich-text(item.description, size: 9pt)
    }

    if item.date != "" or item.location != "" {
      v(2pt)
      let meta = ()
      if item.date != "" { meta = meta + (item.date,) }
      if item.location != "" { meta = meta + (item.location,) }
      text(size: 8.5pt, fill: muted-color)[#meta.join(" · ")]
    }

    if item.summary != "" {
      v(2pt)
      render-rich-text(item.summary, size: 9pt)
    }

    if has-keywords(item) {
      v(3pt)
      for keyword in item.keywords {
        box(
          fill: tag-bg,
          radius: 3pt,
          inset: (x: 5pt, y: 2pt),
          text(size: 7.5pt, fill: primary-color)[#keyword]
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
    margin: (x: 48pt, y: 40pt),
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

  // === HEADER: Two-tier design ===

  // Tier 1: Name area with light rose background
  box(
    width: 100%,
    fill: header-bg,
    radius: (top: 6pt),
    inset: (x: 20pt, y: 14pt),
    grid(
      columns: (1fr, auto),
      column-gutter: 16pt,
      [
        #text(size: 24pt, weight: "bold", fill: primary-color)[#data.basics.name]
        #if data.basics.headline != "" {
          v(4pt)
          text(size: 11pt, fill: header-text-color)[#data.basics.headline]
        }
      ],
      align(right + horizon)[
        #if has-url(data.basics) {
          link(data.basics.url.href)[#text(size: 9pt, fill: primary-color)[#data.basics.url.href]]
        }
      ]
    )
  )

  // Tier 2: Darker contact bar
  box(
    width: 100%,
    fill: contact-bar-bg,
    radius: (bottom: 6pt),
    inset: (x: 20pt, y: 8pt),
    {
      let contact-items = build-contact-items(data.basics)

      text(size: 9pt, fill: white)[#contact-items.join([#h(8pt)#text(fill: separator-color)[|]#h(8pt)])]
    }
  )

  v(12pt)

  render-resume(data, (
    layout: "two-column",
    renderers: renderers,
    columns: (1fr, 1fr),
    column-gutter: 20pt,
    left-column: 0,
    left-fallback: default-main-sections,
    left-heading: section-heading,
    right-column: 1,
    right-fallback: default-sidebar-sections + ("custom",),
    right-heading: section-heading,
  ))
}
