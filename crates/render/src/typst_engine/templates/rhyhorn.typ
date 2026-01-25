// Rhyhorn Template - Clean, minimal design with accent colors
// This template uses a two-column layout with the main content on the left
// and skills/languages/etc on the right

#let primary-color = rgb("#dc2626")
#let text-color = rgb("#000000")
#let muted-color = rgb("#666666")

#let section-heading(title) = {
  v(12pt)
  text(weight: "bold", size: 11pt, fill: primary-color)[#upper(title)]
  v(2pt)
  line(length: 100%, stroke: 0.5pt + primary-color)
  v(6pt)
}

#let entry-header(left-content, right-content) = {
  grid(
    columns: (1fr, auto),
    column-gutter: 8pt,
    left-content,
    text(size: 9pt, fill: muted-color)[#right-content]
  )
}

#let skill-bar(level) = {
  // Clamp level to valid range [0, 5]
  let level = calc.min(calc.max(level, 0), 5)
  let filled = level
  let empty = 5 - level
  h(4pt)
  for i in range(filled) {
    box(width: 8pt, height: 8pt, fill: primary-color, radius: 2pt)
    h(2pt)
  }
  for i in range(empty) {
    box(width: 8pt, height: 8pt, fill: rgb("#e5e5e5"), radius: 2pt)
    h(2pt)
  }
}

#let render-experience(item) = {
  if item.visible == false { return }

  entry-header(
    [#text(weight: "bold")[#item.company] #if item.position != "" [— #item.position]],
    item.date
  )

  if item.location != "" {
    text(size: 9pt, fill: muted-color)[#item.location]
    v(2pt)
  }

  if item.summary != "" {
    v(4pt)
    text(size: 10pt)[#item.summary]
  }

  v(10pt)
}

#let render-education(item) = {
  if item.visible == false { return }

  entry-header(
    [#text(weight: "bold")[#item.institution]],
    item.date
  )

  if item.area != "" or item.studyType != "" {
    let degree-text = if item.studyType != "" and item.area != "" {
      [#item.studyType in #item.area]
    } else if item.area != "" {
      item.area
    } else {
      item.studyType
    }
    text(size: 10pt)[#degree-text]
    v(2pt)
  }

  if item.score != "" {
    text(size: 9pt, fill: muted-color)[#item.score]
  }

  v(10pt)
}

#let render-skill(item) = {
  if item.visible == false { return }

  grid(
    columns: (1fr, auto),
    text(size: 10pt)[#item.name],
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
    text(size: 10pt)[#item.name],
    skill-bar(item.level)
  )

  if item.description != "" {
    text(size: 9pt, fill: muted-color)[#item.description]
  }

  v(6pt)
}

#let render-profile(item) = {
  if item.visible == false { return }

  if "url" in item and item.url != none and item.url.href != "" {
    link(item.url.href)[#item.network: #item.username]
  } else {
    [#item.network: #item.username]
  }
  v(4pt)
}

#let render-project(item) = {
  if item.visible == false { return }

  text(weight: "bold", size: 10pt)[#item.name]

  if item.description != "" {
    v(2pt)
    text(size: 10pt)[#item.description]
  }

  if item.keywords.len() > 0 {
    v(2pt)
    text(size: 9pt, fill: muted-color)[#item.keywords.join(", ")]
  }

  v(8pt)
}

#let render-certification(item) = {
  if item.visible == false { return }

  entry-header(
    [#text(weight: "bold")[#item.name]],
    item.date
  )

  if item.issuer != "" {
    text(size: 9pt, fill: muted-color)[#item.issuer]
  }

  v(8pt)
}

#let render-award(item) = {
  if item.visible == false { return }

  entry-header(
    [#text(weight: "bold")[#item.title]],
    item.date
  )

  if item.awarder != "" {
    text(size: 9pt, fill: muted-color)[#item.awarder]
  }

  v(8pt)
}

#let render-interest(item) = {
  if item.visible == false { return }

  text(size: 10pt)[#item.name]

  if item.keywords.len() > 0 {
    text(size: 9pt, fill: muted-color)[ — #item.keywords.join(", ")]
  }

  v(4pt)
}

#let template(data) = {
  // Page setup
  set page(
    paper: "a4",
    margin: (x: 48pt, y: 48pt),
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

  // Header
  align(center)[
    #text(size: 24pt, weight: "bold")[#data.basics.name]

    #if data.basics.headline != "" {
      v(4pt)
      text(size: 12pt, fill: primary-color)[#data.basics.headline]
    }

    #v(8pt)

    #let contact-items = ()
    #if data.basics.email != "" { contact-items = contact-items + (data.basics.email,) }
    #if data.basics.phone != "" { contact-items = contact-items + (data.basics.phone,) }
    #if data.basics.location != "" { contact-items = contact-items + (data.basics.location,) }
    #if "url" in data.basics and data.basics.url != none and data.basics.url.href != "" { contact-items = contact-items + (link(data.basics.url.href)[#data.basics.url.href],) }

    #text(size: 9pt)[#contact-items.join(" · ")]
  ]

  v(16pt)
  line(length: 100%, stroke: 0.5pt + primary-color)
  v(16pt)

  // Two column layout
  grid(
    columns: (2fr, 1fr),
    column-gutter: 24pt,

    // Left column - main content
    [
      // Summary
      #if data.sections.summary.visible and data.sections.summary.content != "" {
        section-heading(data.sections.summary.name)
        text(size: 10pt)[#data.sections.summary.content]
      }

      // Experience
      #if data.sections.experience.visible and data.sections.experience.items.len() > 0 {
        section-heading(data.sections.experience.name)
        for item in data.sections.experience.items {
          render-experience(item)
        }
      }

      // Education
      #if data.sections.education.visible and data.sections.education.items.len() > 0 {
        section-heading(data.sections.education.name)
        for item in data.sections.education.items {
          render-education(item)
        }
      }

      // Projects
      #if data.sections.projects.visible and data.sections.projects.items.len() > 0 {
        section-heading(data.sections.projects.name)
        for item in data.sections.projects.items {
          render-project(item)
        }
      }
    ],

    // Right column - sidebar
    [
      // Profiles
      #if data.sections.profiles.visible and data.sections.profiles.items.len() > 0 {
        section-heading(data.sections.profiles.name)
        for item in data.sections.profiles.items {
          render-profile(item)
        }
      }

      // Skills
      #if data.sections.skills.visible and data.sections.skills.items.len() > 0 {
        section-heading(data.sections.skills.name)
        for item in data.sections.skills.items {
          render-skill(item)
        }
      }

      // Languages
      #if data.sections.languages.visible and data.sections.languages.items.len() > 0 {
        section-heading(data.sections.languages.name)
        for item in data.sections.languages.items {
          render-language(item)
        }
      }

      // Certifications
      #if data.sections.certifications.visible and data.sections.certifications.items.len() > 0 {
        section-heading(data.sections.certifications.name)
        for item in data.sections.certifications.items {
          render-certification(item)
        }
      }

      // Awards
      #if data.sections.awards.visible and data.sections.awards.items.len() > 0 {
        section-heading(data.sections.awards.name)
        for item in data.sections.awards.items {
          render-award(item)
        }
      }

      // Interests
      #if data.sections.interests.visible and data.sections.interests.items.len() > 0 {
        section-heading(data.sections.interests.name)
        for item in data.sections.interests.items {
          render-interest(item)
        }
      }
    ]
  )
}
