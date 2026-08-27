// Pikachu Template - Modern design with colored sidebar
// Features a bold yellow sidebar with contact info and skills

#import "_common.typ": *


#let template(data) = {
  // ── Theme colors from resume metadata (with sensible fallbacks) ──
  let primary-color = rgb(data.metadata.theme.at("primary", default: "#ca8a04"))
  let text-color = rgb(data.metadata.theme.at("text", default: "#1c1917"))
  let bg-color = rgb(data.metadata.theme.at("background", default: "#ffffff"))
  let level-display = data.metadata.at("levelDisplay", default: "template-default")
  // Muted ink: the sheet's `--doc-sheet-muted` — `text` at 60% over the ground.
  let muted-color = sheet-muted(text-color, bg-color)
  // Accent ink: the raw `primary-color` seed, exactly what the sheet paints as
  // `--doc-sheet-accent` (#919). The sheet is the PDF's visual source of truth,
  // so the old `darken(…)` step is gone — it was an unenforced WCAG-AA
  // convention with no test or CI gate behind it. Decorative tints are mixed
  // over the page ground below with the sheet's own `color-mix` formulas.
  let accent-color = primary-color

  // ── Helper functions (capture theme colors from enclosing scope) ──

  let white = rgb("#ffffff")
  // Sidebar tint and ink: `.doc-sheet--sidebar-tint .doc-sheet__side` paints
  // `color-mix(in srgb, accent 15%, bg)` and leaves the text at the normal
  // document colour, so the PDF does the same (#919).
  let sidebar-bg = sheet-sidebar-tint(primary-color, bg-color)
  let sidebar-text-color = text-color

  let sidebar-section(title) = {
    v(12pt)
    heading-label(upper(title), size: 9pt, fill: accent-color, tracking: 0.08em)
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
      sheet-level-dots(level, accent-color)
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

    // Degree-first, institution · area secondary, date separate (#829).
    let degree = education-degree(item)
    let school = education-school(item)
    if degree != "" {
      text(weight: "bold", size: 10pt)[#degree]
    }
    if school != "" {
      if degree != "" { v(2pt) }
      text(size: 10pt)[#school]
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

    // Sheet parity (#919): this template's registry `keywordStyle` is
    // `plain`, which `.doc-sheet--keywords-plain` renders as comma-separated
    // muted text — not `.doc-sheet__tag-chip` pills.
    if has-keywords(item) {
      v(2pt)
      render-keywords-inline(item, 8pt, muted-color)
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
      label-mode: "auto",
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

    // Sheet parity (#919): this template's registry `keywordStyle` is
    // `plain`, which `.doc-sheet--keywords-plain` renders as comma-separated
    // muted text — not `.doc-sheet__tag-chip` pills.
    if has-keywords(item) {
      v(2pt)
      render-keywords-inline(item, 8pt, muted-color)
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

  // Body size is inherited from the engine's `#set text(size: metadata.typography.font.size)`.
  set text(
    font: "IBM Plex Sans",
    fill: text-color,
  )

  set par(
    leading: typography-leading(data),
    justify: false,
  )

  // The cover-letter page is not the sheet grid — the sheet has no opinion on
  // it — so its inset stays this template's own, independent of the columns.
  render-cover-letter-page(data, main-section, muted: muted-color, inset: (x: 24pt, y: 32pt))

  if has-resume-body(data) {
    let sidebar-wrapper(body) = {
      set text(fill: sidebar-text-color)
      body
    }

    let sidebar-before = () => [
      // Avatar slot: photo, opt-in initials, or collapsed (#857).
      #align(center)[
        #avatar-above(data.basics, accent-color, below: 16pt, default-size: 80pt)
      ]

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
        text(size: 9pt)[#contact-item(data, "link", link(url-href(data.basics.url))[#url-display-label(data.basics.url)], fill: sidebar-text-color)]
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
      // Column padding mirrors the sheet grid (#919). The CSS paddings are
      // three-value: `.doc-sheet__side` is `1.6rem 0.95rem 2rem` and
      // `.doc-sheet__main` is `1.6rem 1.45rem 2rem`, at the sheet's
      // 1rem = 16px = 12pt. Typst insets are symmetric in y, so the top value
      // (1.6rem = 19.2pt) is used for both edges; the sheet's larger 2rem
      // bottom is slack under a scrolling column, not a print margin.
      sidebar-inset: (x: 11.4pt, y: 19.2pt),
      main-inset: (x: 17.4pt, y: 19.2pt),
      sidebar-heading: sidebar-section,
      main-heading: main-section,
      sidebar-before: sidebar-before,
      main-before: main-before,
      sidebar-wrapper: sidebar-wrapper,
    ))
  }
}
