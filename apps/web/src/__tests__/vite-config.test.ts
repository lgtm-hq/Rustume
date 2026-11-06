import path from "node:path";
import { fileURLToPath } from "node:url";
import type { UserConfig } from "vite";
import { describe, expect, it } from "vitest";
import viteConfig from "../../vite.config";

// The account-export contents JSON lives under crates/, outside the Vite root.
// Vitest reads it from disk and would not notice if the dev server's
// server.fs.allow list stopped covering it, so pin the real config here.
describe("vite dev server file access", () => {
  it("allows serving the shared account_export_contents.json from crates/", () => {
    const allow = (viteConfig as UserConfig).server?.fs?.allow ?? [];
    const json = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../../crates/server/src/db/account_export_contents.json",
    );
    const covered = allow.some((dir) => {
      const rel = path.relative(dir, json);
      return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
    });
    expect(covered, `server.fs.allow (${allow.join(", ")}) must cover ${json}`).toBe(true);
  });
});
