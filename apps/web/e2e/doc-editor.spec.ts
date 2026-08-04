import { test, expect } from "./support/fixtures";

/**
 * The single-surface document editor (#785): one centered sheet with an
 * Edit/Done toggle instead of a split editor/preview view, plus the one-time
 * legacy HTML→markdown migration on open (#786) and the deduplicated profile
 * rendering (#787).
 */
test.use({ formBuilderOverride: false });

/**
 * A Reactive Resume v3 payload whose rich fields are TipTap HTML — the legacy
 * shape every pre-doc-editor resume carries (`content_format` absent).
 */
function legacyV3Resume(): Buffer {
  const emptyItems = [
    "experience",
    "education",
    "skills",
    "languages",
    "awards",
    "certifications",
    "interests",
    "projects",
    "publications",
    "volunteer",
    "references",
  ];
  const sections: Record<string, unknown> = { custom: {} };
  for (const key of emptyItems) sections[key] = { items: [] };
  sections.profiles = {
    items: [
      {
        id: "profile-1",
        visible: true,
        network: "GitHub",
        username: "lgtm-hq",
        url: { label: "", href: "https://github.com/lgtm-hq" },
      },
    ],
  };

  return Buffer.from(
    JSON.stringify({
      id: "legacy-html",
      name: "Legacy Resume",
      basics: {
        name: "Ada Lovelace",
        headline: "Automation Engineer",
        email: "ada@example.com",
        summary: {
          body: "<p>Automation and platform engineer with <strong>eleven years</strong> of experience.</p>",
          visible: true,
        },
      },
      sections,
      // `meta` is what marks the payload as Reactive Resume v3 for the
      // import's format detection.
      meta: { version: 3 },
      metadata: {},
    }),
  );
}

test.describe("single-surface document editor", () => {
  test("a new resume opens as one editable surface with no preview pane", async ({
    homePage,
    docEditorPage,
  }) => {
    await homePage.open();
    await homePage.createResume();

    await docEditorPage.assertDocEditorOpen();
    // A brand-new empty resume opens ready to type.
    await docEditorPage.assertMode("edit");
    await expect(docEditorPage.modeToggle).toHaveText("Done");
  });

  test("the Edit/Done toggle flips between the editable and rendered document", async ({
    page,
    homePage,
    docEditorPage,
  }) => {
    await homePage.open();
    await homePage.createResume();
    await docEditorPage.assertDocEditorOpen();
    await docEditorPage.assertMode("edit");

    // Put some content on the sheet so Done mode has a document to render.
    await page.getByRole("button", { name: "Your name", exact: true }).click();
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("Ada Lovelace");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Ada Lovelace" })).toBeVisible();

    await docEditorPage.toggleMode();
    await docEditorPage.assertMode("done");
    await expect(docEditorPage.modeToggle).toHaveText("Edit");

    // Done is a clean rendered document: the name is plain text, not a
    // click-to-edit button, and no editing affordances remain.
    await expect(page.getByRole("heading", { name: "Ada Lovelace" })).toBeVisible();
    await expect(docEditorPage.sheet.getByRole("button")).toHaveCount(0);
    await expect(docEditorPage.sheet.locator(".doc-sheet__editable")).toHaveCount(0);

    await docEditorPage.toggleMode();
    await docEditorPage.assertMode("edit");
    await expect(docEditorPage.sheet.getByRole("button", { name: "Ada Lovelace" })).toBeVisible();
  });

  test("opening a legacy HTML resume shows formatted text, not raw tags", async ({
    page,
    homePage,
    docEditorPage,
    importModal,
  }) => {
    await homePage.open();
    await homePage.createResume();
    await docEditorPage.assertDocEditorOpen();

    await page.getByRole("button", { name: "Import" }).click();
    await importModal.assertOpen();
    await importModal.importBuffer("legacy.json", "application/json", legacyV3Resume());
    await expect(page.getByText("Resume imported successfully")).toBeVisible();
    await importModal.assertClosed();

    const summary = docEditorPage.sheet.locator('[data-section-id="summary"]');
    await expect(summary).toContainText("eleven years");
    // The migration (#786) converted the TipTap HTML: no literal markup, and
    // the emphasis survives as real formatting.
    await expect(summary).not.toContainText("<p>");
    await expect(summary).not.toContainText("<strong>");
    await expect(summary.locator("strong")).toHaveText("eleven years");

    // Profiles render one compact row per profile (#787, #794): a brand
    // glyph plus the username once — not stacked as title, subtitle and link.
    const profiles = docEditorPage.sheet.locator('[data-section-id="profiles"]');
    await expect(profiles.getByText("lgtm-hq")).toHaveCount(1);
    await expect(profiles.locator("svg.doc-sheet__row-ico").first()).toBeVisible();
  });
});
