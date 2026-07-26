import { describe, expect, it } from "vitest";
import { reorderAnnouncement } from "../reorderAnnounce";

describe("reorderAnnouncement", () => {
  it("formats position-based reorder messages", () => {
    expect(reorderAnnouncement("Experience", 1, 5)).toBe("Experience moved to position 2 of 5");
  });
});
