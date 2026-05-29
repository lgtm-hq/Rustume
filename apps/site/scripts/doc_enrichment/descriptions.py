"""Frontmatter descriptions and inline replacement tables for doc enrichment."""

from pathlib import Path

DOCS = Path(__file__).resolve().parents[2] / "src/content/docs"


# Policy-level operations frontmatter (single source for enrich + disclosure tests).
OPERATIONS_POLICY_DESCRIPTIONS: dict[str, str] = {
    "operations/monitoring.md": (
        "Server health, bearer-protected <code>/metrics</code>, and optional "
        '<a href="https://sentry.io/">Sentry</a> integration.'
    ),
    "operations/terraform.md": (
        "Infrastructure-as-code responsibilities for the operated Rustume Cloud production stack."
    ),
    "operations/backups.md": (
        "Recovery guidance for PostgreSQL-backed connected deployments and the operated "
        "Rustume Cloud service."
    ),
}

DESCRIPTIONS: dict[str, str] = {
    "getting-started/quickstart.md": (
        "Get Rustume running locally with <code>make setup</code>, <code>make dev</code>, "
        'or <a href="/docs/deployment/docker/">Docker</a> in under five minutes.'
    ),
    "getting-started/import-formats.md": (
        'Import resumes from <a href="https://jsonresume.org/">JSON Resume</a>, '
        '<a href="https://www.linkedin.com/">LinkedIn</a> exports, and '
        '<a href="https://rxresu.me/">Reactive Resume</a> via <code>rustume parse</code>.'
    ),
    "cloud/overview.md": (
        'Compare managed Rustume Cloud with <a href="/docs/deployment/self-hosting/">'
        "self-hosted connected</a> operation: the same capabilities with different "
        "responsibilities."
    ),
    "cloud/getting-started.md": (
        'Sign up for Rustume Cloud with <a href="/docs/cloud/auth/">WorkOS AuthKit</a>, '
        "create a resume, and import local <code>IndexedDB</code> data."
    ),
    "cloud/auth.md": (
        '<a href="https://workos.com/docs/user-management/authkit">WorkOS AuthKit</a> integration, '
        "<code>rustume_session</code> cookies, minimal account metadata, and sensitive "
        "resume-data handling."
    ),
    "cloud/storage.md": (
        'Resume CRUD in <a href="https://www.postgresql.org/">PostgreSQL</a>, import from local '
        "<code>IndexedDB</code>, and operator responsibility for managed persistence."
    ),
    "cloud/sync.md": (
        "Cross-device sync, offline queue, and conflict resolution for cloud resumes — "
        "<code>PUT /api/resumes/{id}</code> with <code>409 Conflict</code> handling."
    ),
    "cloud/encryption.md": (
        "Two-tier encryption: server-side <code>AES-256-GCM</code> and optional client-side E2E "
        "with passphrase."
    ),
    "cloud/public-pages.md": (
        "Share resumes with public URLs, Open Graph previews, passwords, and custom domains — "
        "<code>/r/{slug}</code> routes."
    ),
    "cloud/version-history.md": (
        "Automatic resume snapshots on save, restore workflows, and operator-selected "
        "retention policies."
    ),
    "pricing/plans.md": (
        "Compare self-hosted operation with managed Rustume Cloud access and "
        '<a href="https://www.paddle.com/">Paddle</a> billing.'
    ),
    "pricing/checkout.md": (
        'Subscribe to hosted service with the <a href="https://developer.paddle.com/">'
        "Paddle</a> checkout overlay and managed billing."
    ),
    "pricing/management.md": (
        '<a href="https://www.paddle.com/">Paddle</a> customer portal, VAT handling, and '
        "Merchant of Record benefits."
    ),
    "architecture/overview.md": (
        '<a href="https://www.rust-lang.org/">Rust</a> workspace crate map, dependency flow, '
        "and component responsibilities."
    ),
    "architecture/cloud-stack.md": (
        'Production infrastructure — <a href="https://railway.com/">Railway</a>, '
        '<a href="https://neon.tech/">Neon</a>, R2, '
        '<a href="https://workos.com/">WorkOS</a>, <a href="https://www.paddle.com/">Paddle</a>, '
        "Grafana, and Sentry."
    ),
    "architecture/data-model.md": (
        '<a href="https://www.postgresql.org/">PostgreSQL</a> schema for users, resumes, sessions, '
        "subscriptions, and version history."
    ),
    "api/overview.md": (
        "REST API for parsing, rendering, validation, and Rustume Cloud — "
        "<code>/swagger-ui/</code> and <code>GET /health</code>."
    ),
    "api/core-endpoints.md": (
        "<code>POST /api/parse</code>, <code>POST /api/render/pdf</code>, validate, and template "
        "reference."
    ),
    "api/cloud-endpoints.md": (
        "Authentication, resume CRUD, billing webhooks, and public page routes when "
        "<code>RUSTUME_CLOUD=true</code>."
    ),
    "api/api-keys.md": (
        "Generate scoped <code>rsk_</code> API keys for programmatic access in connected "
        "deployments."
    ),
    "deployment/docker.md": (
        "Run Rustume from <code>ghcr.io/lgtm-hq/rustume</code>, build from source, verify "
        "signatures, "
        "and use <code>docker compose</code>."
    ),
    "deployment/self-hosting.md": (
        "Expose Rustume on the internet with a reverse proxy, TLS, and "
        "<code>GET /health</code> probes."
    ),
    "deployment/env-reference.md": (
        "Complete reference for core server and Rustume Cloud configuration — "
        "<code>RUSTUME_CLOUD</code>, <code>DATABASE_URL</code>, <code>WORKOS_*</code>, "
        "<code>PADDLE_*</code>."
    ),
    "deployment/supply-chain.md": (
        'Verify Docker image signatures with <a href="https://docs.sigstore.dev/cosign/overview/">'
        "cosign</a> and inspect SLSA provenance and SBOM attestations."
    ),
    **OPERATIONS_POLICY_DESCRIPTIONS,
    "contributing/development.md": (
        "Clone, <code>make setup</code>, <code>make dev</code>, and run tests for local Rustume "
        "development."
    ),
    "contributing/linting.md": (
        "Run <code>uv run lintro chk</code> and <code>uv run lintro fmt</code> for all linting "
        "and formatting checks."
    ),
    "contributing/web-app.md": (
        '<a href="https://www.solidjs.com/">SolidJS</a> resume builder structure, stores, '
        "components, and WASM integration."
    ),
    "cli/usage.md": (
        "Install and use the <code>rustume</code> command-line tool for parsing, rendering, and "
        "validation."
    ),
    "cli/commands.md": (
        "Reference for <code>parse</code>, <code>render</code>, <code>preview</code>, "
        "<code>templates</code>, <code>init</code>, and <code>validate</code> subcommands."
    ),
}

# (relative_path, old, new) — applied only when old is present
