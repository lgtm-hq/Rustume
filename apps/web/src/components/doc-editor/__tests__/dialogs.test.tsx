import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { emptyItemFor } from "../../../lib/docLayout";
import { itemFieldsFor } from "../itemFields";
import { createEmptyPicture } from "../../../wasm/types";
import { CustomSectionDialog } from "../CustomSectionDialog";
import { ItemDialog } from "../ItemDialog";
import { PhotoDialog } from "../PhotoDialog";

const store = vi.hoisted(() => ({
  updateBasics: vi.fn(),
  updateSummary: vi.fn(),
  updateCoverLetter: vi.fn(),
  updateSectionName: vi.fn(),
  updateSectionItem: vi.fn(),
  addSectionItem: vi.fn(),
  updateCustomSection: vi.fn(),
  addCustomSection: vi.fn(() => "custom-1"),
  updateCustomSectionItem: vi.fn(),
  addCustomSectionItem: vi.fn(),
}));

vi.mock("../../../stores/resume", () => ({ resumeStore: store }));

vi.mock("../../../lib/imageUpload", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/imageUpload")>();
  return {
    ...actual,
    processImage: vi.fn(async () => ({ dataUrl: "data:image/webp;base64,AAA", aspectRatio: 1.5 })),
  };
});

/** Every fixed section that holds items, plus a custom section id. */
const ITEM_SECTIONS = [
  "experience",
  "education",
  "skills",
  "projects",
  "profiles",
  "awards",
  "certifications",
  "publications",
  "languages",
  "interests",
  "volunteer",
  "references",
] as const;

