// Bronzor Template - Single-column linear layout
// Centered header with picture area, teal accents, contact icons
// Original: turbo-resume/apps/artboard/src/templates/bronzor.tsx

#import "_common.typ": *

#let primary-color = rgb("#0891b2")
#let text-color = rgb("#1f2937")
#let muted-color = rgb("#6b7280")

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
    align(right)[
      #text(size: 9pt, fill: muted-color)[#right-content]
    ]
  )
}

#let skill-bar(level) = {
  h(4pt)
  rating-indicators(level, 8pt, 8pt, primary-color, rgb("#e5e5e5"), 2pt, 2pt)
}

#let render-experience(item) = {
  if item.visible == false { return }

  entry-header(
    [
      #text(weight: "bold")[#item.company]
      #if item.position != "" [ — #item.position]
    ],
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
    let degree-text = format-degree(item.studyType, item.area)
    text(size: 10pt)[#degree-text]
    v(2pt)
  }

  if item.score != "" {
    text(size: 9pt, fill: muted-color)[#item.score]
  }

  if item.summary != "" {
    v(2pt)
    text(size: 9pt)[#item.summary]
  }

  v(10pt)
}

#let render-skill(item) = {
  if item.visible == false { return }

  grid(
    columns: (1fr, auto),
    [
      #text(size: 10pt, weight: "bold")[#item.name]
      #if item.description != "" {
        v(1pt)
        text(size: 9pt)[#item.description]
      }
    ],
    skill-bar(item.level)
  )

  if has-keywords(item) {
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
      #text(size: 10pt, weight: "bold")[#item.name]
      #if item.description != "" {
        v(1pt)
        text(size: 9pt)[#item.description]
      }
    ],
    skill-bar(item.level)
  )

  v(6pt)
}

#let render-profile(item) = {
  if item.visible == false { return }

  if has-url(item) {
    let label = if item.username != "" { item.username } else { item.url.href }
    link(item.url.href)[#text(fill: primary-color)[#label]]
  } else {
    [#item.network: #item.username]
  }
  v(4pt)
}

#let render-project(item) = {
  if item.visible == false { return }

  entry-header(
    [#text(weight: "bold", size: 10pt)[#item.name]],
    item.date
  )

  if item.description != "" {
    v(2pt)
    text(size: 10pt)[#item.description]
  }

  if item.summary != "" {
    v(2pt)
    text(size: 10pt)[#item.summary]
  }

  if has-keywords(item) {
    v(2pt)
    text(size: 9pt, fill: muted-color)[#item.keywords.join(", ")]
  }

  v(8pt)
}

#let render-certification(item) = {
  if item.visible == false { return }

  entry-header(
    [
      #text(weight: "bold")[#item.name]
      #if item.issuer != "" {
        text(fill: muted-color)[ — #item.issuer]
      }
    ],
    item.date
  )

  if item.summary != "" {
    v(2pt)
    text(size: 9pt)[#item.summary]
  }

  v(8pt)
}

#let render-award(item) = {
  if item.visible == false { return }

  entry-header(
    [
      #text(weight: "bold")[#item.title]
      #if item.awarder != "" {
        text(fill: muted-color)[ — #item.awarder]
      }
    ],
    item.date
  )

  if item.summary != "" {
    v(2pt)
    text(size: 9pt)[#item.summary]
  }

  v(8pt)
}

#let render-interest(item) = {
  if item.visible == false { return }

  text(size: 10pt, weight: "bold")[#item.name]

  if has-keywords(item) {
    text(size: 9pt, fill: muted-color)[ — #item.keywords.join(", ")]
  }

  v(4pt)
}

#let render-publication(item) = {
  if item.visible == false { return }

  entry-header(
    [
      #text(weight: "bold")[#item.name]
      #if item.publisher != "" {
        v(1pt)
        text(size: 9pt)[#item.publisher]
      }
    ],
    item.date
  )

  if item.summary != "" {
    v(2pt)
    text(size: 9pt)[#item.summary]
  }

  v(8pt)
}

#let render-volunteer(item) = {
  if item.visible == false { return }

  entry-header(
    [
      #text(weight: "bold")[#item.organization]
      #if item.position != "" [ — #item.position]
    ],
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

#let render-reference(item) = {
  if item.visible == false { return }

  text(weight: "bold")[#item.name]

  if item.description != "" {
    v(2pt)
    text(size: 9pt)[#item.description]
  }

  if item.summary != "" {
    v(2pt)
    text(size: 9pt)[#item.summary]
  }

  v(8pt)
}

#let render-custom(item) = {
  if item.visible == false { return }

  entry-header(
    [
      #text(weight: "bold")[#item.name]
      #if item.description != "" {
        v(1pt)
        text(size: 9pt)[#item.description]
      }
    ],
    item.date
  )

  if item.location != "" {
    text(size: 9pt, fill: muted-color)[#item.location]
  }

  if item.summary != "" {
    v(2pt)
    text(size: 9pt)[#item.summary]
  }

  if has-keywords(item) {
    v(2pt)
    text(size: 9pt, fill: muted-color)[#item.keywords.join(", ")]
  }

  v(8pt)
}

#let template(data) = {
  set page(
    margin: (x: 48pt, y: 48pt),
  )

  set text(
    font: "IBM Plex Sans",
    size: 10pt,
    fill: text-color,
  )

  set par(
    leading: 0.65em,
    justify: true,
  )

  // Header - centered with picture area
  align(center)[
    // Picture area
    #if "picture" in data.basics and data.basics.picture != none and "url" in data.basics.picture and data.basics.picture.url != "" {
      box(
        width: 64pt,
        height: 64pt,
        radius: 50%,
        clip: true,
        stroke: 1.5pt + primary-color,
        image(data.basics.picture.url, width: 64pt, height: 64pt, fit: "cover")
      )
      v(8pt)
    }

    // Name
    #text(size: 24pt, weight: "bold", fill: text-color)[#data.basics.name]

    // Headline
    #if data.basics.headline != "" {
      v(4pt)
      text(size: 12pt, fill: muted-color)[#data.basics.headline]
    }

    #v(8pt)

    // Contact items - wrapped horizontally
    #let contact-items = build-contact-items(data.basics)
    #if has-url(data.basics) {
      contact-items = contact-items + (link(data.basics.url.href)[#text(fill: primary-color)[#data.basics.url.href]],)
    }

    #text(size: 9pt)[#contact-items.join([#h(10pt)#text(fill: muted-color)[|]#h(10pt)])]
  ]

  v(8pt)
  line(length: 100%, stroke: 0.5pt + primary-color)
  v(8pt)

  // All sections flow linearly
  // Summary
  if data.sections.summary.visible {
    section-heading(data.sections.summary.name)
    text(size: 10pt)[#data.sections.summary.content]
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
