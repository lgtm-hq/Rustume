# Rustume API Server Dockerfile
# Multi-stage build for minimal image size

# =============================================================================
# Stage 1: Builder
# =============================================================================
FROM rust:1.93-bookworm@sha256:c38b1b917cb749e50aea7dd6e87f6e315d62a4bc84e38d63f5eb8b1908db1b9a AS builder

WORKDIR /app

# Install build dependencies (includes fonts for copying to distroless runtime)
# hadolint ignore=DL3008 -- apt version pinning impractical; Renovate updates base image
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    fonts-liberation \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace files
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY bindings ./bindings

# Build release binary
RUN cargo build --release -p rustume-server

# =============================================================================
# Stage 2: Runtime (distroless — minimal attack surface)
# =============================================================================
FROM gcr.io/distroless/cc-debian12:nonroot@sha256:7e5b8df2f4d36f5599ef4ab856d7d444922531709becb03f3368c6d797d0a5eb AS runtime

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/target/release/rustume-server /app/rustume-server

# Copy font files from builder (needed for PDF rendering)
COPY --from=builder /usr/share/fonts/truetype/liberation /usr/share/fonts/truetype/liberation
COPY --from=builder /usr/share/fonts/truetype/dejavu /usr/share/fonts/truetype/dejavu

# Environment variables
ENV RUST_LOG=info
ENV PORT=3000

# Expose port
EXPOSE 3000

# Note: distroless has no shell — health checks should be configured
# in the orchestrator (Docker Compose, Kubernetes) via HTTP probes

# Run server (distroless nonroot user is UID 65532)
CMD ["/app/rustume-server"]
