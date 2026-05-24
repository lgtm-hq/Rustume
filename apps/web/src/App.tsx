import { onMount, createSignal, Show, type ParentComponent } from "solid-js";
import { AppShell } from "./components/layout/AppShell";
import { CloudImportPrompt } from "./components/Auth/CloudImportPrompt";
import { Button, ToastRegion } from "./components/ui";
import { authStore } from "./stores/auth";
import { initWasm } from "./wasm";

const WASM_NOTICE_KEY = "wasmNoticeDismissed";

const App: ParentComponent = (props) => {
  const [wasmError, setWasmError] = createSignal<string | null>(null);
  const [showWasmNotice, setShowWasmNotice] = createSignal(
    localStorage.getItem(WASM_NOTICE_KEY) !== "true",
  );

  const dismissNotice = () => {
    setShowWasmNotice(false);
    localStorage.setItem(WASM_NOTICE_KEY, "true");
  };

  onMount(async () => {
    void authStore.refresh();
    try {
      await initWasm();
    } catch (e) {
      console.error("Failed to initialize WASM:", e);
      setWasmError(e instanceof Error ? e.message : "Failed to load");
    }
  });

  return (
    <div class={wasmError() && showWasmNotice() ? "pt-16" : ""}>
      <Show when={wasmError() && showWasmNotice()}>
        <div class="fixed top-0 left-0 right-0 z-50 border-b border-amber-300 bg-amber-100 px-4 py-3 text-sm text-amber-950 shadow-soft">
          <div class="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <p>
              Browser import features are using the server fallback because the WASM module did not
              load. Run <code class="font-mono">make setup</code> in development, or continue if you
              are using the hosted app.
            </p>
            <Button variant="ghost" size="sm" onClick={dismissNotice}>
              Dismiss
            </Button>
          </div>
        </div>
      </Show>
      <AppShell>{props.children}</AppShell>
      <CloudImportPrompt />
      <ToastRegion />
    </div>
  );
};

export default App;
