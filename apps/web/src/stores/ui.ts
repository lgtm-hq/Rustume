import { createStore } from "solid-js/store";

export type ModalType = "import" | "export" | "commandPalette" | "versionHistory" | null;

export interface UiStore {
  modal: ModalType;
}

const [uiState, setUiState] = createStore<UiStore>({
  modal: null,
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
  };
}

export const uiStore = useUiStore();
