import { createStore } from "solid-js/store";

export type ModalType = "import" | "export" | "template" | "settings" | null;

export type Panel = "editor" | "preview" | "both";

export interface UiStore {
  modal: ModalType;
  panel: Panel;
  sidebarOpen: boolean;
  sectionPanelOpen: boolean;
  previewPage: number;
  previewZoom: number;
}

const [uiState, setUiState] = createStore<UiStore>({
  modal: null,
  panel: "both",
  sidebarOpen: true,
  sectionPanelOpen: false,
  previewPage: 0,
  previewZoom: 1,
});

export function useUiStore() {
  return {
    store: uiState,

    openModal(modal: ModalType) {
      setUiState("modal", modal);
    },

    closeModal() {
      setUiState("modal", null);
    },

    setPanel(panel: Panel) {
      setUiState("panel", panel);
    },

    toggleSidebar() {
      setUiState("sidebarOpen", !uiState.sidebarOpen);
    },

    toggleSectionPanel() {
      setUiState("sectionPanelOpen", !uiState.sectionPanelOpen);
    },

    setSectionPanelOpen(open: boolean) {
      setUiState("sectionPanelOpen", open);
    },

    setPreviewPage(page: number) {
      setUiState("previewPage", page);
    },

    setPreviewZoom(zoom: number) {
      setUiState("previewZoom", Math.max(0.5, Math.min(2, zoom)));
    },

    zoomIn() {
      setUiState("previewZoom", Math.min(2, uiState.previewZoom + 0.1));
    },

    zoomOut() {
      setUiState("previewZoom", Math.max(0.5, uiState.previewZoom - 0.1));
    },
  };
}

export const uiStore = useUiStore();
