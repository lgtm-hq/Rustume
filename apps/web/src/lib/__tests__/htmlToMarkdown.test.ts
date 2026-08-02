import { describe, expect, it } from "vitest";
import {
  htmlToMarkdown,
  migrateResumeContentToMarkdown,
  needsContentMigration,
} from "../htmlToMarkdown";
import { loadDocEditorFixture } from "../../test/docEditorFixture";

describe("htmlToMarkdown", () => {
  it("converts a TipTap paragraph to plain text", () => {
    expect(htmlToMarkdown("<p>Automation and platform engineer.</p>")).toBe(
      "Automation and platform engineer.",
    );
  });

  it("separates paragraphs with a blank line", () => {
    expect(htmlToMarkdown("<p>First paragraph.</p><p>Second paragraph.</p>")).toBe(
      "First paragraph.\n\nSecond paragraph.",
    );
  });

  it("keeps a <br> as a line break within its paragraph", () => {
    expect(htmlToMarkdown("<p>Line one<br>Line two</p>")).toBe("Line one\nLine two");
  });

  it.each([
    { html: "<p><strong>bold</strong></p>", markdown: "**bold**" },
    { html: "<p><b>bold</b></p>", markdown: "**bold**" },
    { html: "<p><em>italic</em></p>", markdown: "*italic*" },
    { html: "<p><i>italic</i></p>", markdown: "*italic*" },
  ])("converts $html to $markdown", ({ html, markdown }) => {
    expect(htmlToMarkdown(html)).toBe(markdown);
  });

  it("moves edge whitespace outside emphasis markers", () => {
    // `** bold **` is not valid markdown emphasis; the spaces must not be
    // swallowed into the markers.
    expect(htmlToMarkdown("<p>a<strong> bold </strong>b</p>")).toBe("a **bold** b");
  });

  it("nests emphasis inside-out", () => {
    expect(htmlToMarkdown("<p><strong><em>both</em></strong></p>")).toBe("***both***");
  });

  it("converts anchors to markdown links", () => {
    expect(htmlToMarkdown('<p>See <a href="https://example.com">the docs</a>.</p>')).toBe(
      "See [the docs](https://example.com).",
    );
  });

  it("percent-encodes characters in an href that would end the link early", () => {
    expect(htmlToMarkdown('<p><a href="https://en.example/x_(y)">wiki</a></p>')).toBe(
      "[wiki](https://en.example/x_%28y%29)",
    );
    expect(htmlToMarkdown('<p><a href="https://example.com/a b">docs</a></p>')).toBe(
      "[docs](https://example.com/a%20b)",
    );
  });

  it("keeps an anchor with no href as plain text", () => {
    expect(htmlToMarkdown("<p>See <a>the docs</a>.</p>")).toBe("See the docs.");
  });

  it("converts an unordered list to dash lines", () => {
    expect(htmlToMarkdown("<ul><li>First</li><li>Second</li></ul>")).toBe("- First\n- Second");
  });

  it("converts an ordered list to numbered lines", () => {
    expect(htmlToMarkdown("<ol><li>First</li><li>Second</li></ol>")).toBe("1. First\n2. Second");
  });

  it("converts TipTap list items that wrap their text in paragraphs", () => {
    // TipTap serializes each list item's content as a paragraph node.
    expect(htmlToMarkdown("<ul><li><p>First</p></li><li><p>Second</p></li></ul>")).toBe(
      "- First\n- Second",
    );
  });

  it("indents a nested list under its parent item", () => {
    expect(htmlToMarkdown("<ul><li><p>Parent</p><ul><li><p>Child</p></li></ul></li></ul>")).toBe(
      "- Parent\n  - Child",
    );
  });

  it("keeps inline marks inside list items", () => {
    expect(htmlToMarkdown("<ul><li><p><strong>Led</strong> the migration</p></li></ul>")).toBe(
      "- **Led** the migration",
    );
  });

  it("unwraps underline — markdown has none", () => {
    expect(htmlToMarkdown("<p><u>underlined</u></p>")).toBe("underlined");
  });

  it("unwraps unknown tags rather than dropping their text", () => {
    expect(htmlToMarkdown("<p><span>kept</span> and <code>kept too</code></p>")).toBe(
      "kept and kept too",
    );
  });

  it("normalizes &nbsp; and collapsed whitespace", () => {
    expect(htmlToMarkdown("<p>one&nbsp;two   three</p>")).toBe("one two three");
  });

  it("returns empty for an empty TipTap document", () => {
    expect(htmlToMarkdown("")).toBe("");
    expect(htmlToMarkdown("<p></p>")).toBe("");
  });

  it("passes plain text through untouched", () => {
    // A field that was never rich is already valid markdown; the conversion
    // must be a no-op so migrating twice cannot mangle anything.
    expect(htmlToMarkdown("Shipped **things** with - dashes")).toBe(
      "Shipped **things** with - dashes",
    );
  });

  it("passes plain text with literal angle brackets through untouched", () => {
    // Imported plain-text content (JSON Resume, LinkedIn) never went through
    // TipTap; stray comparisons or pseudo-tags are prose, not markup.
    expect(htmlToMarkdown("Kept latency x < y under load")).toBe("Kept latency x < y under load");
    expect(htmlToMarkdown("Worked on <redacted> systems")).toBe("Worked on <redacted> systems");
  });

  it("converts a realistic TipTap summary", () => {
    const html =
      "<p>Automation and platform engineer with <strong>eleven years</strong> of experience.</p>" +
      "<ul><li><p>Cut build times by <em>60%</em></p></li>" +
      '<li><p>Maintains <a href="https://example.com/oss">open source</a></p></li></ul>';

    expect(htmlToMarkdown(html)).toBe(
      "Automation and platform engineer with **eleven years** of experience.\n\n" +
        "- Cut build times by *60%*\n" +
        "- Maintains [open source](https://example.com/oss)",
    );
  });
});

