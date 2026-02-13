// Azurill Template - Two-column sidebar layout
// Amber/gold accents, left sidebar (1/3) + main content (2/3), centered header above columns

#import "_common.typ": *

#let primary-color = rgb("#d97706")
#let text-color = rgb("#1f2937")
#let muted-color = rgb("#6b7280")
#let light-bg = rgb("#fef3c7")
#let sidebar-bg = rgb("#fffbeb")
#let bar-empty = rgb("#e5e7eb")

// Section heading for main content area (right column)
#let main-section-heading(title) = {
  v(14pt)
  text(weight: "bold", size: 11pt, fill: primary-color, tracking: 0.06em)[#upper(title)]
  v(2pt)
  line(length: 100%, stroke: 1.5pt + primary-color)
  v(8pt)
}

// Section heading for sidebar (left column) - smaller, different style
#let sidebar-section-heading(title) = {
  v(12pt)
  text(weight: "semibold", size: 9pt, fill: primary-color, tracking: 0.1em)[#upper(title)]
  v(2pt)
  line(length: 100%, stroke: 0.75pt + primary-color)
  v(6pt)
}

// Rating bars helper (0-5 scale)
#let rating-bars(level) = {
  rating-indicators(level, 14pt, 4pt, primary-color, bar-empty, 2pt, 2pt)
}

#let render-experience(item) = {
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
    text(size: 9pt)[#item.summary]
  }

  v(10pt)
}

#let render-education(item) = {
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
    text(size: 9pt)[#item.summary]
  }

  v(10pt)
}

#let render-skill(item) = {
  if item.visible == false { return }

  text(size: 9pt, weight: "bold")[#item.name]

  if item.description != "" {
    v(1pt)
    text(size: 8pt, fill: muted-color)[#item.description]
  }

  let level = clamp-level(item.level)
  if level > 0 {
    v(2pt)
    rating-bars(level)
  }

  if has-keywords(item) {
    v(2pt)
    text(size: 8pt, fill: muted-color)[#item.keywords.join(", ")]
  }

  v(8pt)
}

#let render-language(item) = {
  if item.visible == false { return }

  text(size: 9pt, weight: "bold")[#item.name]

  if item.description != "" {
    v(1pt)
    text(size: 8pt, fill: muted-color)[#item.description]
  }

  let level = clamp-level(item.level)
  if level > 0 {
    v(2pt)
    rating-bars(level)
  }

  v(8pt)
}

#let render-profile(item) = {
  if item.visible == false { return }

  text(size: 8pt, fill: muted-color)[#item.network]
  v(1pt)
  if has-url(item) {
    link(item.url.href)[#text(size: 9pt, fill: primary-color)[#item.username]]
  } else {
    text(size: 9pt)[#item.username]
  }
  v(6pt)
}

#let render-project(item) = {
  if item.visible == false { return }

  grid(
    columns: (1fr, auto),
    column-gutter: 8pt,
    text(weight: "bold", size: 10pt)[#item.name],
    text(size: 9pt, fill: muted-color)[#item.date]
  )

  if item.description != "" {
    v(2pt)
    text(size: 9pt)[#item.description]
  }

  if item.summary != "" {
    v(2pt)
    text(size: 9pt)[#item.summary]
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

#let render-certification(item) = {
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
    text(size: 9pt)[#item.summary]
  }

  v(10pt)
}

#let render-award(item) = {
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
    text(size: 9pt)[#item.summary]
  }

  v(10pt)
}

#let render-interest(item) = {
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

#let render-publication(item) = {
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
    text(size: 9pt)[#item.summary]
  }

  v(10pt)
}

#let render-volunteer(item) = {
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
    text(size: 9pt)[#item.summary]
  }

  v(10pt)
}

#let render-reference(item) = {
  if item.visible == false { return }

  text(weight: "bold", size: 10pt)[#item.name]

  if item.description != "" {
    v(2pt)
    text(size: 9pt, fill: muted-color)[#item.description]
  }

  if item.summary != "" {
    v(2pt)
    text(size: 9pt)[#item.summary]
  }

  v(10pt)
}

#let render-custom(item) = {
  if item.visible == false { return }

  grid(
    columns: (1fr, auto),
    column-gutter: 8pt,
    [
      #text(weight: "bold", size: 10pt)[#item.name]
      #if item.description != "" {
        v(1pt)
        text(size: 9pt)[#item.description]
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
    text(size: 9pt)[#item.summary]
  }

  if has-keywords(item) {
    v(2pt)
    text(size: 8pt, fill: muted-color)[#item.keywords.join(", ")]
  }

  v(10pt)
}

#let template(data) = {
  // Page setup
  set page(
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

  // ── Two-column grid: sidebar (1fr) + main (2fr) ──
  grid(
    columns: (1fr, 2fr),
    column-gutter: 20pt,

    // ── Left column (sidebar) ──
    [
      // Profiles
      #if data.sections.profiles.visible {
        sidebar-section-heading(data.sections.profiles.name)
        for item in data.sections.profiles.items {
          render-profile(item)
        }
      }

      // Skills
      #if data.sections.skills.visible {
        sidebar-section-heading(data.sections.skills.name)
        for item in data.sections.skills.items {
          render-skill(item)
        }
      }

      // Languages
      #if data.sections.languages.visible {
        sidebar-section-heading(data.sections.languages.name)
        for item in data.sections.languages.items {
          render-language(item)
        }
      }

      // Interests
      #if data.sections.interests.visible {
        sidebar-section-heading(data.sections.interests.name)
        for item in data.sections.interests.items {
          render-interest(item)
        }
      }
    ],

    // ── Right column (main content) ──
    [
      // Summary
      #if data.sections.summary.visible {
        text(size: 10pt, fill: muted-color, style: "italic")[#data.sections.summary.content]
        v(6pt)
      }

      // Experience
      #if data.sections.experience.visible {
        main-section-heading(data.sections.experience.name)
        for item in data.sections.experience.items {
          render-experience(item)
        }
      }

      // Education
      #if data.sections.education.visible {
        main-section-heading(data.sections.education.name)
        for item in data.sections.education.items {
          render-education(item)
        }
      }

      // Awards
      #if data.sections.awards.visible {
        main-section-heading(data.sections.awards.name)
        for item in data.sections.awards.items {
          render-award(item)
        }
      }

      // Certifications
      #if data.sections.certifications.visible {
        main-section-heading(data.sections.certifications.name)
        for item in data.sections.certifications.items {
          render-certification(item)
        }
      }

      // Publications
      #if data.sections.publications.visible {
        main-section-heading(data.sections.publications.name)
        for item in data.sections.publications.items {
          render-publication(item)
        }
      }

      // Volunteer
      #if data.sections.volunteer.visible {
        main-section-heading(data.sections.volunteer.name)
        for item in data.sections.volunteer.items {
          render-volunteer(item)
        }
      }

      // Projects
      #if data.sections.projects.visible {
        main-section-heading(data.sections.projects.name)
        for item in data.sections.projects.items {
          render-project(item)
        }
      }

      // References
      #if data.sections.references.visible {
        main-section-heading(data.sections.references.name)
        for item in data.sections.references.items {
          render-reference(item)
        }
      }

      // Custom sections
      #if "custom" in data.sections {
        for (key, section) in data.sections.custom {
          if section.visible {
            main-section-heading(section.name)
            for item in section.items {
              render-custom(item)
            }
          }
        }
      }
    ]
  )
}
