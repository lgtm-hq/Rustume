# PROTOTYPE VERDICT — can rendering move into the browser?

Throwaway spike. Delete this crate; keep the numbers.

**Question:** does `rustume-render` (Typst 0.15) compile to `wasm32-unknown-unknown`,
and what does it weigh? `bindings/wasm/Cargo.toml` excludes it with the comment
"Typst has native dependencies that don't compile to WASM".

## 1. Does it build?

**Yes.** `cargo build -p prototype-wasm-render --target wasm32-unknown-unknown --release`
finished in 3m14s with zero errors on rustc 1.96.0. The exclusion comment is out of date.

## 2. What breaks?

**Nothing.** No feature-gating was needed — the spike depends on `rustume-render`
unmodified. The suspected blockers (`fontdb`, `memmap2`, `libc`) all resolved.
`crates/render/src/typst_engine/world.rs` already gates its filesystem template
override behind `cfg(not(target_arch = "wasm32"))`, so the groundwork predates this
spike. The only wasm-build output is three dead-code warnings for the
now-unreachable native font/template loaders.

## 3. Bundle size — this is the real constraint

| build | raw | gzipped |
|---|---|---|
| `rustume-wasm` today (no render) | 3.8 MB | 1.0 MB |
| with `rustume-render` | 46.6 MB | **17.4 MB** |
| delta | +42.8 MB | **+16.4 MB** |

A ~17x increase. `wasm-opt` was not available locally, so the optimised figure is
probably 10-20% lower — call it ~14 MB gzipped. Still large: the bulk is
`typst-assets`'s embedded font payload.

## Verdict

Feasibility is **not** the blocker; payload is. Shipping this eagerly to every
visitor is not viable. It is viable if the render module is **lazy-loaded on first
export/preview** and cached, or if fonts are subset/fetched on demand rather than
embedded wholesale — neither of which this spike tested.

## Reproduce

```
cargo build -p prototype-wasm-render --target wasm32-unknown-unknown --release
ls -l target/wasm32-unknown-unknown/release/prototype_wasm_render.wasm
```
