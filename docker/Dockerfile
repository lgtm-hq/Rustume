# syntax=docker/dockerfile:1@sha256:87999aa3d42bdc6bea60565083ee17e86d1f3339802f543c0d03998580f9cb89
# Rustume Dockerfile
# Multi-stage build with cargo-chef dependency caching + BuildKit registry cache
# Stages: chef → planner → builder → web-builder → runtime

# =============================================================================
# Stage 1: Chef base (shared toolchain for planner + builder)
# =============================================================================
FROM rust:1.97-alpine@sha256:3c38f3f82c2f3d73da3b38e18d279393a04cb43ddded0e35088a8c3324d40900 AS chef

# BuildKit auto-populates TARGETARCH per --platform (amd64 | arm64)
ARG TARGETARCH

WORKDIR /app
# musl-dev + make: required for tikv-jemalloc-sys to compile jemalloc from C source
# Map TARGETARCH → Rust triple and persist for downstream stages.
# cargo-chef is a checksum-verified prebuilt (via cargo-binstall), not a
# from-source compile. Do not cap CARGO_BUILD_JOBS here: jobs=1 and jobs=2
# still died at ~20 min on linux/amd64 (same band as default ncpu), and
# jobs=1 stretched linux/arm64 from ~15 min to 47 min. A jobs cap, if
# ever restored, must be TARGETARCH=amd64 only.
ARG CARGO_CHEF_VERSION=0.1.77
COPY scripts/ci/docker/install-cargo-binstall.sh /tmp/install-cargo-binstall.sh
RUN apk add --no-cache musl-dev make curl bash && \
    bash /tmp/install-cargo-binstall.sh && \
    cargo binstall --no-confirm --locked --disable-strategies compile \
      "cargo-chef@${CARGO_CHEF_VERSION}" && \
    rm /tmp/install-cargo-binstall.sh && \
    case "${TARGETARCH}" in \
      amd64) echo "x86_64-unknown-linux-musl" > /tmp/rust_target ;; \
      arm64) echo "aarch64-unknown-linux-musl" > /tmp/rust_target ;; \
      *) echo "unsupported TARGETARCH: ${TARGETARCH}" >&2 && exit 1 ;; \
    esac

# =============================================================================
# Stage 2: Planner (compute dependency recipe from workspace manifests)
# =============================================================================
FROM chef AS planner

COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY bindings ./bindings

RUN cargo chef prepare --recipe-path recipe.json

# =============================================================================
# Stage 3: Builder (cook deps, then build workspace in single stage)
# =============================================================================
# Using a single stage keeps the cooked target/ dir intact between cook and
# build RUN commands. Docker layer caching handles the cook layer invalidation
# (triggered only when Cargo.toml or Cargo.lock change via recipe.json).
FROM chef AS builder

# Re-declare — ARGs do not cross FROM boundaries
ARG TARGETARCH

# Install fallback fonts (data files for copying to runtime). The font
# families the templates name (IBM Plex Sans / IBM Plex Serif) are embedded
# in the server binary itself (crates/render/src/typst_engine/assets/fonts,
# via include_dir), so they need no system package here; these packages only
# provide broad glyph-coverage fallbacks for user-configured families.
RUN apk add --no-cache font-liberation font-dejavu

# Cook dependencies into the layer filesystem. recipe.json is the cache key.
# Do NOT mount /app/target: BuildKit cache mounts are not exported by
# cache-to type=gha / type=registry (the only backends lgtm-ci uses). A
# mount would make the cook layer look cached on the next runner while
# leaving /app/target empty, so cargo build would recompile the whole
# tree and the #868 warm-path payoff would never happen. The same-stage
# layer carries target/ from cook to build — that is the cargo-chef
# contract. Registry mounts stay: crate tarballs are cheap vs rustc.
COPY --from=planner /app/recipe.json recipe.json
RUN --mount=type=cache,target=/usr/local/cargo/registry,id=rustume-registry-${TARGETARCH} \
    RUST_TARGET="$(cat /tmp/rust_target)" && \
    cargo chef cook --release --target "${RUST_TARGET}" \
      --recipe-path recipe.json -p rustume-server

# Build metadata surfaced by `GET /version` (crates/server/build.rs).
# Declared AFTER the cook layer so a new commit never invalidates the cached
# dependency build. Empty is valid: the endpoint reports null for what it does
# not know, so local `docker build` needs no build args.
ARG GIT_COMMIT=""

# Copy workspace source and build (reuses cooked deps from the previous layer)
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY bindings ./bindings
# GIT_COMMIT is truncated to 7 characters to match the `sha-<commit>` image tag
# that docker/metadata-action publishes (and that rustume-ops pins in
# deploy/image.txt), so a /version response can be compared to the pin verbatim.
# BUILD_TIME is stamped here rather than passed in: it is the time this layer
# actually compiled the binary, which stays truthful on a cache hit.
RUN --mount=type=cache,target=/usr/local/cargo/registry,id=rustume-registry-${TARGETARCH} \
    RUST_TARGET="$(cat /tmp/rust_target)" && \
    GIT_COMMIT="$(printf '%.7s' "${GIT_COMMIT}")" && \
    BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)" && \
    export GIT_COMMIT BUILD_TIME && \
    cargo build --release --target "${RUST_TARGET}" -p rustume-server && \
    cp "target/${RUST_TARGET}/release/rustume-server" /app/rustume-server

