import { fetchBlob, fetchBlobWithHeaders } from "../client";
import { renderPreview, getCacheKey, getTemplateThumbnailUrl, clearPreviewCache } from "../render";
import type { ResumeData } from "../../wasm/types";

vi.mock("../client", () => ({
  fetchBlob: vi.fn(),
  fetchBlobWithHeaders: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
}));

const mockCreateObjectURL = vi.fn(() => "blob:mock-url");
const mockRevokeObjectURL = vi.fn();

const originalCreateObjectURL = globalThis.URL.createObjectURL;
const originalRevokeObjectURL = globalThis.URL.revokeObjectURL;
globalThis.URL.createObjectURL = mockCreateObjectURL;
globalThis.URL.revokeObjectURL = mockRevokeObjectURL;

function mockPreviewBlob(blob: Blob, totalPages = "1"): void {
  vi.mocked(fetchBlobWithHeaders).mockResolvedValue({
    blob,
    headers: new Headers({ "X-Total-Pages": totalPages }),
  });
}

afterAll(() => {
  globalThis.URL.createObjectURL = originalCreateObjectURL;
  globalThis.URL.revokeObjectURL = originalRevokeObjectURL;
});

const mockResume: ResumeData = {
  basics: {
    name: "",
    headline: "",
    email: "",
    phone: "",
    location: "",
    url: { label: "", href: "" },
    customFields: [],
    picture: {
      url: "",
      size: 64,
      aspectRatio: 1,
      borderRadius: 0,
      effects: {
        hidden: true,
        border: false,
        grayscale: false,
        rotation: 0,
        borderColor: "",
        borderWidth: 2,
        shadowColor: "#00000040",
        shadowSize: 0,
      },
    },
  },
  sections: {
    summary: {
      id: "summary",
      name: "Summary",
      columns: 1,
      separateLinks: false,
      visible: false,
      content: "",
    },
    experience: {
      id: "experience",
      name: "Experience",
      columns: 1,
      separateLinks: false,
      visible: false,
      items: [],
    },
    education: {
      id: "education",
      name: "Education",
      columns: 1,
      separateLinks: false,
      visible: false,
      items: [],
    },
    skills: {
      id: "skills",
      name: "Skills",
      columns: 1,
      separateLinks: false,
      visible: false,
      items: [],
    },
    projects: {
      id: "projects",
      name: "Projects",
      columns: 1,
      separateLinks: false,
      visible: false,
      items: [],
    },
    profiles: {
      id: "profiles",
      name: "Profiles",
      columns: 1,
      separateLinks: false,
      visible: false,
      items: [],
    },
    awards: {
      id: "awards",
      name: "Awards",
      columns: 1,
      separateLinks: false,
      visible: false,
      items: [],
    },
    certifications: {
      id: "certifications",
      name: "Certifications",
      columns: 1,
      separateLinks: false,
      visible: false,
      items: [],
    },
    publications: {
      id: "publications",
      name: "Publications",
      columns: 1,
      separateLinks: false,
      visible: false,
      items: [],
    },
    languages: {
      id: "languages",
      name: "Languages",
      columns: 1,
      separateLinks: false,
      visible: false,
      items: [],
    },
    interests: {
      id: "interests",
      name: "Interests",
      columns: 1,
      separateLinks: false,
      visible: false,
      items: [],
    },
    volunteer: {
      id: "volunteer",
      name: "Volunteer",
      columns: 1,
      separateLinks: false,
      visible: false,
      items: [],
    },
    references: {
      id: "references",
      name: "References",
      columns: 1,
      separateLinks: false,
      visible: false,
      items: [],
    },
    custom: {},
  },
  metadata: {
    template: "rhyhorn",
    layout: [],
    css: { value: "", visible: false },
    page: { margin: 18, format: "a4", breakLine: false, pageNumbers: false },
    theme: { background: "#ffffff", text: "#000000", primary: "#65a30d" },
    typography: {
      font: {
        family: "IBM Plex Sans",
        subset: "latin",
        variants: ["regular"],
        size: 14,
      },
      lineHeight: 1.5,
      hideIcons: false,
      underlineLinks: false,
    },
    notes: "",
    levelDisplay: "template-default",
  },
};

