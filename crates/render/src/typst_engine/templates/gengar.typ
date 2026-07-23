// Gengar Template - Two-column sidebar layout
// Light teal sidebar (left) with header inside, main content (right)
// Primary teal accents, clean professional typography

#import "_common.typ": *


#let template(data) = {
  // ── Theme colors from resume metadata (with sensible fallbacks) ──
  let primary-color = rgb(data.metadata.theme.at("primary", default: "#67b8c8"))
  let text-color = rgb(data.metadata.theme.at("text", default: "#1f2937"))
  let bg-color = rgb(data.metadata.theme.at("background", default: "#ffffff"))
  let level-display = data.metadata.at("levelDisplay", default: "template-default")
  // Derived colors (not in schema — computed from theme values)
  let muted-color = rgb("#6b7280")

  // ── Helper functions (capture theme colors from enclosing scope) ──

  let sidebar-bg = primary-color.lighten(90%)
  let sidebar-text = primary-color.darken(50%)

  let sidebar-section-heading(title) = {
    v(12pt)
    text(weight: "bold", size: 9pt, fill: primary-color, tracking: 0.05em)[#upper(title)]
    v(2pt)
    line(length: 100%, stroke: 1pt + primary-color)
    v(8pt)
  }

  let main-section-heading(title) = {
    v(14pt)
    text(weight: "bold", size: 11pt, fill: text-color, tracking: 0.04em)[#upper(title)]
    v(3pt)
    line(length: 100%, stroke: 1.5pt + primary-color)
    v(10pt)
  }

  let entry-header(left-content, right-content) = {
    grid(
      columns: (1fr, auto),
      column-gutter: 8pt,
      left-content,
      align(right)[
        #text(size: 9pt, fill: muted-color)[#right-content]
      ]
    )
  }

  let rating-boxes(level) = {
    let level = clamp-level(level)
    if level-display == "template-default" {
      rating-indicators(level, 8pt, 8pt, primary-color, bg-color.darken(10%), 1pt, 2pt)
    } else {
      render-level(level, level-display, primary-color, bg-color.darken(10%), width: 8pt, height: 8pt)
    }
  }

  let render-experience(item) = {
    if item.visible == false { return }

    entry-header(
      [
        #if has-url(item) {
          link(item.url.href)[#text(weight: "bold", size: 10pt)[#item.company]]
        } else {
          text(weight: "bold", size: 10pt)[#item.company]
        }
        #v(2pt)
        #text(size: 10pt, fill: text-color)[#item.position]
      ],
      [
        #item.date
        #if item.location != "" {
          v(2pt)
          text(size: 9pt, fill: muted-color)[#item.location]
        }
      ]
    )

    if item.summary != "" {
      v(6pt)
      render-rich-text(item.summary, size: 9.5pt)
    }

    v(12pt)
  }

  let render-education(item) = {
    if item.visible == false { return }

    entry-header(
      [
        #text(weight: "bold", size: 10pt)[#item.institution]
        #if item.area != "" or item.studyType != "" {
          v(2pt)
          let degree = format-degree(item.studyType, item.area)
          text(size: 9.5pt)[#degree]
        }
      ],
      [
        #item.date
        #if item.score != "" {
          v(2pt)
          text(size: 9pt, fill: muted-color)[#item.score]
        }
      ]
    )

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
        #text(size: 9pt, weight: "bold")[#item.name]
        #if item.description != "" {
          v(1pt)
          render-rich-text(item.description, size: 8pt, fill: muted-color)
        }
      ],
      rating-boxes(item.level)
    )

    if has-keywords(item) {
      v(2pt)
      text(size: 8pt, fill: muted-color)[#item.keywords.join(", ")]
    }

    v(8pt)
  }

  let render-language(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 4pt,
      [
        #text(size: 9pt, weight: "bold")[#item.name]
        #if item.description != "" {
          h(4pt)
          render-rich-text(item.description, size: 8pt, fill: muted-color)
        }
      ],
      rating-boxes(item.level)
    )

    v(6pt)
  }

  let render-profile(item) = {
    if item.visible == false { return }

    text(size: 9pt, weight: "medium", fill: sidebar-text)[#item.network]
    v(1pt)
    if has-url(item) {
      link(item.url.href)[#text(size: 8pt, fill: primary-color)[#item.username]]
    } else {
      text(size: 8pt, fill: muted-color)[#item.username]
    }
    v(6pt)
  }

  let render-project(item) = {
    if item.visible == false { return }

    entry-header(
      [
        #if has-url(item) {
          link(item.url.href)[#text(weight: "bold", size: 10pt)[#item.name]]
        } else {
          text(weight: "bold", size: 10pt)[#item.name]
        }
        #if item.description != "" {
          v(2pt)
          render-rich-text(item.description, size: 9.5pt)
        }
      ],
      item.date
    )

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 9.5pt)
    }

    if has-keywords(item) {
      v(4pt)
      for keyword in item.keywords {
        box(
          fill: sidebar-bg,
          radius: 3pt,
          inset: (x: 5pt, y: 2pt),
          text(size: 8pt, fill: primary-color)[#keyword]
        )
        h(4pt)
      }
    }

    v(12pt)
  }

  let render-certification(item) = {
    if item.visible == false { return }

    entry-header(
      [
        #text(weight: "bold", size: 10pt)[#item.name]
        #if item.issuer != "" {
          text(size: 9pt, fill: muted-color)[ -- #item.issuer]
        }
      ],
      item.date
    )

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 9.5pt)
    }

    v(8pt)
  }

  let render-award(item) = {
    if item.visible == false { return }

    entry-header(
      [
        #text(weight: "bold", size: 10pt)[#item.title]
        #if item.awarder != "" {
          text(size: 9pt, fill: muted-color)[ -- #item.awarder]
        }
      ],
      item.date
    )

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 9.5pt)
    }

    v(8pt)
  }

  let render-interest(item) = {
    if item.visible == false { return }

    text(size: 9pt, weight: "bold")[#item.name]

    if has-keywords(item) {
      v(2pt)
      text(size: 8pt, fill: muted-color)[#item.keywords.join(", ")]
    }

    v(6pt)
  }

  let render-publication(item) = {
    if item.visible == false { return }

    entry-header(
      [
        #text(weight: "bold", size: 10pt)[#item.name]
        #if item.publisher != "" {
          v(2pt)
          text(size: 9pt, fill: muted-color)[#item.publisher]
        }
      ],
      item.date
    )

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 9.5pt)
    }

    v(8pt)
  }

  let render-volunteer(item) = {
    if item.visible == false { return }

    entry-header(
      [
        #text(weight: "bold", size: 10pt)[#item.organization]
        #if item.position != "" {
          v(2pt)
          text(size: 9.5pt)[#item.position]
        }
      ],
      [
        #item.date
        #if item.location != "" {
          v(2pt)
          text(size: 9pt, fill: muted-color)[#item.location]
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

    text(weight: "bold", size: 10pt)[#item.name]

    if item.description != "" {
      v(2pt)
      render-rich-text(item.description, size: 9pt, fill: muted-color)
    }

    if item.summary != "" {
      v(2pt)
      render-rich-text(item.summary, size: 9.5pt)
    }

    v(8pt)
  }

  let render-custom(item) = {
    if item.visible == false { return }

    entry-header(
      [
        #text(weight: "bold", size: 10pt)[#item.name]
        #if item.description != "" {
          v(1pt)
          render-rich-text(item.description, size: 9pt, fill: muted-color)
        }
      ],
      item.date
    )

    if item.location != "" {
      v(2pt)
      text(size: 9pt, fill: muted-color)[#item.location]
    }

    if item.summary != "" {
      v(2pt)
      render-rich-text(item.summary, size: 9.5pt)
    }

    if has-keywords(item) {
      v(2pt)
      text(size: 8pt, fill: muted-color)[#item.keywords.join(", ")]
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
    size: 10pt,
    fill: text-color,
  )

  set par(
    leading: 0.65em,
    justify: false,
  )

  // Cover letter — dedicated page before the resume content
  render-cover-letter-page(data, main-section-heading, muted: muted-color)

  if has-resume-body(data) {
    let sidebar-wrapper(body) = {
      set text(fill: sidebar-text)
      body
    }

    let sidebar-before = () => [
      // Header: Name, headline, contact info
      #text(size: 18pt, weight: "bold", fill: sidebar-text)[#data.basics.name]

      #if data.basics.headline != "" {
        v(6pt)
        text(size: 9pt, fill: muted-color)[#data.basics.headline]
      }

      #v(12pt)

      // Contact info
      #if data.basics.email != "" {
        text(size: 8pt, fill: sidebar-text)[#data.basics.email]
        v(4pt)
      }
      #if data.basics.phone != "" {
        text(size: 8pt, fill: sidebar-text)[#data.basics.phone]
        v(4pt)
      }
      #if data.basics.location != "" {
        text(size: 8pt, fill: sidebar-text)[#data.basics.location]
        v(4pt)
      }
      #if has-url(data.basics) {
        link(data.basics.url.href)[#text(size: 8pt, fill: primary-color)[#data.basics.url.href]]
        v(4pt)
      }
    ]

    render-resume(data, (
      layout: "sidebar-left",
      renderers: renderers,
      // Default width must match FIXED_SIDEBAR_WIDTH_PT in apps/web/src/components/templates/ThemeEditor.tsx.
      sidebar-width: sidebar-width-from-ratio(data, 170pt),
      sidebar-bg: sidebar-bg,
      body-bg: bg-color,
      sidebar-inset: (x: 16pt, y: 28pt),
      main-inset: (x: 24pt, y: 28pt),
      sidebar-heading: sidebar-section-heading,
      main-heading: main-section-heading,
      sidebar-before: sidebar-before,
      sidebar-wrapper: sidebar-wrapper,
    ))
  }
}
