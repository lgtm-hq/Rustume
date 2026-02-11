import { createRoot } from "solid-js";
import { useUiStore } from "../ui";

describe("useUiStore", () => {
  /**
   * Helper: reset the module-level singleton to known defaults
   * before every test so tests do not leak state into each other.
   */
  function resetStore() {
    const { closeModal, setPanel, setSectionPanelOpen, setPreviewPage, setPreviewZoom } =
      useUiStore();
    closeModal();
    setPanel("both");
    // Restore sidebarOpen to true (default)
    const { store, toggleSidebar } = useUiStore();
    if (!store.sidebarOpen) toggleSidebar();
    setSectionPanelOpen(false);
    setPreviewPage(0);
    setPreviewZoom(1);
  }

  beforeEach(() => {
    createRoot((dispose) => {
      resetStore();
      dispose();
    });
  });

  it("has correct initial state defaults", () => {
    createRoot((dispose) => {
      const { store } = useUiStore();
      expect(store.modal).toBe(null);
      expect(store.panel).toBe("both");
      expect(store.sidebarOpen).toBe(true);
      expect(store.sectionPanelOpen).toBe(false);
      expect(store.previewPage).toBe(0);
      expect(store.previewZoom).toBe(1);
      dispose();
    });
  });

  it("openModal sets modal and closeModal clears it", () => {
    createRoot((dispose) => {
      const { store, openModal, closeModal } = useUiStore();
      openModal("import");
      expect(store.modal).toBe("import");

      openModal("export");
      expect(store.modal).toBe("export");

      closeModal();
      expect(store.modal).toBe(null);
      dispose();
    });
  });

  it("setPanel changes panel", () => {
    createRoot((dispose) => {
      const { store, setPanel } = useUiStore();
      setPanel("editor");
      expect(store.panel).toBe("editor");

      setPanel("preview");
      expect(store.panel).toBe("preview");

      setPanel("both");
      expect(store.panel).toBe("both");
      dispose();
    });
  });

  it("toggleSidebar flips sidebarOpen", () => {
    createRoot((dispose) => {
      const { store, toggleSidebar } = useUiStore();
      expect(store.sidebarOpen).toBe(true);

      toggleSidebar();
      expect(store.sidebarOpen).toBe(false);

      toggleSidebar();
      expect(store.sidebarOpen).toBe(true);
      dispose();
    });
  });

  it("toggleSectionPanel flips sectionPanelOpen", () => {
    createRoot((dispose) => {
      const { store, toggleSectionPanel } = useUiStore();
      expect(store.sectionPanelOpen).toBe(false);

      toggleSectionPanel();
      expect(store.sectionPanelOpen).toBe(true);

      toggleSectionPanel();
      expect(store.sectionPanelOpen).toBe(false);
      dispose();
    });
  });

  it("setSectionPanelOpen sets explicit value", () => {
    createRoot((dispose) => {
      const { store, setSectionPanelOpen } = useUiStore();
      setSectionPanelOpen(true);
      expect(store.sectionPanelOpen).toBe(true);

      setSectionPanelOpen(false);
      expect(store.sectionPanelOpen).toBe(false);

      setSectionPanelOpen(true);
      expect(store.sectionPanelOpen).toBe(true);
      dispose();
    });
  });

  it("setPreviewPage updates page", () => {
    createRoot((dispose) => {
      const { store, setPreviewPage } = useUiStore();
      setPreviewPage(3);
      expect(store.previewPage).toBe(3);

      setPreviewPage(0);
      expect(store.previewPage).toBe(0);
      dispose();
    });
  });

  it("setPreviewZoom clamps between 0.5 and 2", () => {
    createRoot((dispose) => {
      const { store, setPreviewZoom } = useUiStore();

      setPreviewZoom(1.5);
      expect(store.previewZoom).toBe(1.5);

      // Clamp below minimum
      setPreviewZoom(0.1);
      expect(store.previewZoom).toBe(0.5);

      // Clamp above maximum
      setPreviewZoom(5);
      expect(store.previewZoom).toBe(2);

      // Exact boundaries
      setPreviewZoom(0.5);
      expect(store.previewZoom).toBe(0.5);

      setPreviewZoom(2);
      expect(store.previewZoom).toBe(2);
      dispose();
    });
  });

  it("zoomIn increments by 0.1", () => {
    createRoot((dispose) => {
      const { store, setPreviewZoom, zoomIn } = useUiStore();
      setPreviewZoom(1);

      zoomIn();
      expect(store.previewZoom).toBeCloseTo(1.1);

      zoomIn();
      expect(store.previewZoom).toBeCloseTo(1.2);
      dispose();
    });
  });

  it("zoomOut decrements by 0.1", () => {
    createRoot((dispose) => {
      const { store, setPreviewZoom, zoomOut } = useUiStore();
      setPreviewZoom(1);

      zoomOut();
      expect(store.previewZoom).toBeCloseTo(0.9);

      zoomOut();
      expect(store.previewZoom).toBeCloseTo(0.8);
      dispose();
    });
  });

  it("zoomIn does not exceed 2", () => {
    createRoot((dispose) => {
      const { store, setPreviewZoom, zoomIn } = useUiStore();
      setPreviewZoom(1.9);

      zoomIn();
      expect(store.previewZoom).toBe(2);

      // Already at max, should stay at 2
      zoomIn();
      expect(store.previewZoom).toBe(2);
      dispose();
    });
  });

  it("zoomOut does not go below 0.5", () => {
    createRoot((dispose) => {
      const { store, setPreviewZoom, zoomOut } = useUiStore();
      setPreviewZoom(0.6);

      zoomOut();
      expect(store.previewZoom).toBe(0.5);

      // Already at min, should stay at 0.5
      zoomOut();
      expect(store.previewZoom).toBe(0.5);
      dispose();
    });
  });
});
