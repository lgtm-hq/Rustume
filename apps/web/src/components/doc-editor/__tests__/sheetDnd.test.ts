import { describe, expect, it } from "vitest";
import { dropIndexFromPointer } from "../sheetDnd";

function dragEventAt(clientY: number, rect: DOMRect): DragEvent {
  const target = document.createElement("div");
  target.getBoundingClientRect = () => rect;
  // jsdom's DragEvent often drops clientY; Mirror the section-card tests and
  // build a MouseEvent shaped as a DragEvent for the half-box reader.
  const event = new MouseEvent("dragover", {
    bubbles: true,
    cancelable: true,
    clientY,
  }) as unknown as DragEvent;
  Object.defineProperty(event, "currentTarget", { value: target });
  return event;
}

describe("dropIndexFromPointer", () => {
  const rect = {
    top: 100,
    height: 40,
    left: 0,
    width: 200,
    bottom: 140,
    right: 200,
    x: 0,
    y: 100,
    toJSON: () => ({}),
  } as DOMRect;

  it("inserts before when the pointer is in the top half", () => {
    expect(dropIndexFromPointer(dragEventAt(110, rect), 2)).toBe(2);
  });

  it("inserts after when the pointer is in the bottom half", () => {
    expect(dropIndexFromPointer(dragEventAt(130, rect), 2)).toBe(3);
  });

  it("accounts for miniature scale without changing the half-box decision", () => {
    // A scaled visual box: same midpoint test after dividing by k.
    const scaled = { ...rect, top: 50, height: 20, bottom: 70, y: 50 } as DOMRect;
    expect(dropIndexFromPointer(dragEventAt(55, scaled), 1, 0.5)).toBe(1);
    expect(dropIndexFromPointer(dragEventAt(65, scaled), 1, 0.5)).toBe(2);
  });

  it("falls back safely when scale is non-positive", () => {
    expect(dropIndexFromPointer(dragEventAt(130, rect), 0, 0)).toBe(1);
  });
});
