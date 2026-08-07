// Nosepass Template - Professional, classic design
// Traditional layout with blue accents, suitable for corporate environments

#import "_common.typ": *


#let template(data) = {
  // ── Theme colors from resume metadata (with sensible fallbacks) ──
  let primary-color = rgb(data.metadata.theme.at("primary", default: "#3b82f6"))
  let text-color = rgb(data.metadata.theme.at("text", default: "#1f2937"))
  let bg-color = rgb(data.metadata.theme.at("background", default: "#ffffff"))
  let level-display = data.metadata.at("levelDisplay", default: "template-default")
  // Derived colors (not in schema — computed from theme values)
  let muted-color = text-color.lighten(30%)
  // Accent ink: `primary-color` darkened until it clears WCAG AA (4.5:1)
  // as text on every backdrop this template paints it on — page, tinted
  // panels, chips and its own profile badge. `primary-color` itself stays
  // the untouched brand seed the decorative tints below are derived from.
  let accent-color = primary-color.darken(30%)

  // ── Helper functions (capture theme colors from enclosing scope) ──

  let light-gray = bg-color.darken(5%)
  // Neutral rule/border ink. `darken(15%)` was #d9d9d9 — 1.41:1 on white,
  // effectively invisible; this clears the 3:1 that WCAG 2.1 SC 1.4.11
  // asks of a boundary that separates content.
  let border-color = bg-color.darken(45%)

  let section-heading(title) = {
    v(14pt)
    grid(
      columns: (auto, 1fr),
      column-gutter: 12pt,
      text(weight: "bold", size: 11pt, fill: accent-color)[#title],
      line(start: (0pt, 6pt), length: 100%, stroke: 1pt + border-color)
    )
    v(10pt)
  }

  let date-badge(date) = {
    box(
      fill: light-gray,
      radius: 2pt,
      inset: (x: 6pt, y: 2pt),
      text(size: 9pt, fill: muted-color)[#date]
    )
  }

  let render-experience(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 12pt,
      [
        #text(weight: "bold", size: 11pt, fill: accent-color)[#item.position]
        #v(2pt)
        #text(size: 10pt)[#item.company]
        #if item.location != "" {
          text(size: 9pt, fill: muted-color)[ · #item.location]
        }
      ],
      date-badge(item.date)
    )

    if item.summary != "" {
      v(6pt)
      render-rich-text(item.summary, size: 10pt)
    }

    v(12pt)
  }

  let render-education(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 12pt,
      [
        #text(weight: "bold", size: 11pt, fill: accent-color)[#item.institution]
        #v(2pt)
        #if item.studyType != "" or item.area != "" {
          let degree = format-degree(item.studyType, item.area)
          text(size: 10pt)[#degree]
        }
        #if item.score != "" {
          text(size: 9pt, fill: muted-color)[ · GPA: #item.score]
        }
      ],
      date-badge(item.date)
    )

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 10pt)
    }

    v(12pt)
  }

  let render-skill(item) = {
    if item.visible == false { return }

    box(
      stroke: 1pt + border-color,
      radius: 3pt,
      inset: (x: 8pt, y: 4pt),
      [
        #text(size: 9pt, weight: "medium")[#item.name]
        #let level = clamp-level(item.level)
        #if level-display == "template-default" and level > 0 {
          h(4pt)
          for i in range(level) {
            text(fill: accent-color)[●]
          }
          for i in range(5 - level) {
            text(fill: bg-color, stroke: 0.4pt + accent-color)[●]
          }
        } else if should-render-level(level, level-display) {
          h(4pt)
          render-level(level, level-display, accent-color, bg-color.darken(10%))
        }
        #if item.description != "" {
          v(2pt)
          render-rich-text(item.description, size: 8pt, fill: muted-color)
        }
        #if has-keywords(item) {
          v(2pt)
          text(size: 8pt, fill: muted-color)[#item.keywords.join(", ")]
        }
      ]
    )
    h(6pt)
  }

  let render-language(item) = {
    if item.visible == false { return }

    grid(
      columns: (auto, 1fr, auto),
      column-gutter: 8pt,
      text(size: 10pt, weight: "medium")[#item.name],
      line(start: (0pt, 5pt), length: 100%, stroke: (dash: "dotted") + border-color),
      render-rich-text(item.description, size: 9pt, fill: muted-color)
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
      link-fill: accent-color,
      label-mode: "network-username",
    )
    v(4pt)
  }

  let render-project(item) = {
    if item.visible == false { return }

    text(weight: "bold", size: 10pt, fill: accent-color)[#item.name]

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
          fill: light-gray,
          radius: 2pt,
          inset: (x: 5pt, y: 2pt),
          text(size: 8pt)[#keyword]
        )
        h(4pt)
      }
    }

    v(10pt)
  }

  let render-certification(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 12pt,
      [
        #text(weight: "medium", size: 10pt)[#item.name]
        #if item.issuer != "" {
          text(size: 9pt, fill: muted-color)[ — #item.issuer]
        }
      ],
      date-badge(item.date)
    )
    v(8pt)
  }

  let render-award(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 12pt,
      [
        #text(weight: "medium", size: 10pt)[#item.title]
        #if item.awarder != "" {
          text(size: 9pt, fill: muted-color)[ — #item.awarder]
        }
      ],
      date-badge(item.date)
    )

    if item.summary != "" {
      v(2pt)
      render-rich-text(item.summary, size: 9pt)
    }

    v(8pt)
  }

  let render-interest(item) = {
    if item.visible == false { return }

    box(
      fill: light-gray,
      radius: 3pt,
      inset: (x: 8pt, y: 4pt),
      [
        #text(size: 9pt)[#item.name]
        #if has-keywords(item) {
          text(size: 8pt, fill: muted-color)[ — #item.keywords.join(", ")]
        }
      ]
    )
    h(6pt)
  }

  let render-publication(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 12pt,
      [
        #text(weight: "bold", size: 10pt, fill: accent-color)[#item.name]
        #if item.publisher != "" {
          v(2pt)
          text(size: 9pt, fill: muted-color)[#item.publisher]
        }
      ],
      date-badge(item.date)
    )

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 10pt)
    }

    v(10pt)
  }

  let render-volunteer(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 12pt,
      [
        #text(weight: "bold", size: 11pt, fill: accent-color)[#item.organization]
        #if item.position != "" {
          v(2pt)
          text(size: 10pt)[#item.position]
        }
        #if item.location != "" {
          text(size: 9pt, fill: muted-color)[ · #item.location]
        }
      ],
      date-badge(item.date)
    )

    if item.summary != "" {
      v(6pt)
      render-rich-text(item.summary, size: 10pt)
    }

    v(12pt)
  }

  let render-reference(item) = {
    if item.visible == false { return }

    text(weight: "bold", size: 10pt, fill: accent-color)[#item.name]

    if item.description != "" {
      v(4pt)
      render-rich-text(item.description, size: 10pt)
    }

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 9pt)
    }

    v(10pt)
  }

  let render-custom(item) = {
    if item.visible == false { return }

    grid(
      columns: (1fr, auto),
      column-gutter: 12pt,
      [
        #text(weight: "bold", size: 10pt, fill: accent-color)[#item.name]
        #if item.description != "" {
          v(2pt)
          render-rich-text(item.description, size: 10pt)
        }
      ],
      date-badge(item.date)
    )

    if item.location != "" {
      v(2pt)
      text(size: 9pt, fill: muted-color)[#item.location]
    }

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 10pt)
    }

    if has-keywords(item) {
      v(4pt)
      for keyword in item.keywords {
        box(
          fill: light-gray,
          radius: 2pt,
          inset: (x: 5pt, y: 2pt),
          text(size: 8pt)[#keyword]
        )
        h(4pt)
      }
    }

    render-url(item, accent-color)
    v(10pt)
  }

  // Page setup

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
    margin: (x: 54pt, y: 48pt),
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

  render-cover-letter-page(data, section-heading, muted: muted-color)

  if has-resume-body(data) {
    // Header with blue accent bar
    box(
      width: 100%,
      stroke: (bottom: 3pt + accent-color),
      inset: (bottom: 12pt),
      [
        #if has-visible-picture(data.basics) {
          render-picture(data.basics, accent-color)
          v(8pt)
        }

        #text(size: 28pt, weight: "bold", fill: accent-color)[#data.basics.name]

        #if data.basics.headline != "" {
          v(4pt)
          text(size: 12pt, fill: muted-color)[#data.basics.headline]
        }

        #v(10pt)

        // Contact information in a row
        #let contact-parts = ()
        #if data.basics.email != "" {
          contact-parts.push([#contact-item(data, "email", link("mailto:" + data.basics.email)[#data.basics.email], fill: text-color)])
        }
        #if data.basics.phone != "" {
          contact-parts.push([#contact-item(data, "phone", data.basics.phone, fill: text-color)])
        }
        #if data.basics.location != "" {
          contact-parts.push([#contact-item(data, "location", data.basics.location, fill: text-color)])
        }
        #if has-url(data.basics) {
          contact-parts.push([#contact-item(data, "link", link(data.basics.url.href)[#url-display-label(data.basics.url, fallback: "Portfolio")], fill: text-color)])
        }

        #text(size: 9pt)[#contact-parts.join("    ")]
      ]
    )

    v(8pt)

    render-resume(data, (
      layout: "single",
      renderers: renderers,
      heading: section-heading,
    ))
  }
}
