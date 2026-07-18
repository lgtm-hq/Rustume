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

[Unreleased]: https://github.com/lgtm-hq/Rustume/compare/v0.29.4...HEAD
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
