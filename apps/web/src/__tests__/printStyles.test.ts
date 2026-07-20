import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("print styles", () => {
  const css = readFileSync(resolve(__dirname, "../index.css"), "utf8");

  it("defines print media rules that hide builder chrome", () => {
    expect(css).toContain("@media print");
    expect(css).toContain("[data-print-hide]");
    expect(css).toContain("[data-print-screen]");
    expect(css).toContain("[data-print-stack]");
  });

  it("supports A4 and letter page sizes via named @page rules", () => {
    expect(css).toContain("@page a4");
    expect(css).toContain("@page letter");
    expect(css).toContain("html[data-print-format=\"a4\"]");
    expect(css).toContain("html[data-print-format=\"letter\"]");
  });

  it("targets the resume preview paper element", () => {
    expect(css).toContain("[data-print-root]");
    expect(css).toContain("page-break-after");
  });
});
