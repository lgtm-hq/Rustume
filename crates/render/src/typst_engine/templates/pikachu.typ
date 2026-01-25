// Pikachu Template - Modern design with colored sidebar
// Features a bold yellow sidebar with contact info and skills

#let primary-color = rgb("#ca8a04")
#let sidebar-bg = rgb("#fef9c3")
#let text-color = rgb("#1c1917")
#let muted-color = rgb("#78716c")
#let white = rgb("#ffffff")

#let sidebar-section(title) = {
  v(12pt)
  text(weight: "bold", size: 9pt, fill: primary-color, tracking: 0.08em)[#upper(title)]
  v(6pt)
}

#let main-section(title) = {
  v(14pt)
  box(
    fill: primary-color,
    inset: (x: 8pt, y: 4pt),
    radius: 2pt,
    text(weight: "bold", size: 10pt, fill: white, tracking: 0.05em)[#upper(title)]
  )
  v(10pt)
}

#let skill-dots(level) = {
  let level = calc.min(calc.max(level, 0), 5)
  let filled = level
  let empty = 5 - level
  for i in range(filled) {
    box(width: 6pt, height: 6pt, fill: primary-color, radius: 50%)
    h(3pt)
  }
  for i in range(empty) {
    box(width: 6pt, height: 6pt, fill: rgb("#d6d3d1"), radius: 50%)
    h(3pt)
  }
}

