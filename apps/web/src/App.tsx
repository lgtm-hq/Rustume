import { onMount, createSignal, Show, type ParentComponent } from "solid-js";
import { AppShell } from "./components/layout/AppShell";
import { ToastRegion } from "./components/ui";
import { initWasm } from "./wasm";

const App: ParentComponent = (props) => {
  const [wasmError, setWasmError] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      await initWasm();
    } catch (e) {
      console.error("Failed to initialize WASM:", e);
      setWasmError(e instanceof Error ? e.message : "Failed to load");
      // Continue anyway - server API can still work
    }
  });

  return (
    <div class={wasmError() ? "pt-10" : ""}>
      <Show when={wasmError()}>
        <div class="fixed top-0 left-0 right-0 h-10 bg-amber-100 px-4 py-2 text-center text-sm text-amber-800 z-50">
          Some features unavailable (WASM): {wasmError()}
        </div>
      </Show>
      <AppShell>{props.children}</AppShell>
      <ToastRegion />
    </div>
  );
};

export default App;