describe("renderPreview", () => {
  beforeEach(() => {
    vi.mocked(fetchBlob).mockReset();
    vi.mocked(fetchBlobWithHeaders).mockReset();
    mockCreateObjectURL.mockClear();
    mockRevokeObjectURL.mockClear();
    clearPreviewCache();
  });

  it("calls fetchBlobWithHeaders with correct payload", async () => {
    const mockBlob = new Blob(["png-content"], { type: "image/png" });
    mockPreviewBlob(mockBlob);

    await renderPreview(mockResume, 0);

    expect(fetchBlobWithHeaders).toHaveBeenCalledWith("/render/preview", {
      resume: mockResume,
      template: "rhyhorn",
      page: 0,
    });
  });

  it("returns object URL and total page count", async () => {
    const mockBlob = new Blob(["png-content"], { type: "image/png" });
    mockPreviewBlob(mockBlob, "3");
    mockCreateObjectURL.mockReturnValue("blob:http://localhost/abc123");

    const result = await renderPreview(mockResume, 0);

    expect(URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
    expect(result).toEqual({ url: "blob:http://localhost/abc123", totalPages: 3 });
  });

  it("falls back to one page when total page header is invalid", async () => {
    const mockBlob = new Blob(["png-content"], { type: "image/png" });
    mockPreviewBlob(mockBlob, "not-a-number");
    mockCreateObjectURL.mockReturnValue("blob:http://localhost/invalid-pages");

    const result = await renderPreview(mockResume, 0);

    expect(result).toEqual({ url: "blob:http://localhost/invalid-pages", totalPages: 1 });
  });

  it("caches result and returns cached URL on repeat call", async () => {
    const mockBlob = new Blob(["png-content"], { type: "image/png" });
    mockPreviewBlob(mockBlob, "2");
    mockCreateObjectURL.mockReturnValue("blob:cached-url");

    const result1 = await renderPreview(mockResume, 0);
    const result2 = await renderPreview(mockResume, 0);

    expect(result1).toEqual({ url: "blob:cached-url", totalPages: 2 });
    expect(result2).toEqual({ url: "blob:cached-url", totalPages: 2 });
    expect(fetchBlobWithHeaders).toHaveBeenCalledTimes(1);
  });

  it("uses provided template name instead of metadata template", async () => {
    const mockBlob = new Blob(["png-content"], { type: "image/png" });
    mockPreviewBlob(mockBlob);

    await renderPreview(mockResume, 0, "gengar");

    expect(fetchBlobWithHeaders).toHaveBeenCalledWith("/render/preview", {
      resume: mockResume,
      template: "gengar",
      page: 0,
    });
  });
});

describe("getCacheKey", () => {
  beforeEach(() => {
    vi.mocked(fetchBlob).mockReset();
    vi.mocked(fetchBlobWithHeaders).mockReset();
    mockCreateObjectURL.mockClear();
    mockRevokeObjectURL.mockClear();
    clearPreviewCache();
  });

  it("returns distinct keys for payloads that collided under the old 32-bit hash", () => {
    const resumeA = {
      ...mockResume,
      basics: { ...mockResume.basics, name: "\u3A24\u79908" },
    };
    const resumeB = {
      ...mockResume,
      basics: { ...mockResume.basics, name: "x84120" },
    };

    const keyA = getCacheKey(resumeA, "rhyhorn", 0);
    const keyB = getCacheKey(resumeB, "rhyhorn", 0);

    expect(keyA).not.toBe(keyB);
  });

  it("fetches separately for colliding legacy-hash payloads instead of reusing cache", async () => {
    const resumeA = {
      ...mockResume,
      basics: { ...mockResume.basics, name: "\u3A24\u79908" },
    };
    const resumeB = {
      ...mockResume,
      basics: { ...mockResume.basics, name: "x84120" },
    };
    const mockBlob = new Blob(["png-content"], { type: "image/png" });
    mockPreviewBlob(mockBlob, "2");
    mockCreateObjectURL.mockReturnValue("blob:cached-url");

    await renderPreview(resumeA, 0);
    await renderPreview(resumeB, 0);

    expect(fetchBlobWithHeaders).toHaveBeenCalledTimes(2);
  });
});

describe("getTemplateThumbnailUrl", () => {
  const originalEnv = import.meta.env.VITE_API_URL;

  afterEach(() => {
    import.meta.env.VITE_API_URL = originalEnv;
  });

  it("returns correct format with no VITE_API_URL", () => {
    import.meta.env.VITE_API_URL = "";

    const url = getTemplateThumbnailUrl("rhyhorn");

    expect(url).toBe("/api/templates/rhyhorn/thumbnail");
  });

  it("handles VITE_API_URL env var", () => {
    import.meta.env.VITE_API_URL = "https://api.example.com";

    const url = getTemplateThumbnailUrl("gengar");

    expect(url).toBe("https://api.example.com/api/templates/gengar/thumbnail");
  });

  it("strips trailing slashes from VITE_API_URL", () => {
    import.meta.env.VITE_API_URL = "https://api.example.com/";

    const url = getTemplateThumbnailUrl("kakuna");

    expect(url).toBe("https://api.example.com/api/templates/kakuna/thumbnail");
  });

  it("removes /api suffix from VITE_API_URL to avoid double /api", () => {
    import.meta.env.VITE_API_URL = "https://api.example.com/api";

    const url = getTemplateThumbnailUrl("pikachu");

    expect(url).toBe("https://api.example.com/api/templates/pikachu/thumbnail");
  });
});

describe("clearPreviewCache", () => {
  beforeEach(() => {
    vi.mocked(fetchBlob).mockReset();
    vi.mocked(fetchBlobWithHeaders).mockReset();
    mockCreateObjectURL.mockClear();
    mockRevokeObjectURL.mockClear();
    clearPreviewCache();
  });

  it("revokes all cached URLs", async () => {
    const mockBlob = new Blob(["png"], { type: "image/png" });
    mockPreviewBlob(mockBlob);

    mockCreateObjectURL.mockReturnValueOnce("blob:url-1");
    await renderPreview(mockResume, 0);

    mockCreateObjectURL.mockReturnValueOnce("blob:url-2");
    await renderPreview(mockResume, 1);

    mockRevokeObjectURL.mockClear();

    clearPreviewCache();

    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:url-1");
    expect(mockRevokeObjectURL).toHaveBeenCalledWith("blob:url-2");
    expect(mockRevokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it("allows fresh fetches after clearing cache", async () => {
    const mockBlob = new Blob(["png"], { type: "image/png" });
    mockPreviewBlob(mockBlob);

    await renderPreview(mockResume, 0);
    expect(fetchBlobWithHeaders).toHaveBeenCalledTimes(1);

    clearPreviewCache();

    await renderPreview(mockResume, 0);
    expect(fetchBlobWithHeaders).toHaveBeenCalledTimes(2);
  });
});
