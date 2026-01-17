// Azurill Template - Minimal, single column design
// Clean and simple with ample whitespace and amber accent

#let primary-color = rgb("#d97706")
#let text-color = rgb("#1f2937")
#let muted-color = rgb("#6b7280")
#let light-bg = rgb("#fef3c7")

#let section-heading(title) = {
  v(16pt)
  text(weight: "semibold", size: 10pt, fill: primary-color, tracking: 0.1em)[#upper(title)]
  v(8pt)
}

#let entry-date(date) = {
  text(size: 9pt, fill: muted-color)[#date]
}

#let render-experience(item) = {
  if item.visible == false { return }

  grid(
    columns: (1fr, auto),
    column-gutter: 16pt,
    [
      #text(weight: "bold", size: 11pt)[#item.position]
      #if item.company != "" {
        text(size: 10pt, fill: muted-color)[ at #item.company]
      }
    ],
    entry-date(item.date)
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

  grid(
    columns: (1fr, auto),
    column-gutter: 16pt,
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
    entry-date(item.date)
  )

  if item.score != "" {
    v(2pt)
    text(size: 9pt, fill: muted-color)[#item.score]
  }

  v(14pt)
}

#let render-skill(item) = {
  if item.visible == false { return }

  box(
    fill: light-bg,
    radius: 4pt,
    inset: (x: 8pt, y: 4pt),
    text(size: 9pt)[#item.name]
  )
  h(6pt)
}

#let render-language(item) = {
  if item.visible == false { return }

  text(size: 10pt)[#text(weight: "medium")[#item.name]]
  if item.description != "" {
    text(size: 9pt, fill: muted-color)[ — #item.description]
  }
  v(6pt)
}

#let render-profile(item) = {
  if item.visible == false { return }

  if item.url.href != "" {
    link(item.url.href)[#text(fill: primary-color)[#item.network]]
  } else {
    text(size: 10pt)[#item.network: #item.username]
  }
  h(16pt)
}

#let render-project(item) = {
  if item.visible == false { return }

  text(weight: "bold", size: 10pt)[#item.name]

  if item.description != "" {
    v(4pt)
    text(size: 10pt)[#item.description]
  }

  if item.keywords.len() > 0 {
    v(4pt)
    for keyword in item.keywords {
      box(
        fill: light-bg,
        radius: 3pt,
        inset: (x: 6pt, y: 2pt),
        text(size: 8pt)[#keyword]
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
    [
      #text(weight: "medium", size: 10pt)[#item.name]
      #if item.issuer != "" {
        text(size: 9pt, fill: muted-color)[ — #item.issuer]
      }
    ],
    entry-date(item.date)
  )

  v(8pt)
}

#let render-award(item) = {
  if item.visible == false { return }

  grid(
    columns: (1fr, auto),
    [
      #text(weight: "medium", size: 10pt)[#item.title]
      #if item.awarder != "" {
        text(size: 9pt, fill: muted-color)[ — #item.awarder]
      }
    ],
    entry-date(item.date)
  )

  v(8pt)
}

#let render-interest(item) = {
  if item.visible == false { return }

  box(
    fill: light-bg,
    radius: 4pt,
    inset: (x: 8pt, y: 4pt),
    text(size: 9pt)[#item.name]
  )
  h(6pt)
}

#let template(data) = {
  // Page setup
  set page(
    paper: "a4",
    margin: (x: 56pt, y: 56pt),
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

  // Header - Centered, minimal
  align(center)[
    #text(size: 28pt, weight: "light", tracking: 0.05em)[#data.basics.name]

    #if data.basics.headline != "" {
      v(6pt)
      text(size: 11pt, fill: muted-color)[#data.basics.headline]
    }

    #v(12pt)

    // Contact as horizontal list
    #let contact-items = ()
    #if data.basics.email != "" { contact-items.push(link("mailto:" + data.basics.email)[#data.basics.email]) }
    #if data.basics.phone != "" { contact-items.push(data.basics.phone) }
    #if data.basics.location != "" { contact-items.push(data.basics.location) }
    #if data.basics.url.href != "" { contact-items.push(link(data.basics.url.href)[#data.basics.url.href]) }

    #text(size: 9pt, fill: muted-color)[#contact-items.join("  ·  ")]
  ]

  v(24pt)

  // Summary
  if data.sections.summary.visible and data.sections.summary.content != "" {
    text(size: 10pt, style: "italic", fill: muted-color)[#data.sections.summary.content]
    v(8pt)
  }

  // Profiles - inline
  if data.sections.profiles.visible and data.sections.profiles.items.len() > 0 {
    for item in data.sections.profiles.items {
      render-profile(item)
    }
    v(8pt)
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

  // Projects
  if data.sections.projects.visible and data.sections.projects.items.len() > 0 {
    section-heading(data.sections.projects.name)
    for item in data.sections.projects.items {
      render-project(item)
    }
  }

  // Skills - as tags
  if data.sections.skills.visible and data.sections.skills.items.len() > 0 {
    section-heading(data.sections.skills.name)
    for item in data.sections.skills.items {
      render-skill(item)
    }
    v(8pt)
  }

  // Languages
  if data.sections.languages.visible and data.sections.languages.items.len() > 0 {
    section-heading(data.sections.languages.name)
    for item in data.sections.languages.items {
      render-language(item)
    }
  }

  // Certifications
  if data.sections.certifications.visible and data.sections.certifications.items.len() > 0 {
    section-heading(data.sections.certifications.name)
    for item in data.sections.certifications.items {
      render-certification(item)
    }
  }

  // Awards
  if data.sections.awards.visible and data.sections.awards.items.len() > 0 {
    section-heading(data.sections.awards.name)
    for item in data.sections.awards.items {
      render-award(item)
    }
  }

  // Interests - as tags
  if data.sections.interests.visible and data.sections.interests.items.len() > 0 {
    section-heading(data.sections.interests.name)
    for item in data.sections.interests.items {
      render-interest(item)
    }
  }
}