describe("needsContentMigration", () => {
  it("treats an absent contentFormat as legacy HTML", () => {
    const resume = loadDocEditorFixture();
    delete resume.metadata.contentFormat;
    expect(needsContentMigration(resume)).toBe(true);
  });

  it("treats an explicit html marker as legacy", () => {
    const resume = loadDocEditorFixture();
    resume.metadata.contentFormat = "html";
    expect(needsContentMigration(resume)).toBe(true);
  });

  it("leaves a markdown resume alone", () => {
    const resume = loadDocEditorFixture();
    expect(resume.metadata.contentFormat).toBe("markdown");
    expect(needsContentMigration(resume)).toBe(false);
  });
});

describe("migrateResumeContentToMarkdown", () => {
  function legacyResume() {
    const resume = loadDocEditorFixture();
    delete resume.metadata.contentFormat;
    resume.sections.summary.content = "<p>Engineer with <strong>eleven years</strong>.</p>";
    resume.sections.coverLetter.content = "<p>Dear <em>team</em>,</p><p>Hello.</p>";
    resume.sections.experience.items[0].summary =
      "<ul><li><p>Led the <strong>design system</strong></p></li></ul>";
    const custom = Object.values(resume.sections.custom)[0];
    custom.items[0].summary = "<p>Spoke about <em>tokens</em>.</p>";
    return resume;
  }

  it("converts every rich field and stamps contentFormat", () => {
    const migrated = migrateResumeContentToMarkdown(legacyResume());

    expect(migrated.metadata.contentFormat).toBe("markdown");
    expect(migrated.sections.summary.content).toBe("Engineer with **eleven years**.");
    expect(migrated.sections.coverLetter.content).toBe("Dear *team*,\n\nHello.");
    expect(migrated.sections.experience.items[0].summary).toBe("- Led the **design system**");
    expect(Object.values(migrated.sections.custom)[0].items[0].summary).toBe(
      "Spoke about *tokens*.",
    );
  });

  it("does not mutate its input", () => {
    const resume = legacyResume();
    const before = JSON.stringify(resume);

    migrateResumeContentToMarkdown(resume);

    expect(JSON.stringify(resume)).toBe(before);
  });

  it("stamps contentFormat even when no field holds markup", () => {
    const resume = loadDocEditorFixture();
    delete resume.metadata.contentFormat;

    const migrated = migrateResumeContentToMarkdown(resume);

    // The stamp is the migration's termination condition: without it, a
    // resume with plain-text fields would be re-migrated on every open.
    expect(migrated.metadata.contentFormat).toBe("markdown");
    expect(needsContentMigration(migrated)).toBe(false);
  });

  it("leaves plain-text rich fields byte-identical", () => {
    const resume = loadDocEditorFixture();
    delete resume.metadata.contentFormat;
    const summary = resume.sections.summary.content;

    const migrated = migrateResumeContentToMarkdown(resume);

    expect(migrated.sections.summary.content).toBe(summary);
  });
});
