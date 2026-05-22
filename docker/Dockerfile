# syntax=docker/dockerfile:1@sha256:2780b5c3bab67f1f76c781860de469442999ed1a0d7992a5efdf2cffc0e3d769
# Rustume Dockerfile
# Multi-stage build with cargo-chef dependency caching + BuildKit registry cache
# Stages: chef → planner → builder → web-builder → runtime

# =============================================================================
# Stage 1: Chef base (shared toolchain for planner + builder)
# =============================================================================
FROM rust:1.95-alpine@sha256:606fd313a0f49743ee2a7bd49a0914bab7deedb12791f3a846a34a4711db7ed2 AS chef

# BuildKit auto-populates TARGETARCH per --platform (amd64 | arm64)
ARG TARGETARCH

WORKDIR /app
# musl-dev + make: required for tikv-jemalloc-sys to compile jemalloc from C source
# Map TARGETARCH → Rust triple and persist for downstream stages
RUN apk add --no-cache musl-dev make curl && \
    cargo install cargo-chef@0.1.77 --locked && \
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

# Install fonts (data files for copying to runtime)
RUN apk add --no-cache font-liberation font-dejavu

# Cook dependencies — this layer is cached as long as recipe.json is unchanged.
# Cache mounts persist compiled artifacts and crate sources across builds,
# speeding up cold rebuilds when recipe.json changes (dep bumps, toolchain upgrades).
#
# NOTE: the /app/target cache mount is LOAD-BEARING across the cook and build
# RUNs below — cook writes compiled deps there, build reads them. Cache mounts
# are ephemeral (not captured in layers), so BOTH RUNs must mount the same id
# (rustume-target-<arch>). Removing the mount on cook breaks the hand-off and
# forces build to recompile all deps from scratch even on warm cache.
# Cache ids are scoped per-arch so concurrent amd64/arm64 builds don't collide.
COPY --from=planner /app/recipe.json recipe.json
RUN --mount=type=cache,target=/usr/local/cargo/registry,id=rustume-registry-${TARGETARCH} \
    --mount=type=cache,target=/app/target,id=rustume-target-${TARGETARCH} \
    RUST_TARGET="$(cat /tmp/rust_target)" && \
    cargo chef cook --release --target "${RUST_TARGET}" \
      --recipe-path recipe.json -p rustume-server

# Copy workspace source and build (reuses cooked deps via shared target cache mount)
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY bindings ./bindings
RUN --mount=type=cache,target=/usr/local/cargo/registry,id=rustume-registry-${TARGETARCH} \
    --mount=type=cache,target=/app/target,id=rustume-target-${TARGETARCH} \
    RUST_TARGET="$(cat /tmp/rust_target)" && \
    cargo build --release --target "${RUST_TARGET}" -p rustume-server && \
    cp "target/${RUST_TARGET}/release/rustume-server" /app/rustume-server

# =============================================================================
# Stage 4: Web builder (WASM bindings + Vite static bundle)
# Buildx sets the target platform per matrix leg; explicit --platform=$TARGETPLATFORM
# is redundant (BuildKit RedundantTargetPlatform) because it matches the default.
# Local builds: pass --platform linux/arm64 on Apple Silicon.
# =============================================================================
FROM rust:1.95-alpine@sha256:606fd313a0f49743ee2a7bd49a0914bab7deedb12791f3a846a34a4711db7ed2 AS web-builder

# Re-declare — ARGs do not cross FROM boundaries
ARG TARGETARCH
ARG BUN_VERSION=1.3.14

WORKDIR /app
SHELL ["/bin/ash", "-eo", "pipefail", "-c"]

RUN apk add --no-cache musl-dev bash unzip ca-certificates curl && \
    update-ca-certificates && \
    rustup target add wasm32-unknown-unknown && \
    cargo install wasm-pack --locked && \
    cargo install wasm-bindgen-cli --version 0.2.121 --locked && \
    case "${TARGETARCH}" in \
      amd64) BUN_ARCH=x64-musl ;; \
      arm64) BUN_ARCH=aarch64-musl ;; \
      *) echo "unsupported TARGETARCH for bun: ${TARGETARCH}" >&2 && exit 1 ;; \
    esac && \
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
FROM gcr.io/distroless/static:nonroot@sha256:963fa6c544fe5ce420f1f54fb88b6fb01479f054c8056d0f74cc2c6000df5240 AS runtime

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/rustume-server /app/rustume-server

# Copy web app from web-builder
COPY --from=web-builder /app/apps/web/dist /app/web

# Copy font files from builder (needed for PDF rendering)
COPY --from=builder /usr/share/fonts/liberation /usr/share/fonts/truetype/liberation
COPY --from=builder /usr/share/fonts/dejavu /usr/share/fonts/truetype/dejavu

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
