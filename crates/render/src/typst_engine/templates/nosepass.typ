// Nosepass Template - Professional, classic design
// Traditional layout with blue accents, suitable for corporate environments

#let primary-color = rgb("#3b82f6")
#let dark-blue = rgb("#1e3a5f")
#let text-color = rgb("#1f2937")
#let muted-color = rgb("#4b5563")
#let light-gray = rgb("#f3f4f6")
#let border-color = rgb("#d1d5db")

#let section-heading(title) = {
  v(14pt)
  grid(
    columns: (auto, 1fr),
    column-gutter: 12pt,
    text(weight: "bold", size: 11pt, fill: dark-blue)[#title],
    line(start: (0pt, 6pt), length: 100%, stroke: 1pt + border-color)
  )
  v(10pt)
}

#let date-badge(date) = {
  box(
    fill: light-gray,
    radius: 2pt,
    inset: (x: 6pt, y: 2pt),
    text(size: 9pt, fill: muted-color)[#date]
  )
}

#let render-experience(item) = {
  if item.visible == false { return }

  grid(
    columns: (1fr, auto),
    column-gutter: 12pt,
    [
      #text(weight: "bold", size: 11pt, fill: dark-blue)[#item.position]
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
      #text(weight: "bold", size: 11pt, fill: dark-blue)[#item.institution]
      #v(2pt)
      #if item.studyType != "" or item.area != "" {
        let degree = if item.studyType != "" and item.area != "" {
          [#item.studyType in #item.area]
        } else if item.area != "" {
          item.area
        } else {
          item.studyType
        }
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

#let render-skill(item) = {
  if item.visible == false { return }

  box(
    stroke: 1pt + border-color,
    radius: 3pt,
    inset: (x: 8pt, y: 4pt),
    [
      #text(size: 9pt, weight: "medium")[#item.name]
      #let level = calc.min(calc.max(item.level, 0), 5)
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

#let render-language(item) = {
  if item.visible == false { return }

  grid(
    columns: (auto, 1fr, auto),
    column-gutter: 8pt,
    text(size: 10pt, weight: "medium")[#item.name],
    line(start: (0pt, 5pt), length: 100%, stroke: (dash: "dotted") + border-color),
    text(size: 9pt, fill: muted-color)[#item.description]
  )
  v(6pt)
}

#let render-profile(item) = {
  if item.visible == false { return }

  if "url" in item and item.url != none and item.url.href != "" {
    link(item.url.href)[#text(fill: primary-color)[#item.network: #item.username]]
  } else {
    text(size: 10pt)[#item.network: #item.username]
  }
  v(4pt)
}

#let render-project(item) = {
  if item.visible == false { return }

  text(weight: "bold", size: 10pt, fill: dark-blue)[#item.name]

  if item.description != "" {
    v(4pt)
    text(size: 10pt)[#item.description]
  }

  if "keywords" in item and item.keywords != none and item.keywords.len() > 0 {
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

#let render-certification(item) = {
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

#let render-award(item) = {
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
    text(size: 9pt)[#item.summary]
  }

  v(8pt)
}

#let render-interest(item) = {
  if item.visible == false { return }

  box(
    fill: light-gray,
    radius: 3pt,
    inset: (x: 8pt, y: 4pt),
    text(size: 9pt)[#item.name]
  )
  h(6pt)
}

#let render-publication(item) = {
  if item.visible == false { return }

  grid(
    columns: (1fr, auto),
    column-gutter: 12pt,
    [
      #text(weight: "bold", size: 10pt, fill: dark-blue)[#item.name]
      #if item.publisher != "" {
        v(2pt)
        text(size: 9pt, fill: muted-color)[#item.publisher]
      }
    ],
    date-badge(item.date)
  )

  if item.summary != "" {
    v(4pt)
    text(size: 10pt)[#item.summary]
  }

  v(10pt)
}

#let render-volunteer(item) = {
  if item.visible == false { return }

  grid(
    columns: (1fr, auto),
    column-gutter: 12pt,
    [
      #text(weight: "bold", size: 11pt, fill: dark-blue)[#item.organization]
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
    text(size: 10pt)[#item.summary]
  }

  v(12pt)
}

#let render-reference(item) = {
  if item.visible == false { return }

  text(weight: "bold", size: 10pt, fill: dark-blue)[#item.name]

  if item.description != "" {
    v(4pt)
    text(size: 10pt)[#item.description]
  }

  if item.summary != "" {
    v(4pt)
    text(size: 9pt)[#item.summary]
  }

  v(10pt)
}

#let render-custom(item) = {
  if item.visible == false { return }

  grid(
    columns: (1fr, auto),
    column-gutter: 12pt,
    [
      #text(weight: "bold", size: 10pt, fill: dark-blue)[#item.name]
      #if item.description != "" {
        v(2pt)
        text(size: 10pt)[#item.description]
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
    text(size: 10pt)[#item.summary]
  }

  if "keywords" in item and item.keywords != none and item.keywords.len() > 0 {
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

#let template(data) = {
  // Page setup
  set page(
    paper: "a4",
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
      #text(size: 28pt, weight: "bold", fill: dark-blue)[#data.basics.name]

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
      #if "url" in data.basics and data.basics.url != none and data.basics.url.href != "" {
        contact-parts.push([🔗 #link(data.basics.url.href)[Portfolio]])
      }

      #text(size: 9pt)[#contact-parts.join("    ")]
    ]
  )

  v(8pt)

  // Summary in a highlighted box
  if data.sections.summary.visible {
    v(8pt)
    box(
      width: 100%,
      fill: light-gray,
      radius: 4pt,
      inset: 12pt,
      [
        #text(weight: "bold", size: 10pt, fill: dark-blue)[Professional Summary]
        #v(6pt)
        #text(size: 10pt)[#data.sections.summary.content]
      ]
    )
  }

  // Profiles
  if data.sections.profiles.visible {
    section-heading(data.sections.profiles.name)
    for item in data.sections.profiles.items {
      render-profile(item)
    }
  }

  // Experience
  if data.sections.experience.visible {
    section-heading(data.sections.experience.name)
    for item in data.sections.experience.items {
      render-experience(item)
    }
  }

  // Education
  if data.sections.education.visible {
    section-heading(data.sections.education.name)
    for item in data.sections.education.items {
      render-education(item)
    }
  }

  // Two-column layout for skills and languages
  if (data.sections.skills.visible) or (data.sections.languages.visible) {
    v(6pt)
    grid(
      columns: (1fr, 1fr),
      column-gutter: 24pt,
      [
        #if data.sections.skills.visible {
          section-heading(data.sections.skills.name)
          for item in data.sections.skills.items {
            render-skill(item)
          }
        }
      ],
      [
        #if data.sections.languages.visible {
          section-heading(data.sections.languages.name)
          for item in data.sections.languages.items {
            render-language(item)
          }
        }
      ]
    )
  }

  // Projects
  if data.sections.projects.visible {
    section-heading(data.sections.projects.name)
    for item in data.sections.projects.items {
      render-project(item)
    }
  }

  // Certifications
  if data.sections.certifications.visible {
    section-heading(data.sections.certifications.name)
    for item in data.sections.certifications.items {
      render-certification(item)
    }
  }

  // Awards
  if data.sections.awards.visible {
    section-heading(data.sections.awards.name)
    for item in data.sections.awards.items {
      render-award(item)
    }
  }

  // Interests
  if data.sections.interests.visible {
    section-heading(data.sections.interests.name)
    for item in data.sections.interests.items {
      render-interest(item)
    }
  }

  // Publications
  if data.sections.publications.visible {
    section-heading(data.sections.publications.name)
    for item in data.sections.publications.items { render-publication(item) }
  }

  // Volunteer
  if data.sections.volunteer.visible {
    section-heading(data.sections.volunteer.name)
    for item in data.sections.volunteer.items { render-volunteer(item) }
  }

  // References
  if data.sections.references.visible {
    section-heading(data.sections.references.name)
    for item in data.sections.references.items { render-reference(item) }
  }

  // Custom sections
  if "custom" in data.sections {
    for (key, section) in data.sections.custom {
      if section.visible {
        section-heading(section.name)
        for item in section.items { render-custom(item) }
      }
    }
  }
}
