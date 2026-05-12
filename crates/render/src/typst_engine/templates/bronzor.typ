// Bronzor Template - Single-column linear layout
// Centered header with picture area, teal accents, contact icons
// Original: turbo-resume/apps/artboard/src/templates/bronzor.tsx

#import "_common.typ": *


#let template(data) = {
  // ── Theme colors from resume metadata (with sensible fallbacks) ──
  let primary-color = rgb(data.metadata.theme.at("primary", default: "#0891b2"))
  let text-color = rgb(data.metadata.theme.at("text", default: "#1f2937"))
  let bg-color = rgb(data.metadata.theme.at("background", default: "#ffffff"))
  // Derived colors (not in schema — computed from theme values)
  let muted-color = rgb("#6b7280")

  // ── Helper functions (capture theme colors from enclosing scope) ──

  let section-heading(title) = {
    v(12pt)
    text(weight: "bold", size: 11pt, fill: primary-color)[#upper(title)]
    v(2pt)
    line(length: 100%, stroke: 0.5pt + primary-color)
    v(6pt)
  }

  let entry-header(left-content, right-content) = {
    grid(
      columns: (1fr, auto),
      column-gutter: 8pt,
      left-content,
      align(right)[
        #text(size: 9pt, fill: muted-color)[#right-content]
      ]
    )
  }

  let skill-bar(level) = {
    h(4pt)
    rating-indicators(level, 8pt, 8pt, primary-color, bg-color.darken(10%), 2pt, 2pt)
  }

  let render-experience(item) = {
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
      render-rich-text(item.summary, size: 10pt)
    }

    v(10pt)
  }

  let render-education(item) = {
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
      render-rich-text(item.summary, size: 9pt)
    }

    v(10pt)
  }

  let render-skill(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      [
        #text(size: 10pt, weight: "bold")[#item.name]
        #if item.description != "" {
          v(1pt)
          render-rich-text(item.description, size: 9pt)
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

  let render-language(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      [
        #text(size: 10pt, weight: "bold")[#item.name]
        #if item.description != "" {
          v(1pt)
          render-rich-text(item.description, size: 9pt)
        }
      ],
      skill-bar(item.level)
    )

    v(6pt)
  }

  let render-profile(item) = {
    if item.visible == false { return }

    if has-url(item) {
      let label = if item.username != "" { item.username } else { item.url.href }
      link(item.url.href)[#text(fill: primary-color)[#label]]
    } else {
      [#item.network: #item.username]
    }
    v(4pt)
  }

  let render-project(item) = {
    if item.visible == false { return }

    entry-header(
      [#text(weight: "bold", size: 10pt)[#item.name]],
      item.date
    )

    if item.description != "" {
      v(2pt)
      render-rich-text(item.description, size: 10pt)
    }

    if item.summary != "" {
      v(2pt)
      render-rich-text(item.summary, size: 10pt)
    }

    if has-keywords(item) {
      v(2pt)
      text(size: 9pt, fill: muted-color)[#item.keywords.join(", ")]
    }

    v(8pt)
  }

  let render-certification(item) = {
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
      render-rich-text(item.summary, size: 9pt)
    }

    v(8pt)
  }

  let render-award(item) = {
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
      render-rich-text(item.summary, size: 9pt)
    }

    v(8pt)
  }

  let render-interest(item) = {
    if item.visible == false { return }

    text(size: 10pt, weight: "bold")[#item.name]

    if has-keywords(item) {
      text(size: 9pt, fill: muted-color)[ — #item.keywords.join(", ")]
    }

    v(4pt)
  }

  let render-publication(item) = {
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
      render-rich-text(item.summary, size: 9pt)
    }

    v(8pt)
  }

  let render-volunteer(item) = {
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
      render-rich-text(item.summary, size: 10pt)
    }

    v(10pt)
  }

  let render-reference(item) = {
    if item.visible == false { return }

    text(weight: "bold")[#item.name]

    if item.description != "" {
      v(2pt)
      render-rich-text(item.description, size: 9pt)
    }

    if item.summary != "" {
      v(2pt)
      render-rich-text(item.summary, size: 9pt)
    }

    v(8pt)
  }

  let render-custom(item) = {
    if item.visible == false { return }

    entry-header(
      [
        #text(weight: "bold")[#item.name]
        #if item.description != "" {
          v(1pt)
          render-rich-text(item.description, size: 9pt)
        }
      ],
      item.date
    )

    if item.location != "" {
      text(size: 9pt, fill: muted-color)[#item.location]
    }

    if item.summary != "" {
      v(2pt)
      render-rich-text(item.summary, size: 9pt)
    }

    if has-keywords(item) {
      v(2pt)
      text(size: 9pt, fill: muted-color)[#item.keywords.join(", ")]
    }

    render-url(item, primary-color)
    v(8pt)
  }


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
  for key in layout-all-sections(data) {
    render-section(key, section-heading)
  }
}
