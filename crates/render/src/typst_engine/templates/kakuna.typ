// Kakuna Template - Brown/tan minimal warm tones
// Single-column linear layout, centered header in bordered box
// Original: turbo-resume/apps/artboard/src/templates/kakuna.tsx

#import "_common.typ": *


#let template(data) = {
  // ── Theme colors from resume metadata (with sensible fallbacks) ──
  let primary-color = rgb(data.metadata.theme.at("primary", default: "#78716c"))
  let text-color = rgb(data.metadata.theme.at("text", default: "#422006"))
  let bg-color = rgb(data.metadata.theme.at("background", default: "#ffffff"))
  let level-display = data.metadata.at("levelDisplay", default: "template-default")
  // Derived colors (not in schema — computed from theme values)
  let muted-color = text-color.lighten(40%)

  // ── Helper functions (capture theme colors from enclosing scope) ──

  let light-bg = primary-color.lighten(92%)
  let border-color = bg-color.darken(15%)

  let section-heading(title) = {
    v(16pt)
    grid(
      columns: (auto, 1fr),
      column-gutter: 10pt,
      text(weight: "semibold", size: 10pt, fill: primary-color, tracking: 0.06em)[#upper(title)],
      line(start: (0pt, 5pt), length: 100%, stroke: 0.75pt + primary-color)
    )
    v(10pt)
  }

  let skill-bar(level) = {
    let level = clamp-level(level)
    if level-display == "template-default" {
      h(4pt)
      rating-indicators(level, 8pt, 8pt, primary-color, bg-color.darken(10%), 50%, 2pt)
    } else if level-display != "hidden" and not (level-display == "text" and level == 0) {
      h(4pt)
      render-level(level, level-display, primary-color, bg-color.darken(10%), width: 8pt, height: 8pt)
    }
  }

  let entry-header(left-content, right-content) = {
    grid(
      columns: (1fr, auto),
      column-gutter: 12pt,
      left-content,
      align(right, text(size: 9pt, fill: muted-color)[#right-content])
    )
  }

  let render-experience(item) = {
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
      render-rich-text(item.summary, size: 10pt)
    }

    v(14pt)
  }

  let render-education(item) = {
    if item.visible == false { return }

    entry-header(
      [
        #text(weight: "semibold", size: 10pt)[#item.institution]
        #if item.studyType != "" or item.area != "" {
          v(2pt)
          let degree = format-degree(item.studyType, item.area)
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
      render-rich-text(item.summary, size: 10pt)
    }

    v(14pt)
  }

  let render-skill(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      [
        #text(size: 10pt, weight: "medium")[#item.name]
        #if item.description != "" {
          v(1pt)
          render-rich-text(item.description, size: 9pt, fill: muted-color)
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
        #text(size: 10pt, weight: "medium")[#item.name]
        #if item.description != "" {
          v(1pt)
          render-rich-text(item.description, size: 9pt, fill: muted-color)
        }
      ],
      skill-bar(item.level)
    )

    v(6pt)
  }

  let render-profile(item) = {
    if item.visible == false { return }

    let network = if "network" in item and item.network != none { item.network } else { "" }
    let username = if "username" in item and item.username != none { item.username } else { "" }

    let display = if network != "" and username != "" { [#network: #username] } else if network != "" { network } else { username }

    if has-url(item) {
      let label = if network != "" or username != "" { display } else { item.url.href }
      link(item.url.href)[#text(fill: primary-color)[#label]]
    } else if network != "" or username != "" {
      text(size: 10pt)[#display]
    }
    h(14pt)
  }

  let render-project(item) = {
    if item.visible == false { return }

    entry-header(
      [#text(weight: "semibold", size: 10pt)[#item.name]],
      item.date
    )

    if item.description != "" {
      v(4pt)
      render-rich-text(item.description, size: 10pt)
    }

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 10pt)
    }

    if has-keywords(item) {
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

  let render-certification(item) = {
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
      render-rich-text(item.summary, size: 9pt)
    }

    v(8pt)
  }

  let render-award(item) = {
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
      render-rich-text(item.summary, size: 9pt)
    }

    v(8pt)
  }

  let render-interest(item) = {
    if item.visible == false { return }

    text(size: 10pt, weight: "medium")[#item.name]

    if has-keywords(item) {
      text(size: 9pt, fill: muted-color)[ — #item.keywords.join(", ")]
    }

    v(6pt)
  }

  let render-publication(item) = {
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
      render-rich-text(item.summary, size: 9pt)
    }

    v(8pt)
  }

  let render-volunteer(item) = {
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
      render-rich-text(item.summary, size: 10pt)
    }

    v(14pt)
  }

  let render-reference(item) = {
    if item.visible == false { return }

    text(weight: "semibold", size: 10pt)[#item.name]

    if item.description != "" {
      v(2pt)
      render-rich-text(item.description, size: 9pt, fill: muted-color)
    }

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 9pt)
    }

    v(8pt)
  }

  let render-custom(item) = {
    if item.visible == false { return }

    entry-header(
      [
        #text(weight: "semibold", size: 10pt)[#item.name]
        #if item.description != "" {
          v(1pt)
          render-rich-text(item.description, size: 9pt)
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
      render-rich-text(item.summary, size: 9pt)
    }

    if has-keywords(item) {
      v(2pt)
      text(size: 9pt, fill: muted-color)[#item.keywords.join(", ")]
    }

    render-url(item, primary-color)
    v(8pt)
  }


  let renderers = (
    profiles: render-profile,
    experience: render-experience,
    education: render-education,
    awards: render-award,
    certifications: render-certification,
    skills: render-skill,
    interests: render-interest,
    publications: render-publication,
    volunteer: render-volunteer,
    languages: render-language,
    projects: render-project,
    references: render-reference,
    custom: render-custom,
  )

  set page(fill: bg-color, 
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

        #let contact-items = build-contact-items(data.basics)
        #if has-url(data.basics) { contact-items = contact-items + (link(data.basics.url.href)[#data.basics.url.href],) }

        #text(size: 9pt, fill: muted-color)[#contact-items.join("  ·  ")]
      ]
    )
  ]

  v(8pt)

  render-resume(data, (
    layout: "single",
    renderers: renderers,
    heading: section-heading,
  ))
}
