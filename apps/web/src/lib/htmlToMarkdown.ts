/**
 * One-time HTML→markdown migration for legacy rich-text content (#786).
 *
 * Resumes written before the document editor store rich text as TipTap HTML
 * (`metadata.contentFormat` absent means HTML). The document editor — and
 * everything downstream of it — operates on markdown only, so the first open
 * converts every rich field once and stamps `contentFormat: "markdown"`.
 *
 * The conversion covers exactly what the form builder's TipTap editor could
 * produce: `p`, `strong`/`b`, `em`/`i`, `a`, `ul`/`ol`/`li` and line breaks.
 * Underline is unwrapped to plain text — markdown has none, and the render
 * path (`crates/utils/src/html_to_typst.rs`) has nothing to turn one into.
 * Unknown tags are unwrapped rather than dropped, so no text is ever lost.
 *
 * Text content is deliberately not markdown-escaped: escaping would pepper
 * prose with backslashes, and a legacy field that happens to contain markdown
 * punctuation already renders that punctuation verbatim today.
 *
 * Everything here is a pure value-in/value-out transform; `DocEditor` owns the
 * trigger and the store write (`resumeStore.applyContentMigration`).
 */

import type { ResumeData } from "../wasm/types";

/** Inline markers, applied innermost-out while walking the tree. */
const STRONG_TAGS = new Set(["STRONG", "B"]);
const EM_TAGS = new Set(["EM", "I"]);
const LIST_TAGS = new Set(["UL", "OL"]);

/** Indent added per nested list level, matching the mini editor's output. */
const LIST_INDENT = "  ";

function inlineText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    // Collapse the formatting whitespace serializers add; `&nbsp;` survives
    // as a plain space rather than a sticky one.
    return (node.textContent ?? "").replace(/\s+/g, " ");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const element = node as Element;
  const tag = element.tagName;
  if (tag === "BR") return "\n";

  const inner = [...element.childNodes].map(inlineText).join("");
  if (inner.trim() === "") return inner;

  if (STRONG_TAGS.has(tag)) return wrapTight(inner, "**");
  if (EM_TAGS.has(tag)) return wrapTight(inner, "*");
  if (tag === "A") {
    const href = element.getAttribute("href") ?? "";
    return href === "" ? inner : `[${inner.trim()}](${href})`;
  }
  // `u`, `span`, `code`, anything else TipTap or a paste sneaked in: keep the
  // text, drop the tag.
  return inner;
}

/**
 * Wrap `text` in `marker` without swallowing its edge whitespace —
 * `** bold **` is not valid markdown emphasis, so the spaces move outside.
 */
function wrapTight(text: string, marker: string): string {
  const leading = /^\s*/.exec(text)?.[0] ?? "";
  const trailing = /\s*$/.exec(text.slice(leading.length))?.[0] ?? "";
  const core = text.slice(leading.length, text.length - trailing.length);
  return `${leading}${marker}${core}${marker}${trailing}`;
}

/** One `ul`/`ol` as markdown lines, `depth` levels deep. */
function listToMarkdown(list: Element, depth: number): string {
  const ordered = list.tagName === "OL";
  const lines: string[] = [];
  let index = 0;

  for (const child of [...list.children]) {
    if (child.tagName !== "LI") continue;
    index += 1;
    const nested: string[] = [];
    const own: string[] = [];
    for (const node of [...child.childNodes]) {
      if (node.nodeType === Node.ELEMENT_NODE && LIST_TAGS.has((node as Element).tagName)) {
        nested.push(listToMarkdown(node as Element, depth + 1));
      } else {
        own.push(inlineText(node));
      }
    }
    const text = own.join("").replace(/\n+/g, " ").replace(/\s+/g, " ").trim();
    const marker = ordered ? `${index}. ` : "- ";
    lines.push(`${LIST_INDENT.repeat(depth)}${marker}${text}`);
    lines.push(...nested.filter((block) => block !== ""));
  }

  return lines.join("\n");
}

/**
 * Convert one TipTap HTML value to markdown.
 *
 * A value with no markup at all passes through untouched (modulo trimming) —
 * plain text is already valid markdown, and this keeps the conversion
 * idempotent for fields that were never rich.
 */
export function htmlToMarkdown(html: string): string {
  if (html.trim() === "") return "";
  if (!/[<>]/.test(html)) return html.trim();

  const document = new DOMParser().parseFromString(html, "text/html");
  const blocks: string[] = [];

  for (const node of [...document.body.childNodes]) {
    if (node.nodeType === Node.ELEMENT_NODE && LIST_TAGS.has((node as Element).tagName)) {
      const list = listToMarkdown(node as Element, 0);
      if (list !== "") blocks.push(list);
      continue;
    }
    // `p`, stray text, or any other block-ish tag: one paragraph each. `<br>`
    // stays a line break within it.
    const text = inlineText(node)
      .split("\n")
      .map((line) => line.replace(/\s+/g, " ").trim())
      .join("\n")
      .replace(/^\n+|\n+$/g, "");
    if (text !== "") blocks.push(text);
  }

  return blocks.join("\n\n");
}

/** Whether a resume still carries legacy HTML content. Absent means HTML. */
export function needsContentMigration(resume: ResumeData): boolean {
  return (resume.metadata.contentFormat ?? "html") !== "markdown";
}

/** An item shape loose enough to reach every section's `summary` field. */
interface RichItem {
  summary?: unknown;
}

function convertItems(items: RichItem[] | undefined): void {
  for (const item of items ?? []) {
    if (typeof item.summary === "string" && item.summary !== "") {
      item.summary = htmlToMarkdown(item.summary);
    }
  }
}

/**
 * The resume with every rich field converted to markdown and
 * `metadata.contentFormat` stamped.
 *
 * Returns a deep copy; the input is never mutated. The stamp is written even
 * when no field held any markup, so the migration runs at most once.
 */
export function migrateResumeContentToMarkdown(resume: ResumeData): ResumeData {
  const next = JSON.parse(JSON.stringify(resume)) as ResumeData;

  if (next.sections.summary?.content) {
    next.sections.summary.content = htmlToMarkdown(next.sections.summary.content);
  }
  if (next.sections.coverLetter?.content) {
    next.sections.coverLetter.content = htmlToMarkdown(next.sections.coverLetter.content);
  }

  // `summary` is the one rich item field — every other item field is plain
  // text in both editors (see `itemFields.ts` and the form builder's use of
  // `RichTextEditor`).
  convertItems(next.sections.experience?.items);
  convertItems(next.sections.education?.items);
  convertItems(next.sections.projects?.items);
  convertItems(next.sections.awards?.items);
  convertItems(next.sections.certifications?.items);
  convertItems(next.sections.publications?.items);
  convertItems(next.sections.volunteer?.items);
  convertItems(next.sections.references?.items);
  for (const section of Object.values(next.sections.custom ?? {})) {
    convertItems(section.items);
  }

  next.metadata.contentFormat = "markdown";
  return next;
}
