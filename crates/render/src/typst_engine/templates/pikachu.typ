// Pikachu Template - Modern design with colored sidebar
// Features a bold yellow sidebar with contact info and skills

#import "_common.typ": *


#let template(data) = {
  // ── Theme colors from resume metadata (with sensible fallbacks) ──
  let primary-color = rgb(data.metadata.theme.at("primary", default: "#ca8a04"))
  let text-color = rgb(data.metadata.theme.at("text", default: "#1c1917"))
  let bg-color = rgb(data.metadata.theme.at("background", default: "#ffffff"))
  let level-display = data.metadata.at("levelDisplay", default: "template-default")
  // Derived colors (not in schema — computed from theme values)
  let muted-color = text-color.lighten(30%)
  // Accent ink: `primary-color` darkened until it clears WCAG AA (4.5:1)
  // as text on every backdrop this template paints it on — page, tinted
  // panels, chips and its own profile badge. `primary-color` itself stays
  // the untouched brand seed the decorative tints below are derived from.
  let accent-color = primary-color.darken(40%)

  // ── Helper functions (capture theme colors from enclosing scope) ──

  let white = rgb("#ffffff")
  let sidebar-bg = primary-color.lighten(85%)
  let sidebar-text-color = primary-color.darken(60%)

  let sidebar-section(title) = {
    v(12pt)
    text(weight: "bold", size: 9pt, fill: accent-color, tracking: 0.08em)[#upper(title)]
    v(6pt)
  }

  let main-section(title) = {
    v(14pt)
    box(
      fill: accent-color,
      inset: (x: 8pt, y: 4pt),
      radius: 2pt,
      text(weight: "bold", size: 10pt, fill: white, tracking: 0.05em)[#upper(title)]
    )
    v(10pt)
  }

  let skill-dots(level) = {
    let level = clamp-level(level)
    if level-display == "template-default" {
      rating-indicators(level, 6pt, 6pt, accent-color, sidebar-bg.darken(15%), 50%, 3pt)
    } else {
      render-level(level, level-display, accent-color, sidebar-bg.darken(15%), spacing: 3pt)
    }
  }

  let render-experience(item) = {
    if item.visible == false { return }

    text(weight: "bold", size: 11pt)[#item.position]
    v(2pt)
    text(size: 10pt, fill: accent-color)[#item.company]
    h(8pt)
    text(size: 9pt, fill: muted-color)[#item.date]

    if item.location != "" {
      v(2pt)
      text(size: 9pt, fill: muted-color)[#contact-item(data, "location", item.location, fill: muted-color)]
    }

    if item.summary != "" {
      v(6pt)
      render-rich-text(item.summary, size: 10pt)
    }

    v(14pt)
  }

  let render-education(item) = {
    if item.visible == false { return }

    // Stacked, not a side-by-side grid: education lives in the 180pt sidebar
    // by default, where an auto-width date column would squeeze the
    // institution and degree into one-word lines.
    text(weight: "bold", size: 10pt)[#item.institution]
    if item.studyType != "" or item.area != "" {
      v(2pt)
      let degree = format-degree(item.studyType, item.area)
      text(size: 10pt)[#degree]
    }
    if item.score != "" {
      v(2pt)
      text(size: 9pt, fill: muted-color)[#item.score]
    }
    if item.date != "" {
      v(2pt)
      text(size: 9pt, fill: muted-color)[#item.date]
    }

    if item.summary != "" {
      v(4pt)
      render-rich-text(item.summary, size: 10pt)
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

    if item.description != "" {
      render-rich-text(item.description, size: 8pt, fill: muted-color)
    }

    if has-keywords(item) {
      v(2pt)
      text(size: 8pt, fill: muted-color)[#item.keywords.join(", ")]
    }

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

    render-profile-entry(
      data,
      item,
      size: 9pt,
      fill: sidebar-text-color,
      link-fill: sidebar-text-color,
      label-mode: "network",
    )
    v(4pt)
  }

  let render-project(item) = {
    if item.visible == false { return }

    text(weight: "bold", size: 10pt)[#item.name]

    if item.description != "" {
      v(4pt)
      render-rich-text(item.description, size: 10pt)
    }

    if item.summary != "" {
      v(6pt)
      render-rich-text(item.summary, size: 10pt)
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

    if has-keywords(item) {
      v(2pt)
      text(size: 8pt, fill: muted-color)[#item.keywords.join(", ")]
    }

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
    text(size: 10pt, fill: accent-color)[#item.organization]
    h(8pt)
    text(size: 9pt, fill: muted-color)[#item.date]

    if item.location != "" {
      v(2pt)
      text(size: 9pt, fill: muted-color)[#contact-item(data, "location", item.location, fill: muted-color)]
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
        stroke: (left: 2pt + accent-color),
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
        text(size: 9pt, fill: muted-color)[#contact-item(data, "location", item.location, fill: muted-color)]
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

    render-url(item, accent-color)
    v(12pt)
  }

  // Page setup - no margin, we'll handle it in the grid

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

  render-cover-letter-page(data, main-section, muted: muted-color, inset: (x: 24pt, y: 32pt))

  if has-resume-body(data) {
    let sidebar-wrapper(body) = {
      set text(fill: sidebar-text-color)
      body
    }

    let sidebar-before = () => [
      // Photo when set; otherwise initials avatar.
      #align(center)[
        #if has-visible-picture(data.basics) {
          render-picture(data.basics, accent-color, default-size: 80pt)
        } else {
          box(
            width: 80pt,
            height: 80pt,
            fill: accent-color,
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
        }
      ]

      #v(16pt)

      // Contact
      #sidebar-section("Contact")

      #if data.basics.email != "" {
        text(size: 9pt)[#contact-item(data, "email", data.basics.email, fill: sidebar-text-color)]
        v(4pt)
      }

      #if data.basics.phone != "" {
        text(size: 9pt)[#contact-item(data, "phone", data.basics.phone, fill: sidebar-text-color)]
        v(4pt)
      }

      #if data.basics.location != "" {
        text(size: 9pt)[#contact-item(data, "location", data.basics.location, fill: sidebar-text-color)]
        v(4pt)
      }

      #if has-url(data.basics) {
        text(size: 9pt)[#contact-item(data, "link", link(data.basics.url.href)[#url-display-label(data.basics.url)], fill: sidebar-text-color)]
        v(4pt)
      }
    ]

    let main-before = () => [
      // Name and headline
      #text(size: 26pt, weight: "bold")[#data.basics.name]

      #if data.basics.headline != "" {
        v(4pt)
        text(size: 12pt, fill: accent-color)[#data.basics.headline]
      }
    ]

    render-resume(data, (
      layout: "sidebar-left",
      renderers: renderers,
      // Default width must match FIXED_SIDEBAR_WIDTH_PT in apps/web/src/components/templates/ThemeEditor.tsx.
      sidebar-width: sidebar-width-from-ratio(data, 180pt),
      sidebar-bg: sidebar-bg,
      body-bg: bg-color,
      sidebar-inset: (x: 16pt, y: 32pt),
      main-inset: (x: 24pt, y: 32pt),
      sidebar-heading: sidebar-section,
      main-heading: main-section,
      sidebar-before: sidebar-before,
      main-before: main-before,
      sidebar-wrapper: sidebar-wrapper,
    ))
  }
}
