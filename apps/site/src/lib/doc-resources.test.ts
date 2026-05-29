import { describe, expect, it } from "vitest";
import { collectDocResources, dedupeResources } from "./doc-resources";

describe("collectDocResources", () => {
  it("collects visible description and Markdown links in page order", () => {
    const resources = collectDocResources({
      description: 'Read <a href="https://typst.app/">Typst</a> templates.',
      markdown: [
        "Use [Quickstart](/docs/getting-started/quickstart/) and [Typst](https://typst.app/).",
      ],
    });

    expect(resources).toEqual([
      { label: "Typst", href: "https://typst.app/" },
      { label: "Quickstart", href: "/docs/getting-started/quickstart/" },
    ]);
  });

  it("does not treat same-page anchors as resources", () => {
    const resources = collectDocResources({
      markdown: ["Read [this section](#configuration) and [Cloud](/docs/cloud/overview/)."],
    });

    expect(resources).toEqual([{ label: "Cloud", href: "/docs/cloud/overview/" }]);
  });

  it("includes explicitly inserted content links", () => {
    const resources = collectDocResources({
      inserted: [{ label: "Hosting options", href: "/docs/pricing/plans/" }],
      markdown: ["See [Storage](/docs/cloud/storage/)."],
    });

    expect(resources).toEqual([
      { label: "Hosting options", href: "/docs/pricing/plans/" },
      { label: "Storage", href: "/docs/cloud/storage/" },
    ]);
  });

  it("filters invalid inserted resources", () => {
    const resources = collectDocResources({
      inserted: [
        { label: "Skip anchor", href: "#plans" },
        { label: "Valid", href: "/docs/pricing/plans/" },
        { label: "", href: "" },
      ],
    });

    expect(resources).toEqual([{ label: "Valid", href: "/docs/pricing/plans/" }]);
  });
});

describe("dedupeResources", () => {
  it("keeps the first label for repeated destinations", () => {
    expect(
      dedupeResources([
        { label: "Cloud overview", href: "/docs/cloud/overview/" },
        { label: "Cloud", href: "/docs/cloud/overview/" },
      ]),
    ).toEqual([{ label: "Cloud overview", href: "/docs/cloud/overview/" }]);
  });
});
