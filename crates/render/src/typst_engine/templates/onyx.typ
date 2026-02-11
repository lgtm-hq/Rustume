// Onyx Template - Clean professional design
// White background, red accents, horizontal header, single-column linear layout

#import "_common.typ": *

#let primary-color = rgb("#dc2626")
#let text-color = rgb("#111827")
#let muted-color = rgb("#6b7280")

#let section-heading(title) = {
  v(14pt)
  box(
    width: 100%,
    stroke: (bottom: 1.5pt + primary-color),
    inset: (bottom: 4pt),
    text(weight: "bold", size: 10pt, fill: primary-color, tracking: 0.06em)[#upper(title)]
  )
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

#let rating-squares(level) = {
  rating-indicators(level, 8pt, 8pt, primary-color, rgb("#e5e7eb"), 0pt, 2pt)
}

#let render-experience(item) = {
  if item.visible == false { return }

  entry-header(
    [
      #text(weight: "bold", size: 11pt, fill: text-color)[#item.position]
      #v(2pt)
      #text(size: 10pt, fill: primary-color)[#item.company]
      #if item.location != "" {
        text(size: 9pt, fill: muted-color)[ · #item.location]
      }
    ],
    item.date
  )

  if item.summary != "" {
    v(6pt)
    text(size: 10pt, fill: text-color)[#item.summary]
  }

  v(12pt)
}

