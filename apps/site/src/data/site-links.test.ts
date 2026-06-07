import { describe, expect, it } from "vitest";
import { docHref, docs, external, home } from "./site-links";

describe("site-links", () => {
  it("exposes internal doc paths under docs/", () => {
    expect(docs.quickstart).toMatch(/^docs\//);
    expect(docs.cloudOverview).toMatch(/^docs\//);
  });

  it("exposes non-doc internal paths like license", () => {
    expect(docs.license).toBe("license/");
  });

  it("exposes home and external link metadata", () => {
    expect(home.href).toBe("/");
    expect(external.rust.href).toMatch(/^https:\/\//);
  });

  it("joins doc paths with a normalized base slash", () => {
    expect(docHref("/Rustume", "docs/cloud/overview/")).toBe("/Rustume/docs/cloud/overview/");
    expect(docHref("/Rustume/", "/docs/cloud/overview/")).toBe("/Rustume/docs/cloud/overview/");
    expect(docHref("  /Rustume/  ", "/docs/cloud/overview/")).toBe("/Rustume/docs/cloud/overview/");
    expect(docHref("/Rustume///", "///docs/cloud/overview/")).toBe("/Rustume/docs/cloud/overview/");
    expect(docHref("/Rustume", "   ")).toBe("/Rustume/");
    expect(docHref("/Rustume", "")).toBe("/Rustume/");
    expect(docHref("Rustume", "docs/quickstart")).toBe("/Rustume/docs/quickstart");
    expect(docHref("/", "docs/cloud/overview/")).toBe("/docs/cloud/overview/");
    expect(docHref("/Rustume", "docs//cloud///overview")).toBe("/Rustume/docs/cloud/overview");
  });
});
