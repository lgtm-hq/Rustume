/**
 * The document editor's store contract.
 *
 * Decision 4 of the doc-editor epic: every change the sheet makes goes through
 * a `resumeStore` action. A component that reaches for `setStore` — or builds
 * its own store — writes without `markDirty()` and without an undo snapshot,
 * and nothing at runtime would say so. This test is the guard.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const DOC_EDITOR_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Every source file of the document editor, tests excluded. */
function sourceFiles(): string[] {
  return readdirSync(DOC_EDITOR_DIR)
    .filter((name) => name.endsWith(".ts") || name.endsWith(".tsx"))
    .map((name) => join(DOC_EDITOR_DIR, name));
}

describe("doc-editor store contract", () => {
  it("finds the document editor's sources", () => {
    expect(sourceFiles().length).toBeGreaterThan(5);
  });

  it.each(sourceFiles())("%s never writes the store directly", (file) => {
    const source = readFileSync(file, "utf8");

    // A call, not a mention: the modules explain the rule in their own prose.
    expect(source).not.toMatch(/\bsetStore\s*\(/);
    // Quote-agnostic, and static or dynamic: neither a formatting variation
    // nor an `import()` may defeat the guard.
    expect(source).not.toMatch(/from\s+['"]solid-js\/store['"]/);
    expect(source).not.toMatch(/import\s*\(\s*['"]solid-js\/store['"]\s*\)/);
  });

  it("routes every store action through docEdits", () => {
    const offenders = sourceFiles().filter(
      (file) =>
        !file.endsWith("docEdits.ts") &&
        /(?:from|import\s*\()\s*['"]\.\.\/\.\.\/stores\/resume['"]/.test(
          readFileSync(file, "utf8"),
        ),
    );

    // One chokepoint keeps the rule above checkable by reading a single file.
    expect(offenders).toEqual([]);
  });
});
