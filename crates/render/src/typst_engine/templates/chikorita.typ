// Chikorita Template - Two-column layout with green accents
// Main content (left, 2/3) + sidebar (right, 1/3) with tinted background

#let primary-color = rgb("#16a34a")
#let text-color = rgb("#166534")
#let muted-color = rgb("#6b7280")
#let light-bg = rgb("#f0fdf4")
#let accent-bg = rgb("#dcfce7")
#let border-color = rgb("#bbf7d0")

#let main-section(title) = {
  v(14pt)
  box(
    width: 100%,
    stroke: (bottom: 2pt + primary-color),
    inset: (bottom: 4pt),
    text(weight: "bold", size: 10pt, fill: primary-color, tracking: 0.06em)[#upper(title)]
  )
  v(10pt)
}

#let sidebar-section(title) = {
  v(12pt)
  text(weight: "bold", size: 9pt, fill: primary-color, tracking: 0.08em)[#upper(title)]
  v(2pt)
  line(length: 100%, stroke: 0.5pt + border-color)
  v(6pt)
}

#let rating-dots(level) = {
  let level = int(calc.min(calc.max(level, 0), 5))
  for i in range(level) {
    box(width: 6pt, height: 6pt, fill: primary-color, radius: 50%)
    h(3pt)
  }
  for i in range(5 - level) {
    box(width: 6pt, height: 6pt, fill: border-color, radius: 50%)
    h(3pt)
  }
}

