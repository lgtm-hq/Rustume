// Leafish Template - Rose/crimson accented two-column layout
// Full-width header above equal two-column grid, two-tier header design

#let primary-color = rgb("#9f1239")
#let text-color = rgb("#1f2937")
#let muted-color = rgb("#6b7280")
#let header-bg = rgb("#fde8ef")
#let contact-bar-bg = rgb("#9f1239")
#let tag-bg = rgb("#fde8ef")

#let section-heading(title) = {
  v(10pt)
  box(
    width: 100%,
    stroke: (bottom: 1.5pt + primary-color),
    inset: (bottom: 4pt),
    text(weight: "bold", size: 9pt, fill: primary-color, tracking: 0.06em)[#upper(title)]
  )
  v(8pt)
}

#let rating-dots(level) = {
  let level = int(calc.min(calc.max(level, 0), 5))
  for i in range(level) {
    box(width: 6pt, height: 6pt, fill: primary-color, radius: 50%)
    h(2pt)
  }
  for i in range(5 - level) {
    box(width: 6pt, height: 6pt, fill: rgb("#e5e7eb"), radius: 50%)
    h(2pt)
  }
}

#let render-experience(item) = {
  if item.visible == false { return }

  grid(
    columns: (1fr, auto),
    column-gutter: 8pt,
    [
      #if "url" in item and item.url != none and item.url.href != "" {
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
    text(size: 9.5pt)[#item.summary]
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
      #if item.area != "" or item.studyType != "" {
        v(2pt)
        let degree = if item.studyType != "" and item.area != "" {
          [#item.studyType in #item.area]
        } else if item.area != "" {
          item.area
        } else {
          item.studyType
        }
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
    text(size: 9.5pt)[#item.summary]
  }

  v(10pt)
}

#let render-skill(item) = {
  if item.visible == false { return }

  grid(
    columns: (1fr, auto),
    column-gutter: 4pt,
    [
      #text(size: 9.5pt, weight: "bold")[#item.name]
      #if item.description != "" {
        v(1pt)
        text(size: 8.5pt, fill: muted-color)[#item.description]
      }
    ],
    rating-dots(item.level)
  )

  if "keywords" in item and item.keywords != none and item.keywords.len() > 0 {
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

#let render-language(item) = {
  if item.visible == false { return }

  grid(
    columns: (1fr, auto),
    column-gutter: 4pt,
    [
      #text(size: 9.5pt, weight: "bold")[#item.name]
      #if item.description != "" {
        h(4pt)
        text(size: 8.5pt, fill: muted-color)[#item.description]
      }
    ],
    rating-dots(item.level)
  )

  v(6pt)
}

#let render-profile(item) = {
  if item.visible == false { return }

  text(size: 9pt, weight: "medium", fill: muted-color)[#item.network]
  h(4pt)
  if "url" in item and item.url != none and item.url.href != "" {
    link(item.url.href)[#text(size: 9pt, fill: primary-color)[#item.username]]
  } else {
    text(size: 9pt)[#item.username]
  }

  v(5pt)
}

#let render-project(item) = {
  if item.visible == false { return }

  text(weight: "bold", size: 9.5pt)[#item.name]

  if item.description != "" {
    v(2pt)
    text(size: 9pt)[#item.description]
  }

  if item.date != "" {
    v(2pt)
    text(size: 8.5pt, fill: muted-color)[#item.date]
  }

  if item.summary != "" {
    v(2pt)
    text(size: 9pt)[#item.summary]
  }

  if "keywords" in item and item.keywords != none and item.keywords.len() > 0 {
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

#let render-certification(item) = {
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
    text(size: 9pt)[#item.summary]
  }

  v(8pt)
}

#let render-award(item) = {
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
    text(size: 9pt)[#item.summary]
  }

  v(8pt)
}

#let render-interest(item) = {
  if item.visible == false { return }

  text(size: 9.5pt, weight: "medium")[#item.name]

  if "keywords" in item and item.keywords != none and item.keywords.len() > 0 {
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

#let render-publication(item) = {
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
    text(size: 9pt)[#item.summary]
  }

  v(8pt)
}

#let render-volunteer(item) = {
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
    text(size: 9.5pt)[#item.summary]
  }

  v(10pt)
}

#let render-reference(item) = {
  if item.visible == false { return }

  text(weight: "bold", size: 9.5pt)[#item.name]

  if item.description != "" {
    v(2pt)
    text(size: 8.5pt, fill: muted-color)[#item.description]
  }

  if item.summary != "" {
    v(2pt)
    text(size: 9pt)[#item.summary]
  }

  v(8pt)
}

#let render-custom(item) = {
  if item.visible == false { return }

  text(weight: "bold", size: 9.5pt)[#item.name]

  if item.description != "" {
    v(2pt)
    text(size: 9pt)[#item.description]
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
    text(size: 9pt)[#item.summary]
  }

  if "keywords" in item and item.keywords != none and item.keywords.len() > 0 {
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

#let template(data) = {
  set page(
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
          text(size: 11pt, fill: text-color)[#data.basics.headline]
        }
      ],
      align(right + horizon)[
        #if "url" in data.basics and data.basics.url != none and data.basics.url.href != "" {
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
      let contact-items = ()
      if data.basics.email != "" { contact-items = contact-items + (data.basics.email,) }
      if data.basics.phone != "" { contact-items = contact-items + (data.basics.phone,) }
      if data.basics.location != "" { contact-items = contact-items + (data.basics.location,) }

      text(size: 9pt, fill: white)[#contact-items.join([#h(8pt)#text(fill: rgb("#f9a8c9"))[|]#h(8pt)])]
    }
  )

  v(12pt)

  // === TWO-COLUMN GRID ===
  grid(
    columns: (1fr, 1fr),
    column-gutter: 20pt,

    // ---- LEFT COLUMN ----
    [
      // Summary
      #if data.sections.summary.visible {
        section-heading(data.sections.summary.name)
        text(size: 9.5pt)[#data.sections.summary.content]
      }

      // Experience
      #if data.sections.experience.visible {
        section-heading(data.sections.experience.name)
        for item in data.sections.experience.items {
          render-experience(item)
        }
      }

      // Education
      #if data.sections.education.visible {
        section-heading(data.sections.education.name)
        for item in data.sections.education.items {
          render-education(item)
        }
      }

      // Awards
      #if data.sections.awards.visible {
        section-heading(data.sections.awards.name)
        for item in data.sections.awards.items {
          render-award(item)
        }
      }

      // Certifications
      #if data.sections.certifications.visible {
        section-heading(data.sections.certifications.name)
        for item in data.sections.certifications.items {
          render-certification(item)
        }
      }

      // Publications
      #if data.sections.publications.visible {
        section-heading(data.sections.publications.name)
        for item in data.sections.publications.items {
          render-publication(item)
        }
      }
    ],

    // ---- RIGHT COLUMN ----
    [
      // Profiles
      #if data.sections.profiles.visible {
        section-heading(data.sections.profiles.name)
        for item in data.sections.profiles.items {
          render-profile(item)
        }
      }

      // Skills
      #if data.sections.skills.visible {
        section-heading(data.sections.skills.name)
        for item in data.sections.skills.items {
          render-skill(item)
        }
      }

      // Languages
      #if data.sections.languages.visible {
        section-heading(data.sections.languages.name)
        for item in data.sections.languages.items {
          render-language(item)
        }
      }

      // Interests
      #if data.sections.interests.visible {
        section-heading(data.sections.interests.name)
        for item in data.sections.interests.items {
          render-interest(item)
        }
      }

      // Volunteer
      #if data.sections.volunteer.visible {
        section-heading(data.sections.volunteer.name)
        for item in data.sections.volunteer.items {
          render-volunteer(item)
        }
      }

      // Projects
      #if data.sections.projects.visible {
        section-heading(data.sections.projects.name)
        for item in data.sections.projects.items {
          render-project(item)
        }
      }

      // References
      #if data.sections.references.visible {
        section-heading(data.sections.references.name)
        for item in data.sections.references.items {
          render-reference(item)
        }
      }
    ]
  )

  // === CUSTOM SECTIONS (after grid) ===
  if "custom" in data.sections {
    for (key, section) in data.sections.custom {
      if section.visible {
        section-heading(section.name)
        for item in section.items {
          render-custom(item)
        }
      }
    }
  }
}
