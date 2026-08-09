# Template visual baselines

Two baseline sets for the shared `tests/fixtures/v3/doc-editor.json` fixture,
kept side by side so a PR that touches either surface shows both diffs to the
reviewer (#831):

| Surface | Location | Gate |
| --- | --- | --- |
| **Sheet** (Playwright) | `apps/web/e2e/__screenshots__/template-sheet.visual.spec.ts/` | Web E2E / `visual` project |
| **PDF** (Typst `render_preview`) | `crates/render/tests/baselines/pdf/` | `cargo test -p rustume-render --test template_visual_baselines` |

These are **parity review** aids, not an automated sheet↔PDF pixel compare —
the two raster pipelines differ (fonts, DPI, chrome). Frozen per-template specs
(`docs/templates/`, epic #826 / #827) are the judge.

## Regenerating PDF baselines

```sh
UPDATE_VISUAL_BASELINES=1 cargo test -p rustume-render --test template_visual_baselines
git add crates/render/tests/baselines/pdf
```

Baselines are single-page PNGs at 1 px/pt (moderate DPI) to bound repo growth.
Comparison allows ±8 per channel and up to 2% differing pixels.

## Regenerating sheet baselines (CI / #812 convention)

Sheet screenshots are platform-sensitive (Chromium font rasterization). Generate
them on the Linux CI runner, never from a local macOS/Windows machine:

1. Push a branch that adds or intentionally changes sheet baselines.
2. Let **Test - Web E2E** fail on missing/updated snapshots; on failure the
   job copies `e2e/__screenshots__` into the Playwright report artifact
   (`scripts/ci/testing/web/e2e.sh`).
3. Download the report artifact, copy the new
   `test-results/__screenshots__/template-sheet.visual.spec.ts/*.png` files
   into `apps/web/e2e/__screenshots__/template-sheet.visual.spec.ts/`, and
   commit them.

Local opt-in (expect platform diffs): `E2E_VISUAL=1 bunx playwright test --project=visual`.
