import sanitizeHtml from "sanitize-html";

/** Options for doc frontmatter description HTML rendered via set:html. */
export const DESCRIPTION_HTML_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["a", "code"],
  allowedAttributes: {
    a: ["href", "class", "target", "rel"],
    code: [],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
};

/** Strip unsafe markup while preserving allowed inline doc description tags. */
export function sanitizeDescriptionHtml(html: string): string {
  return sanitizeHtml(html, DESCRIPTION_HTML_OPTIONS);
}