const CUSTOM_SECTION_ID = "speaking";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("item dialog", () => {
  it.each(ITEM_SECTIONS)("adds a correctly-shaped %s item", (sectionId) => {
    render(() => (
      <ItemDialog open sectionId={sectionId} sectionTitle={sectionId} onOpenChange={() => {}} />
    ));

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(store.addSectionItem).toHaveBeenCalledOnce();
    const [committedSection, item] = store.addSectionItem.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(committedSection).toBe(sectionId);
    // The seed is `emptyItemFor()`; the editor supplies the id it deliberately
    // leaves blank, and the item starts visible.
    expect(Object.keys(item).sort()).toEqual(
      Object.keys(emptyItemFor(sectionId) ?? {})
        .concat()
        .sort(),
    );
    expect(item.id).not.toBe("");
    expect(item.visible).toBe(true);
  });

  it("titles itself Add · <Section label> and Edit · <Section label>", () => {
    const { unmount } = render(() => (
      <ItemDialog open sectionId="awards" sectionTitle="Awards" onOpenChange={() => {}} />
    ));
    expect(screen.getByRole("dialog", { name: "Add · Awards" })).toBeInTheDocument();
    unmount();

    render(() => (
      <ItemDialog
        open
        sectionId="awards"
        sectionTitle="Awards"
        index={0}
        item={{ title: "Ship of the year" }}
        onOpenChange={() => {}}
      />
    ));
    expect(screen.getByRole("dialog", { name: "Edit · Awards" })).toBeInTheDocument();
  });

  it("carries typed values into the added item", () => {
    render(() => (
      <ItemDialog open sectionId="experience" sectionTitle="Experience" onOpenChange={() => {}} />
    ));

    fireEvent.input(screen.getByRole("textbox", { name: "Company" }), {
      target: { value: "Lumen Health" },
    });
    fireEvent.input(screen.getByRole("textbox", { name: "Highlights" }), {
      target: { value: "Owned **Halo**." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(store.addSectionItem).toHaveBeenCalledOnce();
    const [, item] = store.addSectionItem.mock.calls[0] as [string, Record<string, unknown>];
    expect(item.company).toBe("Lumen Health");
    expect(item.summary).toBe("Owned **Halo**.");
  });

  it("falls back to placeholder names for blank headline fields on save", () => {
    render(() => (
      <ItemDialog open sectionId="experience" sectionTitle="Experience" onOpenChange={() => {}} />
    ));

    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    // Spec §1.13: a blank company/position saves as "Company"/"Role" so the
    // sheet still draws a recognisable row.
    const [, item] = store.addSectionItem.mock.calls[0] as [string, Record<string, unknown>];
    expect(item.company).toBe("Company");
    expect(item.position).toBe("Role");
  });

  it("edits an existing item through one updateSectionItem call", () => {
    const item = {
      ...(emptyItemFor("skills") as unknown as Record<string, unknown>),
      id: "s1",
      name: "Rust",
    };

    render(() => (
      <ItemDialog
        open
        sectionId="skills"
        sectionTitle="Skills"
        index={2}
        item={item}
        onOpenChange={() => {}}
      />
    ));

    const tags = screen.getByRole("textbox", { name: "Tags" });
    fireEvent.input(tags, { target: { value: "wasm" } });
    fireEvent.keyDown(tags, { key: "Enter" });
    fireEvent.input(tags, { target: { value: "axum" } });
    fireEvent.keyDown(tags, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(store.addSectionItem).not.toHaveBeenCalled();
    expect(store.updateSectionItem).toHaveBeenCalledOnce();
    const [sectionId, index, updates] = store.updateSectionItem.mock.calls[0] as [
      string,
      number,
      Record<string, unknown>,
    ];
    expect([sectionId, index]).toEqual(["skills", 2]);
    expect(updates.name).toBe("Rust");
    expect(updates.keywords).toEqual(["wasm", "axum"]);
  });

  it("derives an empty profile href from network + username on save (#820)", () => {
    render(() => (
      <ItemDialog open sectionId="profiles" sectionTitle="Profiles" onOpenChange={() => {}} />
    ));

    fireEvent.input(screen.getByRole("textbox", { name: "Network" }), {
      target: { value: "GitHub" },
    });
    fireEvent.input(screen.getByRole("textbox", { name: "Username" }), {
      target: { value: "TurboCoder13" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    const [, item] = store.addSectionItem.mock.calls[0] as [string, Record<string, unknown>];
    expect((item.url as { href: string }).href).toBe("https://github.com/turbocoder13");
  });

  it("re-derives the href when a rename left it on the old username's URL (#820)", () => {
    const item = {
      ...(emptyItemFor("profiles") as unknown as Record<string, unknown>),
      id: "p1",
      network: "GitHub",
      username: "lgtm-hq",
      url: { label: "", href: "https://github.com/lgtm-hq" },
    };

    render(() => (
      <ItemDialog
        open
        sectionId="profiles"
        sectionTitle="Profiles"
        index={0}
        item={item}
        onOpenChange={() => {}}
      />
    ));

    fireEvent.input(screen.getByRole("textbox", { name: "Username" }), {
      target: { value: "TurboCoder13" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const [, , updates] = store.updateSectionItem.mock.calls[0] as [
      string,
      number,
      Record<string, unknown>,
    ];
    expect((updates.url as { href: string }).href).toBe("https://github.com/turbocoder13");
  });

  it("never overwrites a hand-written profile href (#820)", () => {
    const item = {
      ...(emptyItemFor("profiles") as unknown as Record<string, unknown>),
      id: "p1",
      network: "GitHub",
      username: "lgtm-hq",
      url: { label: "", href: "https://example.com/custom" },
    };

    render(() => (
      <ItemDialog
        open
        sectionId="profiles"
        sectionTitle="Profiles"
        index={0}
        item={item}
        onOpenChange={() => {}}
      />
    ));

    fireEvent.input(screen.getByRole("textbox", { name: "Username" }), {
      target: { value: "TurboCoder13" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const [, , updates] = store.updateSectionItem.mock.calls[0] as [
      string,
      number,
      Record<string, unknown>,
    ];
    expect((updates.url as { href: string }).href).toBe("https://example.com/custom");
  });

  it("adds a custom-section item through addCustomSectionItem", () => {
    render(() => (
      <ItemDialog open sectionId={CUSTOM_SECTION_ID} sectionTitle="Talks" onOpenChange={() => {}} />
    ));

    fireEvent.input(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Design Tokens" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(store.addCustomSectionItem).toHaveBeenCalledOnce();
    const [sectionId, item] = store.addCustomSectionItem.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(sectionId).toBe(CUSTOM_SECTION_ID);
    expect(item.name).toBe("Design Tokens");
    expect(Object.keys(item).sort()).toEqual(
      Object.keys(emptyItemFor(CUSTOM_SECTION_ID) ?? {}).sort(),
    );
  });

  it("edits a custom-section item through updateCustomSectionItem", () => {
    const item = {
      ...(emptyItemFor(CUSTOM_SECTION_ID) as unknown as Record<string, unknown>),
      id: "t1",
      name: "Talk",
    };

    render(() => (
      <ItemDialog
        open
        sectionId={CUSTOM_SECTION_ID}
        sectionTitle="Talks"
        index={1}
        item={item}
        onOpenChange={() => {}}
      />
    ));

    fireEvent.input(screen.getByRole("textbox", { name: "Date" }), {
      target: { value: "2025" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(store.updateCustomSectionItem).toHaveBeenCalledOnce();
    const [sectionId, index, updates] = store.updateCustomSectionItem.mock.calls[0] as [
      string,
      number,
      Record<string, unknown>,
    ];
    expect([sectionId, index]).toEqual([CUSTOM_SECTION_ID, 1]);
    expect(updates.date).toBe("2025");
  });

  it.each([...ITEM_SECTIONS, CUSTOM_SECTION_ID])(
    "describes every writable key of a %s item",
    (sectionId) => {
      // The shape test above seeds *from* `emptyItemFor`, so it would still
      // pass with an empty descriptor list. This is what actually ties the
      // dialog's fields to the item the store holds.
      const stored = Object.keys(emptyItemFor(sectionId) ?? {}).filter(
        (key) => key !== "id" && key !== "visible",
      );

      expect(
        itemFieldsFor(sectionId)
          .map((field) => field.key)
          .sort(),
      ).toEqual(stored.sort());
    },
  );

  describe("tag input", () => {
    function renderSkills(): HTMLElement {
      render(() => (
        <ItemDialog
          open
          sectionId="skills"
          sectionTitle="Skills"
          index={0}
          item={{ ...(emptyItemFor("skills") as object), id: "s1", name: "Rust" }}
          onOpenChange={() => {}}
        />
      ));
      return screen.getByRole("textbox", { name: "Tags" });
    }

    function savedKeywords(): unknown {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      const [, , updates] = store.updateSectionItem.mock.calls[0] as [
        string,
        number,
        Record<string, unknown>,
      ];
      return updates.keywords;
    }

    it("commits a chip on comma, stripping the separator", () => {
      const input = renderSkills();

      fireEvent.input(input, { target: { value: "wasm" } });
      fireEvent.keyDown(input, { key: "," });

      expect(savedKeywords()).toEqual(["wasm"]);
    });

    it("commits the draft on blur", () => {
      const input = renderSkills();

      fireEvent.input(input, { target: { value: "wasm" } });
      fireEvent.blur(input);

      expect(savedKeywords()).toEqual(["wasm"]);
    });

    it("splits a pasted comma list into chips", () => {
      const input = renderSkills();

      fireEvent.input(input, { target: { value: "wasm, axum , wasm" } });
      fireEvent.keyDown(input, { key: "Enter" });

      expect(savedKeywords()).toEqual(["wasm", "axum"]);
    });

    it("drops duplicates and trims whitespace", () => {
      const input = renderSkills();

      for (const raw of ["wasm ", " wasm"]) {
        fireEvent.input(input, { target: { value: raw } });
        fireEvent.keyDown(input, { key: "Enter" });
      }

      expect(savedKeywords()).toEqual(["wasm"]);
    });

    it("pops the last chip on Backspace over an empty draft", () => {
      const input = renderSkills();

      for (const tag of ["wasm", "axum"]) {
        fireEvent.input(input, { target: { value: tag } });
        fireEvent.keyDown(input, { key: "Enter" });
      }
      fireEvent.keyDown(input, { key: "Backspace" });

      expect(savedKeywords()).toEqual(["wasm"]);
    });

    it("removes a chip through its own remove button", () => {
      const input = renderSkills();

      for (const tag of ["wasm", "axum"]) {
        fireEvent.input(input, { target: { value: tag } });
        fireEvent.keyDown(input, { key: "Enter" });
      }
      fireEvent.click(screen.getByRole("button", { name: "Remove wasm" }));

      expect(savedKeywords()).toEqual(["axum"]);
    });
  });

  describe("level picker", () => {
    it("offers five number-only cards — no proficiency wording", () => {
      // Owner decision (post-§1.13): word labels only made sense for
      // languages; every levelled section shows the bare 1–5 scale.
      render(() => (
        <ItemDialog open sectionId="languages" sectionTitle="Languages" onOpenChange={() => {}} />
      ));

      const cards = screen.getAllByRole("radio");
      expect(cards).toHaveLength(5);
      expect(cards.map((card) => card.textContent)).toEqual(["1", "2", "3", "4", "5"]);
      expect(cards.map((card) => card.getAttribute("aria-label"))).toEqual([
        "Level 1 of 5",
        "Level 2 of 5",
        "Level 3 of 5",
        "Level 4 of 5",
        "Level 5 of 5",
      ]);
    });

    it("saves the picked level without touching the description", () => {
      render(() => (
        <ItemDialog open sectionId="languages" sectionTitle="Languages" onOpenChange={() => {}} />
      ));

      fireEvent.click(screen.getByRole("radio", { name: "Level 5 of 5" }));
      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      const [, item] = store.addSectionItem.mock.calls[0] as [string, Record<string, unknown>];
      expect(item.level).toBe(5);
      // Proficiency wording is gone: the description is never auto-written.
      expect(item.description ?? "").toBe("");
    });

    it("defaults an untouched add to level 3", () => {
      render(() => (
        <ItemDialog open sectionId="skills" sectionTitle="Skills" onOpenChange={() => {}} />
      ));

      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      const [, item] = store.addSectionItem.mock.calls[0] as [string, Record<string, unknown>];
      expect(item.level).toBe(3);
      expect(item.description ?? "").toBe("");
    });

    it("seeds an existing level-0 item at the default level", () => {
      // Pre-modal data can carry level 0. Seeding it at the default keeps
      // the picker's selected card consistent with what save would write.
      render(() => (
        <ItemDialog
          open
          sectionId="skills"
          sectionTitle="Skills"
          index={0}
          item={{ id: "s1", visible: true, name: "Rust", description: "", level: 0 }}
          onOpenChange={() => {}}
        />
      ));

      expect(screen.getByRole("radio", { name: "Level 3 of 5" })).toHaveAttribute(
        "aria-checked",
        "true",
      );

      fireEvent.click(screen.getByRole("button", { name: "Save" }));
      const [, , updates] = store.updateSectionItem.mock.calls[0] as [
        string,
        number,
        Record<string, unknown>,
      ];
      expect(updates.level).toBe(3);
    });

    it("never clobbers a description the user wrote themselves", () => {
      render(() => (
        <ItemDialog
          open
          sectionId="languages"
          sectionTitle="Languages"
          index={0}
          item={{
            id: "l1",
            visible: true,
            name: "French",
            description: "Business fluent",
            level: 4,
          }}
          onOpenChange={() => {}}
        />
      ));

      fireEvent.click(screen.getByRole("radio", { name: "Level 5 of 5" }));
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      const [, , updates] = store.updateSectionItem.mock.calls[0] as [
        string,
        number,
        Record<string, unknown>,
      ];
      expect(updates.level).toBe(5);
      // Owner decision: descriptions are the user's own text; the picker
      // never writes into them.
      expect(updates.description).toBe("Business fluent");
    });

    it("leaves a legacy auto-set label alone as ordinary user text", () => {
      // Earlier builds wrote proficiency words into descriptions; with the
      // wording removed, such text is simply preserved like any other.
      render(() => (
        <ItemDialog
          open
          sectionId="languages"
          sectionTitle="Languages"
          index={0}
          item={{ id: "l1", visible: true, name: "French", description: "Fluent", level: 4 }}
          onOpenChange={() => {}}
        />
      ));

      fireEvent.click(screen.getByRole("radio", { name: "Level 1 of 5" }));
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      const [, , updates] = store.updateSectionItem.mock.calls[0] as [
        string,
        number,
        Record<string, unknown>,
      ];
      expect(updates.level).toBe(1);
      expect(updates.description).toBe("Fluent");
    });
  });

  describe("custom fields", () => {
    it("adds a row and saves it with the schema's name/value shape", () => {
      render(() => (
        <ItemDialog open sectionId="experience" sectionTitle="Experience" onOpenChange={() => {}} />
      ));

      fireEvent.click(screen.getByRole("button", { name: "+ Add field" }));
      fireEvent.input(screen.getByRole("textbox", { name: "Field 1 name" }), {
        target: { value: "Stack" },
      });
      fireEvent.input(screen.getByRole("textbox", { name: "Field 1 value" }), {
        target: { value: "Rust · Solid" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      const [, item] = store.addSectionItem.mock.calls[0] as [string, Record<string, unknown>];
      const fields = item.customFields as Array<Record<string, string>>;
      expect(fields).toHaveLength(1);
      expect(fields[0].name).toBe("Stack");
      expect(fields[0].value).toBe("Rust · Solid");
      expect(fields[0].icon).toBe("");
      expect(fields[0].id).not.toBe("");
    });

    it("drops rows left entirely blank on save", () => {
      render(() => (
        <ItemDialog open sectionId="experience" sectionTitle="Experience" onOpenChange={() => {}} />
      ));

      fireEvent.click(screen.getByRole("button", { name: "+ Add field" }));
      fireEvent.click(screen.getByRole("button", { name: "Add" }));

      const [, item] = store.addSectionItem.mock.calls[0] as [string, Record<string, unknown>];
      expect(item.customFields).toEqual([]);
    });
  });
});

describe("custom section dialog", () => {
  it("creates a section through addCustomSection", () => {
    render(() => <CustomSectionDialog open onOpenChange={() => {}} />);

    fireEvent.input(screen.getByRole("textbox", { name: "Section title" }), {
      target: { value: "Talks & Workshops" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add section" }));

    expect(store.addCustomSection).toHaveBeenCalledExactlyOnceWith("Talks & Workshops");
  });

  it("renames a section through updateCustomSection", () => {
    render(() => (
      <CustomSectionDialog open sectionId="speaking" name="Talks" onOpenChange={() => {}} />
    ));

    fireEvent.input(screen.getByRole("textbox", { name: "Section title" }), {
      target: { value: "Talks & Workshops" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));

    expect(store.updateCustomSection).toHaveBeenCalledExactlyOnceWith("speaking", {
      name: "Talks & Workshops",
    });
    expect(store.addCustomSection).not.toHaveBeenCalled();
  });

  it("refuses an empty name", () => {
    render(() => <CustomSectionDialog open onOpenChange={() => {}} />);

    expect(screen.getByRole("button", { name: "Add section" })).toBeDisabled();
  });
});

describe("photo dialog", () => {
  it("patches basics.picture once, with the uploaded image", async () => {
    render(() => <PhotoDialog open picture={createEmptyPicture()} onOpenChange={() => {}} />);

    const file = new File(["binary"], "avatar.png", { type: "image/png" });
    const input = screen.getByLabelText("Choose profile photo") as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() => expect(screen.getByAltText("Profile photo")).toBeInTheDocument());

    fireEvent.input(screen.getByLabelText(/Corner radius/), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: "Save photo" }));

    expect(store.updateBasics).toHaveBeenCalledOnce();
    const [field, picture] = store.updateBasics.mock.calls[0] as [
      string,
      { url: string; aspectRatio: number; borderRadius: number; effects: { hidden: boolean } },
    ];
    expect(field).toBe("picture");
    expect(picture.url).toBe("data:image/webp;base64,AAA");
    expect(picture.aspectRatio).toBe(1.5);
    expect(picture.borderRadius).toBe(12);
    expect(picture.effects.hidden).toBe(false);
  });

  it("leaves a hidden photo hidden when it is replaced", async () => {
    const picture = createEmptyPicture();
    render(() => (
      <PhotoDialog
        open
        picture={{
          ...picture,
          url: "data:image/webp;base64,OLD",
          effects: { ...picture.effects, hidden: true },
        }}
        onOpenChange={() => {}}
      />
    ));

    const file = new File(["binary"], "avatar.png", { type: "image/png" });
    const input = screen.getByLabelText("Choose profile photo") as HTMLInputElement;
    Object.defineProperty(input, "files", { value: [file], configurable: true });
    fireEvent.change(input);

    await waitFor(() =>
      expect(screen.getByAltText("Profile photo")).toHaveAttribute(
        "src",
        "data:image/webp;base64,AAA",
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save photo" }));

    // Only a first upload reveals the photo; "Replace" must not undo the
    // user's own decision to hide it.
    const [, saved] = store.updateBasics.mock.calls[0] as [
      string,
      { effects: { hidden: boolean } },
    ];
    expect(saved.effects.hidden).toBe(true);
  });

  it("clamps the corner radius when the size shrinks", () => {
    render(() => (
      <PhotoDialog open picture={{ ...createEmptyPicture(), size: 200 }} onOpenChange={() => {}} />
    ));

    fireEvent.input(screen.getByLabelText(/Corner radius/), { target: { value: "100" } });
    fireEvent.input(screen.getByLabelText(/^Size/), { target: { value: "40" } });
    fireEvent.click(screen.getByRole("button", { name: "Save photo" }));

    const [, saved] = store.updateBasics.mock.calls[0] as [string, { borderRadius: number }];
    expect(saved.borderRadius).toBe(20);
  });

  it("writes nothing until the dialog is saved", () => {
    render(() => <PhotoDialog open picture={createEmptyPicture()} onOpenChange={() => {}} />);

    fireEvent.input(screen.getByLabelText(/^Size/), { target: { value: "96" } });

    expect(store.updateBasics).not.toHaveBeenCalled();
  });

  it("commits the initials-disc opt-in from the photo options", () => {
    render(() => <PhotoDialog open picture={createEmptyPicture()} onOpenChange={() => {}} />);

    fireEvent.click(screen.getByRole("switch", { name: "Initials disc" }));
    fireEvent.click(screen.getByRole("button", { name: "Save photo" }));

    const [, saved] = store.updateBasics.mock.calls[0] as [
      string,
      { effects: { showInitials: boolean; hidden: boolean } },
    ];
    expect(saved.effects.showInitials).toBe(true);
    expect(saved.effects.hidden).toBe(true);
  });
});
