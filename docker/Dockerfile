# Rustume API Server Dockerfile
# Multi-stage build for minimal image size

# =============================================================================
# Stage 1: Builder
# =============================================================================
FROM rust:latest AS builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy workspace files
COPY Cargo.toml Cargo.lock ./
COPY crates ./crates
COPY bindings ./bindings

# Build release binary
RUN cargo build --release -p rustume-server

# =============================================================================
# Stage 2: Runtime
# =============================================================================
FROM debian:bookworm-slim AS runtime

# Install runtime dependencies
# - ca-certificates: for HTTPS
# - fonts-liberation: standard fonts for PDF rendering
# - fonts-dejavu: fallback fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user
RUN groupadd --gid 1000 rustume \
    && useradd --uid 1000 --gid rustume --shell /bin/bash --create-home rustume

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/target/release/rustume-server /app/rustume-server

# Set ownership
RUN chown -R rustume:rustume /app

# Switch to non-root user
USER rustume

# Environment variables
ENV RUST_LOG=info
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Run server
CMD ["/app/rustume-server"]
