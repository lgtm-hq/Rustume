# Rustume API Server Dockerfile
# Multi-stage build: musl static binary + distroless/static runtime (zero CVEs)

# =============================================================================
# Stage 1: Builder (Alpine for musl toolchain)
# =============================================================================
FROM rust:1.93-alpine@sha256:4fec02de605563c297c78a31064c8335bc004fa2b0bf406b1b99441da64e2d2d AS builder

WORKDIR /app

# Install musl build toolchain and fonts (data files for copying to runtime)
# hadolint ignore=DL3018 -- apk version pinning impractical; Renovate updates base image
RUN apk add --no-cache musl-dev font-liberation font-dejavu

# Copy workspace files
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY bindings ./bindings

# Build statically-linked release binary
RUN cargo build --release -p rustume-server

# =============================================================================
# Stage 2: Runtime (distroless/static — no libc, no CVEs)
# =============================================================================
FROM gcr.io/distroless/static:nonroot@sha256:e3f945647ffb95b5839c07038d64f9811adf17308b9121d8a2b87b6a22a80a39 AS runtime

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/target/release/rustume-server /app/rustume-server

# Copy font files from builder (needed for PDF rendering)
COPY --from=builder /usr/share/fonts/liberation /usr/share/fonts/truetype/liberation
COPY --from=builder /usr/share/fonts/dejavu /usr/share/fonts/truetype/dejavu

# Environment variables
ENV RUST_LOG=info
ENV PORT=3000

# Expose port
EXPOSE 3000

# Note: distroless has no shell — health checks should be configured
# in the orchestrator (Docker Compose, Kubernetes) via HTTP probes

# Run server (distroless nonroot user is UID 65532)
CMD ["/app/rustume-server"]
