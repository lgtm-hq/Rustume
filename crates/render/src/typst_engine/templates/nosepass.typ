// Nosepass Template - Professional, classic design
// Traditional layout with blue accents, suitable for corporate environments

#import "_common.typ": *


#let template(data) = {
  // ── Theme colors from resume metadata (with sensible fallbacks) ──
  let primary-color = rgb(data.metadata.theme.at("primary", default: "#3b82f6"))
  let text-color = rgb(data.metadata.theme.at("text", default: "#1f2937"))
  let bg-color = rgb(data.metadata.theme.at("background", default: "#ffffff"))
  // Derived colors (not in schema — computed from theme values)
  let muted-color = text-color.lighten(30%)

  // ── Helper functions (capture theme colors from enclosing scope) ──

  let light-gray = bg-color.darken(5%)
  let border-color = bg-color.darken(15%)

  let section-heading(title) = {
    v(14pt)
    grid(
      columns: (auto, 1fr),
      column-gutter: 12pt,
      text(weight: "bold", size: 11pt, fill: primary-color)[#title],
      line(start: (0pt, 6pt), length: 100%, stroke: 1pt + border-color)
    )
    v(10pt)
  }

  let date-badge(date) = {
    box(
      fill: light-gray,
      radius: 2pt,
      inset: (x: 6pt, y: 2pt),
      text(size: 9pt, fill: muted-color)[#date]
    )
  }

  let render-experience(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 12pt,
      [
        #text(weight: "bold", size: 11pt, fill: primary-color)[#item.position]
        #v(2pt)
        #text(size: 10pt)[#item.company]
        #if item.location != "" {
          text(size: 9pt, fill: muted-color)[ · #item.location]
        }
      ],
      date-badge(item.date)
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
      column-gutter: 12pt,
      [
        #text(weight: "bold", size: 11pt, fill: primary-color)[#item.institution]
        #v(2pt)
        #if item.studyType != "" or item.area != "" {
          let degree = format-degree(item.studyType, item.area)
          text(size: 10pt)[#degree]
        }
        #if item.score != "" {
          text(size: 9pt, fill: muted-color)[ · GPA: #item.score]
        }
      ],
      date-badge(item.date)
    )

    v(12pt)
  }

  let render-skill(item) = {
    if item.visible == false { return }

    box(
      stroke: 1pt + border-color,
      radius: 3pt,
      inset: (x: 8pt, y: 4pt),
      [
        #text(size: 9pt, weight: "medium")[#item.name]
        #let level = clamp-level(item.level)
        #if level > 0 {
          h(4pt)
          for i in range(level) {
            text(fill: primary-color)[●]
          }
          for i in range(5 - level) {
            text(fill: border-color)[●]
          }
        }
      ]
    )
    h(6pt)
  }

  let render-language(item) = {
    if item.visible == false { return }

    grid(
      columns: (auto, 1fr, auto),
      column-gutter: 8pt,
      text(size: 10pt, weight: "medium")[#item.name],
      line(start: (0pt, 5pt), length: 100%, stroke: (dash: "dotted") + border-color),
      render-rich-text(item.description, size: 9pt, fill: muted-color)
    )
    v(6pt)
  }

  let render-profile(item) = {
    if item.visible == false { return }

    if has-url(item) {
      link(item.url.href)[#text(fill: primary-color)[#item.network: #item.username]]
    } else {
      text(size: 10pt)[#item.network: #item.username]
    }
    v(4pt)
  }

  let render-project(item) = {
    if item.visible == false { return }

    text(weight: "bold", size: 10pt, fill: primary-color)[#item.name]

    if item.description != "" {
      v(4pt)
      render-rich-text(item.description, size: 10pt)
    }

    if has-keywords(item) {
      v(4pt)
      for keyword in item.keywords {
        box(
          fill: light-gray,
          radius: 2pt,
          inset: (x: 5pt, y: 2pt),
          text(size: 8pt)[#keyword]
        )
        h(4pt)
      }
    }

    v(10pt)
  }

  let render-certification(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 12pt,
      [
        #text(weight: "medium", size: 10pt)[#item.name]
        #if item.issuer != "" {
          text(size: 9pt, fill: muted-color)[ — #item.issuer]
        }
      ],
      date-badge(item.date)
    )
    v(8pt)
  }

  let render-award(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 12pt,
      [
        #text(weight: "medium", size: 10pt)[#item.title]
        #if item.awarder != "" {
          text(size: 9pt, fill: muted-color)[ — #item.awarder]
        }
      ],
      date-badge(item.date)
    )

    if item.summary != "" {
      v(2pt)
      render-rich-text(item.summary, size: 9pt)
    }

    v(8pt)
  }

  let render-interest(item) = {
    if item.visible == false { return }

    box(
      fill: light-gray,
      radius: 3pt,
      inset: (x: 8pt, y: 4pt),
      text(size: 9pt)[#item.name]
    )
    h(6pt)
  }

  let render-publication(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 12pt,
      [
        #text(weight: "bold", size: 10pt, fill: primary-color)[#item.name]
        #if item.publisher != "" {
          v(2pt)
          text(size: 9pt, fill: muted-color)[#item.publisher]
        }
      ],
      date-badge(item.date)
    )

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 10pt)
    }

    v(10pt)
  }

  let render-volunteer(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 12pt,
      [
        #text(weight: "bold", size: 11pt, fill: primary-color)[#item.organization]
        #if item.position != "" {
          v(2pt)
          text(size: 10pt)[#item.position]
        }
        #if item.location != "" {
          text(size: 9pt, fill: muted-color)[ · #item.location]
        }
      ],
      date-badge(item.date)
    )

    if item.summary != "" {
      v(6pt)
      render-rich-text(item.summary, size: 10pt)
    }

    v(12pt)
  }

  let render-reference(item) = {
    if item.visible == false { return }

    text(weight: "bold", size: 10pt, fill: primary-color)[#item.name]

    if item.description != "" {
      v(4pt)
      render-rich-text(item.description, size: 10pt)
    }

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 9pt)
    }

    v(10pt)
  }

  let render-custom(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 12pt,
      [
        #text(weight: "bold", size: 10pt, fill: primary-color)[#item.name]
        #if item.description != "" {
          v(2pt)
          render-rich-text(item.description, size: 10pt)
        }
      ],
      date-badge(item.date)
    )

    if item.location != "" {
      v(2pt)
      text(size: 9pt, fill: muted-color)[#item.location]
    }

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 10pt)
    }

    if has-keywords(item) {
      v(4pt)
      for keyword in item.keywords {
        box(
          fill: light-gray,
          radius: 2pt,
          inset: (x: 5pt, y: 2pt),
          text(size: 8pt)[#keyword]
        )
        h(4pt)
      }
    }

    render-url(item, primary-color)
    v(10pt)
  }

  // Page setup

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

  set page(fill: bg-color, 
    margin: (x: 54pt, y: 48pt),
  )

  set text(
    font: "IBM Plex Serif",
    size: 10pt,
    fill: text-color,
  )

  set par(
    leading: 0.65em,
    justify: true,
  )

  // Header with blue accent bar
  box(
    width: 100%,
    stroke: (bottom: 3pt + primary-color),
    inset: (bottom: 12pt),
    [
      #text(size: 28pt, weight: "bold", fill: primary-color)[#data.basics.name]

      #if data.basics.headline != "" {
        v(4pt)
        text(size: 12pt, fill: muted-color)[#data.basics.headline]
      }

      #v(10pt)

      // Contact information in a row
      #let contact-parts = ()
      #if data.basics.email != "" {
        contact-parts.push([✉ #link("mailto:" + data.basics.email)[#data.basics.email]])
      }
      #if data.basics.phone != "" {
        contact-parts.push([☎ #data.basics.phone])
      }
      #if data.basics.location != "" {
        contact-parts.push([📍 #data.basics.location])
      }
      #if has-url(data.basics) {
        contact-parts.push([🔗 #link(data.basics.url.href)[Portfolio]])
      }

      #text(size: 9pt)[#contact-parts.join("    ")]
    ]
  )

  v(8pt)

  for key in layout-all-sections(data) {
    render-section(key, section-heading)
  }
}
