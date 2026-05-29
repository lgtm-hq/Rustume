"""Body text replacements for doc enrichment."""

from .descriptions import DESCRIPTIONS

REPLACEMENTS: list[tuple[str, str, str]] = [
    # Reactive Resume naming (keep rrv3 as format id)
    (
        "getting-started/import-formats.md",
        'description: "Import resumes from JSON Resume, LinkedIn data exports, and '
        'Reactive Resume v3."',
        f'description: "{DESCRIPTIONS["getting-started/import-formats.md"]}"',
    ),
    (
        "getting-started/import-formats.md",
        "| Reactive Resume v3 | `rrv3` | `rrv3` | JSON file |",
        "| [Reactive Resume](https://rxresu.me/) | `rrv3` | `rrv3` | JSON file |",
    ),
    (
        "getting-started/import-formats.md",
        "## Reactive Resume v3 (RRV3)\n\nIf you are migrating from [Reactive "
        "Resume](https://rxresu.me/) v3, export your resume JSON. RRV3\nfiles contain",
        "## Reactive Resume\n\nIf you are migrating from [Reactive "
        "Resume](https://rxresu.me/), export your resume JSON. Reactive Resume\nfiles "
        "contain",
    ),
    (
        "architecture/overview.md",
        "| `rustume-parser` | Import parsers for JSON Resume, LinkedIn, Reactive Resume v3 |",
        "| `rustume-parser` | Import parsers for [JSON Resume](https://jsonresume.org/), "
        "LinkedIn, [Reactive Resume](https://rxresu.me/) |",
    ),
    (
        "api/core-endpoints.md",
        "| `rrv3` | Reactive Resume v3 JSON |",
        "| `rrv3` | [Reactive Resume](https://rxresu.me/) JSON |",
    ),
    (
        "cli/usage.md",
        "| `parse` | Convert JSON Resume, LinkedIn, RRV3, or Rustume JSON |",
        "| `parse` | Convert [JSON Resume](https://jsonresume.org/), LinkedIn, [Reactive "
        "Resume](https://rxresu.me/) (`rrv3`), or Rustume JSON |",
    ),
    (
        "cli/commands.md",
        "(`basics.label` → JSON Resume, `public` + `sections` → RRV3).",
        "(`basics.label` → [JSON Resume](https://jsonresume.org/), `public` + `sections` "
        "→ [Reactive Resume](https://rxresu.me/) / `rrv3`).",
    ),
    (
        "contributing/web-app.md",
        "│   ├── import/         Import modal (JSON, LinkedIn, RRV3)",
        "│   ├── import/         Import modal (JSON, LinkedIn, Reactive Resume)",
    ),
    # quickstart polish
    (
        "getting-started/quickstart.md",
        "server proxies API calls to the [Rust](https://www.rust-lang.org/) server on port 3000.",
        "server proxies API calls to the [Rust](https://www.rust-lang.org/) server on port `3000`.",
    ),
    (
        "getting-started/quickstart.md",
        "- Deploy with [Docker](/docs/deployment/docker/) for self-hosting",
        "- Deploy with [Docker](/docs/deployment/docker/) for "
        "[self-hosting](/docs/deployment/self-hosting/)",
    ),
    # development.md prerequisites table
    (
        "contributing/development.md",
        "| Rust | [rustup.rs](https://rustup.rs/) |",
        "| [Rust](https://www.rust-lang.org/) | [rustup](https://rustup.rs/) |",
    ),
    (
        "contributing/development.md",
        "| wasm-pack | `cargo install wasm-pack` |",
        "| [wasm-pack](https://rustwasm.github.io/wasm-pack/) | `cargo install wasm-pack` |",
    ),
    (
        "contributing/development.md",
        "| bun | [bun.sh](https://bun.sh) |",
        "| [bun](https://bun.sh) | [bun.sh](https://bun.sh) |",
    ),
    (
        "contributing/development.md",
        "| Python 3.11+ | For lintro |",
        "| [Python 3.11+](https://www.python.org/) | For "
        "[lintro](https://github.com/lgtm-hq/py-lintro) |",
    ),
    (
        "contributing/development.md",
        "| uv | `curl -LsSf https://astral.sh/uv/install.sh \\| sh` |",
        "| [uv](https://docs.astral.sh/uv/) | `curl -LsSf https://astral.sh/uv/install.sh "
        "\\| sh` |",
    ),
    # cloud overview stack links
    (
        "cloud/overview.md",
        "| Account / sign-in | No | WorkOS AuthKit |",
        "| Account / sign-in | No | [WorkOS AuthKit](https://workos.com/docs/user-managem"
        "ent/authkit) |",
    ),
    (
        "cloud/overview.md",
        "| Hosting model | Self-operated | Managed service |",
        "| Hosting model | Self-operated | [Managed service](/docs/pricing/plans/) |",
    ),
    (
        "cloud/overview.md",
        "| Database required | No | PostgreSQL (managed) |",
        "| Database required | No | [PostgreSQL](https://www.postgresql.org/) (managed) |",
    ),
    (
        "cloud/overview.md",
        "| Database | Neon PostgreSQL |",
        "| Database | [Neon](https://neon.tech/) PostgreSQL |",
    ),
    (
        "cloud/overview.md",
        "| Object storage | Cloudflare R2 |",
        "| Object storage | [Cloudflare R2](https://developers.cloudflare.com/r2/) |",
    ),
    (
        "cloud/overview.md",
        "| Auth | WorkOS AuthKit |",
        "| Auth | [WorkOS AuthKit](https://workos.com/docs/user-management/authkit) |",
    ),
    (
        "cloud/overview.md",
        "| Pricing | Paddle |",
        "| Pricing | [Paddle](https://www.paddle.com/) |",
    ),
    (
        "cloud/overview.md",
        "| Metrics | Grafana Cloud |",
        "| Metrics | [Grafana Cloud](https://grafana.com/products/cloud/) |",
    ),
    (
        "cloud/overview.md",
        "| Errors | Sentry |",
        "| Errors | [Sentry](https://sentry.io/) |",
    ),
    (
        "cloud/overview.md",
        "| IaC | Terraform |",
        "| IaC | [Terraform](/docs/operations/terraform/) |",
    ),
    # architecture cloud-stack
    (
        "architecture/cloud-stack.md",
        "| **Hosting** | Railway | Docker deploy of multi-stage image (Axum + SPA) |",
        "| **Hosting** | [Railway](https://railway.com/) | "
        "[Docker](/docs/deployment/docker/) deploy of multi-stage image "
        "([Axum](https://github.com/tokio-rs/axum) + SPA) |",
    ),
    (
        "architecture/cloud-stack.md",
        "| **Database** | Neon | Managed PostgreSQL — users, resumes, sessions, subscriptions |",
        "| **Database** | [Neon](https://neon.tech/) | Managed "
        "[PostgreSQL](/docs/architecture/data-model/) — users, resumes, sessions, "
        "subscriptions |",
    ),
    (
        "architecture/cloud-stack.md",
        "| **Object storage** | Cloudflare R2 | Profile photos, exported PDFs, OG preview images |",
        "| **Object storage** | [Cloudflare R2](https://developers.cloudflare.com/r2/) | "
        "Profile photos, exported PDFs, OG preview images |",
    ),
    (
        "architecture/cloud-stack.md",
        "| **Auth** | WorkOS AuthKit | Social login, email/password, MFA, passkeys |",
        "| **Auth** | [WorkOS AuthKit](/docs/cloud/auth/) | Social login, email/password, "
        "MFA, passkeys |",
    ),
    (
        "architecture/cloud-stack.md",
        "| **Billing** | Paddle (MoR) | Checkout overlay, customer portal, webhooks; EU VAT |",
        "| **Billing** | [Paddle](/docs/pricing/checkout/) (MoR) | Checkout overlay, "
        "customer portal, webhooks; EU VAT |",
    ),
    (
        "architecture/cloud-stack.md",
        "| **Metrics** | Grafana Cloud | Prometheus scrape from `/metrics`, dashboards, alerts |",
        "| **Metrics** | [Grafana Cloud](https://grafana.com/products/cloud/) | "
        "Prometheus scrape from `/metrics`, dashboards, alerts |",
    ),
    (
        "architecture/cloud-stack.md",
        "| **Errors** | Sentry | Server-side error tracking and release health |",
        "| **Errors** | [Sentry](https://sentry.io/) | Server-side error tracking and "
        "release health |",
    ),
    # api overview
    (
        "api/overview.md",
        "Rustume exposes a REST API from the same Axum server that serves the web UI.",
        "Rustume exposes a REST API from the same "
        "[Axum](https://github.com/tokio-rs/axum) server that serves the web UI.",
    ),
    (
        "api/overview.md",
        "is generated at compile time with `utoipa`.",
        "is generated at compile time with `utoipa`. See [Core "
        "endpoints](/docs/api/core-endpoints/) and [Cloud "
        "endpoints](/docs/api/cloud-endpoints/).",
    ),
    # docker
    (
        "deployment/docker.md",
        "Rustume ships as a single container that serves both the SolidJS resume builder "
        "and the Rust API.",
        "Rustume ships as a single [Docker](https://www.docker.com/) container that "
        "serves both the [SolidJS](https://www.solidjs.com/) resume builder and the "
        "[Rust](https://www.rust-lang.org/) API.",
    ),
    (
        "deployment/docker.md",
        "Native development (without Docker) requires Rust, wasm-pack, bun, and the "
        "`wasm32-unknown-unknown`\ntarget",
        "Native development (without Docker) requires [Rust](https://www.rust-lang.org/), "
        "[wasm-pack](https://rustwasm.github.io/wasm-pack/), [bun](https://bun.sh), and "
        "the `wasm32-unknown-unknown`\ntarget",
    ),
    # self-hosting
    (
        "deployment/self-hosting.md",
        "- Resume data lives in the browser (IndexedDB via WASM) — not on the server",
        "- Resume data lives in the browser ([IndexedDB](https://developer.mozilla.org/en"
        "-US/docs/Web/API/IndexedDB_API) via [WASM](/docs/architecture/overview/)) — not "
        "on the server",
    ),
    (
        "deployment/self-hosting.md",
        "- The Axum server handles parse, render, validate, and template APIs",
        "- The [Axum](https://github.com/tokio-rs/axum) server handles parse, render, "
        "validate, and template APIs",
    ),
    # cli usage intro
    (
        "cli/usage.md",
        "The `rustume` CLI exposes the same core engine as the web app and REST API",
        "The `rustume` CLI exposes the same core engine as the [web "
        "app](/docs/contributing/web-app/) and [REST API](/docs/api/overview/)",
    ),
    (
        "cli/usage.md",
        "| `templates` | List available Typst templates |",
        "| `templates` | List available [Typst](https://typst.app/) templates |",
    ),
    # web-app
    (
        "contributing/web-app.md",
        "The Rustume web app (`apps/web/`) is a SolidJS single-page application built with Vite.",
        "The Rustume web app (`apps/web/`) is a [SolidJS](https://www.solidjs.com/) "
        "single-page application built with [Vite](https://vite.dev/).",
    ),
    (
        "contributing/web-app.md",
        "offline-first with WASM-powered local storage and optionally syncs to Rustume Cloud.",
        "offline-first with [WASM](/docs/architecture/overview/) + "
        "[IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) "
        "local storage and optionally syncs to [Rustume Cloud](/docs/cloud/overview/).",
    ),
    # linting
    (
        "contributing/linting.md",
        "Rustume uses [lintro](https://github.com/lgtm-hq/py-lintro) for all linting and "
        "formatting. Do not\nrun native tools directly",
        "Rustume uses [lintro](https://github.com/lgtm-hq/py-lintro) for all linting and "
        "formatting — `uv run lintro chk` and `uv run lintro fmt`. Do not\nrun native "
        "tools directly",
    ),
    (
        "contributing/linting.md",
        "The Makefile includes native Rust/JS lint targets",
        "The [Makefile](https://github.com/lgtm-hq/Rustume/blob/main/Makefile) includes "
        "native Rust/JS lint targets",
    ),
    # import formats cross-links
    (
        "getting-started/import-formats.md",
        "On Rustume Cloud, use **Import from local** after sign-in to upload IndexedDB "
        "resumes to your\naccount.",
        "On [Rustume Cloud](/docs/cloud/getting-started/), use **Import from local** "
        "after sign-in to upload [IndexedDB](https://developer.mozilla.org/en-US/docs/Web"
        "/API/IndexedDB_API) resumes to your\naccount.",
    ),
    # architecture overview render
    (
        "architecture/overview.md",
        "| `rustume-render` | Typst-based PDF/PNG generation with 12 templates |",
        "| `rustume-render` | [Typst](https://typst.app/)-based PDF/PNG generation with "
        "12 templates |",
    ),
    (
        "architecture/overview.md",
        "| `rustume-server` | REST API with OpenAPI documentation |",
        "| `rustume-server` | REST API with [OpenAPI](/docs/api/overview/) documentation |",
    ),
    (
        "architecture/overview.md",
        "| `apps/web` | SolidJS resume builder (Vite) |",
        "| `apps/web` | [SolidJS](https://www.solidjs.com/) resume builder "
        "([Vite](https://vite.dev/)) |",
    ),
    # cloud auth
    (
        "cloud/auth.md",
        "Sessions are stored in PostgreSQL with a 30-day expiry:",
        "Sessions are stored in [PostgreSQL](https://www.postgresql.org/) with a 30-day expiry:",
    ),
    (
        "cloud/auth.md",
        "The SolidJS app probes auth on load:",
        "The [SolidJS](https://www.solidjs.com/) app probes auth on load:",
    ),
    # encryption
    (
        "cloud/encryption.md",
        "before storage in PostgreSQL. Plaintext never",
        "before storage in [PostgreSQL](https://www.postgresql.org/). Plaintext never",
    ),
    # pricing plans
    (
        "pricing/plans.md",
        "| Local storage (IndexedDB) | ✅ | ✅ | ✅ |",
        "| Local storage ([IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/In"
        "dexedDB_API)) | ✅ | ✅ | ✅ |",
    ),
    (
        "pricing/plans.md",
        "Paddle acts as **Merchant of Record (MoR)**:",
        "[Paddle](https://www.paddle.com/) acts as **Merchant of Record (MoR)**:",
    ),
    # data model
    (
        "architecture/data-model.md",
        "Rustume Cloud stores data in PostgreSQL (Neon).",
        "Rustume Cloud stores data in [PostgreSQL](https://www.postgresql.org/) "
        "([Neon](https://neon.tech/)).",
    ),
    # monitoring
    (
        "operations/monitoring.md",
        "Returns metrics in Prometheus text exposition format.",
        "Returns metrics in [Prometheus](https://prometheus.io/) text exposition format.",
    ),
    (
        "operations/monitoring.md",
        "Pre-built dashboards (provisioned via Terraform):",
        "Pre-built dashboards (provisioned via [Terraform](/docs/operations/terraform/)):",
    ),
    # terraform
    (
        "operations/terraform.md",
        "Rustume Cloud infrastructure is defined in Terraform under `infra/`.",
        "Rustume Cloud infrastructure is defined in "
        "[Terraform](https://www.terraform.io/) under `infra/`.",
    ),
    # env reference
    (
        "deployment/env-reference.md",
        "| `DATABASE_URL` | Yes | PostgreSQL connection string (Neon in production) |",
        "| `DATABASE_URL` | Yes | [PostgreSQL](https://www.postgresql.org/) connection "
        "string ([Neon](https://neon.tech/) in production) |",
    ),
    (
        "deployment/env-reference.md",
        "| `WORKOS_CLIENT_ID` | Yes | WorkOS AuthKit application client ID |",
        "| `WORKOS_CLIENT_ID` | Yes | [WorkOS AuthKit](/docs/cloud/auth/) application client ID |",
    ),
    # cloud endpoints
    (
        "api/cloud-endpoints.md",
        "| `GET` | `/auth/login` | No | Redirect to WorkOS AuthKit |",
        "| `GET` | `/auth/login` | No | Redirect to [WorkOS "
        "AuthKit](https://workos.com/docs/user-management/authkit) |",
    ),
    # storage
    (
        "cloud/storage.md",
        "Rustume Cloud persists resumes in PostgreSQL (Neon in production).",
        "Rustume Cloud persists resumes in [PostgreSQL](https://www.postgresql.org/) "
        "([Neon](https://neon.tech/) in production).",
    ),
    (
        "cloud/storage.md",
        "The browser uses IndexedDB via WASM.",
        "The browser uses [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/In"
        "dexedDB_API) via [WASM](/docs/architecture/overview/).",
    ),
    # sync
    (
        "cloud/sync.md",
        "Local\nIndexedDB remains the write path;",
        "Local\n[IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API"
        ") remains the write path;",
    ),
    # public pages
    (
        "cloud/public-pages.md",
        "stored in **Cloudflare R2** (`og/{slug}.png`), generated on",
        "stored in **[Cloudflare R2](https://developers.cloudflare.com/r2/)** "
        "(`og/{slug}.png`), generated on",
    ),
    # core endpoints
    (
        "api/core-endpoints.md",
        "| `json-resume` | JSON Resume string |",
        "| `json-resume` | [JSON Resume](https://jsonresume.org/) string |",
    ),
    (
        "api/core-endpoints.md",
        "| `linkedin` | Base64-encoded ZIP (`base64: true`) |",
        "| `linkedin` | Base64-encoded [LinkedIn](https://www.linkedin.com/) export ZIP "
        "(`base64: true`) |",
    ),
    # cloud getting started
    (
        "cloud/getting-started.md",
        "1. Open the Rustume Cloud deployment (production URL or your Railway instance)",
        "1. Open the Rustume Cloud deployment (production URL or your "
        "[Railway](https://railway.com/) instance)",
    ),
    (
        "cloud/getting-started.md",
        "3. You are redirected to **WorkOS AuthKit** — choose a provider:",
        "3. You are redirected to **[WorkOS AuthKit](https://workos.com/docs/user-managem"
        "ent/authkit)** — choose a provider:",
    ),
    (
        "cloud/getting-started.md",
        "3. The web app reads IndexedDB/localStorage entries and POSTs them to "
        "`/api/resumes/import`",
        "3. The web app reads [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/AP"
        "I/IndexedDB_API)/`localStorage` entries and POSTs them to `/api/resumes/import`",
    ),
    # checkout
    (
        "pricing/checkout.md",
        "The web app loads Paddle.js with your client-side token:",
        "The [web app](/docs/contributing/web-app/) loads Paddle.js with your client-side token:",
    ),
    # management
    (
        "pricing/management.md",
        "Manage your Rustume Cloud subscription through Paddle's hosted customer portal.",
        "Manage your Rustume Cloud subscription through "
        "[Paddle](https://www.paddle.com/)'s hosted customer portal.",
    ),
    # commands typst
    (
        "cli/commands.md",
        "Returns non-zero on validation or Typst errors.",
        "Returns non-zero on validation or [Typst](https://typst.app/) errors.",
    ),
    (
        "cli/commands.md",
        "List available Typst templates.",
        "List available [Typst](https://typst.app/) templates.",
    ),
    # version-history cross-links
    (
        "cloud/version-history.md",
        "Rustume Cloud captures a snapshot of your resume on every save, enabling revert "
        "when you make a\nmistake or want to compare earlier drafts.",
        "Rustume Cloud captures a snapshot of your resume on every save via [resume "
        "storage](/docs/cloud/storage/), enabling revert when you make a\nmistake or want "
        "to compare earlier drafts.",
    ),
    (
        "cloud/version-history.md",
        "Typical usage (50 versions × 50 KB) ≈ 2.5 MB per resume — well within Neon limits.",
        "Typical usage (50 versions × 50 KB) ≈ 2.5 MB per resume — well within "
        "[Neon](https://neon.tech/) limits.",
    ),
    (
        "cloud/version-history.md",
        "Version history is available in connected deployments; the operator sets "
        "retention behavior and users can also export portable JSON backups.",
        "Local [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API"
        ") mode stores the latest state. Connected [version history]"
        "(/docs/cloud/version-history/) complements portable JSON export backups.",
    ),
    # api-keys cross-links
    (
        "api/api-keys.md",
        "Connected deployments can create API keys for programmatic access — CI pipelines, "
        "custom\nintegrations, or headless PDF generation without browser cookies.",
        "Connected deployments can create API keys for programmatic access — CI pipelines, "
        "custom\nintegrations, or headless [PDF generation](/docs/api/core-endpoints/) "
        "without browser cookies.",
    ),
    (
        "api/api-keys.md",
        "Default keys get `resumes:read` + `resumes:write` + `render:pdf`. Custom scope "
        "selection available\nat creation.",
        "Default keys get `resumes:read` + `resumes:write` + `render:pdf`. See [Cloud "
        "endpoints](/docs/api/cloud-endpoints/) for route details. Custom scope selection "
        "available\nat creation.",
    ),
    # cloud-stack terraform row
    (
        "architecture/cloud-stack.md",
        "| **IaC** | Terraform | Railway, Neon, R2, DNS, monitoring wiring |",
        "| **IaC** | [Terraform](/docs/operations/terraform/) | Railway, Neon, R2, DNS, "
        "monitoring wiring |",
    ),
    (
        "architecture/cloud-stack.md",
        "Rustume Cloud runs on managed services orchestrated with Terraform. The stack prioritizes",
        "Rustume Cloud runs on managed services orchestrated with "
        "[Terraform](/docs/operations/terraform/). The stack prioritizes",
    ),
    # data-model workos
    (
        "architecture/data-model.md",
        "Authenticated accounts linked to WorkOS.",
        "Authenticated accounts linked to [WorkOS](/docs/cloud/auth/).",
    ),
    (
        "architecture/data-model.md",
        "Paddle subscription state synced via webhooks.",
        "[Paddle](/docs/pricing/checkout/) subscription state synced via webhooks.",
    ),
    # web-app table
    (
        "contributing/web-app.md",
        "| Framework | SolidJS (signals, fine-grained reactivity) |",
        "| Framework | [SolidJS](https://www.solidjs.com/) (signals, fine-grained reactivity) |",
    ),
    (
        "contributing/web-app.md",
        "| Local storage | WASM → IndexedDB |",
        "| Local storage | [WASM](/docs/architecture/overview/) → "
        "[IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) |",
    ),
]
