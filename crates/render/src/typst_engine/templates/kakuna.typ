// Kakuna Template - Brown/tan minimal warm tones
// Single-column linear layout, centered header in bordered box
// Original: turbo-resume/apps/artboard/src/templates/kakuna.tsx

#let primary-color = rgb("#78716c")
#let text-color = rgb("#422006")
#let muted-color = rgb("#a8a29e")
#let light-bg = rgb("#faf5f0")
#let border-color = rgb("#d6d3d1")

#let section-heading(title) = {
  v(16pt)
  grid(
    columns: (auto, 1fr),
    column-gutter: 10pt,
    text(weight: "semibold", size: 10pt, fill: primary-color, tracking: 0.06em)[#upper(title)],
    line(start: (0pt, 5pt), length: 100%, stroke: 0.75pt + primary-color)
  )
  v(10pt)
}

#let skill-bar(level) = {
  let level = calc.min(calc.max(level, 0), 5)
  h(4pt)
  for i in range(level) {
    box(width: 8pt, height: 8pt, fill: primary-color, radius: 50%)
    h(2pt)
  }
  for i in range(5 - level) {
    box(width: 8pt, height: 8pt, fill: border-color, radius: 50%)
    h(2pt)
  }
}

#let entry-header(left-content, right-content) = {
  grid(
    columns: (1fr, auto),
    column-gutter: 12pt,
    left-content,
    align(right, text(size: 9pt, fill: muted-color)[#right-content])
  )
}

#let render-experience(item) = {
  if item.visible == false { return }

  entry-header(
    [
      #text(weight: "semibold", size: 10pt)[#item.position]
      #if item.company != "" {
        text(size: 10pt, fill: muted-color)[ — #item.company]
      }
    ],
    item.date
  )

  if item.location != "" {
    v(2pt)
    text(size: 9pt, fill: muted-color)[#item.location]
  }

  if item.summary != "" {
    v(6pt)
    text(size: 10pt)[#item.summary]
  }

  v(14pt)
}

#let render-education(item) = {
  if item.visible == false { return }

  entry-header(
    [
      #text(weight: "semibold", size: 10pt)[#item.institution]
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
    item.date
  )

  if item.score != "" {
    v(2pt)
    text(size: 9pt, fill: muted-color)[#item.score]
  }

  if item.summary != "" {
    v(4pt)
    text(size: 10pt)[#item.summary]
  }

  v(14pt)
}

#let render-skill(item) = {
  if item.visible == false { return }

  grid(
    columns: (1fr, auto),
    [
      #text(size: 10pt, weight: "medium")[#item.name]
      #if item.description != "" {
        v(1pt)
        text(size: 9pt, fill: muted-color)[#item.description]
      }
    ],
    skill-bar(item.level)
  )

  if item.keywords.len() > 0 {
    v(2pt)
    text(size: 9pt, fill: muted-color)[#item.keywords.join(", ")]
  }

  v(8pt)
}

#let render-language(item) = {
  if item.visible == false { return }

  grid(
    columns: (1fr, auto),
    [
      #text(size: 10pt, weight: "medium")[#item.name]
      #if item.description != "" {
        v(1pt)
        text(size: 9pt, fill: muted-color)[#item.description]
      }
    ],
    skill-bar(item.level)
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
  h(14pt)
}

#let render-project(item) = {
  if item.visible == false { return }

  entry-header(
    [#text(weight: "semibold", size: 10pt)[#item.name]],
    item.date
  )

  if item.description != "" {
    v(4pt)
    text(size: 10pt)[#item.description]
  }

  if item.summary != "" {
    v(4pt)
    text(size: 10pt)[#item.summary]
  }

  if "keywords" in item and item.keywords != none and item.keywords.len() > 0 {
    v(4pt)
    for keyword in item.keywords {
      box(
        fill: light-bg,
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

  entry-header(
    [
      #text(weight: "medium", size: 10pt)[#item.name]
      #if item.issuer != "" {
        text(size: 9pt, fill: muted-color)[ — #item.issuer]
      }
    ],
    item.date
  )

  if item.summary != "" {
    v(4pt)
    text(size: 9pt)[#item.summary]
  }

  v(8pt)
}

#let render-award(item) = {
  if item.visible == false { return }

  entry-header(
    [
      #text(weight: "medium", size: 10pt)[#item.title]
      #if item.awarder != "" {
        text(size: 9pt, fill: muted-color)[ — #item.awarder]
      }
    ],
    item.date
  )

  if item.summary != "" {
    v(4pt)
    text(size: 9pt)[#item.summary]
  }

  v(8pt)
}

#let render-interest(item) = {
  if item.visible == false { return }

  text(size: 10pt, weight: "medium")[#item.name]

  if item.keywords.len() > 0 {
    text(size: 9pt, fill: muted-color)[ — #item.keywords.join(", ")]
  }

  v(6pt)
}

#let render-publication(item) = {
  if item.visible == false { return }

  entry-header(
    [
      #text(weight: "semibold", size: 10pt)[#item.name]
      #if item.publisher != "" {
        v(1pt)
        text(size: 9pt, fill: muted-color)[#item.publisher]
      }
    ],
    item.date
  )

  if item.summary != "" {
    v(4pt)
    text(size: 9pt)[#item.summary]
  }

  v(8pt)
}

#let render-volunteer(item) = {
  if item.visible == false { return }

  entry-header(
    [
      #text(weight: "semibold", size: 10pt)[#item.organization]
      #if item.position != "" {
        text(size: 10pt, fill: muted-color)[ — #item.position]
      }
    ],
    item.date
  )

  if item.location != "" {
    v(2pt)
    text(size: 9pt, fill: muted-color)[#item.location]
  }

  if item.summary != "" {
    v(6pt)
    text(size: 10pt)[#item.summary]
  }

  v(14pt)
}

#let render-reference(item) = {
  if item.visible == false { return }

  text(weight: "semibold", size: 10pt)[#item.name]

  if item.description != "" {
    v(2pt)
    text(size: 9pt, fill: muted-color)[#item.description]
  }

  if item.summary != "" {
    v(4pt)
    text(size: 9pt)[#item.summary]
  }

  v(8pt)
}

#let render-custom(item) = {
  if item.visible == false { return }

  entry-header(
    [
      #text(weight: "semibold", size: 10pt)[#item.name]
      #if item.description != "" {
        v(1pt)
        text(size: 9pt)[#item.description]
      }
    ],
    item.date
  )

  if item.location != "" {
    v(2pt)
    text(size: 9pt, fill: muted-color)[#item.location]
  }

  if item.summary != "" {
    v(4pt)
    text(size: 9pt)[#item.summary]
  }

  if "keywords" in item and item.keywords != none and item.keywords.len() > 0 {
    v(2pt)
    text(size: 9pt, fill: muted-color)[#item.keywords.join(", ")]
  }

  v(8pt)
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
    leading: 0.7em,
    justify: false,
  )

  // Centered header in bordered box
  align(center)[
    #box(
      width: 100%,
      stroke: 1pt + border-color,
      radius: 4pt,
      inset: (x: 24pt, y: 20pt),
      [
        #text(size: 24pt, weight: "light", fill: text-color, tracking: 0.03em)[#data.basics.name]

        #if data.basics.headline != "" {
          v(6pt)
          text(size: 11pt, fill: primary-color)[#data.basics.headline]
        }

        #v(10pt)

        #let contact-items = ()
        #if data.basics.email != "" { contact-items = contact-items + (data.basics.email,) }
        #if data.basics.phone != "" { contact-items = contact-items + (data.basics.phone,) }
        #if data.basics.location != "" { contact-items = contact-items + (data.basics.location,) }
        #if "url" in data.basics and data.basics.url != none and data.basics.url.href != "" { contact-items = contact-items + (link(data.basics.url.href)[#data.basics.url.href],) }

        #text(size: 9pt, fill: muted-color)[#contact-items.join("  ·  ")]
      ]
    )
  ]

  v(8pt)

  // Summary
  if data.sections.summary.visible and data.sections.summary.content != "" {
    section-heading(data.sections.summary.name)
    text(size: 10pt)[#data.sections.summary.content]
  }

  // Profiles
  if data.sections.profiles.visible and data.sections.profiles.items.len() > 0 {
    section-heading(data.sections.profiles.name)
    for item in data.sections.profiles.items {
      render-profile(item)
    }
  }

  // Experience
  if data.sections.experience.visible and data.sections.experience.items.len() > 0 {
    section-heading(data.sections.experience.name)
    for item in data.sections.experience.items {
      render-experience(item)
    }
  }

  // Education
  if data.sections.education.visible and data.sections.education.items.len() > 0 {
    section-heading(data.sections.education.name)
    for item in data.sections.education.items {
      render-education(item)
    }
  }

  // Awards
  if data.sections.awards.visible and data.sections.awards.items.len() > 0 {
    section-heading(data.sections.awards.name)
    for item in data.sections.awards.items {
      render-award(item)
    }
  }

  // Certifications
  if data.sections.certifications.visible and data.sections.certifications.items.len() > 0 {
    section-heading(data.sections.certifications.name)
    for item in data.sections.certifications.items {
      render-certification(item)
    }
  }

  // Skills
  if data.sections.skills.visible and data.sections.skills.items.len() > 0 {
    section-heading(data.sections.skills.name)
    for item in data.sections.skills.items {
      render-skill(item)
    }
  }

  // Interests
  if data.sections.interests.visible and data.sections.interests.items.len() > 0 {
    section-heading(data.sections.interests.name)
    for item in data.sections.interests.items {
      render-interest(item)
    }
  }

  // Publications
  if data.sections.publications.visible and data.sections.publications.items.len() > 0 {
    section-heading(data.sections.publications.name)
    for item in data.sections.publications.items {
      render-publication(item)
    }
  }

  // Volunteer
  if data.sections.volunteer.visible and data.sections.volunteer.items.len() > 0 {
    section-heading(data.sections.volunteer.name)
    for item in data.sections.volunteer.items {
      render-volunteer(item)
    }
  }

  // Languages
  if data.sections.languages.visible and data.sections.languages.items.len() > 0 {
    section-heading(data.sections.languages.name)
    for item in data.sections.languages.items {
      render-language(item)
    }
  }

  // Projects
  if data.sections.projects.visible and data.sections.projects.items.len() > 0 {
    section-heading(data.sections.projects.name)
    for item in data.sections.projects.items {
      render-project(item)
    }
  }

  // References
  if data.sections.references.visible and data.sections.references.items.len() > 0 {
    section-heading(data.sections.references.name)
    for item in data.sections.references.items {
      render-reference(item)
    }
  }

  // Custom sections
  if "custom" in data.sections {
    for (key, section) in data.sections.custom {
      if section.visible and section.items.len() > 0 {
        section-heading(section.name)
        for item in section.items {
          render-custom(item)
        }
      }
    }
  }
}
