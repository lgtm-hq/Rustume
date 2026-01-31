import { onMount, createSignal, Show, type ParentComponent } from "solid-js";
import { AppShell } from "./components/layout/AppShell";
import { initWasm } from "./wasm";

const App: ParentComponent = (props) => {
  const [_wasmReady, setWasmReady] = createSignal(false);
  const [wasmError, setWasmError] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      await initWasm();
      setWasmReady(true);
    } catch (e) {
      console.error("Failed to initialize WASM:", e);
      setWasmError(e instanceof Error ? e.message : "Failed to load");
      // Continue anyway - server API can still work
      setWasmReady(true);
    }
  });

  return (
    <>
      <Show when={wasmError()}>
        <div class="fixed top-0 left-0 right-0 bg-offline/10 px-4 py-2 text-center text-sm text-stone z-50">
          Offline features unavailable: {wasmError()}
        </div>
      </Show>
      <AppShell>{props.children}</AppShell>
    </>
  );
};

export default App;
