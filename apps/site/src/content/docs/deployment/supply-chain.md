---
title: "Supply Chain Security"
description: 'Verify <a href="/docs/deployment/docker/">Docker</a> image signatures with <a href="https://docs.sigstore.dev/cosign/overview/">cosign</a>, inspect <a href="https://slsa.dev/">SLSA</a> provenance and <a href="https://www.cisa.gov/sbom">SBOM</a> attestations.'
category: deployment
order: 40
---

Published [Rustume](/) release images on
[GHCR](https://github.com/lgtm-hq/rustume/pkgs/container/rustume) are signed and attested through
the [lgtm-ci](https://github.com/lgtm-hq/lgtm-ci)
[`reusable-docker.yml`](https://github.com/lgtm-hq/lgtm-ci/blob/main/.github/workflows/reusable-docker.yml)
workflow. [Verify Docker image signatures](#image-signing) and inspect [SLSA
provenance](#slsa-provenance) and [SBOM](#sbom-attestations) attestations before deploying to
production.

## Image signing

Release images are signed with **[Sigstore cosign](https://docs.sigstore.dev/cosign/overview/)**
[keyless signing](https://docs.sigstore.dev/cosign/signing/signing_with_containers/) via [GitHub
Actions
OIDC](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect).

```bash
cosign verify ghcr.io/lgtm-hq/rustume:latest \
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com \
  --certificate-identity-regexp='^https://github\.com/lgtm-hq/lgtm-ci/\.github/workflows/reusable-docker\.yml@refs/.*$'

```

Replace `latest` with a [semver](https://semver.org/) tag (e.g. `0.16.0`) to pin a specific release.

A successful verification confirms the image was built by the trusted CI workflow — not tampered
with after publish.

## SLSA provenance

[SLSA provenance](https://slsa.dev/spec/v1.0/provenance) attestations document how the image was
built (source commit, builder, dependencies).

```bash
cosign verify-attestation \
  --type https://slsa.dev/provenance/v1 \
  ghcr.io/lgtm-hq/rustume:latest \
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com \
  --certificate-identity-regexp='^https://github\.com/lgtm-hq/lgtm-ci/\.github/workflows/reusable-docker\.yml@refs/.*$'

```

Inspect the attestation payload:

```bash
cosign verify-attestation \
  --type https://slsa.dev/provenance/v1 \
  ghcr.io/lgtm-hq/rustume:latest \
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com \
  --certificate-identity-regexp='^https://github\.com/lgtm-hq/lgtm-ci/\.github/workflows/reusable-docker\.yml@refs/.*$' \
  | jq .

```

## SBOM attestations

[Software Bill of Materials (SBOM)](https://www.cisa.gov/sbom) attestations list packages included
in the image. Attach during the same publish workflow as provenance.

```bash
cosign verify-attestation \
  --type spdx \
  ghcr.io/lgtm-hq/rustume:latest \
  --certificate-oidc-issuer=https://token.actions.githubusercontent.com \
  --certificate-identity-regexp='^https://github\.com/lgtm-hq/lgtm-ci/\.github/workflows/reusable-docker\.yml@refs/.*$'

```

Use [SBOM](https://www.cisa.gov/sbom) data for vulnerability scanning in your registry or with tools
like [OSV-Scanner](https://google.github.io/osv-scanner/) (also run in [Rustume](/) CI via
[lgtm-hq/py-lintro](https://github.com/lgtm-hq/py-lintro)).

## Dependency auditing

The [Rustume](/) repository runs:

- **[OSV-Scanner](https://google.github.io/osv-scanner/)** — [Rust](https://www.rust-lang.org/) and
  [JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript) dependency checks
- **[cargo-deny](https://github.com/EmbarkStudios/cargo-deny)** /
  **[cargo-audit](https://github.com/rustsec/rustsec/tree/main/cargo-audit)** — crate policy and
  [RustSec advisory database](https://rustsec.org/)
- **[Dependency Review](https://github.com/actions/dependency-review-action)** — [GitHub
  Action](https://github.com/features/actions) on
pull requests
- **[lgtm-ci](https://github.com/lgtm-hq/lgtm-ci)** — reusable workflows for
  [Docker](https://www.docker.com/) [signing](https://docs.sigstore.dev/cosign/overview/) and
[CI
hardening](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)

Self-hosters should still verify image signatures at deploy time rather than relying solely on
`latest`.

## Pinning recommendations

| Environment | Tag strategy |
| --- | --- |
| Production | [Semver](https://semver.org/) pin (`0.16.0`) + [cosign verify](https://docs.sigstore.dev/cosign/verify/) |
| Staging | [Semver](https://semver.org/) minor pin (`0.16`) |
| Development | `main` or local `--build` |

Never use `build-*` CI staging tags in production deployments.