# =============================================================================
# Stage 4: Web builder (WASM bindings + Vite static bundle)
# Buildx sets the target platform per matrix leg; explicit --platform=$TARGETPLATFORM
# is redundant (BuildKit RedundantTargetPlatform) because it matches the default.
# Local builds: pass --platform linux/arm64 on Apple Silicon.
# =============================================================================
FROM rust:1.97-alpine@sha256:3c38f3f82c2f3d73da3b38e18d279393a04cb43ddded0e35088a8c3324d40900 AS web-builder

# Re-declare — ARGs do not cross FROM boundaries
ARG TARGETARCH
ARG BUN_VERSION=1.4.0

WORKDIR /app
SHELL ["/bin/ash", "-eo", "pipefail", "-c"]

COPY Cargo.lock /tmp/Cargo.lock
COPY scripts/ci/testing/web/install-wasm-pack.sh /tmp/install-wasm-pack.sh
COPY scripts/ci/docker/install-cargo-binstall.sh /tmp/install-cargo-binstall.sh

# Install wasm-pack through the repo's canonical checksum-pinned installer,
# then install a checksum-verified cargo-binstall release for the lockfile-
# pinned wasm-bindgen-cli binary. Compiling either tool from source would
# recreate the rustc peak this stage is meant to avoid. Both architectures
# publish musl artifacts; --disable-strategies compile fails closed if the
# wasm-bindgen prebuilt disappears.
RUN apk add --no-cache musl-dev bash unzip ca-certificates curl && \
    update-ca-certificates && \
    rustup target add wasm32-unknown-unknown && \
    bash /tmp/install-wasm-pack.sh && \
    bash /tmp/install-cargo-binstall.sh && \
    case "${TARGETARCH}" in \
      amd64) BUN_ARCH=x64-musl ;; \
      arm64) BUN_ARCH=aarch64-musl ;; \
      *) echo "unsupported TARGETARCH: ${TARGETARCH}" >&2 && exit 1 ;; \
    esac && \
    WASM_BINDGEN_VERSION=$(grep 'name = "wasm-bindgen"' /tmp/Cargo.lock -A 1 | grep version | head -1 | cut -d '"' -f 2) && \
    cargo binstall --no-confirm --locked --disable-strategies compile \
      "wasm-bindgen-cli@${WASM_BINDGEN_VERSION}" && \
    rm -rf /tmp/install-cargo-binstall.sh /tmp/install-wasm-pack.sh \
      /tmp/Cargo.lock && \
    BUN_ZIP="bun-linux-${BUN_ARCH}.zip" && \
    curl -fsSL "https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/${BUN_ZIP}" -o "/tmp/${BUN_ZIP}" && \
    curl -fsSL "https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/SHASUMS256.txt" -o /tmp/SHASUMS256.txt && \
    HASH="$(grep "${BUN_ZIP}" /tmp/SHASUMS256.txt | awk '{print $1}')" && \
    echo "${HASH}  /tmp/${BUN_ZIP}" | sha256sum -c - && \
    unzip -q "/tmp/${BUN_ZIP}" -d /tmp/bun && \
    install -m 755 "/tmp/bun/bun-linux-${BUN_ARCH}/bun" /usr/local/bin/bun && \
    rm -rf /tmp/bun "/tmp/${BUN_ZIP}" /tmp/SHASUMS256.txt

COPY apps/web/package.json apps/web/bun.lock ./apps/web/
WORKDIR /app/apps/web
RUN bun install --frozen-lockfile

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY bindings ./bindings
COPY apps ./apps
WORKDIR /app/apps/web
RUN bun run build:wasm && \
    bun run build

# =============================================================================
# Stage 5: Runtime (distroless/static — no libc, no CVEs)
# =============================================================================
FROM gcr.io/distroless/static:nonroot@sha256:f7f8f729987ad0fdf6b05eeeae94b26e6a0f613bdf46feea7fc40f7bd72953e6 AS runtime

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/rustume-server /app/rustume-server

# Copy web app from web-builder
COPY --from=web-builder /app/apps/web/dist /app/web

# Copy fallback font files from builder (template-named IBM Plex families are
# embedded in the binary; these cover other user-configured font families)
COPY --from=builder /usr/share/fonts/liberation /usr/share/fonts/truetype/liberation
COPY --from=builder /usr/share/fonts/dejavu /usr/share/fonts/truetype/dejavu

# License texts (AGPL distribution compliance for self-hosted images)
COPY LICENSE NOTICE THIRD_PARTY_NOTICES /app/legal/

# Environment variables
ENV RUST_LOG=info
ENV PORT=3000
ENV RUSTUME_STATIC_DIR=/app/web

# Expose port
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["/app/rustume-server", "--health"]

# Run server (distroless nonroot user is UID 65532)
CMD ["/app/rustume-server"]
