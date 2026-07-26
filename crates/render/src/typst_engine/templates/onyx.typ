// Onyx Template - Clean professional design
// White background, red accents, horizontal header, single-column linear layout

#import "_common.typ": *


#let template(data) = {
  // ── Theme colors from resume metadata (with sensible fallbacks) ──
  let primary-color = rgb(data.metadata.theme.at("primary", default: "#dc2626"))
  let text-color = rgb(data.metadata.theme.at("text", default: "#111827"))
  let bg-color = rgb(data.metadata.theme.at("background", default: "#ffffff"))
  let level-display = data.metadata.at("levelDisplay", default: "template-default")
  // Derived colors (not in schema — computed from theme values)
  let muted-color = rgb("#6b7280")

  // ── Helper functions (capture theme colors from enclosing scope) ──

  let section-heading(title) = {
    v(14pt)
    box(
      width: 100%,
      stroke: (bottom: 1.5pt + primary-color),
      inset: (bottom: 4pt),
      text(weight: "bold", size: 10pt, fill: primary-color, tracking: 0.06em)[#upper(title)]
    )
    v(10pt)
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

  let rating-squares(level) = {
    let level = clamp-level(level)
    if level-display == "template-default" {
      rating-indicators(level, 8pt, 8pt, primary-color, bg-color.darken(10%), 0pt, 2pt)
    } else {
      render-level(level, level-display, primary-color, bg-color.darken(10%), width: 8pt, height: 8pt)
    }
  }

  let render-experience(item) = {
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
      render-rich-text(item.summary, size: 10pt, fill: text-color)
    }

    v(12pt)
  }

  let render-education(item) = {
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
      render-rich-text(item.summary, size: 10pt, fill: text-color)
    }

    v(12pt)
  }

  let render-skill(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 8pt,
      [
        #text(size: 10pt, weight: "medium", fill: text-color)[#item.name]
        #if item.description != "" {
          v(1pt)
          render-rich-text(item.description, size: 9pt, fill: muted-color)
        }
      ],
      rating-squares(item.level)
    )

    if has-keywords(item) {
      v(2pt)
      for keyword in item.keywords {
        box(
          fill: primary-color.lighten(92%),
          radius: 3pt,
          inset: (x: 6pt, y: 2pt),
          text(size: 8pt, fill: primary-color)[#keyword]
        )
        h(4pt)
      }
    }

    v(8pt)
  }

  let render-language(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 8pt,
      [
        #text(size: 10pt, weight: "medium", fill: text-color)[#item.name]
        #if item.description != "" {
          h(6pt)
          render-rich-text(item.description, size: 9pt, fill: muted-color)
        }
      ],
      rating-squares(item.level)
    )

    v(6pt)
  }

  let render-profile(item) = {
    if item.visible == false { return }

    render-profile-entry(
      data,
      item,
      size: 10pt,
      fill: text-color,
      link-fill: primary-color,
      label-mode: if has-url(item) { "network" } else { "network-username" },
    )
    h(14pt)
  }

  let render-project(item) = {
    if item.visible == false { return }

    entry-header(
      [#text(weight: "bold", size: 10pt, fill: text-color)[#item.name]],
      item.date
    )

    if item.description != "" {
      v(4pt)
      render-rich-text(item.description, size: 10pt, fill: text-color)
    }

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 10pt, fill: text-color)
    }

    if has-keywords(item) {
      v(4pt)
      for keyword in item.keywords {
        box(
          fill: primary-color.lighten(92%),
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
        #text(weight: "medium", size: 10pt, fill: text-color)[#item.name]
        #if item.issuer != "" {
          text(size: 9pt, fill: muted-color)[ — #item.issuer]
        }
      ],
      item.date
    )

    if item.summary != "" {
      v(2pt)
      render-rich-text(item.summary, size: 9pt, fill: text-color)
    }

    v(8pt)
  }

  let render-award(item) = {
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
      render-rich-text(item.summary, size: 9pt, fill: text-color)
    }

    v(8pt)
  }

  let render-interest(item) = {
    if item.visible == false { return }

    text(size: 10pt, weight: "medium", fill: text-color)[#item.name]

    if has-keywords(item) {
      text(size: 9pt, fill: muted-color)[ — #item.keywords.join(", ")]
    }

    v(6pt)
  }

  let render-publication(item) = {
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
      render-rich-text(item.summary, size: 9pt, fill: text-color)
    }

    v(8pt)
  }

  let render-volunteer(item) = {
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
      render-rich-text(item.summary, size: 10pt, fill: text-color)
    }

    v(12pt)
  }

  let render-reference(item) = {
    if item.visible == false { return }

    text(weight: "bold", size: 10pt, fill: text-color)[#item.name]

    if item.description != "" {
      v(2pt)
      render-rich-text(item.description, size: 9pt, fill: muted-color)
    }

    if item.summary != "" {
      v(2pt)
      render-rich-text(item.summary, size: 9pt, fill: text-color)
    }

    v(8pt)
  }

  let render-custom(item) = {
    if item.visible == false { return }

    entry-header(
      [
        #text(weight: "bold", size: 10pt, fill: text-color)[#item.name]
        #if item.description != "" {
          v(1pt)
          render-rich-text(item.description, size: 9pt, fill: muted-color)
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
      render-rich-text(item.summary, size: 9pt, fill: text-color)
    }

    if has-keywords(item) {
      v(2pt)
      for keyword in item.keywords {
        box(
          fill: primary-color.lighten(92%),
          radius: 3pt,
          inset: (x: 6pt, y: 2pt),
          text(size: 8pt, fill: primary-color)[#keyword]
        )
        h(4pt)
      }
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

  render-cover-letter-page(data, section-heading, muted: muted-color)

  if has-resume-body(data) {
    // Header - horizontal flex: name/headline left, contact info stacked right
    grid(
      columns: (1fr, auto),
      column-gutter: 16pt,
      [
        #if has-visible-picture(data.basics) {
          grid(
            columns: (auto, 1fr),
            column-gutter: 12pt,
            align(horizon)[
              #render-picture(data.basics, primary-color)
            ],
            [
              #text(size: 26pt, weight: "bold", fill: text-color)[#data.basics.name]

              #if data.basics.headline != "" {
                v(4pt)
                text(size: 12pt, fill: primary-color)[#data.basics.headline]
              }
            ]
          )
        } else {
          text(size: 26pt, weight: "bold", fill: text-color)[#data.basics.name]

          if data.basics.headline != "" {
            v(4pt)
            text(size: 12pt, fill: primary-color)[#data.basics.headline]
          }
        }
      ],
      align(right)[
        #let contact-items = build-contact-items(data.basics)
        #if has-url(data.basics) { contact-items = contact-items + (link(data.basics.url.href)[#text(fill: primary-color)[#url-display-label(data.basics.url)]],) }

        #for item in contact-items {
          text(size: 9pt, fill: muted-color)[#item]
          v(2pt)
        }
      ]
    )

    v(8pt)
    line(length: 100%, stroke: 1.5pt + primary-color)
    v(8pt)

    render-resume(data, (
      layout: "single",
      renderers: renderers,
      heading: section-heading,
    ))
  }
}
