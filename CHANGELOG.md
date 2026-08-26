<!-- markdownlint-disable MD024 -- duplicate headings are standard in changelogs -->

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security

## [0.69.0] - 2026-08-26

### Added

- add org AI review via lgtm-ci reusable (5c81e05)

### Changed

- **deps**: update github-actions (#917) (1aa88b6)
- **deps**: update dependency h3 to 2.0.1-rc.28 (patch) (#914) (d690cbd)
- **deps**: update gcr.io/distroless/static:nonroot docker digest to 1c2c046 (#913)
  (56fe845)

## [0.68.1] - 2026-08-22

### Fixed

- **render**: paint sidebar tint full page height and keep titles on one line (#906)
  (f12a185)

## [0.68.0] - 2026-08-22

### Added

- **typst**: honour metadata.typography across all templates (#902) (571b920)

### Changed

- **deps**: update test-tools to 4.1.11 (patch) (#907) (1713851)
- **deps**: update postgres:18-alpine docker digest to d3e1620 (#898) (b4fe0f0)
- **deps**: update docker/dockerfile:1 docker digest to ecfaec9 (#897) (bb932ea)
- **deps**: update lintro to 0.123.3 (patch) (#893) (384cbe9)
- **deps**: update lintro to 0.123.1 (minor) (#892) (31f12da)
- **deps**: update lintro to 0.122.0 (minor) (#891) (1eb681b)
- **deps**: update lintro to 0.120.0 (minor) (#890) (421ee69)
- **deps**: update lintro to 0.118.5 (minor) (#889) (6008130)
- **deps**: update dependency cargo-llvm-cov to 0.9.0 (minor) (#888) (16c0f21)
- **deps**: update dependency @solidjs/router to 1.0.0 (major) (#747) (39ccc39)
- **deps**: update dependency @axe-core/playwright to 4.13.0 (minor) (#874) (eed9ea4)
- **deps**: update dependency @types/node to 26.2.0 (minor) (#849) (111f47e)
- **deps**: update dependency axe-core to 4.13.0 (minor) (#834) (eabd3b4)
- **deps**: update dependency @playwright/test to 1.62.1 (patch) (#790) (5f6ab19)
- **deps**: update dependency oxlint to 1.78.0 (minor) (#816) (bf98b40)
- **deps-dev**: update rust crate criterion to 0.8.2 (minor) (#873) (da88096)
- **deps**: update step-security/harden-runner action to v2.21.0 (minor) (#876)
  (2f51b25)

### Fixed

- **render**: skip remote profile pictures instead of failing PDF render (#905)
  (2704ab2)
- **web**: match Done mode to PDF on glalie justify and education dates (#904) (6a13e5a)
- **ci**: fail release publish when the image build fails (#903) (82949e2)
- **web**: declare per-template margin support and disable the inert control (#901)
  (bce33f7)
- **render**: interpret markdown subset in html_to_typst (#900) (a921b2a)
- **ci**: pin Trivy DB to ghcr.io so Vulnerability Scan stops 404ing (#899) (8d76514)

## [0.67.7] - 2026-08-18

### Fixed

- **ci**: make the cross install step idempotent for binary-build reruns (#886)
  (4fb3a5d)

## [0.67.6] - 2026-08-18

### Fixed

- **ci**: audit-mode egress for the release image verify job (#883) (d2511b2)

## [0.67.5] - 2026-08-18

### Fixed

- **ci**: switch docker build jobs to audit-mode egress until block mode is fixed (#880)
  (48bec9e)

## [0.67.4] - 2026-08-17

### Changed

- **deps**: lock file maintenance (#877) (73ec3ff)
- **deps**: update lintro to 0.117.1 (minor) (#875) (8e5114a)
- **deps-dev**: pin dependencies (#870) (0eeddb5)
- **deps**: update dependency @testing-library/jest-dom to 7.0.1 (patch) (#872)
  (e2b5344)
- **deps-dev**: update rust crate http-body-util to 0.1.5 (patch) (#871) (138e1c0)

### Fixed

- **docker**: export cooked deps and drop the amd64 footprint diet (#869) (1290a58)

## [0.67.3] - 2026-08-14

### Fixed

- **app**: collapse the avatar slot when no photo is set (#866) (9c3c960)

## [0.67.2] - 2026-08-14

### Fixed

- **render**: lead experience items with position on eight templates (#864) (284acba)

## [0.67.1] - 2026-08-14

### Changed

- **app**: close the parity-harness drift gaps found in the fidelity-wave review (#861)
  (98698b8)
- **render**: eliminate redundant full-payload passes on the render request path (#844)
  (1fee6ea)
- **app**: per-template sheet and PDF visual baselines in CI (#843) (faad370)

### Fixed

- **render**: keep chikorita body on PDF page 1 (#862) (c8e5dc5)

## [0.67.0] - 2026-08-13

### Added

- **web**: render per-template chrome on the document sheet (#842) (52585c0)

## [0.66.0] - 2026-08-13

### Added

- **web**: scale the document sheet as a faithful miniature on narrow viewports (#841)
  (f1e22ed)

## [0.65.3] - 2026-08-13

### Changed

- **templates**: audit the 12 templates and freeze each design spec (#838) (b91d885)
- **web,render**: enforce lockstep between bundledTemplateLayout and get_template_layout
  (#837) (79c7a2e)

### Fixed

- **app**: one item-presentation contract shared by sheet and Typst (#840) (4b961ab)

## [0.65.2] - 2026-08-13

### Changed

- **deps**: update lintro to 0.113.2 (patch) (#848) (d7b1f51)
- **deps**: update lintro to 0.113.1 (minor) (#847) (487db8a)
- **deps**: update renovatebot/github-action action to v46.2.2 (patch) (#846) (1f0745e)
- **deps**: lock file maintenance (#845) (e0b9072)
- **deps**: update lintro to 0.112.7 (patch) (#839) (cde16b4)
- **deps**: update lintro to 0.112.6 (patch) (#835) (e45989b)
- **deps-dev**: pin rust crate pdf-extract to =0.12.0 (#833) (1684f7f)

### Fixed

- **web**: scope sheet typography so it stops inheriting app chrome fonts (#836)
  (71eeafb)

## [0.65.1] - 2026-08-08

### Changed

- **deps-dev**: update rust crate wasm-bindgen-test to 0.3.77 (patch) (#825) (8a1ba77)
- **deps**: update lintro to 0.112.5 (patch) (#818) (069bba6)
- **deps**: update lintro to 0.112.4 (patch) (#817) (a50e3b0)
- **deps**: update lintro to 0.112.2 (patch) (#815) (09ec1df)
- **deps**: update lintro to 0.112.0 (minor) (#814) (42ea36c)
- **deps**: update lintro to 0.110.0 (minor) (#811) (c8040a5)
- **e2e**: commit CI-generated visual baselines for the doc editor (#812) (c271900)
- **web**: retire the form builder (#784) (1ea5e1d)
- **deps**: update step-security/harden-runner action to v2.20.1 (patch) (#810)
  (458e4f0)

### Fixed

- **app**: restore sidebar placement, link integrity, custom-section fields, and PDF
  parity (#823) (8600da0)

## [0.65.0] - 2026-08-05

### Added

- **web**: sections, templates, and theme panels for the document editor (#808)
  (aee58b0)

## [0.64.0] - 2026-08-05

### Added

- **web**: whole-surface drag and drop and explicit pagination (#807) (75150ef)
- **web**: typed modal editing and the modal system for the document editor (#805)
  (647163b)

### Changed

- **deps**: update ghcr.io/lgtm-hq/py-lintro docker tag to 0.106.0 (minor) (#804)
  (d6bb317)
- **web**: content-sized sheet engine with section and entry chrome (#794) (#801)
  (872f547)
- **deps-dev**: update dependency lintro to 0.106.0 (minor) (#803) (6d76d06)
- **deps**: update lintro to 0.105.2 (patch) (#802) (0b8ce05)
- **deps**: update renovatebot/github-action action to v46.2.1 (patch) (#791) (5e8ebc1)

## [0.63.0] - 2026-08-03

### Added

- **schema**: add itemBreaks, item keywords/customFields, and render support (#798)
  (2f1be31)

### Changed

- **deps**: lock file maintenance (#792) (3234688)
- **deps**: update lintro to 0.104.3 (patch) (#789) (ebb78d2)
- **web**: single-surface document editor with an Edit/Done toggle (#788) (4ea460f)

## [0.62.0] - 2026-08-02

### Added

- **web**: default the document editor on with a form-builder escape hatch (#778)
  (3dffd3c)

## [0.61.2] - 2026-08-02

### Changed

- **deps**: update lintro to 0.104.2 (patch) (#779) (d4a4220)

### Fixed

- **web**: place fixed sections on toggle-on and back-fill legacy layouts (#777)
  (357fa8f)

## [0.61.1] - 2026-08-02

### Fixed

- **ci**: recover cargo through rustup when the macOS image ships no shims (#775)
  (1a3654a)

## [0.61.0] - 2026-08-02

### Added

- **web**: add templates drawer and sections panel backed by the registry API (#768)
  (c6db6b3)

## [0.60.0] - 2026-08-01

### Added

- **web**: integrate the PDF preview pane into the document editor (#765) (3c17454)

### Changed

- **deps**: update lintro to 0.104.1 (minor) (#771) (1c172e9)

## [0.59.0] - 2026-08-01

### Added

- **web**: wire undo, autosave, and version history into the document editor (#767)
  (01973de)

## [0.58.0] - 2026-08-01

### Added

- **web**: add section cards, add-blocks, and whole-surface drag and drop (#759)
  (d69e72f)

### Changed

- **deps**: update lintro to 0.101.0 (minor) (#764) (fb09e38)
- **deps-dev**: update dependency lintro to 0.100.0 (minor) (#763) (b124cd6)

## [0.57.2] - 2026-08-01

### Fixed

- **utils**: render nested lists as nested in html_to_typst (#756) (595a440)

## [0.57.1] - 2026-08-01

### Changed

- **deps**: update lintro to 0.99.0 (minor) (#761) (851dae9)
- **deps**: update dependency jsdom to 30.0.1 (patch) (#755) (4a518e3)

### Fixed

- **deps**: disable base64 default simd-unsafe feature (#754) (ffa8c35)

## [0.57.0] - 2026-08-01

### Added

- **web**: add click-to-edit and item dialogs to the document sheet (#752) (86627ee)

### Changed

- **deps**: update lintro to 0.98.0 (minor) (#757) (f2212bb)

## [0.56.0] - 2026-08-01

### Added

- **web**: add runtime feature flags and a gated read-only document sheet (#748)
  (99b94b4)

## [0.55.0] - 2026-07-31

### Added

- **render**: add a markdown-to-typst adapter via comrak (#742) (db6e145)

## [0.54.0] - 2026-07-31

### Added

- **web**: add the document-editor layout model (#743) (82a6161)

### Changed

- **deps**: update lintro to 0.97.1 (patch) (#741) (597d4a5)

## [0.53.0] - 2026-07-31

### Added

- **server**: expose template layout metadata in GET /api/templates (#737) (e5875de)

### Changed

- **deps**: update lintro to 0.97.0 (minor) (#739) (5171ccf)
- **test**: add a document-editor fixture to the v3 test corpus (#736) (8631fd6)
- **deps**: update dependency jsdom to 30.0.0 (major) (#719) (41926d0)
- **deps**: update lintro to 0.96.0 (minor) (#720) (474b8d7)
- **deps**: update dependency oxlint to 1.76.0 (minor) (#716) (8ede1a6)
- **deps**: update dependency @playwright/test to 1.62.0 (minor) (#658) (ae0384e)
- **deps**: update sentry-rust monorepo to 0.49.0 (minor) (#705) (230b73a)
- **deps**: update renovatebot/github-action action to v46.2.0 (minor) (#706) (8f11daf)

## [0.52.8] - 2026-07-30

### Changed

- **deps**: update lintro to 0.95.0 (minor) (#717) (2092170)

### Fixed

- **ci**: stop cancelling in-progress required checks on main pushes (#715) (9c3c9f4)

## [0.52.7] - 2026-07-30

### Fixed

- **deps**: update dependency @lgtm-hq/turbo-themes to 0.41.1 (minor) (#709) (c189722)

## [0.52.6] - 2026-07-30

### Changed

- **deps**: update dependency @astrojs/check to 0.9.10 (patch) (#710) (81db5db)
- **deps**: update lintro to 0.94.6 (patch) (#708) (ed83d1f)
- **deps**: update lintro to 0.94.4 (patch) (#707) (c174ba0)
- **deps**: update lintro to 0.94.3 (patch) (#704) (6d0f50b)

### Fixed

- **ci**: recover cargo from CARGO_HOME when setup-rust leaves it off PATH (#703)
  (72d215a)

## [0.52.5] - 2026-07-28

### Fixed

- **site**: underline docs prose links and unsuppress link-in-text-block (#688)
  (ea850e3)
- **site**: stop resource tags, tables, and inline code overflowing at 320px (#686)
  (6b0777e)

## [0.52.4] - 2026-07-28

### Fixed

- **site**: contain focus and announce the result count in the docs search dialog (#687)
  (a3d00ec)

## [0.52.3] - 2026-07-28

### Fixed

- **site**: restore focus and fix listbox semantics in the theme picker (#685) (bc4ffce)

## [0.52.2] - 2026-07-28

### Fixed

- **site**: relevel footer headings from h4 to h2 (#681) (777f238)

## [0.52.1] - 2026-07-28

### Changed

- **a11y**: record the manual A11Y Project checklist pass (#678) (fc12edb)
- **deps**: update lintro to 0.94.1 (patch) (#690) (2156a60)
- **templates**: guard contrast matrix coverage of every colour binding (#680) (bf2de44)
- **deps**: update lintro to 0.94.0 (minor) (#679) (23a9a9e)

### Fixed

- **typst**: apply the themed page background in glalie (#683) (6054dc1)

## [0.52.0] - 2026-07-28

### Added

- **web**: raise axe coverage to WCAG 2.2 AA and enable target-size (#657) (bb60183)

## [0.51.0] - 2026-07-27

### Added

- **web**: honour prefers-reduced-motion across app and site (#655) (e53f0f5)

### Changed

- **site**: run the site accessibility suite in CI (#656) (d9715d5)

## [0.50.2] - 2026-07-27

### Changed

- **design**: record UX pattern decisions for the editor, preview, and import/export
  flows (#649) (6ff863a)
- **site**: add Playwright and axe accessibility coverage for rustume.com (#647)
  (79f18ea)
- **deps**: update dependency h3 to 2.0.1-rc.26 (patch) (#652) (1e3ea45)
- auto-rerun infra failures on Publish - GitHub Release (#640) (2af52bf)

### Fixed

- **templates**: contrast-audit the 12 resume templates for screen and print (#651)
  (464f2b4)

## [0.50.1] - 2026-07-27

### Changed

- **deps-dev**: update dependency lintro to 0.93.1 (patch) (#636) (43a9006)
- **web**: remove the design-lab playground from the production bundle (#630) (a8b5287)

### Fixed

- **web**: re-enable the axe color-contrast rule and fix failing surfaces (#631)
  (64b44fe)

## [0.50.0] - 2026-07-27

### Added

- **site**: audit craft theme tokens against WCAG AA with a contrast checker (#632)
  (d2b32f1)

### Changed

- **design**: define Rustume brand story and design language (#629) (1c02629)
- **deps**: update lintro to 0.93.0 (minor) (#634) (673a6cb)
- **deps**: update lintro to 0.91.59 (patch) (#616) (85c5032)
- **deps**: update rust crate validator to 0.21.0 (minor) (#615) (0458cdf)
- let auto-rerun inspect tag workflow failures (#559) (326b6e4)
- **web**: per-flow E2E suites, visual regression, and accessibility checks (#490)
  (78e38b0)
- **web**: add Playwright infrastructure, smoke tests, and CI wiring (#486) (b35c444)

## [0.49.1] - 2026-07-27

### Changed

- **deps**: update lintro to 0.91.56 (patch) (#613) (0788f45)
- fail the run when a release image is not published (#607) (1093b0d)
- **deps**: lock file maintenance (#612) (66c0ef6)
- **deps**: update renovatebot/github-action action to v46.1.21 (patch) (#611) (0e8d82a)
- **deps**: update ghcr.io/lgtm-hq/py-lintro docker tag to 0.91.55 (patch) (#610)
  (93b691a)
- **deps-dev**: update dependency lintro to 0.91.55 (patch) (#608) (013fa06)

### Fixed

- **deps**: update dependency @lgtm-hq/turbo-themes to 0.40.3 (minor) (#595) (5bf0397)

## [0.49.0] - 2026-07-26

### Added

- **web**: add folder scopes to the library sidebar (#606) (a25b099)

### Changed

- **deps**: update lintro to 0.91.54 (patch) (#605) (601aad3)

## [0.48.0] - 2026-07-26

### Changed

- **server**: require authentication on all cloud deployments (#601) (ff70afd)
- **deps**: update lintro to 0.91.53 (patch) (#603) (62f3798)
- bump lgtm-ci v0.54.0 to v0.59.16 and pin lintro exactly (#598) (28b3d63)

## [0.47.0] - 2026-07-26

### Added

- **web**: add the additive scope sidebar to the Home command centre (#600) (6240159)

### Changed

- **deps**: update ghcr.io/lgtm-hq/py-lintro docker tag to 0.91.52 (patch) (#599)
  (e5c3cb4)

## [0.46.0] - 2026-07-26

### Added

- **web**: redesign the signed-out Cloud entry page and fix the dead sign-in button
  (#592) (838d16b)

### Changed

- **deps**: update ghcr.io/lgtm-hq/py-lintro docker tag to 0.91.51 (patch) (#593)
  (c81dcd6)
- **deps**: update ghcr.io/lgtm-hq/py-lintro docker tag to 0.91.48 (patch) (#590)
  (b0f4147)

## [0.45.0] - 2026-07-26

### Added

- **server**: add GET /version deploy-verification endpoint (#585) (8988281)

### Changed

- **deps**: update ghcr.io/lgtm-hq/py-lintro docker tag to 0.91.47 (patch) (#586)
  (fccbdfb)
- **deps**: update ghcr.io/lgtm-hq/py-lintro docker tag to 0.91.46 (patch) (#583)
  (9c35997)

## [0.44.0] - 2026-07-25

### Added

- **web**: redesign Home as a command centre shell with list/grid/gallery views (#569)
  (10acc62)

### Changed

- **deps**: update ghcr.io/lgtm-hq/py-lintro docker tag to 0.91.45 (patch) (#579)
  (2ec4ad8)
- **deps**: update dependency oxlint to 1.75.0 (minor) (#565) (ece7979)

## [0.43.2] - 2026-07-25

### Changed

- **deps**: update ghcr.io/lgtm-hq/py-lintro docker tag to 0.91.44 (patch) (#577)
  (80038ba)
- **deps**: update all major dependencies (major) (#557) (7ca9d15)
- **deps**: update ghcr.io/lgtm-hq/py-lintro docker tag to 0.91.43 (patch) (#576)
  (1b255ea)
- track lintro and lgtm-ci pins in Renovate, inventory version-bearing files, align
  lintro to 0.91.41 (#572) (fd7bd81)

### Fixed

- **deps**: update dependency @lgtm-hq/turbo-themes to 0.38.7 (minor) (#562) (42b26e3)

## [0.43.1] - 2026-07-25

### Changed

- **deps**: pin dependency fake-indexeddb to 6.2.5 (#564) (669afb0)

### Fixed

- **deps**: clear brace-expansion advisories and re-verify OSV suppressions (#573)
  (85f1754)
- **deps**: update rust crate base64 to 0.23.0 (minor) (#556) (9c36cd8)

## [0.43.0] - 2026-07-24

### Added

- version history, cover letter editor, Home library, and editor UX (#561) (5433ce1)

## [0.42.0] - 2026-07-23

### Added

- **render**: render cover letter section as dedicated page in Typst templates (#489)
  (cced46f)

## [0.41.0] - 2026-07-23

### Added

- **schema**: add cover letter section type to resume schema (#423) (fda6a9b)

### Fixed

- **web**: handle cover letter sections after schema merge (#555) (0deee84)

## [0.40.2] - 2026-07-23

### Fixed

- **deps**: update dependency @lgtm-hq/turbo-themes to 0.36.1 (minor) (#541) (c54de51)

## [0.40.1] - 2026-07-22

### Changed

- **deps**: update all major dependencies (major) (#502) (7c6436c)
- **ops**: purge hosted deploy/backup pipelines migrated to rustume-ops (#539) (4549e06)
- **render**: assert sidebar ratio changes layout and clamps (#537) (6ef1a7a)

### Fixed

- **deps**: update dependency @lgtm-hq/turbo-themes to 0.29.3 (minor) (#520) (48a0775)

## [0.40.0] - 2026-07-21

### Added

- **web**: add adjustable sidebar width ratio (#534) (ae865a3)

## [0.39.0] - 2026-07-21

### Added

- **web**: add proficiency level display types (#533) (afd6663)

## [0.38.0] - 2026-07-21

### Added

- **schema**: add picture rotation and shadow effects (#522) (fb0020a)

## [0.37.0] - 2026-07-21

### Added

- **web**: add print-optimized view (#524) (44eb84c)

## [0.36.0] - 2026-07-20

### Added

- **web**: add command palette (#523) (d781e07)

## [0.35.0] - 2026-07-20

### Added

- **web**: add custom CSS editor in theme sidebar (#525) (1ef3256)

## [0.34.0] - 2026-07-20

### Added

- **web**: add fuzzy search across resumes (#526) (a17a8b1)

## [0.33.0] - 2026-07-20

### Added

- **web**: pan preview when zoomed (#521) (f6accca)

### Changed

- add AGENTS.md with Cursor Cloud dev environment setup notes (#517) (9bb7764)
- **licensing**: document the open/closed boundary with rustume-ops (#512) (af80240)
- **deps**: update github-actions (#519) (c965243)
- **deps**: lock file maintenance (#516) (be0dda5)
- **web**: migrate eslint + typescript-eslint to oxlint (#514) (eb21099)
- **infra**: remove Terraform infra migrated to rustume-ops and add ops-boundary guard
  (#513) (3271b58)

## [0.32.0] - 2026-07-18

### Added

- **server**: resume publish/unpublish API with slug management (#432) (b9d9303)

## [0.31.0] - 2026-07-18

### Added

- **web**: runtime validation of API responses at the client boundary (#429) (ad08dbc)

## [0.30.0] - 2026-07-18

### Added

- **web**: Terms of Service and Privacy Policy pages (#430) (3eaba1e)
- **infra**: author Terraform modules, env roots, and fmt/validate CI (#422) (87c7fec)

### Changed

- **server,web**: small hardening batch — ErrorBoundary, account-delete rate limit,
  preview cache hash (#431) (201304d)
- **deps**: pin dependency typescript-eslint to 8.64.0 (#499) (a328f66)
- **deps**: update eslint monorepo to 9.39.5 (patch) (#500) (0e75521)
- **lint**: enable stricter clippy lints workspace-wide (#426) (40387f3)

## [0.29.5] - 2026-07-18

### Fixed

- **ci**: run web app typecheck and lint in CI (#421) (d592796)

## [0.29.4] - 2026-07-18

### Changed

- **ci**: deny-by-default docker path filtering with drift test (#482) (2c2a1e6)

### Fixed

- **ci**: fix db-backup apt install and extract inline scripts (#481) (44321e2)

## [0.29.3] - 2026-07-18

### Changed

- **rfc**: local↔cloud linking architecture RFC (#420) (848e28e)
- **rfc**: require recovery-backup nonce storage and freshness (#479) (7626bba)
- **shell**: commit curl mocks for deploy-ghcr bats as fixtures (#480) (58c1872)

### Fixed

- **ci**: use Postgres trust auth in local CI setup (#478) (4115874)

## [0.29.2] - 2026-07-18

### Changed

- **deps**: update rust:1.97-alpine docker digest to 3c38f3f (#491) (ad20551)
- **deps**: update gcr.io/distroless/static:nonroot docker digest to f7f8f72 (#483)
  (9d286ec)
- **config**: migrate Renovate config (#402) (402c448)
- **deps**: update dependency typescript to 7.0.2 (major) (#462) (00b62c0)
- **deps**: update dependency lgtm-hq/lgtm-ci to v0.54.0 (minor) (#475) (2f6f4e5)
- **deps**: update typst to 0.15.0 (minor) (#424) (1ca1533)
- **ci**: bump lgtm-ci pins to v0.54.0 and add infra auto-rerun caller (#474) (9ebf183)
- **deps-dev**: update rust crate http-body-util to 0.1.4 (patch) (#472) (35ac299)

### Fixed

- **ci**: gate Railway deploy behind RAILWAY_DEPLOY_ENABLED repo variable (#493)
  (7fdb35c)

## [0.29.1] - 2026-07-13

### Changed

- **ci**: skip docker publish and railway deploy on version-bump-only merges (#469)
  (8117f9e)
- **release**: version 0.29.1 (#467) (fbcc608)
- **ci**: remove redundant DB-integration job from coverage workflow (#470) (875ae4b)
- **ci**: add concurrency groups to coverage and docker workflows (#466) (f664759)
- **deps**: pin dependencies (#461) (db7cc3e)
- **release**: version 0.29.1 (#460) (53a3b4e)
- **deps**: lock file maintenance (#428) (d18db88)
- **deps**: lock file maintenance (#427) (babe1c0)
- **deps**: update renovatebot/github-action action to v46.1.19 (patch) (#418) (fa8421d)
- **deps**: lock file maintenance (#425) (2b6893e)
- **deps**: update all major dependencies (major) (#297) (994e1d1)
- **deps**: pin dependencies (#419) (0f81e5c)

### Fixed

- **ci**: remove duplicate release trigger from docker publish (#468) (448988c)
- **ci**: allow timestamp.sigstore.dev egress for cosign signing on main (#464)
  (0388337)
- **ci**: restore green main workflows and unblock GitHub Releases (#440) (adc90ee)

## [0.29.0] - 2026-07-13

### Added

- **web**: add automated axe-core accessibility checks to the vitest suite (#406)
  (6497d21)

### Changed

- **deps**: update rust docker tag to 1.97 (minor) (#413) (58c51c4)
- **parser**: share resume format dispatch between server and CLI (#396) (bc73795)
- **server**: small cleanups — ApiError dedup, urlencoding, drop ImportItemError (#399)
  (59e4911)
- **server**: drop env-mutating CORS integration test (#415) (a91c422)

### Fixed

- **ci**: run DB-backed integration tests against a Postgres service (#404) (02dbc8f)
- **server**: reject unknown-shaped JSON in /api/validate (#395) (6b2bca5)

## [0.28.0] - 2026-07-12

### Added

- **web**: respect system color scheme for default theme (#393) (0da1363)

### Fixed

- **server**: evict stale rate limiter keys periodically (#400) (f6d6b43)

## [0.27.0] - 2026-07-12

### Added

- **infra**: scheduled pg_dump-to-R2 backup workflow, verification script, and restore
  runbook (#405) (d7c714b)
- **render**: load Typst templates at runtime instead of embedding in binary (#397)
  (bed05b6)

## [0.26.3] - 2026-07-12

### Changed

- **sync**: RFC for end-to-end encryption design (#394) (04c4625)
- **deps**: update rust crate governor to 0.10.4 (minor) (#411) (512eeb0)

### Fixed

- **server**: default CORS to same-origin when unset (#407) (9a23987)

## [0.26.2] - 2026-07-12

### Changed

- **deps**: update renovatebot/github-action action to v46.1.18 (patch) (#409) (a3fb238)
- **deps**: update rust crate reqwest to 0.13.4 (minor) (#289) (e4b46e7)

### Fixed

- **deps**: update rust crate sha2 to 0.11.0 (minor) (#296) (74272b4)

## [0.26.1] - 2026-07-12

### Changed

- **deps**: pin dependencies (#401) (019bbd5)
- **deps**: group typst crates into a single Renovate update (#392) (3e430a9)
- **deps**: pin dependencies (#398) (fe9b961)

### Fixed

- **deps**: update rust crate hmac to 0.13.0 (minor) (#295) (1c022f6)

## [0.26.0] - 2026-07-12

### Added

- **ci**: add merge_group triggers for merge queue support (#356) (c42509f)

### Changed

- **ci**: adopt 📌 pinning check name and lgtm-ci v0.52.4 (#391) (42e6fa9)
- **ci**: adopt canonical emoji check names (#388) (dbed92a)
- **ci**: adopt lgtm-ci v0.52.3 and fix path-filtered CodeQL check (#385) (ebd9b15)
- **renovate**: drop rules superseded by org preset (#384) (70203b2)
- **renovate**: migrate fileMatch to managerFilePatterns (#381) (17a738c)
- **deps**: update rust to 1.96 (minor) (#290) (e8ce1c4)
- **deps**: update metrics-exporter-prometheus to 0.18.3 (minor) (#285) (fa8f449)
- **deps**: update axum-extra to 0.12.6 (minor) (#262) (fd7d76d)
- **deps**: update postgres digest (#227) (59e635d)

### Fixed

- **ci**: unblock release PR egress and pages deploy after v0.52.3 (#390) (8b8ae8e)

## [0.25.1] - 2026-06-28

### Fixed

- **server**: bulk export cap, rate limit reference, and hosting cost docs (#330) (2ae15c0)

## [0.25.0] - 2026-06-20

### Added

- **cloud**: subscription cancellation, data portability, and grace period (#328) (cda3376)

## [0.24.0] - 2026-06-20

### Added

- **cloud**: account deletion with full data erasure (#326) (6bff709)

## [0.23.0] - 2026-06-19

### Added

- **infra**: transactional email service for account lifecycle (#324) (71cb2c9)

## [0.22.0] - 2026-06-19

### Added

- **web**: polish Rustume Cloud login and account UX (#320) (daec673)

### Fixed

- **ci**: trigger release PR for web and site app changes (#322) (8b077c5)

## [0.21.1] - 2026-06-19

### Fixed

- **security**: post-launch hardening for open-source posture (#317) (c274fd8)

## [0.21.0] - 2026-06-19

### Added

- **server**: rate limiting for cloud API endpoints (#313) (049873d)

## [0.20.0] - 2026-06-18

### Added

- **cloud**: require authentication on hosted Rustume Cloud (#311) (90dec0b)

### Fixed

- **ci**: grant release auto-tag caller permissions (#314) (c9c2c00)

## [0.19.0] - 2026-06-18

### Added

- add cloud login and account UX (Phase 1 MVP) (#287) (a3051f6)

### Changed

- **infra**: update public URLs from GitHub Pages to rustume.com (#309) (a7baf3e)
- **infra**: configure rustume.com domain and prepare for public access (#307) (dcb9b33)
- **release**: version 0.19.0 (#303) (6c8d61d)
- **ci**: add BATS tests for Railway deploy scripts (#302) (6e05cc0)
- **infra**: automate Railway deploy after GHCR publish on main (#301) (27878d9)
- **infra**: deploy Rustume Cloud from GHCR instead of Railway source builds (#298) (50de287)
- **deps**: update digest (#247) (ec48308)
- **release**: version 0.19.0 (#288) (681fc82)
- **release**: version 0.18.1 (#284) (a042863)
- **deps**: update actions/checkout to v6.0.3 (#282) (1c7a420)
- **release**: version 0.18.1 (#283) (e33cd66)
- **ci**: trigger fresh docker build after cosign 409 conflict (33d0fc1)

### Fixed

- **ci**: resolve shell test flake and kcov include-path error (#306) (45b9f68)
- **server**: optimistic concurrency control on resume updates (#286) (5d384da)
- **docker**: sync wasm-bindgen dynamic versioning to Railway Dockerfile (95b3825)
- **ci**: grant actions:read and issues:write for reusable failure-notify job (a360f0e)
- **ci**: move permissions to workflow level for reusable caller (0b30e2c)
- **ci**: adopt lgtm-ci v0.44.1 and complete reusable workflow migration (#281) (76fade2)

## [0.18.1] - 2026-06-12

### Changed

- **deps**: update actions/checkout to v6.0.3 (#282) (1c7a420)
- **release**: version 0.18.1 (#283) (e33cd66)
- **ci**: trigger fresh docker build after cosign 409 conflict (33d0fc1)

### Fixed

- **server**: optimistic concurrency control on resume updates (#286) (5d384da)
- **docker**: sync wasm-bindgen dynamic versioning to Railway Dockerfile (95b3825)
- **ci**: grant actions:read and issues:write for reusable failure-notify job (a360f0e)
- **ci**: move permissions to workflow level for reusable caller (0b30e2c)
- **ci**: adopt lgtm-ci v0.44.1 and complete reusable workflow migration (#281) (76fade2)

## [0.11.0] - 2026-04-01

### Added

- Request review from CODEOWNER on bot-opened PRs (#127)

### Fixed

- Pin lgtm-ci actions to SHA digests (#134)
- Upgrade zlib to patch CVE-2023-45853 (#135)
- Switch runtime to distroless base image (#137)
- Add individual CODEOWNER for PR auto-assign (#143)

### Changed

- Standardize Renovate config with org-wide shared preset (#142)

## [0.10.2] - 2026-03-22

### Fixed

- Update reusable-docker workflow pin to lgtm-ci v0.8.2 (#125)

## [0.10.1] - 2026-03-22

### Fixed

- Use upstream scorecard actions and pin harden-runner (#123)

## [0.10.0] - 2026-02-26

### Added

- Persist resume list metadata (#62, #114)

## [0.9.1] - 2026-02-26

### Fixed

- Use upstream actions in scorecard workflow (#119)

## [0.9.0] - 2026-02-23

### Added

- Keyboard shortcuts (#69, #113)

## [0.8.4] - 2026-02-22

### Fixed

- Define theme preset API contract (#59, #115)

## [0.8.3] - 2026-02-22

### Fixed

- Use actions/checkout for Windows builds (#100, #112)

## [0.8.2] - 2026-02-20

### Fixed

- Allow api.deps.dev in scorecard egress policy (#109)
- Remove accidentally committed node_modules and add to .gitignore (#110)

## [0.8.1] - 2026-02-20

### Fixed

- Add keyboard accessibility to layout editor drag-and-drop (#107)

## [0.8.0] - 2026-02-20

### Added

- Drag-and-drop layout editor (#99)

## [0.7.0] - 2026-02-20

### Added

- Image upload for profile photos (#98)

## [0.6.2] - 2026-02-20

### Fixed

- Use GitHub App token for auto-tag authentication (#103)

## [0.6.1] - 2026-02-20

### Fixed

- Prevent destructive fallback on resume load failure (#96)

## [0.6.0] - 2026-02-20

> **Note:** v0.1.1–v0.5.0 were released on the same day with cumulative
> (non-incremental) notes and have been consolidated into this entry.
> See [release history](https://github.com/lgtm-hq/Rustume/releases) for
> the original per-version notes.

### Added

- Port all 12 Typst templates with thumbnails and preview UX (#48)
- Toast notification system (#55)
- Resume duplication (#56)
- TipTap rich text editor for resume descriptions (#57)
- Complete section editor parity for all types (#97)

### Changed

- Revamp README to match org standards (#54)

### Fixed

- Remove unsupported attestations permission from docker workflow (#50)
- Pin docker reusable workflow to SHA for tag resolution (#51)
- Grant all permissions required by reusable docker workflow (#52)
- Bump Rust to 1.93 and add Renovate workflow (#53)

## [0.1.0] - 2026-02-20

### Added

- Rust core foundation (#4)
- Web application with Solid.js (#47)
- Release infrastructure and lgtm-ci workflow integration (#49)
- Lintro code quality configuration (#46)

### Changed

- Update repository references for org migration (#25)

[Unreleased]: https://github.com/lgtm-hq/Rustume/compare/v0.69.0...HEAD
[0.69.0]: https://github.com/lgtm-hq/Rustume/compare/v0.68.1...v0.69.0
[0.68.1]: https://github.com/lgtm-hq/Rustume/compare/v0.68.0...v0.68.1
[0.68.0]: https://github.com/lgtm-hq/Rustume/compare/v0.67.7...v0.68.0
[0.67.7]: https://github.com/lgtm-hq/Rustume/compare/v0.67.6...v0.67.7
[0.67.6]: https://github.com/lgtm-hq/Rustume/compare/v0.67.5...v0.67.6
[0.67.5]: https://github.com/lgtm-hq/Rustume/compare/v0.67.4...v0.67.5
[0.67.4]: https://github.com/lgtm-hq/Rustume/compare/v0.67.3...v0.67.4
[0.67.3]: https://github.com/lgtm-hq/Rustume/compare/v0.67.2...v0.67.3
[0.67.2]: https://github.com/lgtm-hq/Rustume/compare/v0.67.1...v0.67.2
[0.67.1]: https://github.com/lgtm-hq/Rustume/compare/v0.67.0...v0.67.1
[0.67.0]: https://github.com/lgtm-hq/Rustume/compare/v0.66.0...v0.67.0
[0.66.0]: https://github.com/lgtm-hq/Rustume/compare/v0.65.3...v0.66.0
[0.65.3]: https://github.com/lgtm-hq/Rustume/compare/v0.65.2...v0.65.3
[0.65.2]: https://github.com/lgtm-hq/Rustume/compare/v0.65.1...v0.65.2
[0.65.1]: https://github.com/lgtm-hq/Rustume/compare/v0.65.0...v0.65.1
[0.65.0]: https://github.com/lgtm-hq/Rustume/compare/v0.64.0...v0.65.0
[0.64.0]: https://github.com/lgtm-hq/Rustume/compare/v0.63.0...v0.64.0
[0.63.0]: https://github.com/lgtm-hq/Rustume/compare/v0.62.0...v0.63.0
[0.62.0]: https://github.com/lgtm-hq/Rustume/compare/v0.61.2...v0.62.0
[0.61.2]: https://github.com/lgtm-hq/Rustume/compare/v0.61.1...v0.61.2
[0.61.1]: https://github.com/lgtm-hq/Rustume/compare/v0.61.0...v0.61.1
[0.61.0]: https://github.com/lgtm-hq/Rustume/compare/v0.60.0...v0.61.0
[0.60.0]: https://github.com/lgtm-hq/Rustume/compare/v0.59.0...v0.60.0
[0.59.0]: https://github.com/lgtm-hq/Rustume/compare/v0.58.0...v0.59.0
[0.58.0]: https://github.com/lgtm-hq/Rustume/compare/v0.57.2...v0.58.0
[0.57.2]: https://github.com/lgtm-hq/Rustume/compare/v0.57.1...v0.57.2
[0.57.1]: https://github.com/lgtm-hq/Rustume/compare/v0.57.0...v0.57.1
[0.57.0]: https://github.com/lgtm-hq/Rustume/compare/v0.56.0...v0.57.0
[0.56.0]: https://github.com/lgtm-hq/Rustume/compare/v0.55.0...v0.56.0
[0.55.0]: https://github.com/lgtm-hq/Rustume/compare/v0.54.0...v0.55.0
[0.54.0]: https://github.com/lgtm-hq/Rustume/compare/v0.53.0...v0.54.0
[0.53.0]: https://github.com/lgtm-hq/Rustume/compare/v0.52.8...v0.53.0
[0.52.8]: https://github.com/lgtm-hq/Rustume/compare/v0.52.7...v0.52.8
[0.52.7]: https://github.com/lgtm-hq/Rustume/compare/v0.52.6...v0.52.7
[0.52.6]: https://github.com/lgtm-hq/Rustume/compare/v0.52.5...v0.52.6
[0.52.5]: https://github.com/lgtm-hq/Rustume/compare/v0.52.4...v0.52.5
[0.52.4]: https://github.com/lgtm-hq/Rustume/compare/v0.52.3...v0.52.4
[0.52.3]: https://github.com/lgtm-hq/Rustume/compare/v0.52.2...v0.52.3
[0.52.2]: https://github.com/lgtm-hq/Rustume/compare/v0.52.1...v0.52.2
[0.52.1]: https://github.com/lgtm-hq/Rustume/compare/v0.52.0...v0.52.1
[0.52.0]: https://github.com/lgtm-hq/Rustume/compare/v0.51.0...v0.52.0
[0.51.0]: https://github.com/lgtm-hq/Rustume/compare/v0.50.2...v0.51.0
[0.50.2]: https://github.com/lgtm-hq/Rustume/compare/v0.50.1...v0.50.2
[0.50.1]: https://github.com/lgtm-hq/Rustume/compare/v0.50.0...v0.50.1
[0.50.0]: https://github.com/lgtm-hq/Rustume/compare/v0.49.1...v0.50.0
[0.49.1]: https://github.com/lgtm-hq/Rustume/compare/v0.49.0...v0.49.1
[0.49.0]: https://github.com/lgtm-hq/Rustume/compare/v0.48.0...v0.49.0
[0.48.0]: https://github.com/lgtm-hq/Rustume/compare/v0.47.0...v0.48.0
[0.47.0]: https://github.com/lgtm-hq/Rustume/compare/v0.46.0...v0.47.0
[0.46.0]: https://github.com/lgtm-hq/Rustume/compare/v0.45.0...v0.46.0
[0.45.0]: https://github.com/lgtm-hq/Rustume/compare/v0.44.0...v0.45.0
[0.44.0]: https://github.com/lgtm-hq/Rustume/compare/v0.43.2...v0.44.0
[0.43.2]: https://github.com/lgtm-hq/Rustume/compare/v0.43.1...v0.43.2
[0.43.1]: https://github.com/lgtm-hq/Rustume/compare/v0.43.0...v0.43.1
[0.43.0]: https://github.com/lgtm-hq/Rustume/compare/v0.42.0...v0.43.0
[0.42.0]: https://github.com/lgtm-hq/Rustume/compare/v0.41.0...v0.42.0
[0.41.0]: https://github.com/lgtm-hq/Rustume/compare/v0.40.2...v0.41.0
[0.40.2]: https://github.com/lgtm-hq/Rustume/compare/v0.40.1...v0.40.2
[0.40.1]: https://github.com/lgtm-hq/Rustume/compare/v0.40.0...v0.40.1
[0.40.0]: https://github.com/lgtm-hq/Rustume/compare/v0.39.0...v0.40.0
[0.39.0]: https://github.com/lgtm-hq/Rustume/compare/v0.38.0...v0.39.0
[0.38.0]: https://github.com/lgtm-hq/Rustume/compare/v0.37.0...v0.38.0
[0.37.0]: https://github.com/lgtm-hq/Rustume/compare/v0.36.0...v0.37.0
[0.36.0]: https://github.com/lgtm-hq/Rustume/compare/v0.35.0...v0.36.0
[0.35.0]: https://github.com/lgtm-hq/Rustume/compare/v0.34.0...v0.35.0
[0.34.0]: https://github.com/lgtm-hq/Rustume/compare/v0.33.0...v0.34.0
[0.33.0]: https://github.com/lgtm-hq/Rustume/compare/v0.32.0...v0.33.0
[0.32.0]: https://github.com/lgtm-hq/Rustume/compare/v0.31.0...v0.32.0
[0.31.0]: https://github.com/lgtm-hq/Rustume/compare/v0.30.0...v0.31.0
[0.30.0]: https://github.com/lgtm-hq/Rustume/compare/v0.29.5...v0.30.0
[0.29.5]: https://github.com/lgtm-hq/Rustume/compare/v0.29.4...v0.29.5
[0.29.4]: https://github.com/lgtm-hq/Rustume/compare/v0.29.3...v0.29.4
[0.29.3]: https://github.com/lgtm-hq/Rustume/compare/v0.29.2...v0.29.3
[0.29.2]: https://github.com/lgtm-hq/Rustume/compare/v0.29.1...v0.29.2
[0.29.1]: https://github.com/lgtm-hq/Rustume/compare/v0.29.0...v0.29.1
[0.29.0]: https://github.com/lgtm-hq/Rustume/compare/v0.28.0...v0.29.0
[0.28.0]: https://github.com/lgtm-hq/Rustume/compare/v0.27.0...v0.28.0
[0.27.0]: https://github.com/lgtm-hq/Rustume/compare/v0.26.3...v0.27.0
[0.26.3]: https://github.com/lgtm-hq/Rustume/compare/v0.26.2...v0.26.3
[0.26.2]: https://github.com/lgtm-hq/Rustume/compare/v0.26.1...v0.26.2
[0.26.1]: https://github.com/lgtm-hq/Rustume/compare/v0.26.0...v0.26.1
[0.26.0]: https://github.com/lgtm-hq/Rustume/compare/v0.25.1...v0.26.0
[0.25.1]: https://github.com/lgtm-hq/Rustume/compare/v0.25.0...v0.25.1
[0.25.0]: https://github.com/lgtm-hq/Rustume/compare/v0.24.0...v0.25.0
[0.24.0]: https://github.com/lgtm-hq/Rustume/compare/v0.23.0...v0.24.0
[0.23.0]: https://github.com/lgtm-hq/Rustume/compare/v0.22.0...v0.23.0
[0.22.0]: https://github.com/lgtm-hq/Rustume/compare/v0.21.1...v0.22.0
[0.21.1]: https://github.com/lgtm-hq/Rustume/compare/v0.21.0...v0.21.1
[0.21.0]: https://github.com/lgtm-hq/Rustume/compare/v0.20.0...v0.21.0
[0.20.0]: https://github.com/lgtm-hq/Rustume/compare/v0.19.0...v0.20.0
[0.19.0]: https://github.com/lgtm-hq/Rustume/compare/v0.18.0...v0.19.0
[0.18.1]: https://github.com/lgtm-hq/Rustume/compare/v0.18.0...v0.18.1
[0.11.0]: https://github.com/lgtm-hq/Rustume/compare/v0.10.2...v0.11.0
[0.10.2]: https://github.com/lgtm-hq/Rustume/compare/v0.10.1...v0.10.2
[0.10.1]: https://github.com/lgtm-hq/Rustume/compare/v0.10.0...v0.10.1
[0.10.0]: https://github.com/lgtm-hq/Rustume/compare/v0.9.1...v0.10.0
[0.9.1]: https://github.com/lgtm-hq/Rustume/compare/v0.9.0...v0.9.1
[0.9.0]: https://github.com/lgtm-hq/Rustume/compare/v0.8.4...v0.9.0
[0.8.4]: https://github.com/lgtm-hq/Rustume/compare/v0.8.3...v0.8.4
[0.8.3]: https://github.com/lgtm-hq/Rustume/compare/v0.8.2...v0.8.3
[0.8.2]: https://github.com/lgtm-hq/Rustume/compare/v0.8.1...v0.8.2
[0.8.1]: https://github.com/lgtm-hq/Rustume/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/lgtm-hq/Rustume/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/lgtm-hq/Rustume/compare/v0.6.2...v0.7.0
[0.6.2]: https://github.com/lgtm-hq/Rustume/compare/v0.6.1...v0.6.2
[0.6.1]: https://github.com/lgtm-hq/Rustume/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/lgtm-hq/Rustume/compare/v0.1.0...v0.6.0
[0.1.0]: https://github.com/lgtm-hq/Rustume/releases/tag/v0.1.0
