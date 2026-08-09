/**
 * Lockstep between `bundledTemplateLayout` and Rust `get_template_layout`.
 *
 * The shared fixture is authored by the Rust suite
 * (`template_layouts_fixture_is_up_to_date` in
 * `crates/render/src/typst_engine/template_layout.rs`). Regenerate with:
 * `UPDATE_FIXTURES=1 cargo test -p rustume-render template_layouts_fixture_is_up_to_date --lib`
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { bundledTemplateLayout, type TemplateLayout } from "../docLayout";

const FIXTURE_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../../../tests/fixtures/template-layouts.json",
);

type FixtureLayouts = Record<string, TemplateLayout>;

function loadFixture(): FixtureLayouts {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as FixtureLayouts;
}

describe("bundledTemplateLayout lockstep with get_template_layout", () => {
  const fixture = loadFixture();
  const ids = Object.keys(fixture);

  it("fixture covers at least one template and the unknown-id fallback", () => {
    expect(ids.length).toBeGreaterThan(1);
    expect(fixture).toHaveProperty("not-a-template");
  });

  it.each(ids)("matches fixture for %s", (id) => {
    expect(bundledTemplateLayout(id)).toEqual(fixture[id]);
  });
});
