# PR #225 Review Findings

All 13 recommendation items from the UX and Deployment Findings plan are
addressed and both review rounds are resolved.

## Resolved

| # | Issue | Resolution |
| --- | --- | --- |
| 1 | WASM import path broken in production bundle | Changed to absolute `/wasm/rustume_wasm.js` path; added cross-platform `scripts/copy-wasm.js` that guards missing dir |
| 2 | Static assets served without Cache-Control | Added `cache_control()` — immutable for `/assets/`, `no-cache` for index.html |
| 3 | spa_fallback serves HTML for non-GET methods | Restricted to GET/HEAD; returns 405 otherwise; added test |
| 4 | Symlink escape possible via static file serving | Added `tokio::fs::canonicalize` containment check |
| 5 | WASM notice reappears on every load | Persisted dismissal in localStorage |
| 6 | `**.rs` in semantic-release push trigger | Removed; Rust changes only trigger via `workflow_run` gate |
| 7 | CORS wildcard in docker-compose | Changed to `${CORS_ORIGIN:-http://localhost:3000}` |
| 8 | Two docker-compose files without explanation | Added header comment to `docker/docker-compose.yml`; changed image name to `rustume:local` |
| 9 | `cp -R wasm` not cross-platform / fails if missing | Replaced with `node scripts/copy-wasm.js` |
