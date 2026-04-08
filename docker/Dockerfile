# syntax=docker/dockerfile:1@sha256:4a43a54dd1fedceb30ba47e76cfcf2b47304f4161c0caeac2db1c61804ea3c91
# Rustume API Server Dockerfile
# Multi-stage build with cargo-chef dependency caching + BuildKit registry cache
# Stages: chef → planner → builder → runtime

# =============================================================================
# Stage 1: Chef base (shared toolchain for planner + builder)
# =============================================================================
FROM rust:1.94-alpine@sha256:7f752ee8ea5deb9f4863d8c3f228a216a6466619882f09a44b9eda9617dc7770 AS chef

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
    esac && \
    rustup target add "$(cat /tmp/rust_target)"

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
# Stage 4: Runtime (distroless/static — no libc, no CVEs)
# =============================================================================
FROM gcr.io/distroless/static:nonroot@sha256:e3f945647ffb95b5839c07038d64f9811adf17308b9121d8a2b87b6a22a80a39 AS runtime

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/rustume-server /app/rustume-server

# Copy font files from builder (needed for PDF rendering)
COPY --from=builder /usr/share/fonts/liberation /usr/share/fonts/truetype/liberation
COPY --from=builder /usr/share/fonts/dejavu /usr/share/fonts/truetype/dejavu

# Environment variables
ENV RUST_LOG=info
ENV PORT=3000

# Expose port
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD ["/app/rustume-server", "--health"]

# Run server (distroless nonroot user is UID 65532)
CMD ["/app/rustume-server"]
