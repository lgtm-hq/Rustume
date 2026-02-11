// Gengar Template - Two-column sidebar layout
// Light teal sidebar (left) with header inside, main content (right)
// Primary teal accents, clean professional typography

#let primary-color = rgb("#67b8c8")
#let text-color = rgb("#1f2937")
#let muted-color = rgb("#6b7280")
#let sidebar-bg = rgb("#e8f4f7")
#let white = rgb("#ffffff")

#let sidebar-section-heading(title) = {
  v(12pt)
  text(weight: "bold", size: 9pt, fill: primary-color, tracking: 0.05em)[#upper(title)]
  v(2pt)
  line(length: 100%, stroke: 1pt + primary-color)
  v(8pt)
}

#let main-section-heading(title) = {
  v(14pt)
  text(weight: "bold", size: 11pt, fill: text-color, tracking: 0.04em)[#upper(title)]
  v(3pt)
  line(length: 100%, stroke: 1.5pt + primary-color)
  v(10pt)
}

#let entry-header(left-content, right-content) = {
  grid(
    columns: (1fr, auto),
    column-gutter: 8pt,
    left-content,
    align(right)[
      #text(size: 9pt, fill: muted-color)[#right-content]
    ]
  )
}

#let rating-boxes(level) = {
  let level = calc.min(calc.max(level, 0), 5)
  for i in range(level) {
    box(width: 8pt, height: 8pt, fill: primary-color, radius: 1pt)
    h(2pt)
  }
  for i in range(5 - level) {
    box(width: 8pt, height: 8pt, fill: rgb("#d1d5db"), radius: 1pt)
    h(2pt)
  }
}

#let render-experience(item) = {
  if item.visible == false { return }

  entry-header(
    [
      #if "url" in item and item.url != none and item.url.href != "" {
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
    text(size: 9.5pt)[#item.summary]
  }

  v(12pt)
}

#let render-education(item) = {
  if item.visible == false { return }

  entry-header(
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
    [
      #item.date
      #if item.studyType != "" {
        v(2pt)
        text(size: 9pt, fill: muted-color)[#item.studyType]
      }
    ]
  )

  if item.score != "" {
    v(2pt)
    text(size: 9pt, fill: muted-color)[Score: #item.score]
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
      #text(size: 9pt, weight: "bold")[#item.name]
      #if item.description != "" {
        v(1pt)
        text(size: 8pt, fill: muted-color)[#item.description]
      }
    ],
    rating-boxes(item.level)
  )

  if "keywords" in item and item.keywords != none and item.keywords.len() > 0 {
    v(2pt)
    text(size: 8pt, fill: muted-color)[#item.keywords.join(", ")]
  }

  v(8pt)
}

#let render-language(item) = {
  if item.visible == false { return }

  grid(
    columns: (1fr, auto),
    column-gutter: 4pt,
    [
      #text(size: 9pt, weight: "bold")[#item.name]
      #if item.description != "" {
        h(4pt)
        text(size: 8pt, fill: muted-color)[#item.description]
      }
    ],
    rating-boxes(item.level)
  )

  v(6pt)
}

#let render-profile(item) = {
  if item.visible == false { return }

  text(size: 9pt, weight: "medium", fill: text-color)[#item.network]
  v(1pt)
  if "url" in item and item.url != none and item.url.href != "" {
    link(item.url.href)[#text(size: 8pt, fill: primary-color)[#item.username]]
  } else {
    text(size: 8pt, fill: muted-color)[#item.username]
  }
  v(6pt)
}

#let render-project(item) = {
  if item.visible == false { return }

  entry-header(
    [
      #if "url" in item and item.url != none and item.url.href != "" {
        link(item.url.href)[#text(weight: "bold", size: 10pt)[#item.name]]
      } else {
        text(weight: "bold", size: 10pt)[#item.name]
      }
      #if item.description != "" {
        v(2pt)
        text(size: 9.5pt)[#item.description]
      }
    ],
    item.date
  )

  if item.summary != "" {
    v(4pt)
    text(size: 9.5pt)[#item.summary]
  }

  if "keywords" in item and item.keywords != none and item.keywords.len() > 0 {
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

#let render-certification(item) = {
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
    text(size: 9.5pt)[#item.summary]
  }

  v(8pt)
}

#let render-award(item) = {
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
    text(size: 9.5pt)[#item.summary]
  }

  v(8pt)
}

#let render-interest(item) = {
  if item.visible == false { return }

  text(size: 9pt, weight: "bold")[#item.name]

  if "keywords" in item and item.keywords != none and item.keywords.len() > 0 {
    v(2pt)
    text(size: 8pt, fill: muted-color)[#item.keywords.join(", ")]
  }

  v(6pt)
}

#let render-publication(item) = {
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
    text(size: 9.5pt)[#item.summary]
  }

  v(8pt)
}

#let render-volunteer(item) = {
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
    text(size: 9.5pt)[#item.summary]
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
    text(size: 9.5pt)[#item.summary]
  }

  v(8pt)
}

#let render-custom(item) = {
  if item.visible == false { return }

  entry-header(
    [
      #text(weight: "bold", size: 10pt)[#item.name]
      #if item.description != "" {
        v(1pt)
        text(size: 9pt, fill: muted-color)[#item.description]
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
    text(size: 9.5pt)[#item.summary]
  }

  if "keywords" in item and item.keywords != none and item.keywords.len() > 0 {
    v(2pt)
    text(size: 8pt, fill: muted-color)[#item.keywords.join(", ")]
  }

  v(8pt)
}

#let template(data) = {
  set page(
    paper: "a4",
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

  // Two-column grid: sidebar (left) + main (right)
  grid(
    columns: (170pt, 1fr),
    column-gutter: 0pt,

    // ── LEFT SIDEBAR ──
    box(
      width: 100%,
      height: 100%,
      fill: sidebar-bg,
      inset: (x: 16pt, y: 28pt),
      [
        // Header: Name, headline, contact info
        #text(size: 18pt, weight: "bold", fill: text-color)[#data.basics.name]

        #if data.basics.headline != "" {
          v(6pt)
          text(size: 9pt, fill: muted-color)[#data.basics.headline]
        }

        #v(12pt)

        // Contact info
        #if data.basics.email != "" {
          text(size: 8pt, fill: text-color)[#data.basics.email]
          v(4pt)
        }
        #if data.basics.phone != "" {
          text(size: 8pt, fill: text-color)[#data.basics.phone]
          v(4pt)
        }
        #if data.basics.location != "" {
          text(size: 8pt, fill: text-color)[#data.basics.location]
          v(4pt)
        }
        #if "url" in data.basics and data.basics.url != none and data.basics.url.href != "" {
          link(data.basics.url.href)[#text(size: 8pt, fill: primary-color)[#data.basics.url.href]]
          v(4pt)
        }

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
      ]
    ),

    // ── RIGHT MAIN ──
    box(
      width: 100%,
      inset: (x: 24pt, y: 28pt),
      [
        // Summary
        #if data.sections.summary.visible {
          main-section-heading(data.sections.summary.name)
          text(size: 10pt)[#data.sections.summary.content]
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
      ]
    ),
  )

  // Custom sections (after grid, full-width)
  if "custom" in data.sections {
    for (key, section) in data.sections.custom {
      if section.visible {
        pad(x: 24pt)[
          #main-section-heading(section.name)
          #for item in section.items {
            render-custom(item)
          }
        ]
      }
    }
  }
}