#let render-education(item) = {
  if item.visible == false { return }

  entry-header(
    [
      #text(weight: "bold", size: 11pt, fill: text-color)[#item.institution]
      #if item.studyType != "" or item.area != "" {
        v(2pt)
        let degree = format-degree(item.studyType, item.area)
        text(size: 10pt, fill: text-color)[#degree]
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
    text(size: 10pt, fill: text-color)[#item.summary]
  }

  v(12pt)
}

#let render-skill(item) = {
  if item.visible == false { return }

  grid(
    columns: (1fr, auto),
    column-gutter: 8pt,
    [
      #text(size: 10pt, weight: "medium", fill: text-color)[#item.name]
      #if item.description != "" {
        v(1pt)
        text(size: 9pt, fill: muted-color)[#item.description]
      }
    ],
    rating-squares(item.level)
  )

  if has-keywords(item) {
    v(2pt)
    for keyword in item.keywords {
      box(
        fill: rgb("#fef2f2"),
        radius: 3pt,
        inset: (x: 6pt, y: 2pt),
        text(size: 8pt, fill: primary-color)[#keyword]
      )
      h(4pt)
    }
  }

  v(8pt)
}

#let render-language(item) = {
  if item.visible == false { return }

  grid(
    columns: (1fr, auto),
    column-gutter: 8pt,
    [
      #text(size: 10pt, weight: "medium", fill: text-color)[#item.name]
      #if item.description != "" {
        h(6pt)
        text(size: 9pt, fill: muted-color)[#item.description]
      }
    ],
    rating-squares(item.level)
  )

  v(6pt)
}

#let render-profile(item) = {
  if item.visible == false { return }

  if has-url(item) {
    link(item.url.href)[#text(fill: primary-color)[#item.network]]
  } else {
    text(size: 10pt, fill: text-color)[#item.network: #item.username]
  }
  h(14pt)
}

#let render-project(item) = {
  if item.visible == false { return }

  entry-header(
    [#text(weight: "bold", size: 10pt, fill: text-color)[#item.name]],
    item.date
  )

  if item.description != "" {
    v(4pt)
    text(size: 10pt, fill: text-color)[#item.description]
  }

  if item.summary != "" {
    v(4pt)
    text(size: 10pt, fill: text-color)[#item.summary]
  }

  if has-keywords(item) {
    v(4pt)
    for keyword in item.keywords {
      box(
        fill: rgb("#fef2f2"),
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
      #text(weight: "medium", size: 10pt, fill: text-color)[#item.name]
      #if item.issuer != "" {
        text(size: 9pt, fill: muted-color)[ — #item.issuer]
      }
    ],
    item.date
  )

  if item.summary != "" {
    v(2pt)
    text(size: 9pt, fill: text-color)[#item.summary]
  }

  v(8pt)
}

#let render-award(item) = {
  if item.visible == false { return }

  entry-header(
    [
      #text(weight: "medium", size: 10pt, fill: text-color)[#item.title]
      #if item.awarder != "" {
        text(size: 9pt, fill: muted-color)[ — #item.awarder]
      }
    ],
    item.date
  )

  if item.summary != "" {
    v(2pt)
    text(size: 9pt, fill: text-color)[#item.summary]
  }

  v(8pt)
}

#let render-interest(item) = {
  if item.visible == false { return }

  text(size: 10pt, weight: "medium", fill: text-color)[#item.name]

  if has-keywords(item) {
    text(size: 9pt, fill: muted-color)[ — #item.keywords.join(", ")]
  }

  v(6pt)
}

#let render-publication(item) = {
  if item.visible == false { return }

  entry-header(
    [
      #text(weight: "bold", size: 10pt, fill: text-color)[#item.name]
      #if item.publisher != "" {
        v(1pt)
        text(size: 9pt, fill: muted-color)[#item.publisher]
      }
    ],
    item.date
  )

  if item.summary != "" {
    v(4pt)
    text(size: 9pt, fill: text-color)[#item.summary]
  }

  v(8pt)
}

#let render-volunteer(item) = {
  if item.visible == false { return }

  entry-header(
    [
      #text(weight: "bold", size: 11pt, fill: text-color)[#item.organization]
      #if item.position != "" {
        text(size: 10pt, fill: text-color)[ — #item.position]
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
    text(size: 10pt, fill: text-color)[#item.summary]
  }

  v(12pt)
}

#let render-reference(item) = {
  if item.visible == false { return }

  text(weight: "bold", size: 10pt, fill: text-color)[#item.name]

  if item.description != "" {
    v(2pt)
    text(size: 9pt, fill: muted-color)[#item.description]
  }

  if item.summary != "" {
    v(2pt)
    text(size: 9pt, fill: text-color)[#item.summary]
  }

  v(8pt)
}

#let render-custom(item) = {
  if item.visible == false { return }

  entry-header(
    [
      #text(weight: "bold", size: 10pt, fill: text-color)[#item.name]
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
    text(size: 9pt, fill: text-color)[#item.summary]
  }

  if has-keywords(item) {
    v(2pt)
    for keyword in item.keywords {
      box(
        fill: rgb("#fef2f2"),
        radius: 3pt,
        inset: (x: 6pt, y: 2pt),
        text(size: 8pt, fill: primary-color)[#keyword]
      )
      h(4pt)
    }
  }

  v(8pt)
}

#let template(data) = {
  set page(
    paper: "a4",
    margin: (x: 48pt, y: 48pt),
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

  // Header - horizontal flex: name/headline left, contact info stacked right
  grid(
    columns: (1fr, auto),
    column-gutter: 16pt,
    [
      #text(size: 26pt, weight: "bold", fill: text-color)[#data.basics.name]

      #if data.basics.headline != "" {
        v(4pt)
        text(size: 12pt, fill: primary-color)[#data.basics.headline]
      }
    ],
    align(right)[
      #let contact-items = build-contact-items(data.basics)
      #if has-url(data.basics) { contact-items = contact-items + (link(data.basics.url.href)[#text(fill: primary-color)[#data.basics.url.href]],) }

      #for item in contact-items {
        text(size: 9pt, fill: muted-color)[#item]
        v(2pt)
      }
    ]
  )

  v(8pt)
  line(length: 100%, stroke: 1.5pt + primary-color)
  v(8pt)

  // Summary
  if data.sections.summary.visible {
    section-heading(data.sections.summary.name)
    text(size: 10pt, fill: text-color)[#data.sections.summary.content]
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

  // Awards
  if data.sections.awards.visible {
    section-heading(data.sections.awards.name)
    for item in data.sections.awards.items {
      render-award(item)
    }
  }

  // Certifications
  if data.sections.certifications.visible {
    section-heading(data.sections.certifications.name)
    for item in data.sections.certifications.items {
      render-certification(item)
    }
  }

  // Skills
  if data.sections.skills.visible {
    section-heading(data.sections.skills.name)
    for item in data.sections.skills.items {
      render-skill(item)
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
    for item in data.sections.publications.items {
      render-publication(item)
    }
  }

  // Volunteer
  if data.sections.volunteer.visible {
    section-heading(data.sections.volunteer.name)
    for item in data.sections.volunteer.items {
      render-volunteer(item)
    }
  }

  // Languages
  if data.sections.languages.visible {
    section-heading(data.sections.languages.name)
    for item in data.sections.languages.items {
      render-language(item)
    }
  }

  // Projects
  if data.sections.projects.visible {
    section-heading(data.sections.projects.name)
    for item in data.sections.projects.items {
      render-project(item)
    }
  }

  // References
  if data.sections.references.visible {
    section-heading(data.sections.references.name)
    for item in data.sections.references.items {
      render-reference(item)
    }
  }

  // Custom sections
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