#let render-experience(item) = {
  if item.visible == false { return }

  text(weight: "bold", size: 11pt)[#item.position]
  v(2pt)
  text(size: 10pt, fill: primary-color)[#item.company]
  h(8pt)
  text(size: 9pt, fill: muted-color)[#item.date]

  if item.location != "" {
    v(2pt)
    text(size: 9pt, fill: muted-color)[📍 #item.location]
  }

  if item.summary != "" {
    v(6pt)
    text(size: 10pt)[#item.summary]
  }

  v(14pt)
}

#let render-education(item) = {
  if item.visible == false { return }

  text(weight: "bold", size: 10pt)[#item.institution]
  v(2pt)

  if item.studyType != "" or item.area != "" {
    let degree = if item.studyType != "" and item.area != "" {
      [#item.studyType in #item.area]
    } else if item.area != "" {
      item.area
    } else {
      item.studyType
    }
    text(size: 10pt)[#degree]
    h(8pt)
  }

  text(size: 9pt, fill: muted-color)[#item.date]

  if item.score != "" {
    v(2pt)
    text(size: 9pt, fill: muted-color)[#item.score]
  }

  v(12pt)
}

#let render-skill(item) = {
  if item.visible == false { return }

  grid(
    columns: (1fr, auto),
    text(size: 9pt)[#item.name],
    skill-dots(item.level)
  )
  v(6pt)
}

#let render-language(item) = {
  if item.visible == false { return }

  grid(
    columns: (1fr, auto),
    text(size: 9pt)[#item.name],
    skill-dots(item.level)
  )

  if item.description != "" {
    text(size: 8pt, fill: muted-color)[#item.description]
  }

  v(6pt)
}

#let render-profile(item) = {
  if item.visible == false { return }

  if "url" in item and item.url != none and item.url.href != "" {
    link(item.url.href)[
      #text(size: 9pt, fill: text-color)[#item.network]
    ]
  } else {
    text(size: 9pt)[#item.network]
  }
  v(4pt)
}

#let render-project(item) = {
  if item.visible == false { return }

  text(weight: "bold", size: 10pt)[#item.name]

  if item.description != "" {
    v(4pt)
    text(size: 10pt)[#item.description]
  }

  if "keywords" in item and item.keywords != none and item.keywords.len() > 0 {
    v(4pt)
    text(size: 9pt, fill: muted-color)[#item.keywords.join(" · ")]
  }

  v(12pt)
}

#let render-certification(item) = {
  if item.visible == false { return }

  text(weight: "medium", size: 10pt)[#item.name]
  if item.issuer != "" {
    text(size: 9pt, fill: muted-color)[ — #item.issuer]
  }
  h(8pt)
  text(size: 9pt, fill: muted-color)[#item.date]
  v(8pt)
}

#let render-award(item) = {
  if item.visible == false { return }

  text(weight: "medium", size: 10pt)[#item.title]
  if item.awarder != "" {
    text(size: 9pt, fill: muted-color)[ — #item.awarder]
  }
  h(8pt)
  text(size: 9pt, fill: muted-color)[#item.date]
  v(8pt)
}

#let render-interest(item) = {
  if item.visible == false { return }

  text(size: 9pt)[#item.name]
  v(4pt)
}

#let template(data) = {
  // Page setup - no margin, we'll handle it in the grid
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

  // Two-column layout with sidebar
  grid(
    columns: (180pt, 1fr),
    column-gutter: 0pt,

    // LEFT SIDEBAR
    box(
      fill: sidebar-bg,
      width: 100%,
      height: 100%,
      inset: (x: 16pt, y: 32pt),
      [
        // Profile photo placeholder (initials)
        #align(center)[
          #box(
            width: 80pt,
            height: 80pt,
            fill: primary-color,
            radius: 50%,
            [
              #align(center + horizon)[
                #text(size: 28pt, weight: "bold", fill: white)[
                  #let parts = data.basics.name.split(" ").filter(w => w.len() > 0)
                  #let initials = if parts.len() > 0 { parts.map(w => w.at(0, default: "")).join("") } else { "" }
                  #initials
                ]
              ]
            ]
          )
        ]

        #v(16pt)

        // Contact
        #sidebar-section("Contact")

        #if data.basics.email != "" {
          text(size: 9pt)[✉ #data.basics.email]
          v(4pt)
        }

        #if data.basics.phone != "" {
          text(size: 9pt)[☎ #data.basics.phone]
          v(4pt)
        }

        #if data.basics.location != "" {
          text(size: 9pt)[📍 #data.basics.location]
          v(4pt)
        }

        #if data.basics.url.href != "" {
          text(size: 9pt)[🔗 #link(data.basics.url.href)[Website]]
          v(4pt)
        }

        // Profiles
        #if data.sections.profiles.visible and data.sections.profiles.items.len() > 0 {
          sidebar-section(data.sections.profiles.name)
          for item in data.sections.profiles.items {
            render-profile(item)
          }
        }

        // Skills
        #if data.sections.skills.visible and data.sections.skills.items.len() > 0 {
          sidebar-section(data.sections.skills.name)
          for item in data.sections.skills.items {
            render-skill(item)
          }
        }

        // Languages
        #if data.sections.languages.visible and data.sections.languages.items.len() > 0 {
          sidebar-section(data.sections.languages.name)
          for item in data.sections.languages.items {
            render-language(item)
          }
        }

        // Interests
        #if data.sections.interests.visible and data.sections.interests.items.len() > 0 {
          sidebar-section(data.sections.interests.name)
          for item in data.sections.interests.items {
            render-interest(item)
          }
        }
      ]
    ),

    // MAIN CONTENT
    box(
      width: 100%,
      inset: (x: 24pt, y: 32pt),
      [
        // Name and headline
        #text(size: 26pt, weight: "bold")[#data.basics.name]

        #if data.basics.headline != "" {
          v(4pt)
          text(size: 12pt, fill: primary-color)[#data.basics.headline]
        }

        // Summary
        #if data.sections.summary.visible and data.sections.summary.content != "" {
          v(12pt)
          box(
            stroke: (left: 3pt + primary-color),
            inset: (left: 12pt, y: 4pt),
            text(size: 10pt, fill: muted-color)[#data.sections.summary.content]
          )
        }

        // Experience
        #if data.sections.experience.visible and data.sections.experience.items.len() > 0 {
          main-section(data.sections.experience.name)
          for item in data.sections.experience.items {
            render-experience(item)
          }
        }

        // Education
        #if data.sections.education.visible and data.sections.education.items.len() > 0 {
          main-section(data.sections.education.name)
          for item in data.sections.education.items {
            render-education(item)
          }
        }

        // Projects
        #if data.sections.projects.visible and data.sections.projects.items.len() > 0 {
          main-section(data.sections.projects.name)
          for item in data.sections.projects.items {
            render-project(item)
          }
        }

        // Certifications
        #if data.sections.certifications.visible and data.sections.certifications.items.len() > 0 {
          main-section(data.sections.certifications.name)
          for item in data.sections.certifications.items {
            render-certification(item)
          }
        }

        // Awards
        #if data.sections.awards.visible and data.sections.awards.items.len() > 0 {
          main-section(data.sections.awards.name)
          for item in data.sections.awards.items {
            render-award(item)
          }
        }
      ]
    )
  )
}
