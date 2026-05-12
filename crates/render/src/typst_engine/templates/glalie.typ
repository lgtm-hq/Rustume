// Glalie Template - Classic traditional design with sidebar
// Two-column layout: tinted sidebar (left) + main content (right)
// Teal accents, traditional/formal feel
//
// Colors are read from data.metadata.theme at render time.
// Font family and size are set by the engine via top-level #set text().

#import "_common.typ": *

#let template(data) = {
  // ── Theme colors from resume metadata (with sensible fallbacks) ──
  let primary-color = rgb(data.metadata.theme.at("primary", default: "#14b8a6"))
  let text-color = rgb(data.metadata.theme.at("text", default: "#0f172a"))
  let bg-color = rgb(data.metadata.theme.at("background", default: "#ffffff"))
  // Derived colors (not in schema — computed from theme values)
  let muted-color = rgb("#64748b")
  let sidebar-bg = primary-color.lighten(90%)

  // ── Helper functions (capture theme colors from enclosing scope) ──

  let section-heading(title) = {
    v(14pt)
    text(weight: "bold", size: 11pt, fill: primary-color)[#title]
    v(3pt)
    line(length: 100%, stroke: 1pt + primary-color)
    v(8pt)
  }

  let sidebar-heading(title) = {
    v(12pt)
    text(weight: "bold", size: 10pt, fill: primary-color)[#title]
    v(2pt)
    line(length: 100%, stroke: 0.75pt + primary-color)
    v(6pt)
  }

  let skill-dots(level) = {
    rating-indicators(level, 6pt, 6pt, primary-color, primary-color.lighten(70%), 50%, 2pt)
  }

  let render-experience(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 8pt,
      [
        #text(weight: "bold", size: 10pt)[#item.company]
        #if item.position != "" {
          v(1pt)
          text(size: 10pt)[#item.position]
        }
      ],
      align(right)[
        #text(size: 9pt, fill: muted-color)[#item.date]
        #if item.location != "" {
          v(1pt)
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

    grid(
      columns: (1fr, auto),
      column-gutter: 8pt,
      [
        #text(weight: "bold", size: 10pt)[#item.institution]
        #if item.studyType != "" or item.area != "" {
          v(1pt)
          let degree = format-degree(item.studyType, item.area)
          text(size: 10pt)[#degree]
        }
      ],
      align(right)[
        #text(size: 9pt, fill: muted-color)[#item.date]
      ]
    )

    if item.score != "" {
      v(2pt)
      text(size: 9pt, fill: muted-color)[Score: #item.score]
    }

    v(12pt)
  }

  let render-skill(item) = {
    if item.visible == false { return }

    text(size: 9pt, weight: "bold")[#item.name]

    if item.description != "" {
      v(1pt)
      render-rich-text(item.description, size: 8pt, fill: muted-color)
    }

    let level = clamp-level(item.level)
    if level > 0 {
      v(2pt)
      skill-dots(level)
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
      h(4pt)
      render-rich-text(item.description, size: 8pt, fill: muted-color)
    }

    let level = clamp-level(item.level)
    if level > 0 {
      v(2pt)
      skill-dots(level)
    }

    v(6pt)
  }

  let render-profile(item) = {
    if item.visible == false { return }

    text(size: 9pt, weight: "bold")[#item.network]

    if has-url(item) {
      v(1pt)
      link(item.url.href)[#text(size: 8pt, fill: primary-color)[#item.username]]
    } else {
      v(1pt)
      text(size: 8pt)[#item.username]
    }

    v(6pt)
  }

  let render-project(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 8pt,
      [#text(weight: "bold", size: 10pt)[#item.name]],
      text(size: 9pt, fill: muted-color)[#item.date]
    )

    if item.description != "" {
      v(4pt)
      render-rich-text(item.description, size: 10pt)
    }

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 10pt)
    }

    if has-keywords(item) {
      v(4pt)
      text(size: 9pt, fill: muted-color)[#item.keywords.join(", ")]
    }

    v(12pt)
  }

  let render-certification(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 8pt,
      [
        #text(weight: "bold", size: 10pt)[#item.name]
        #if item.issuer != "" {
          text(size: 9pt, fill: muted-color)[ — #item.issuer]
        }
      ],
      text(size: 9pt, fill: muted-color)[#item.date]
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
        #text(weight: "bold", size: 10pt)[#item.title]
        #if item.awarder != "" {
          text(size: 9pt, fill: muted-color)[ — #item.awarder]
        }
      ],
      text(size: 9pt, fill: muted-color)[#item.date]
    )

    if item.summary != "" {
      v(2pt)
      render-rich-text(item.summary, size: 9pt)
    }

    v(8pt)
  }

  let render-interest(item) = {
    if item.visible == false { return }

    text(size: 9pt, weight: "bold")[#item.name]

    if has-keywords(item) {
      v(1pt)
      text(size: 8pt, fill: muted-color)[#item.keywords.join(", ")]
    }

    v(6pt)
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
      v(4pt)
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
          text(size: 10pt)[ — #item.position]
        }
      ],
      text(size: 9pt, fill: muted-color)[#item.date]
    )

    if item.location != "" {
      v(2pt)
      text(size: 9pt, fill: muted-color)[#item.location]
    }

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 10pt)
    }

    v(12pt)
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

    v(8pt)
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
          render-rich-text(item.description, size: 9pt, fill: muted-color)
        }
      ],
      text(size: 9pt, fill: muted-color)[#item.date]
    )

    if item.location != "" {
      v(2pt)
      text(size: 9pt, fill: muted-color)[#item.location]
    }

    if item.summary != "" {
      v(2pt)
      render-rich-text(item.summary, size: 9pt)
    }

    if has-keywords(item) {
      v(2pt)
      text(size: 9pt, fill: muted-color)[#item.keywords.join(", ")]
    }


    render-url(item, primary-color)
    v(8pt)
  }

  // ── Page & typography setup ──
  // Page margin is zero because the sidebar uses its own padding.
  // Font family and size are inherited from the engine's top-level #set text().

  let render-section(key, heading) = {
    if key == "summary" and data.sections.summary.visible {
      heading(data.sections.summary.name)
      render-rich-text(data.sections.summary.content, size: 10pt)
    } else if key == "profiles" and data.sections.profiles.visible {
      heading(data.sections.profiles.name)
      for item in data.sections.profiles.items { render-profile(item) }
    } else if key == "experience" and data.sections.experience.visible {
      heading(data.sections.experience.name)
      for item in data.sections.experience.items { render-experience(item) }
    } else if key == "education" and data.sections.education.visible {
      heading(data.sections.education.name)
      for item in data.sections.education.items { render-education(item) }
    } else if key == "awards" and data.sections.awards.visible {
      heading(data.sections.awards.name)
      for item in data.sections.awards.items { render-award(item) }
    } else if key == "certifications" and data.sections.certifications.visible {
      heading(data.sections.certifications.name)
      for item in data.sections.certifications.items { render-certification(item) }
    } else if key == "skills" and data.sections.skills.visible {
      heading(data.sections.skills.name)
      for item in data.sections.skills.items { render-skill(item) }
    } else if key == "interests" and data.sections.interests.visible {
      heading(data.sections.interests.name)
      for item in data.sections.interests.items { render-interest(item) }
    } else if key == "publications" and data.sections.publications.visible {
      heading(data.sections.publications.name)
      for item in data.sections.publications.items { render-publication(item) }
    } else if key == "volunteer" and data.sections.volunteer.visible {
      heading(data.sections.volunteer.name)
      for item in data.sections.volunteer.items { render-volunteer(item) }
    } else if key == "languages" and data.sections.languages.visible {
      heading(data.sections.languages.name)
      for item in data.sections.languages.items { render-language(item) }
    } else if key == "projects" and data.sections.projects.visible {
      heading(data.sections.projects.name)
      for item in data.sections.projects.items { render-project(item) }
    } else if key == "references" and data.sections.references.visible {
      heading(data.sections.references.name)
      for item in data.sections.references.items { render-reference(item) }
    } else if key == "custom" and "custom" in data.sections {
      for (_, section) in data.sections.custom {
        if section.visible {
          heading(section.name)
          for item in section.items { render-custom(item) }
        }
      }
    }
  }

  set page(
    margin: 0pt,
  )

  set text(
    fill: text-color,
  )

  set par(
    leading: 0.65em,
    justify: true,
  )

  sidebar-layout(
    sidebar-width: 170pt,
    sidebar-bg: sidebar-bg,
    sidebar-inset: (x: 16pt, y: 24pt),
    main-inset: (x: 24pt, y: 24pt),
    sidebar-content: [
        // Header: Name, headline, contact info
        #text(size: 18pt, weight: "bold", fill: text-color)[#data.basics.name]

        #if data.basics.headline != "" {
          v(6pt)
          text(size: 9pt, style: "italic", fill: muted-color)[#data.basics.headline]
        }

        #v(12pt)

        // Contact info stacked vertically
        #if data.basics.email != "" {
          text(size: 8pt, fill: text-color)[#data.basics.email]
          v(3pt)
        }
        #if data.basics.phone != "" {
          text(size: 8pt, fill: text-color)[#data.basics.phone]
          v(3pt)
        }
        #if data.basics.location != "" {
          text(size: 8pt, fill: text-color)[#data.basics.location]
          v(3pt)
        }
        #if has-url(data.basics) {
          link(data.basics.url.href)[#text(size: 8pt, fill: primary-color)[#data.basics.url.href]]
          v(3pt)
        }

        #for key in layout-column-sections(data, 1, default-sidebar-sections) {
          render-section(key, sidebar-heading)
        }
    ],
    main-content: [
        #for key in layout-column-sections(data, 0, default-main-sections + ("custom",)) {
          render-section(key, section-heading)
        }
    ]
  )
}
