# Licensing & Repository Boundary

Rustume is developed in the open. Operating Rustume Cloud is not. This document
is the written boundary between the two, so the split is auditable and citable
in review instead of living as tribal knowledge.

**The rule: the product is open, operating it is private.**

## The two repositories

| Repo | Visibility | License | Contents |
| --- | --- | --- | --- |
| [`lgtm-hq/Rustume`](https://github.com/lgtm-hq/Rustume) | public | [AGPL-3.0-only](LICENSE) | Product code (`crates/`, `apps/web`, bindings), tests, documentation, developer tooling, CI for all of the above, and any self-host/dev compose files |
| `lgtm-hq/rustume-ops` | private | proprietary | Production infrastructure (Terraform, tfvars, state configuration), secrets policy and inventory, deploy topology, runbooks and playbooks, on-call routing, compliance material (DPA, subprocessor register), hosting cost model |

Unlike some open-core projects there is no closed-IP seam inside the product
itself — no private prompts, models, or tuning data. Everything needed to build,
run, and self-host Rustume is in the public repo. Everything about how *we*
run it as a paid service is in `rustume-ops`.

## What lands where

Ask one question: **does this describe the product, or our operation of it?**

Public (`Rustume`):

- Source code, schemas, templates, and their tests
- Self-hosting documentation and example configuration
- CI that builds, tests, lints, or releases the product
- Deploy *mechanics* that a self-hoster could reuse (e.g. a generic
  image-publish workflow)

Private (`rustume-ops`):

- Terraform modules, environment roots, tfvars, and state/backend configuration
- Concrete production topology: provider accounts, DNS layout, service wiring,
  monitoring dashboards and scrape configuration
- Runbooks, playbooks, incident procedures, on-call
- Legal/compliance engagements and documents
- Cost models and capacity planning

**Issues follow the same rule.** Ops-shaped issues — infrastructure work,
runbooks, legal or compliance engagements — are filed in `rustume-ops`, not
here.

## Precedent and enforcement

- **Precedent:** Rustume PR [#422](https://github.com/lgtm-hq/Rustume/pull/422)
  landed the Cloud Terraform tree in this repo because no written boundary said
  otherwise. That tree was migrated to `rustume-ops` (tracked there as issue
  #7), and this document is the decision record preventing a recurrence.
- **Enforcement:** a CI boundary guard
  ([#511](https://github.com/lgtm-hq/Rustume/issues/511)) mechanically rejects
  ops-shaped content (Terraform paths, runbook paths, production topology
  patterns) from landing in this repo.

## Licensing summary

The public repo is licensed AGPL-3.0-only (see [LICENSE](LICENSE),
[NOTICE](NOTICE), and [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES)). Nothing in
this document changes the product license; it only fixes which repository
content belongs in.