#let render-experience(item) = {
  if item.visible == false { return }

  grid(
    columns: (1fr, auto),
    column-gutter: 12pt,
    [
      #text(weight: "bold", size: 11pt)[#item.company]
      #v(2pt)
      #text(size: 10pt, fill: primary-color)[#item.position]
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
    text(size: 10pt)[#item.summary]
  }

  v(12pt)
}

#let render-education(item) = {
  if item.visible == false { return }

  grid(
    columns: (1fr, auto),
    column-gutter: 12pt,
    [
      #text(weight: "bold", size: 11pt)[#item.institution]
      #if item.studyType != "" or item.area != "" {
        v(2pt)
        let degree = if item.studyType != "" and item.area != "" {
          [#item.studyType in #item.area]
        } else if item.area != "" {
          item.area
        } else {
          item.studyType
        }
        text(size: 10pt)[#degree]
      }
    ],
    text(size: 9pt, fill: muted-color)[#item.date]
  )

  if item.score != "" {
    v(2pt)
    text(size: 9pt, fill: muted-color)[#item.score]
  }

  v(12pt)
}

#let render-skill(item) = {
  if item.visible == false { return }

  text(size: 9pt, weight: "bold")[#item.name]

  if item.description != "" {
    v(2pt)
    text(size: 8pt, fill: muted-color)[#item.description]
  }

  let level = calc.min(calc.max(item.level, 0), 5)
  if level > 0 {
    v(2pt)
    rating-dots(level)
  }

  if "keywords" in item and item.keywords != none and item.keywords.len() > 0 {
    v(2pt)
    text(size: 8pt, fill: muted-color)[#item.keywords.join(", ")]
  }

  v(8pt)
}

#let render-language(item) = {
  if item.visible == false { return }

  text(size: 9pt, weight: "bold")[#item.name]

  if item.description != "" {
    v(2pt)
    text(size: 8pt, fill: muted-color)[#item.description]
  }

  let level = calc.min(calc.max(item.level, 0), 5)
  if level > 0 {
    v(2pt)
    rating-dots(level)
  }

  v(8pt)
}

#let render-profile(item) = {
  if item.visible == false { return }

  text(size: 9pt, weight: "medium")[#item.network]

  if item.username != "" {
    text(size: 8pt, fill: muted-color)[ #item.username]
  }

  if "url" in item and item.url != none and item.url.href != "" {
    v(1pt)
    link(item.url.href)[#text(size: 8pt, fill: primary-color)[#item.url.href]]
  }

  v(6pt)
}

#let render-project(item) = {
  if item.visible == false { return }

  grid(
    columns: (1fr, auto),
    column-gutter: 12pt,
    text(weight: "bold", size: 10pt)[#item.name],
    text(size: 9pt, fill: muted-color)[#item.date]
  )

  if item.description != "" {
    v(4pt)
    text(size: 10pt)[#item.description]
  }

  if item.summary != "" {
    v(4pt)
    text(size: 9pt, fill: muted-color)[#item.summary]
  }

  if "keywords" in item and item.keywords != none and item.keywords.len() > 0 {
    v(4pt)
    for keyword in item.keywords {
      box(
        fill: accent-bg,
        radius: 3pt,
        inset: (x: 6pt, y: 2pt),
        text(size: 8pt, fill: primary-color)[#keyword]
      )
      h(4pt)
    }
  }

  v(12pt)
}

#let render-certification(item) = {
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
    text(size: 9pt)[#item.summary]
  }

  v(10pt)
}

#let render-award(item) = {
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
    text(size: 9pt)[#item.summary]
  }

  v(10pt)
}

#let render-interest(item) = {
  if item.visible == false { return }

  text(size: 9pt, weight: "medium")[#item.name]

  if "keywords" in item and item.keywords != none and item.keywords.len() > 0 {
    v(2pt)
    text(size: 8pt, fill: muted-color)[#item.keywords.join(", ")]
  }

  v(6pt)
}

#let render-publication(item) = {
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
    text(size: 9pt)[#item.summary]
  }

  v(12pt)
}

#let render-volunteer(item) = {
  if item.visible == false { return }

  grid(
    columns: (1fr, auto),
    column-gutter: 12pt,
    [
      #text(weight: "bold", size: 11pt)[#item.organization]
      #v(2pt)
      #text(size: 10pt, fill: primary-color)[#item.position]
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
    text(size: 10pt)[#item.summary]
  }

  v(12pt)
}

#let render-reference(item) = {
  if item.visible == false { return }

  text(weight: "bold", size: 10pt)[#item.name]

  if item.description != "" {
    v(4pt)
    text(size: 10pt)[#item.description]
  }

  if item.summary != "" {
    v(4pt)
    box(
      stroke: (left: 2pt + primary-color),
      inset: (left: 10pt, y: 2pt),
      text(size: 9pt, style: "italic", fill: muted-color)[#item.summary]
    )
  }

  v(12pt)
}

#let render-custom(item) = {
  if item.visible == false { return }

  text(weight: "bold", size: 10pt)[#item.name]

  if item.description != "" {
    v(4pt)
    text(size: 10pt)[#item.description]
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
    text(size: 10pt)[#item.summary]
  }

  if "keywords" in item and item.keywords != none and item.keywords.len() > 0 {
    v(4pt)
    for keyword in item.keywords {
      box(
        fill: accent-bg,
        radius: 3pt,
        inset: (x: 6pt, y: 2pt),
        text(size: 8pt, fill: primary-color)[#keyword]
      )
      h(4pt)
    }
  }

  v(12pt)
}

#let template(data) = {
  set page(
    paper: "a4",
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

  // Header - above columns, left-aligned
  text(size: 26pt, weight: "bold", fill: text-color)[#data.basics.name]

  if data.basics.headline != "" {
    v(4pt)
    text(size: 12pt, fill: primary-color)[#data.basics.headline]
  }

  v(10pt)

  // Contact info
  let contact-items = ()
  if data.basics.email != "" { contact-items = contact-items + (data.basics.email,) }
  if data.basics.phone != "" { contact-items = contact-items + (data.basics.phone,) }
  if data.basics.location != "" { contact-items = contact-items + (data.basics.location,) }
  if "url" in data.basics and data.basics.url != none and data.basics.url.href != "" { contact-items = contact-items + (link(data.basics.url.href)[#data.basics.url.href],) }

  if contact-items.len() > 0 {
    text(size: 9pt, fill: muted-color)[#contact-items.join("  |  ")]
  }

  v(16pt)
  line(length: 100%, stroke: 1pt + border-color)
  v(12pt)

  // Two-column grid: main (2fr, LEFT) + sidebar (1fr, RIGHT)
  grid(
    columns: (2fr, 1fr),
    column-gutter: 20pt,

    // LEFT COLUMN - Main content
    [
      // Summary
      #if data.sections.summary.visible {
        main-section(data.sections.summary.name)
        text(size: 10pt)[#data.sections.summary.content]
      }

      // Experience
      #if data.sections.experience.visible {
        main-section(data.sections.experience.name)
        for item in data.sections.experience.items {
          render-experience(item)
        }
      }

      // Education
      #if data.sections.education.visible {
        main-section(data.sections.education.name)
        for item in data.sections.education.items {
          render-education(item)
        }
      }

      // Awards
      #if data.sections.awards.visible {
        main-section(data.sections.awards.name)
        for item in data.sections.awards.items {
          render-award(item)
        }
      }

      // Certifications
      #if data.sections.certifications.visible {
        main-section(data.sections.certifications.name)
        for item in data.sections.certifications.items {
          render-certification(item)
        }
      }

      // Publications
      #if data.sections.publications.visible {
        main-section(data.sections.publications.name)
        for item in data.sections.publications.items {
          render-publication(item)
        }
      }

      // Volunteer
      #if data.sections.volunteer.visible {
        main-section(data.sections.volunteer.name)
        for item in data.sections.volunteer.items {
          render-volunteer(item)
        }
      }

      // Projects
      #if data.sections.projects.visible {
        main-section(data.sections.projects.name)
        for item in data.sections.projects.items {
          render-project(item)
        }
      }

      // References
      #if data.sections.references.visible {
        main-section(data.sections.references.name)
        for item in data.sections.references.items {
          render-reference(item)
        }
      }
    ],

    // RIGHT COLUMN - Sidebar with light green background
    box(
      fill: light-bg,
      radius: 6pt,
      inset: 12pt,
      width: 100%,
      [
        // Profiles
        #if data.sections.profiles.visible {
          sidebar-section(data.sections.profiles.name)
          for item in data.sections.profiles.items {
            render-profile(item)
          }
        }

        // Skills
        #if data.sections.skills.visible {
          sidebar-section(data.sections.skills.name)
          for item in data.sections.skills.items {
            render-skill(item)
          }
        }

        // Languages
        #if data.sections.languages.visible {
          sidebar-section(data.sections.languages.name)
          for item in data.sections.languages.items {
            render-language(item)
          }
        }

        // Interests
        #if data.sections.interests.visible {
          sidebar-section(data.sections.interests.name)
          for item in data.sections.interests.items {
            render-interest(item)
          }
        }
      ]
    )
  )

  // Custom sections - rendered after the grid
  if "custom" in data.sections {
    for (key, section) in data.sections.custom {
      if section.visible {
        main-section(section.name)
        for item in section.items {
          render-custom(item)
        }
      }
    }
  }
}
