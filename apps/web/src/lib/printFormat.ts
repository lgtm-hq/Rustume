export type PrintPageFormat = "a4" | "letter";

/** Sync resume page format to the document root for @page print CSS. */
export function setPrintPageFormat(format: PrintPageFormat | undefined): void {
  if (format) {
    document.documentElement.dataset.printFormat = format;
  } else {
    delete document.documentElement.dataset.printFormat;
  }
}

export function clearPrintPageFormat(): void {
  delete document.documentElement.dataset.printFormat;
}
