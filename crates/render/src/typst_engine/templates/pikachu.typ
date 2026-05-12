// Pikachu Template - Modern design with colored sidebar
// Features a bold yellow sidebar with contact info and skills

#import "_common.typ": *


#let template(data) = {
  // ── Theme colors from resume metadata (with sensible fallbacks) ──
  let primary-color = rgb(data.metadata.theme.at("primary", default: "#ca8a04"))
  let text-color = rgb(data.metadata.theme.at("text", default: "#1c1917"))
  let bg-color = rgb(data.metadata.theme.at("background", default: "#ffffff"))
  // Derived colors (not in schema — computed from theme values)
  let muted-color = rgb("#78716c")

  // ── Helper functions (capture theme colors from enclosing scope) ──

  let white = rgb("#ffffff")
  let sidebar-bg = primary-color.lighten(85%)
  let sidebar-text-color = primary-color.darken(60%)

  let sidebar-section(title) = {
    v(12pt)
    text(weight: "bold", size: 9pt, fill: primary-color, tracking: 0.08em)[#upper(title)]
    v(6pt)
  }

  let main-section(title) = {
    v(14pt)
    box(
      fill: primary-color,
      inset: (x: 8pt, y: 4pt),
      radius: 2pt,
      text(weight: "bold", size: 10pt, fill: white, tracking: 0.05em)[#upper(title)]
    )
    v(10pt)
  }

  let skill-dots(level) = {
    rating-indicators(level, 6pt, 6pt, primary-color, sidebar-bg.darken(15%), 50%, 3pt)
  }

  let render-experience(item) = {
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
      render-rich-text(item.summary, size: 10pt)
    }

    v(14pt)
  }

  let render-education(item) = {
    if item.visible == false { return }

    text(weight: "bold", size: 10pt)[#item.institution]
    v(2pt)

    if item.studyType != "" or item.area != "" {
      let degree = format-degree(item.studyType, item.area)
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

  let render-skill(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      text(size: 9pt)[#item.name],
      skill-dots(item.level)
    )
    v(6pt)
  }

  let render-language(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      text(size: 9pt)[#item.name],
      skill-dots(item.level)
    )

    if item.description != "" {
      render-rich-text(item.description, size: 8pt, fill: muted-color)
    }

    v(6pt)
  }

  let render-profile(item) = {
    if item.visible == false { return }

    if has-url(item) {
      link(item.url.href)[
        #text(size: 9pt, fill: sidebar-text-color)[#item.network]
      ]
    } else {
      text(size: 9pt)[#item.network]
    }
    v(4pt)
  }

  let render-project(item) = {
    if item.visible == false { return }

    text(weight: "bold", size: 10pt)[#item.name]

    if item.description != "" {
      v(4pt)
      render-rich-text(item.description, size: 10pt)
    }

    if has-keywords(item) {
      v(4pt)
      text(size: 9pt, fill: muted-color)[#item.keywords.join(" · ")]
    }

    v(12pt)
  }

  let render-certification(item) = {
    if item.visible == false { return }

    text(weight: "medium", size: 10pt)[#item.name]
    if item.issuer != "" {
      text(size: 9pt, fill: muted-color)[ — #item.issuer]
    }
    h(8pt)
    text(size: 9pt, fill: muted-color)[#item.date]
    v(8pt)
  }

  let render-award(item) = {
    if item.visible == false { return }

    text(weight: "medium", size: 10pt)[#item.title]
    if item.awarder != "" {
      text(size: 9pt, fill: muted-color)[ — #item.awarder]
    }
    h(8pt)
    text(size: 9pt, fill: muted-color)[#item.date]
    v(8pt)
  }

  let render-interest(item) = {
    if item.visible == false { return }

    text(size: 9pt)[#item.name]
    v(4pt)
  }

  let render-publication(item) = {
    if item.visible == false { return }

    text(weight: "medium", size: 10pt)[#item.name]
    if item.publisher != "" {
      text(size: 9pt, fill: muted-color)[ — #item.publisher]
    }
    h(8pt)
    text(size: 9pt, fill: muted-color)[#item.date]

    if item.summary != "" {
      v(6pt)
      render-rich-text(item.summary, size: 10pt)
    }

    v(12pt)
  }

  let render-volunteer(item) = {
    if item.visible == false { return }

    text(weight: "bold", size: 11pt)[#item.position]
    v(2pt)
    text(size: 10pt, fill: primary-color)[#item.organization]
    h(8pt)
    text(size: 9pt, fill: muted-color)[#item.date]

    if item.location != "" {
      v(2pt)
      text(size: 9pt, fill: muted-color)[📍 #item.location]
    }

    if item.summary != "" {
      v(6pt)
      render-rich-text(item.summary, size: 10pt)
    }

    v(14pt)
  }

  let render-reference(item) = {
    if item.visible == false { return }

    text(weight: "medium", size: 10pt)[#item.name]

    if item.description != "" {
      v(4pt)
      render-rich-text(item.description, size: 10pt)
    }

    if item.summary != "" {
      v(6pt)
      box(
        stroke: (left: 2pt + primary-color),
        inset: (left: 10pt, y: 2pt),
        render-rich-text(item.summary, size: 9pt, style: "italic", fill: muted-color)
      )
    }

    v(12pt)
  }

  let render-custom(item) = {
    if item.visible == false { return }

    text(weight: "bold", size: 10pt)[#item.name]

    if item.description != "" {
      v(4pt)
      render-rich-text(item.description, size: 10pt)
    }

    if item.date != "" or item.location != "" {
      v(2pt)
      if item.date != "" {
        text(size: 9pt, fill: muted-color)[#item.date]
      }
      if item.date != "" and item.location != "" {
        h(8pt)
      }
      if item.location != "" {
        text(size: 9pt, fill: muted-color)[📍 #item.location]
      }
    }

    if item.summary != "" {
      v(6pt)
      render-rich-text(item.summary, size: 10pt)
    }

    if has-keywords(item) {
      v(4pt)
      text(size: 9pt, fill: muted-color)[#item.keywords.join(" · ")]
    }

    render-url(item, primary-color)
    v(12pt)
  }

  // Page setup - no margin, we'll handle it in the grid

  let render-section(key, heading) = {
    if key == "summary" {
      render-rich-text-section(data.sections.summary, heading)
    } else if key == "profiles" {
      render-item-section(data.sections.profiles, heading, render-profile)
    } else if key == "experience" {
      render-item-section(data.sections.experience, heading, render-experience)
    } else if key == "education" {
      render-item-section(data.sections.education, heading, render-education)
    } else if key == "awards" {
      render-item-section(data.sections.awards, heading, render-award)
    } else if key == "certifications" {
      render-item-section(data.sections.certifications, heading, render-certification)
    } else if key == "skills" {
      render-item-section(data.sections.skills, heading, render-skill)
    } else if key == "interests" {
      render-item-section(data.sections.interests, heading, render-interest)
    } else if key == "publications" {
      render-item-section(data.sections.publications, heading, render-publication)
    } else if key == "volunteer" {
      render-item-section(data.sections.volunteer, heading, render-volunteer)
    } else if key == "languages" {
      render-item-section(data.sections.languages, heading, render-language)
    } else if key == "projects" {
      render-item-section(data.sections.projects, heading, render-project)
    } else if key == "references" {
      render-item-section(data.sections.references, heading, render-reference)
    } else if key == "custom" and "custom" in data.sections {
      for (_, section) in data.sections.custom {
        render-item-section(section, heading, render-custom)
      }
    }
  }

  set page(fill: bg-color, 
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

  sidebar-layout(
    sidebar-width: 180pt,
    sidebar-bg: sidebar-bg,
    body-bg: bg-color,
    sidebar-inset: (x: 16pt, y: 32pt),
    main-inset: (x: 24pt, y: 32pt),
    sidebar-content: {
      set text(fill: sidebar-text-color)
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

        #if has-url(data.basics) {
          text(size: 9pt)[🔗 #link(data.basics.url.href)[Website]]
          v(4pt)
        }

        #for key in layout-column-sections(data, 1, default-sidebar-sections) {
          render-section(key, sidebar-section)
        }
      ]
    },
    main-content: [
        // Name and headline
        #text(size: 26pt, weight: "bold")[#data.basics.name]

        #if data.basics.headline != "" {
          v(4pt)
          text(size: 12pt, fill: primary-color)[#data.basics.headline]
        }

        #for key in layout-column-sections(data, 0, default-main-sections + ("custom",)) {
          render-section(key, main-section)
        }
    ]
  )
}
