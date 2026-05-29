import { describe, expect, it } from "vitest";
import { templates } from "./templates";

describe("templates", () => {
  it("lists resume templates with stable ids", () => {
    expect(templates.length).toBeGreaterThan(0);
    expect(templates.every((entry) => entry.id.length > 0)).toBe(true);
    const ids = templates.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(templates.length);
  });
});
