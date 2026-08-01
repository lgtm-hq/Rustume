import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@solidjs/testing-library";
import { emptyItemFor } from "../../../lib/docLayout";
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

    fireEvent.click(screen.getByRole("button", { name: `Add ${sectionId.replace(/s$/, "")}` }));

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

  it("carries typed values into the added item", () => {
    render(() => (
      <ItemDialog open sectionId="experience" sectionTitle="Experience" onOpenChange={() => {}} />
    ));

    fireEvent.input(screen.getByRole("textbox", { name: "Company" }), {
      target: { value: "Lumen Health" },
    });
    fireEvent.input(screen.getByRole("textbox", { name: "Summary" }), {
      target: { value: "Owned **Halo**." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add experience" }));

    expect(store.addSectionItem).toHaveBeenCalledOnce();
    const [, item] = store.addSectionItem.mock.calls[0] as [string, Record<string, unknown>];
    expect(item.company).toBe("Lumen Health");
    expect(item.summary).toBe("Owned **Halo**.");
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

    fireEvent.input(screen.getByRole("textbox", { name: "Keywords" }), {
      target: { value: "wasm, axum" },
    });
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

  it("adds a custom-section item through addCustomSectionItem", () => {
    render(() => (
      <ItemDialog open sectionId={CUSTOM_SECTION_ID} sectionTitle="Talks" onOpenChange={() => {}} />
    ));

    fireEvent.input(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Design Tokens" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add talk" }));

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

  it("keeps the separator while a keyword list is being typed", () => {
    render(() => (
      <ItemDialog
        open
        sectionId="skills"
        sectionTitle="Skills"
        index={0}
        item={{ name: "Rust", keywords: [] }}
        onOpenChange={() => {}}
      />
    ));

    // The field is controlled, so rendering the parsed list back would erase
    // the comma the moment it is typed and no second keyword could be started.
    const input = screen.getByRole("textbox", { name: "Keywords" }) as HTMLInputElement;
    fireEvent.input(input, { target: { value: "rust," } });
    expect(input.value).toBe("rust,");
    fireEvent.input(input, { target: { value: "rust, wasm" } });
    expect(input.value).toBe("rust, wasm");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    const [, , updates] = store.updateSectionItem.mock.calls[0] as [
      string,
      number,
      Record<string, unknown>,
    ];
    expect(updates.keywords).toEqual(["rust", "wasm"]);
  });

  it("is a labelled dialog", () => {
    render(() => (
      <ItemDialog open sectionId="awards" sectionTitle="Awards" onOpenChange={() => {}} />
    ));

    expect(screen.getByRole("dialog", { name: "Add award" })).toBeInTheDocument();
  });
});

describe("custom section dialog", () => {
  it("creates a section through addCustomSection", () => {
    render(() => <CustomSectionDialog open onOpenChange={() => {}} />);

    fireEvent.input(screen.getByRole("textbox", { name: "Section name" }), {
      target: { value: "Talks & Workshops" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add section" }));

    expect(store.addCustomSection).toHaveBeenCalledExactlyOnceWith("Talks & Workshops");
  });

  it("renames a section through updateCustomSection", () => {
    render(() => (
      <CustomSectionDialog open sectionId="speaking" name="Talks" onOpenChange={() => {}} />
    ));

    fireEvent.input(screen.getByRole("textbox", { name: "Section name" }), {
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
});
