import { test, expect } from "./support/fixtures";

/**
 * The single-surface document editor (#785): one centered sheet with an
 * Edit/Done toggle instead of a split editor/preview view, plus the one-time
 * legacy HTML→markdown migration on open (#786) and the deduplicated profile
 * rendering (#787).
 */
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
    // Double-click opens the typed field dialog (#795, owner decision
    // 2026-08-04): edit in the modal, Save commits once.
    await page.getByRole("button", { name: "Your name", exact: true }).dblclick();
    const nameDialog = page.getByRole("dialog", { name: "Edit · Name" });
    await nameDialog.getByRole("textbox", { name: "Name" }).fill("Ada Lovelace");
    await nameDialog.getByRole("button", { name: "Save" }).click();
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

  test("whole-surface drags reorder sections and explicit page breaks split the sheet", async ({
    page,
    homePage,
    docEditorPage,
  }) => {
    await homePage.open();
    await homePage.createResume();
    await docEditorPage.assertDocEditorOpen();
    await docEditorPage.assertMode("edit");

    const cards = docEditorPage.sheet.locator('[data-section-id]:not([data-section-id="basics"])');
    const idsBefore = (await cards.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute("data-section-id")),
    )) as string[];
    expect(idsBefore.length).toBeGreaterThan(2);
    const [first, second] = idsBefore;

    // Whole-surface drag (#796): grab the second card by its grip and drop it
    // on the first card — the two swap places through one layout write.
    const source = docEditorPage.sheet.locator(`[data-section-id="${second}"]`);
    const target = docEditorPage.sheet.locator(`[data-section-id="${first}"]`);
    await source.hover();
    // Pin the drop above the target's midpoint: `dropIndexFromPointer` flips
    // to insert-after past the midpoint, and dragTo's default center drop
    // would sit exactly on that boundary.
    const targetBox = await target.boundingBox();
    if (!targetBox) throw new Error("target card has no bounding box");
    await source
      .locator(".doc-sheet__sec-grip")
      .dragTo(target, { targetPosition: { x: targetBox.width / 2, y: 4 } });
    await expect
      .poll(async () =>
        cards.evaluateAll((elements) =>
          elements.map((element) => element.getAttribute("data-section-id")),
        ),
      )
      .toEqual([second, first, ...idsBefore.slice(2)]);

    // Explicit pagination: insert a page break before the now-second section
    // from its pencil menu, then remove it from the rule between the sheets.
    const sheets = docEditorPage.sheet.getByTestId("doc-sheet-page");
    await expect(sheets).toHaveCount(1);
    await target.getByRole("button", { name: / section options$/ }).click();
    await page.getByRole("menuitem", { name: /^Insert page break before .* section$/ }).click();
    await expect(sheets).toHaveCount(2);
    await expect(docEditorPage.sheet.getByTestId("doc-sheet-page-break")).toBeVisible();
    await expect(docEditorPage.sheet.getByTestId("doc-sheet-page-count")).toContainText("2");

    await page.getByRole("button", { name: "Remove page break" }).click();
    await expect(sheets).toHaveCount(1);
    await expect(docEditorPage.sheet.getByTestId("doc-sheet-page-count")).toContainText("1");
  });

  test("edge tabs drive the panels and the top bar drives theme selection", async ({
    page,
    homePage,
    docEditorPage,
  }) => {
    await homePage.open();
    await homePage.createResume();
    await docEditorPage.assertDocEditorOpen();

    // The panels are not top-bar items (owner decision 2026-08-04): their
    // buttons ride the edges of the resume surface.
    const topBar = page.getByTestId("doc-editor-topbar");
    await expect(topBar.getByRole("button", { name: "Templates" })).toHaveCount(0);
    await expect(topBar.getByRole("button", { name: "Sections" })).toHaveCount(0);

    const templatesTab = page.getByTestId("doc-editor-templates-tab");
    const sectionsTab = page.getByTestId("doc-editor-sections-tab");
    await expect(templatesTab).toBeVisible();
    await expect(sectionsTab).toBeVisible();

    // Templates: expand from the left edge, collapse with Escape.
    await templatesTab.click();
    const templatesDrawer = page.getByRole("dialog", { name: "Templates" });
    await expect(templatesDrawer).toBeVisible();
    await expect(templatesDrawer.getByTestId("templates-drawer-list")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(templatesDrawer).toBeHidden();

    // Sections: expand from the right edge, collapse with Escape.
    await sectionsTab.click();
    const sectionsDrawer = page.getByRole("dialog", { name: "Sections" });
    await expect(sectionsDrawer).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sectionsDrawer).toBeHidden();

    // Theme selection stays in the top bar (spec §1.2, owner addition):
    // picking a preset recolors the sheet through the store.
    await topBar.getByRole("button", { name: "Theme" }).click();
    const themeDialog = page.getByRole("dialog", { name: "Theme" });
    await expect(themeDialog).toBeVisible();
    await themeDialog.getByRole("button", { name: "Use Emerald theme" }).click();

    await expect(docEditorPage.sheet).toHaveCSS("--doc-sheet-accent", "#65a30d");
    await expect(themeDialog.getByRole("button", { name: "Use Emerald theme" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.keyboard.press("Escape");
    await expect(themeDialog).toBeHidden();
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

  test("narrow viewports paint a faithful miniature instead of reflowing", async ({
    page,
    homePage,
    docEditorPage,
  }) => {
    // #813: layout stays at the 860px design width; only transform scale
    // changes. Page count and a long name's wrap must match the wide render.
    await page.setViewportSize({ width: 1100, height: 900 });
    await homePage.open();
    await homePage.createResume();
    await docEditorPage.assertDocEditorOpen();
    await docEditorPage.assertMode("edit");

    await page.getByRole("button", { name: "Your name", exact: true }).dblclick();
    const nameDialog = page.getByRole("dialog", { name: "Edit · Name" });
    await nameDialog
      .getByRole("textbox", { name: "Name" })
      .fill("Ada Lovelace Countess of Lovelace Analytical Engine Pioneer");
    await nameDialog.getByRole("button", { name: "Save" }).click();

    // Insert a page break so the page-count pill has something to report.
    const firstCard = docEditorPage.sheet
      .locator('[data-section-id]:not([data-section-id="basics"])')
      .first();
    await firstCard.getByRole("button", { name: / section options$/ }).click();
    await page.getByRole("menuitem", { name: /^Insert page break before .* section$/ }).click();

    const wide = await docEditorPage.sheet.evaluate((sheet) => {
      const name = sheet.querySelector("h1, [data-testid='doc-sheet-header']");
      const nameBox = name?.getBoundingClientRect();
      return {
        layoutWidth: (sheet as HTMLElement).offsetWidth,
        pages: sheet.ownerDocument.querySelectorAll('[data-testid="doc-sheet-page"]').length,
        pill: sheet.ownerDocument.querySelector('[data-testid="doc-sheet-page-count"]')
          ?.textContent,
        nameHeight: nameBox?.height ?? 0,
        scale: sheet.closest('[data-testid="doc-sheet-scale"]')?.getAttribute("data-sheet-scale"),
      };
    });
    expect(wide.layoutWidth).toBe(860);
    expect(wide.pages).toBe(2);
    expect(wide.pill).toMatch(/2/);
    expect(Number(wide.scale)).toBeCloseTo(1, 3);

    await page.setViewportSize({ width: 400, height: 800 });
    const scaleHost = page.getByTestId("doc-sheet-scale");
    await expect(scaleHost).toHaveAttribute("data-sheet-interactive", "true");

    const narrow = await docEditorPage.sheet.evaluate((sheet) => {
      const name = sheet.querySelector("h1, [data-testid='doc-sheet-header']");
      const nameBox = name?.getBoundingClientRect();
      const scaleEl = sheet.closest('[data-testid="doc-sheet-scale"]') as HTMLElement | null;
      const viewport = scaleEl?.querySelector(
        '[data-testid="doc-sheet-scale-viewport"]',
      ) as HTMLElement | null;
      return {
        layoutWidth: (sheet as HTMLElement).offsetWidth,
        visualWidth: sheet.getBoundingClientRect().width,
        pages: sheet.ownerDocument.querySelectorAll('[data-testid="doc-sheet-page"]').length,
        pill: sheet.ownerDocument.querySelector('[data-testid="doc-sheet-page-count"]')
          ?.textContent,
        nameHeight: nameBox?.height ?? 0,
        scale: scaleEl?.getAttribute("data-sheet-scale"),
        viewportWidth: viewport?.getBoundingClientRect().width ?? 0,
        available: scaleEl?.clientWidth ?? 0,
      };
    });

    expect(narrow.layoutWidth).toBe(860);
    expect(narrow.pages).toBe(wide.pages);
    expect(narrow.pill).toBe(wide.pill);
    // Design-space name height is unchanged; the visual height scales with k.
    const k = Number(narrow.scale);
    expect(k).toBeGreaterThan(0.45);
    expect(k).toBeLessThan(1);
    expect(narrow.visualWidth).toBeCloseTo(860 * k, 0);
    expect(narrow.nameHeight).toBeCloseTo(wide.nameHeight * k, 0);
    expect(narrow.viewportWidth).toBeCloseTo(860 * k, 0);

    // Edge chrome stays outside the transform.
    await expect(page.getByTestId("doc-editor-templates-tab")).toBeVisible();
    await expect(page.getByTestId("doc-editor-topbar")).toBeVisible();
  });

  test("below the edit floor the sheet becomes a read-only miniature", async ({
    page,
    homePage,
    docEditorPage,
  }) => {
    // 860 * 0.45 = 387; a 320px canvas is under the floor.
    await page.setViewportSize({ width: 320, height: 640 });
    await homePage.open();
    await homePage.createResume();
    await docEditorPage.assertDocEditorOpen();

    const scaleHost = page.getByTestId("doc-sheet-scale");
    await expect(scaleHost).toHaveAttribute("data-sheet-interactive", "false");
    await docEditorPage.assertMode("done");
    await expect(docEditorPage.modeToggle).toBeDisabled();
    await expect(docEditorPage.sheet.getByRole("button")).toHaveCount(0);
  });
});
