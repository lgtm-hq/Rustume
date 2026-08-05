import { createRoot } from "solid-js";
import { useUiStore } from "../ui";

describe("useUiStore", () => {
  /**
   * Reset the module-level singleton to known defaults before every test so
   * tests do not leak state into each other.
   */
  beforeEach(() => {
    createRoot((dispose) => {
      useUiStore().closeModal();
      dispose();
    });
  });

  it("has correct initial state defaults", () => {
    createRoot((dispose) => {
      const { store } = useUiStore();
      expect(store.modal).toBe(null);
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
});
