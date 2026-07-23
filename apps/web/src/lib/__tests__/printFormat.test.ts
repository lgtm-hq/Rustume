import { afterEach, describe, expect, it } from "vitest";
import { clearPrintPageFormat, setPrintPageFormat } from "../printFormat";

describe("printFormat", () => {
  afterEach(() => {
    clearPrintPageFormat();
  });

  it("sets data-print-format on the document element", () => {
    setPrintPageFormat("letter");
    expect(document.documentElement.dataset.printFormat).toBe("letter");
  });

  it("clears data-print-format", () => {
    setPrintPageFormat("a4");
    clearPrintPageFormat();
    expect(document.documentElement.dataset.printFormat).toBeUndefined();
  });
});
