// Ditto Template - Two-column sidebar layout
// Teal/cyan accents, sidebar on left, compact modern design

#let primary-color = rgb("#0891b2")
#let text-color = rgb("#1f2937")
#let muted-color = rgb("#6b7280")
#let light-bg = rgb("#ecfeff")
#let sidebar-bg = rgb("#f0fdfa")
#let white = rgb("#ffffff")

#let sidebar-heading(title) = {
  v(10pt)
  text(weight: "bold", size: 8pt, fill: primary-color, tracking: 0.08em)[#upper(title)]
  v(2pt)
  line(length: 100%, stroke: 0.5pt + primary-color)
  v(6pt)
}

#let section-heading(title) = {
  v(10pt)
  box(
    width: 100%,
    stroke: (bottom: 1.5pt + primary-color),
    inset: (bottom: 3pt),
    text(weight: "bold", size: 9pt, fill: primary-color, tracking: 0.06em)[#upper(title)]
  )
  v(8pt)
}

#let render-experience(item) = {
  if item.visible == false { return }

  grid(
    columns: (1fr, auto),
    column-gutter: 8pt,
    [
      #if "url" in item and item.url != none and item.url.href != "" {
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
      #text(weight: "bold", size: 9pt)[#item.institution]
      #if item.studyType != "" or item.area != "" {
        v(1pt)
        let degree = if item.studyType != "" and item.area != "" {
          [#item.studyType in #item.area]
        } else if item.area != "" {
          item.area
        } else {
          item.studyType
        }
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

#let render-skill(item) = {
  if item.visible == false { return }

  text(size: 8pt, weight: "bold")[#item.name]

  if item.description != "" {
    v(1pt)
    text(size: 7pt, fill: muted-color)[#item.description]
  }

  let level = calc.min(calc.max(item.level, 0), 5)
  if level > 0 {
    v(2pt)
    for i in range(level) {
      box(width: 6pt, height: 6pt, fill: primary-color, radius: 50%)
      h(2pt)
    }
    for i in range(5 - level) {
      box(width: 6pt, height: 6pt, fill: rgb("#d1d5db"), radius: 50%)
      h(2pt)
    }
  }

  if "keywords" in item and item.keywords != none and item.keywords.len() > 0 {
    v(2pt)
    text(size: 7pt, fill: muted-color)[#item.keywords.join(", ")]
  }

  v(6pt)
}

#let render-language(item) = {
  if item.visible == false { return }

  text(size: 8pt, weight: "bold")[#item.name]

  if item.description != "" {
    text(size: 7pt, fill: muted-color)[ -- #item.description]
  }

  let level = calc.min(calc.max(item.level, 0), 5)
  if level > 0 {
    v(2pt)
    for i in range(level) {
      box(width: 6pt, height: 6pt, fill: primary-color, radius: 50%)
      h(2pt)
    }
    for i in range(5 - level) {
      box(width: 6pt, height: 6pt, fill: rgb("#d1d5db"), radius: 50%)
      h(2pt)
    }
  }

  v(6pt)
}

#let render-profile(item) = {
  if item.visible == false { return }

  text(size: 8pt, weight: "medium")[#item.network]

  if "url" in item and item.url != none and item.url.href != "" {
    v(1pt)
    link(item.url.href)[#text(size: 7pt, fill: primary-color)[#item.username]]
  } else {
    v(1pt)
    text(size: 7pt, fill: muted-color)[#item.username]
  }

  v(6pt)
}

#let render-project(item) = {
  if item.visible == false { return }

  grid(
    columns: (1fr, auto),
    column-gutter: 8pt,
    [#text(weight: "bold", size: 9pt)[#item.name]],
    text(size: 8pt, fill: muted-color)[#item.date]
  )

  if item.description != "" {
    v(2pt)
    text(size: 9pt)[#item.description]
  }

  if item.summary != "" {
    v(2pt)
    text(size: 9pt)[#item.summary]
  }

  if "keywords" in item and item.keywords != none and item.keywords.len() > 0 {
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

#let render-certification(item) = {
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
      #text(weight: "medium", size: 9pt)[#item.title]
      #if item.awarder != "" {
        text(size: 8pt, fill: muted-color)[ -- #item.awarder]
      }
    ],
    text(size: 8pt, fill: muted-color)[#item.date]
  )

  if item.summary != "" {
    v(2pt)
    text(size: 9pt)[#item.summary]
  }

  v(8pt)
}

#let render-interest(item) = {
  if item.visible == false { return }

  text(size: 8pt, weight: "medium")[#item.name]

  if "keywords" in item and item.keywords != none and item.keywords.len() > 0 {
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

#let render-publication(item) = {
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
    text(size: 9pt)[#item.summary]
  }

  v(10pt)
}

#let render-reference(item) = {
  if item.visible == false { return }

  text(weight: "bold", size: 9pt)[#item.name]

  if item.description != "" {
    v(2pt)
    text(size: 8pt, fill: muted-color)[#item.description]
  }

  if item.summary != "" {
    v(2pt)
    text(size: 9pt)[#item.summary]
  }

  v(8pt)
}

#let render-custom(item) = {
  if item.visible == false { return }

  grid(
    columns: (1fr, auto),
    column-gutter: 8pt,
    [
      #text(weight: "bold", size: 9pt)[#item.name]
      #if item.description != "" {
        v(1pt)
        text(size: 8pt, fill: muted-color)[#item.description]
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
    text(size: 9pt)[#item.summary]
  }

  if "keywords" in item and item.keywords != none and item.keywords.len() > 0 {
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

  v(8pt)
}

#let template(data) = {
  set page(
    paper: "a4",
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
        text(size: 11pt, fill: rgb("#cffafe"))[#data.basics.headline]
      }

      #v(8pt)

      #let contact-items = ()
      #if data.basics.email != "" { contact-items = contact-items + (data.basics.email,) }
      #if data.basics.phone != "" { contact-items = contact-items + (data.basics.phone,) }
      #if data.basics.location != "" { contact-items = contact-items + (data.basics.location,) }
      #if "url" in data.basics and data.basics.url != none and data.basics.url.href != "" { contact-items = contact-items + (link(data.basics.url.href)[#text(fill: white)[#data.basics.url.href]],) }

      #text(size: 8pt, fill: rgb("#e0f2fe"))[#contact-items.join("  |  ")]
    ]
  )

  // Two-column grid: sidebar (left) + main (right)
  grid(
    columns: (160pt, 1fr),
    column-gutter: 0pt,

    // Left column - sidebar with light teal background
    box(
      width: 100%,
      fill: sidebar-bg,
      inset: (x: 14pt, y: 12pt),
      [
        // Profiles
        #if data.sections.profiles.visible {
          sidebar-heading(data.sections.profiles.name)
          for item in data.sections.profiles.items {
            render-profile(item)
          }
        }

        // Skills
        #if data.sections.skills.visible {
          sidebar-heading(data.sections.skills.name)
          for item in data.sections.skills.items {
            render-skill(item)
          }
        }

        // Languages
        #if data.sections.languages.visible {
          sidebar-heading(data.sections.languages.name)
          for item in data.sections.languages.items {
            render-language(item)
          }
        }

        // Interests
        #if data.sections.interests.visible {
          sidebar-heading(data.sections.interests.name)
          for item in data.sections.interests.items {
            render-interest(item)
          }
        }
      ]
    ),

    // Right column - main content with internal padding
    box(
      width: 100%,
      inset: (x: 20pt, y: 12pt),
      [
        // Summary
        #if data.sections.summary.visible {
          section-heading(data.sections.summary.name)
          text(size: 9pt)[#data.sections.summary.content]
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
  )

  // Custom sections after grid
  if "custom" in data.sections {
    for (key, section) in data.sections.custom {
      if section.visible {
        box(
          width: 100%,
          inset: (x: 24pt, y: 0pt),
          [
            #section-heading(section.name)
            #for item in section.items {
              render-custom(item)
            }
          ]
        )
      }
    }
  }
}
