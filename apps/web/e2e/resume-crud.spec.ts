import { test, expect } from "./support/fixtures";

const FULL_NAME = "Ada Lovelace";
/**
 * The list title is derived once, on the save that created the resume, and is
 * sticky afterwards so an explicit rename survives later edits — a resume
 * created empty therefore keeps the placeholder even after basics.name is set.
 */
const LISTED_TITLE = "Untitled Resume";

/**
 * Every item-bearing section: its layout id, the singular noun its add
 * affordance and dialog carry, and the dialog field that becomes the drawn
 * item's title line.
 */
const SECTIONS = [
  { id: "experience", noun: "experience", titleField: "Company", value: "Analytical Engines" },
  { id: "education", noun: "education", titleField: "Institution", value: "London Polytechnic" },
  { id: "skills", noun: "skill", titleField: "Name", value: "Typst" },
  { id: "projects", noun: "project", titleField: "Name", value: "Difference Engine" },
  { id: "profiles", noun: "profile", titleField: "Network", value: "GitHub" },
  { id: "awards", noun: "award", titleField: "Title", value: "Royal Medal" },
  { id: "certifications", noun: "certification", titleField: "Name", value: "Chartered Engineer" },
  { id: "publications", noun: "publication", titleField: "Name", value: "Sketch of the Engine" },
  { id: "languages", noun: "language", titleField: "Name", value: "French" },
  { id: "interests", noun: "interest", titleField: "Name", value: "Mathematics" },
  { id: "volunteer", noun: "volunteer", titleField: "Organization", value: "Science Museum" },
  { id: "references", noun: "reference", titleField: "Name", value: "Charles Babbage" },
] as const;

test.describe("resume CRUD", () => {
  test.beforeEach(async ({ homePage, docEditorPage }) => {
    await homePage.open();
    await homePage.createResume();
    await docEditorPage.assertEditorOpen();
    // Let the initial creation auto-save settle before editing.
    await docEditorPage.assertSaved();
  });

  test("adds an item to every section type and persists across a reload", async ({
    page,
    docEditorPage,
  }) => {
    for (const section of SECTIONS) {
      await test.step(`add ${section.noun} item`, async () => {
        await docEditorPage.assertSectionItemCount(section.id, 0);
        await docEditorPage.addItem(section.noun, [[section.titleField, section.value]]);
        await docEditorPage.assertSectionItemCount(section.id, 1);
      });
    }
    await docEditorPage.assertSaved();

    await page.reload();
    await docEditorPage.assertEditorOpen();
    for (const section of SECTIONS) {
      await test.step(`verify ${section.noun} item survived reload`, async () => {
        await docEditorPage.assertSectionItemCount(section.id, 1);
      });
    }
  });

  test("experience details are editable and survive a reload", async ({ page, docEditorPage }) => {
    await docEditorPage.addItem("experience", [
      ["Company", "Analytical Engines Ltd"],
      ["Position", "Chief Engineer"],
    ]);

    await docEditorPage.assertSaved();

    await page.reload();
    await docEditorPage.assertEditorOpen();
    const dialog = await docEditorPage.openItemDialog("Analytical Engines Ltd");
    await expect(dialog.getByLabel("Company", { exact: true })).toHaveValue(
      "Analytical Engines Ltd",
    );
    await expect(dialog.getByLabel("Position", { exact: true })).toHaveValue("Chief Engineer");
  });

  test("removing a section item updates the sheet and persists", async ({
    page,
    docEditorPage,
  }) => {
    await docEditorPage.addItem("skill", [["Name", "Typst"]]);
    await docEditorPage.assertSectionItemCount("skills", 1);
    await docEditorPage.assertSaved();

    await docEditorPage.deleteItem("Typst");
    await docEditorPage.assertSectionItemCount("skills", 0);
    await docEditorPage.assertSaved();

    await page.reload();
    await docEditorPage.assertEditorOpen();
    await docEditorPage.assertSectionItemCount("skills", 0);
  });

  test("renames a resume from the home list", async ({ docEditorPage, homePage }) => {
    await docEditorPage.fillName(FULL_NAME);
    await docEditorPage.assertSaved();

    await docEditorPage.goHome();
    await homePage.assertLoaded();
    await homePage.assertResumeListed(LISTED_TITLE);

    await homePage.renameResume(LISTED_TITLE, "Dream Job 2026");
    await homePage.assertResumeListed("Dream Job 2026");
    // The placeholder title is gone from the list.
    await homePage.assertResumeNotListed(LISTED_TITLE);
  });

  test("duplicates a resume from the home list", async ({ docEditorPage, homePage }) => {
    await docEditorPage.fillName(FULL_NAME);
    await docEditorPage.assertSaved();

    await docEditorPage.goHome();
    await homePage.assertLoaded();
    await homePage.duplicateResume(LISTED_TITLE);
    await homePage.assertResumeCount(2);
  });

  test("delete asks for confirmation and removes the resume", async ({
    docEditorPage,
    homePage,
  }) => {
    await docEditorPage.goHome();
    await homePage.assertLoaded();
    await homePage.assertResumeListed(LISTED_TITLE);

    // Dismissing the confirmation keeps the resume.
    await homePage.deleteResume(LISTED_TITLE, false);
    await homePage.assertResumeListed(LISTED_TITLE);

    // Accepting it deletes the resume and restores the empty state.
    await homePage.deleteResume(LISTED_TITLE, true);
    await homePage.assertEmptyState();
  });
});
