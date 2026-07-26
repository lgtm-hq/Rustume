import { test } from "./support/fixtures";

const FULL_NAME = "Ada Lovelace";
/**
 * The list title is derived once, on the save that created the resume, and is
 * sticky afterwards so an explicit rename survives later edits — a resume
 * created empty therefore keeps the placeholder even after basics.name is set.
 */
const LISTED_TITLE = "Untitled Resume";

/** Sidebar tab label → section editor title, for every list section type. */
const SECTIONS = [
  { tab: "Experience", title: "Experience" },
  { tab: "Education", title: "Education" },
  { tab: "Skills", title: "Skills" },
  { tab: "Projects", title: "Projects" },
  { tab: "Profiles", title: "Profiles" },
  { tab: "Awards", title: "Awards" },
  { tab: "Certs", title: "Certifications" },
  { tab: "Pubs", title: "Publications" },
  { tab: "Langs", title: "Languages" },
  { tab: "Interests", title: "Interests" },
  { tab: "Volunteer", title: "Volunteer" },
  { tab: "Refs", title: "References" },
] as const;

test.describe("resume CRUD", () => {
  test.beforeEach(async ({ homePage, builderPage }) => {
    await homePage.open();
    await homePage.createResume();
    await builderPage.assertEditorOpen();
    // Let the initial creation auto-save settle before editing.
    await builderPage.assertSaved();
  });

  test("adds an item to every section type and persists across a reload", async ({
    page,
    builderPage,
  }) => {
    for (const section of SECTIONS) {
      await test.step(`add ${section.title} item`, async () => {
        await builderPage.openSection(section.tab);
        await builderPage.assertSectionOpen(section.title);
        await builderPage.assertSectionItemCount(0);
        await builderPage.addSectionItem();
        await builderPage.assertSectionItemCount(1);
      });
    }
    await builderPage.assertSaved();

    await page.reload();
    await builderPage.assertEditorOpen();
    for (const section of SECTIONS) {
      await test.step(`verify ${section.title} item survived reload`, async () => {
        await builderPage.openSection(section.tab);
        await builderPage.assertSectionOpen(section.title);
        await builderPage.assertSectionItemCount(1);
      });
    }
  });

  test("experience details are editable and survive a reload", async ({ page, builderPage }) => {
    await builderPage.openSection("Experience");
    await builderPage.addSectionItem();

    await builderPage.fillItemField("Position", "Chief Engineer");
    await builderPage.fillItemField("Company", "Analytical Engines Ltd");
    await builderPage.assertUnsaved();
    await builderPage.assertSaved();

    await page.reload();
    await builderPage.assertEditorOpen();
    await builderPage.openSection("Experience");
    await builderPage.expandItem("Chief Engineer");
    await builderPage.assertItemField("Position", "Chief Engineer");
    await builderPage.assertItemField("Company", "Analytical Engines Ltd");
  });

  test("removing a section item updates the count and persists", async ({ page, builderPage }) => {
    await builderPage.openSection("Skills");
    await builderPage.addSectionItem();
    await builderPage.fillItemField("Skill Name", "Typst");
    await builderPage.assertSectionItemCount(1);
    await builderPage.assertSaved();

    await builderPage.removeSectionItem();
    await builderPage.assertSectionItemCount(0);
    await builderPage.assertSaved();

    await page.reload();
    await builderPage.assertEditorOpen();
    await builderPage.openSection("Skills");
    await builderPage.assertSectionItemCount(0);
  });

  test("renames a resume from the home list", async ({ builderPage, homePage }) => {
    await builderPage.fillFullName(FULL_NAME);
    await builderPage.assertSaved();

    await builderPage.goHome();
    await homePage.assertLoaded();
    await homePage.assertResumeListed(LISTED_TITLE);

    await homePage.renameResume(LISTED_TITLE, "Dream Job 2026");
    await homePage.assertResumeListed("Dream Job 2026");
    // The placeholder title is gone from the list.
    await homePage.assertResumeNotListed(LISTED_TITLE);
  });

  test("duplicates a resume from the home list", async ({ builderPage, homePage }) => {
    await builderPage.fillFullName(FULL_NAME);
    await builderPage.assertSaved();

    await builderPage.goHome();
    await homePage.assertLoaded();
    await homePage.duplicateResume(LISTED_TITLE);
    await homePage.assertResumeCount(2);
  });

  test("delete asks for confirmation and removes the resume", async ({ builderPage, homePage }) => {
    await builderPage.goHome();
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
